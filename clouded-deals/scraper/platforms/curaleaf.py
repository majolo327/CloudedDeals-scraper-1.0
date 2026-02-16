"""
Scraper for Curaleaf dispensary pages.

Flow:
  1. Navigate directly to the store URL (``/shop/{state}/`` or ``/stores/``).
  2. Handle the age gate — Curaleaf now **redirects** to
     ``/age-gate?returnurl=...`` instead of showing an overlay.  We must
     detect the redirect, select the correct state, and submit.
  3. Wait for the React SPA to render product cards.
  4. Extract product cards from the direct page.
  5. Paginate via numbered / "Next" buttons.

CRITICAL: Always check ``is_enabled()`` before clicking any pagination
button.  A disabled button means pagination is COMPLETE — not an error.
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any
from urllib.parse import urlparse

from playwright.async_api import TimeoutError as PlaywrightTimeout

from clouded_logic import CONSECUTIVE_EMPTY_MAX
from config.dispensaries import PLATFORM_DEFAULTS
from handlers import dismiss_age_gate, navigate_curaleaf_page
from handlers.pagination import _JS_DISMISS_OVERLAYS
from .base import BaseScraper

logger = logging.getLogger(__name__)

_CURALEAF_CFG = PLATFORM_DEFAULTS["curaleaf"]
# Reduced from 30s: product card detection follows this sleep and has
# its own 8s timeout, so the full 30s is unnecessary.
_POST_AGE_GATE_WAIT = 15  # seconds

# Strain types that are NOT real product names — skip to next line.
_STRAIN_ONLY = {"indica", "sativa", "hybrid", "cbd", "thc"}

# Category-only labels — also not real product names.
_CATEGORY_ONLY = {
    "flower", "vape", "edible", "concentrate", "preroll", "pre-roll",
    "cartridge", "tincture", "topical", "beverage", "accessories",
    "gear", "merch", "all products", "specials", "deals",
}

# Promotional / discount lines that appear before the product name on some
# sites.  Matched as first-line skip in name extraction.
_PROMO_LINE = re.compile(
    r"^\d+%\s*off\b"              # "40% OFF"
    r"|^B[12]G[12]\b"             # "B1G1", "B2G1"
    r"|^BOGO\b"                   # "BOGO"
    r"|^Buy\s+\d+"               # "Buy 1 Get 1 Free"
    r"|^Save\s+\$"               # "Save $5"
    r"|^(?:NEW|SALE|LIMITED)!?$"  # single-word promo labels
    r"|^Special\b"               # "Special Offer"
    r"|^Mix\s*&?\s*Match\b"      # "Mix & Match"
    r"|^(?:Staff\s+)?Pick!?$"    # "Staff Pick", "Pick"
    r"|^On\s+Sale!?$"            # "On Sale"
    r"|^Deal\s+of\s+the\b"      # "Deal of the Day"
    r"|^Free\s+\w+\b"           # "Free Delivery"
    r"|^from\s+\$"              # "from $7.35"
    r"|^(?:Rec|Med)(?:reational|ical)?$"  # "Rec", "Recreational"
    , re.IGNORECASE,
)

# "by <Brand>" pattern — e.g. "by Essence", "by (the) Essence"
_BY_BRAND = re.compile(
    r"^by\s+(?:\(?the\)?\s+)?(.+?)$",
    re.IGNORECASE,
)

# Cap pagination to avoid 240 s site timeout.  Curaleaf sites have 500–700+
# products across 12-14 pages.  15 pages × 51 products ≈ 765, which captures
# the full catalog for all known Curaleaf/Zen Leaf sites and finishes in ~230 s.
_MAX_PAGES = 15

# Curaleaf product card selectors (tried in order).
_PRODUCT_SELECTORS = [
    '[data-testid*="product"]',
    '[data-testid*="Product"]',
    '[data-testid*="Card"]',
    '[class*="ProductCard"]',
    '[class*="product-card"]',
    'a[href*="/product/"]',
    "article[class*='product']",
    ".product-tile",
    # Curaleaf uses Next.js — try common React component patterns
    'div[class*="ProductItem"]',
    'div[class*="Item_"]',
    'li[class*="product"]',
    # Broad fallback: any card-like container with a "$" price inside
    '[class*="card"]',
    'article',
]


# Map region slugs to full state names (for age gate dropdown) and abbreviations.
_REGION_TO_STATE: dict[str, tuple[str, str]] = {
    "southern-nv": ("Nevada", "NV"),
    "northern-nv": ("Nevada", "NV"),
    "nevada": ("Nevada", "NV"),
    "michigan": ("Michigan", "MI"),
    "illinois": ("Illinois", "IL"),
    "arizona": ("Arizona", "AZ"),
    "missouri": ("Missouri", "MO"),
    "new-jersey": ("New Jersey", "NJ"),
    "ohio": ("Ohio", "OH"),
    "colorado": ("Colorado", "CO"),
    "new-york": ("New York", "NY"),
    "massachusetts": ("Massachusetts", "MA"),
    "pennsylvania": ("Pennsylvania", "PA"),
}


def _infer_state(url: str, dispensary: dict[str, Any]) -> tuple[str, str]:
    """Infer state name and abbreviation for the Curaleaf age gate.

    Resolution order:
      1. URL path: ``/shop/{state}/...`` → lookup in _REGION_TO_STATE
      2. Dispensary config ``region`` field → lookup in _REGION_TO_STATE
      3. Fallback: ("Nevada", "NV") for backward compatibility
    """
    # Try extracting from /shop/{state}/ URL pattern
    match = re.search(r"/shop/([\w-]+)/", url)
    if match:
        slug = match.group(1).lower()
        if slug in _REGION_TO_STATE:
            return _REGION_TO_STATE[slug]
        # Unknown slug — replace hyphens with spaces for dropdown matching
        return slug.replace("-", " ").title(), slug.replace("-", "")[:2].upper()

    # Try the dispensary config "region" field
    region = dispensary.get("region", "").lower()
    if region in _REGION_TO_STATE:
        return _REGION_TO_STATE[region]

    # Fallback: Nevada (backward compat for NV /stores/ URLs)
    return ("Nevada", "NV")


class CuraleafScraper(BaseScraper):
    """Scraper for Curaleaf direct-page dispensary menus."""

    async def scrape(self) -> list[dict[str, Any]]:
        await self.goto()
        logger.info("[%s] After navigation, URL is: %s", self.slug, self.page.url)

        # --- Handle Curaleaf's redirect-based age gate -------------------
        await self._handle_curaleaf_age_gate()

        logger.info("[%s] After age gate, URL is: %s", self.slug, self.page.url)

        # Wait for React SPA to render products
        logger.info("[%s] Waiting %ds for product cards to render…", self.slug, _POST_AGE_GATE_WAIT)
        await asyncio.sleep(_POST_AGE_GATE_WAIT)

        # --- Dismiss overlays that block interaction --------------------
        try:
            removed = await self.page.evaluate(_JS_DISMISS_OVERLAYS)
            if removed:
                logger.info("[%s] Dismissed %d overlay(s) after age gate", self.slug, removed)
        except Exception:
            pass

        # --- Paginate and collect products ------------------------------
        all_products: list[dict[str, Any]] = []
        page_num = 1
        consecutive_empty = 0

        while page_num <= _MAX_PAGES:
            products = await self._extract_products()
            all_products.extend(products)
            logger.info(
                "[%s] Page %d → %d products (total %d)",
                self.slug, page_num, len(products), len(all_products),
            )

            # Track consecutive empty pages — bail after 3 in a row
            # instead of silently paginating through blank pages.
            if len(products) == 0:
                consecutive_empty += 1
                if consecutive_empty >= CONSECUTIVE_EMPTY_MAX:
                    logger.warning(
                        "[%s] %d consecutive empty pages — stopping pagination (total %d products)",
                        self.slug, consecutive_empty, len(all_products),
                    )
                    break
            else:
                consecutive_empty = 0

            page_num += 1
            # CRITICAL: navigate_curaleaf_page checks is_enabled() internally.
            # Retry up to 2 times with exponential backoff on failure.
            _nav_ok = False
            for _attempt in range(3):
                try:
                    _nav_ok = await navigate_curaleaf_page(self.page, page_num)
                    break  # success (or end of pages)
                except Exception as exc:
                    if _attempt < 2:
                        backoff = 2 ** (_attempt + 1)  # 2s, 4s
                        logger.warning(
                            "[%s] Pagination to page %d attempt %d failed (%s) — retrying in %ds",
                            self.slug, page_num, _attempt + 1, exc, backoff,
                        )
                        await asyncio.sleep(backoff)
                    else:
                        logger.warning(
                            "[%s] Pagination to page %d failed after 3 attempts (%s) — keeping %d products",
                            self.slug, page_num, exc, len(all_products),
                        )
            if not _nav_ok:
                break

        if page_num > _MAX_PAGES:
            logger.info("[%s] Reached max pages (%d) — stopping pagination", self.slug, _MAX_PAGES)

        # --- Fallback: if /specials returned 0 products, try the base menu ---
        if not all_products and "/specials" in self.url:
            base_url = self.url.replace("/specials", "")
            logger.warning(
                "[%s] /specials returned 0 products — retrying base menu: %s",
                self.slug, base_url,
            )
            await self.save_debug_info("zero_products_specials")
            await self.goto(base_url)
            await self._handle_curaleaf_age_gate()
            logger.info("[%s] Waiting %ds for product cards on base menu…", self.slug, _POST_AGE_GATE_WAIT)
            await asyncio.sleep(_POST_AGE_GATE_WAIT)
            page_num = 1
            while page_num <= _MAX_PAGES:
                products = await self._extract_products()
                all_products.extend(products)
                logger.info(
                    "[%s] Base menu page %d → %d products (total %d)",
                    self.slug, page_num, len(products), len(all_products),
                )
                page_num += 1
                try:
                    if not await navigate_curaleaf_page(self.page, page_num):
                        break
                except Exception as exc:
                    logger.warning(
                        "[%s] Base menu pagination to page %d failed (%s) — keeping %d products",
                        self.slug, page_num, exc, len(all_products),
                    )
                    break

        if not all_products:
            await self.save_debug_info("zero_products")
        logger.info("[%s] Scrape complete — %d products", self.slug, len(all_products))
        return all_products

    # ------------------------------------------------------------------
    # Age gate — redirect-based
    # ------------------------------------------------------------------

    async def _handle_curaleaf_age_gate(self) -> None:
        """Handle Curaleaf's redirect-based age gate.

        Curaleaf redirects ``/shop/...`` to ``/age-gate?returnurl=...``.
        We need to select the correct state and submit to get back to the
        shop page.  The state is inferred from the URL path or dispensary
        config — no hardcoded state.

        For non-curaleaf.com domains (e.g. Zen Leaf), falls back to the
        generic overlay-based age gate handler.
        """
        current_url = self.page.url
        parsed = urlparse(current_url)

        # Zen Leaf and other non-curaleaf.com domains don't use the
        # redirect-based age gate — they use standard overlays.
        if "curaleaf.com" not in parsed.netloc:
            logger.info(
                "[%s] Non-curaleaf.com domain (%s) — using generic age gate handler",
                self.slug, parsed.netloc,
            )
            await self.handle_age_gate(post_wait_sec=0)
            return

        if "/age-gate" not in current_url:
            logger.info("[%s] No age-gate redirect detected — trying generic handler", self.slug)
            await self.handle_age_gate(post_wait_sec=0)
            return

        logger.info("[%s] Detected Curaleaf age-gate redirect: %s", self.slug, current_url)

        # Infer the correct state from URL or dispensary config
        state_name, state_abbr = _infer_state(self.url, self.dispensary)
        logger.info("[%s] Age gate state: %s (%s)", self.slug, state_name, state_abbr)

        # Step 1: Select state from dropdown
        state_selectors = [
            'select',                           # standard <select>
            '[data-testid*="state"]',
            '[class*="state"]',
            '[class*="select"]',
            '[aria-label*="state"]',
            '[role="combobox"]',
        ]

        for selector in state_selectors:
            try:
                locator = self.page.locator(selector).first
                await locator.wait_for(state="visible", timeout=5_000)
                tag = await locator.evaluate("el => el.tagName.toLowerCase()")
                if tag == "select":
                    await locator.select_option(label=state_name)
                    logger.info("[%s] Selected '%s' from <select> dropdown", self.slug, state_name)
                else:
                    await locator.click()
                    await asyncio.sleep(1)
                    state_option = self.page.locator(f'text="{state_name}"').first
                    try:
                        await state_option.wait_for(state="visible", timeout=3_000)
                        await state_option.click()
                        logger.info("[%s] Clicked '%s' option in dropdown", self.slug, state_name)
                    except PlaywrightTimeout:
                        state_option = self.page.locator(f'text="{state_abbr}"').first
                        try:
                            await state_option.wait_for(state="visible", timeout=2_000)
                            await state_option.click()
                            logger.info("[%s] Clicked '%s' option in dropdown", self.slug, state_abbr)
                        except PlaywrightTimeout:
                            logger.debug("[%s] Could not find %s/%s in dropdown via %r", self.slug, state_name, state_abbr, selector)
                            continue
                break
            except PlaywrightTimeout:
                continue
            except Exception:
                logger.debug("[%s] State selector %r failed", self.slug, selector, exc_info=True)
                continue

        # Step 2: Wait for page to update after state selection
        # The page transitions from state picker to age confirmation
        logger.info("[%s] Waiting 3s for page to update after state selection…", self.slug)
        await asyncio.sleep(3)

        # Step 3: Click the "I'm over 21" button (or similar)
        submit_selectors = [
            "button:has-text(\"I'm over 21\")",
            'button:has-text("over 21")',
            'button:has-text("21 or older")',
            'button:has-text("I am 21")',
            'button:has-text("Enter")',
            'button:has-text("Submit")',
            'button:has-text("Confirm")',
            'button:has-text("Yes")',
            'button[type="submit"]',
            'a:has-text("over 21")',
            'a:has-text("Enter")',
        ]

        for selector in submit_selectors:
            try:
                locator = self.page.locator(selector).first
                await locator.wait_for(state="visible", timeout=5_000)
                await locator.click()
                logger.info("[%s] Clicked age gate submit via %r", self.slug, selector)
                break
            except PlaywrightTimeout:
                continue

        # Wait for redirect back to store page.
        # Curaleaf uses multiple URL patterns:
        #   /stores/  (NV, AZ)
        #   /shop/    (MI, IL)
        #   /dispensary/ (legacy format, some AZ/MI stores)
        # Check which pattern matches the original URL and wait for that.
        if "/shop/" in self.url:
            redirect_pattern = "**/shop/**"
        elif "/dispensary/" in self.url:
            redirect_pattern = "**/dispensary/**"
        else:
            redirect_pattern = "**/stores/**"
        try:
            await self.page.wait_for_url(redirect_pattern, timeout=15_000)
            logger.info("[%s] Redirected back to store: %s", self.slug, self.page.url)
        except PlaywrightTimeout:
            logger.warning(
                "[%s] Did not redirect back to store after age gate (expected %s) — current URL: %s",
                self.slug, redirect_pattern, self.page.url,
            )
            await self.save_debug_info("age_gate_stuck")

        # Dismiss cookie consent banner (OneTrust) immediately so it
        # doesn't block product extraction or pagination clicks.
        try:
            removed = await self.page.evaluate(_JS_DISMISS_OVERLAYS)
            if removed:
                logger.info("[%s] Dismissed %d overlay(s) after age gate redirect", self.slug, removed)
        except Exception:
            pass

    # ------------------------------------------------------------------
    # Product extraction
    # ------------------------------------------------------------------

    async def _extract_products(self) -> list[dict[str, Any]]:
        """Extract product cards from the current Curaleaf page."""
        products: list[dict[str, Any]] = []

        for selector in _PRODUCT_SELECTORS:
            try:
                await self.page.locator(selector).first.wait_for(
                    state="attached", timeout=8_000,
                )
            except PlaywrightTimeout:
                continue

            elements = await self.page.locator(selector).all()
            if not elements:
                continue

            for el in elements:
                try:
                    text_block = await el.inner_text()

                    # Skip elements that don't contain a price — not a product card
                    if "$" not in text_block:
                        continue

                    lines = [ln.strip() for ln in text_block.split("\n") if ln.strip()]

                    # Pick the first line that is a real product name.
                    # Skip strain types, category labels, promo text, "by Brand",
                    # "$X off" patterns, and price lines.
                    name = "Unknown"
                    scraped_brand = ""
                    for ln in lines:
                        low = ln.lower().strip()
                        # Known non-name lines
                        if low in _STRAIN_ONLY or low in _CATEGORY_ONLY:
                            continue
                        if re.match(r"^\$\d+\.?\d*\s*off\b", ln, re.IGNORECASE):
                            continue
                        if _PROMO_LINE.match(ln):
                            continue
                        # "by <Brand>" line — capture brand, keep looking for name
                        by_m = _BY_BRAND.match(ln)
                        if by_m:
                            scraped_brand = by_m.group(1).strip()
                            continue
                        # Compound type labels: "Hybrid Flower", "Indica | Flower | 1g"
                        if re.match(
                            r"^(?:Indica|Sativa|Hybrid)"
                            r"(?:\s*[|/]\s*|\s+)"
                            r"(?:Flower|Vape|Edible|Concentrate|Preroll|Pre-Roll)",
                            ln, re.IGNORECASE,
                        ):
                            continue
                        # Pure price lines
                        if re.match(r"^\$[\d.]+$", ln):
                            continue
                        # THC/CBD content lines: "THC: 29.37%"
                        if re.match(r"^(?:THC|CBD|CBN)\s*:", ln, re.IGNORECASE):
                            continue
                        name = ln
                        break

                    # If no "by Brand" was found yet, scan remaining lines
                    if not scraped_brand:
                        for ln in lines:
                            by_m = _BY_BRAND.match(ln.strip())
                            if by_m:
                                scraped_brand = by_m.group(1).strip()
                                break

                    product: dict[str, Any] = {
                        "name": name,
                        "raw_text": text_block.strip(),
                        "product_url": self.url,  # fallback: dispensary menu URL
                    }
                    if scraped_brand:
                        product["scraped_brand"] = scraped_brand

                    # Extract product link from element or ancestor <a>
                    try:
                        href = await el.evaluate(
                            """el => {
                                if (el.tagName === 'A') return el.href;
                                const a = el.closest('a') || el.querySelector('a');
                                return a ? a.href : null;
                            }"""
                        )
                        if href:
                            product["product_url"] = href
                    except Exception:
                        pass

                    # Collect ALL price-containing lines so the parser
                    # can see both original and sale prices when Curaleaf
                    # renders them on separate lines (e.g. "$50.00\n$30.00").
                    price_lines = [line for line in lines if "$" in line]
                    if price_lines:
                        product["price"] = " ".join(price_lines)

                    products.append(product)
                except Exception:
                    logger.debug("Failed to extract a Curaleaf product", exc_info=True)

            if products:
                logger.info(
                    "[%s] Products matched via selector %r (%d found)",
                    self.slug, selector, len(products),
                )
                break

        return products
