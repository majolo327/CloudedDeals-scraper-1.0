"""
Scraper for Curaleaf dispensary pages.

Flow:
  1. Navigate directly to the ``/shop/nevada/`` store URL.
  2. Handle the age gate — Curaleaf now **redirects** to
     ``/age-gate?returnurl=...`` instead of showing an overlay.  We must
     detect the redirect, select Nevada, and submit.
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
# sites (e.g., Zen Leaf).  Matched as first-line skip in name extraction.
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

# "by <Brand>" pattern — Zen Leaf uses "by Essence", "by (the) Essence"
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
            try:
                if not await navigate_curaleaf_page(self.page, page_num):
                    break
            except Exception as exc:
                # Gracefully stop pagination — keep products we already have.
                logger.warning(
                    "[%s] Pagination to page %d failed (%s) — keeping %d products from earlier pages",
                    self.slug, page_num, exc, len(all_products),
                )
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
                if not await navigate_curaleaf_page(self.page, page_num):
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
        We need to select Nevada and submit to get back to the shop page.
        If we're NOT on the age-gate page, fall back to the generic handler.
        """
        current_url = self.page.url

        if "/age-gate" not in current_url:
            logger.info("[%s] No age-gate redirect detected — trying generic handler", self.slug)
            await self.handle_age_gate(post_wait_sec=0)
            return

        logger.info("[%s] Detected Curaleaf age-gate redirect: %s", self.slug, current_url)

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
                    await locator.select_option(label="Nevada")
                    logger.info("[%s] Selected 'Nevada' from <select> dropdown", self.slug)
                else:
                    await locator.click()
                    await asyncio.sleep(1)
                    nv_option = self.page.locator('text="Nevada"').first
                    try:
                        await nv_option.wait_for(state="visible", timeout=3_000)
                        await nv_option.click()
                        logger.info("[%s] Clicked 'Nevada' option in dropdown", self.slug)
                    except PlaywrightTimeout:
                        nv_option = self.page.locator('text="NV"').first
                        try:
                            await nv_option.wait_for(state="visible", timeout=2_000)
                            await nv_option.click()
                            logger.info("[%s] Clicked 'NV' option in dropdown", self.slug)
                        except PlaywrightTimeout:
                            logger.debug("[%s] Could not find Nevada/NV in dropdown via %r", self.slug, selector)
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

        # Wait for redirect back to store page
        try:
            await self.page.wait_for_url("**/stores/**", timeout=15_000)
            logger.info("[%s] Redirected back to store: %s", self.slug, self.page.url)
        except PlaywrightTimeout:
            logger.warning(
                "[%s] Did not redirect back to store after age gate — current URL: %s",
                self.slug, self.page.url,
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

                    for line in lines:
                        if "$" in line:
                            product["price"] = line
                            break

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
