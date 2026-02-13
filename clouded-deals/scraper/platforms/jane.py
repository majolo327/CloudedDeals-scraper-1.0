"""
Scraper for Jane-powered dispensary menus.

Jane sites are **hybrid**: some render products directly on the page,
others embed them inside an iframe (often from ``iheartjane.com``).

Flow:
  1. Navigate to the dispensary URL.
  2. Dismiss any age gate.
  3. Try direct-page product selectors first.
  4. If nothing is found on the main page, look for a Jane iframe and
     switch into it.
  5. Use the "View More" button to progressively load all products
     (max 10 clicks).
"""

from __future__ import annotations

import logging
import re
from typing import Any

from playwright.async_api import Page, Frame, TimeoutError as PlaywrightTimeout

from config.dispensaries import PLATFORM_DEFAULTS
from handlers import dismiss_age_gate, get_iframe, handle_jane_view_more
from .base import BaseScraper

logger = logging.getLogger(__name__)

_JANE_CFG = PLATFORM_DEFAULTS["jane"]

# Strain types that are NOT real product names — skip to next line.
_STRAIN_ONLY = {"indica", "sativa", "hybrid", "cbd", "thc"}

# Category-only labels — not real product names (shared with curaleaf).
_CATEGORY_ONLY = {
    "flower", "vape", "edible", "concentrate", "preroll", "pre-roll",
    "cartridge", "tincture", "topical", "beverage", "accessories",
    "gear", "merch", "all products", "specials", "deals",
}

# Promotional / discount lines that appear before the product name.
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
    r"|^Free\s+\w+\b"           # "Free Delivery"
    r"|^from\s+\$"              # "from $7.35"
    , re.IGNORECASE,
)

# "by <Brand>" pattern — e.g. "by Essence", "by (the) Essence"
_BY_BRAND = re.compile(
    r"^by\s+(?:\(?the\)?\s+)?(.+?)$",
    re.IGNORECASE,
)

# JS snippet to extract brand from a dedicated child element inside
# a product card.  Runs as a single evaluate() call for efficiency.
_JS_EXTRACT_BRAND = """el => {
    const selectors = [
        '[class*="brand" i]', '[class*="Brand"]',
        '[data-testid*="brand"]',
        '[class*="manufacturer" i]', '[class*="Manufacturer"]',
        '[class*="producer" i]',
    ];
    for (const sel of selectors) {
        const found = el.querySelector(sel);
        if (found) {
            const t = found.textContent.trim();
            if (t && t.length >= 2 && t.length < 60) return t;
        }
    }
    return null;
}"""

# Multiple selector strategies — Jane sites are inconsistent.
# The first entry is a known Jane-specific class pattern from the PRD.
_PRODUCT_SELECTORS = [
    '._flex_80y9c_1[style*="--box-height: 100%"]',
    '[data-testid="product-card"]',
    '._box_qnw0i_1',
    'div[class*="product-card"]',
    'div[class*="menu-item"]',
    'div[class*="product-list-item"]',
    '.product-card',
    '.menu-item',
    '[data-testid*="product"]',
    '[class*="ProductCard"]',
    '[class*="product-card"]',
    '[class*="menu-product"]',
    '[class*="MenuItem"]',
    "article[class*='product']",
    ".product-tile",
    # Broader fallbacks for non-standard Jane embeds (TOL, etc.)
    'li[class*="product"]',
    '[class*="product-row"]',
    '[class*="menu-product-card"]',
    '[class*="store-product"]',
    '[class*="catalog-item"]',
]

# Jane iframe selectors (supplements the generic ones in handlers/iframe.py).
_JANE_IFRAME_SELECTORS = [
    'iframe[src*="iheartjane.com"]',
    'iframe[src*="jane"]',
    'iframe[src*="menu"]',
]


class JaneScraper(BaseScraper):
    """Scraper for Jane hybrid iframe / direct-page menus."""

    async def scrape(self) -> list[dict[str, Any]]:
        await self.goto()
        await self.handle_age_gate(
            post_wait_sec=_JANE_CFG["wait_after_age_gate_sec"],
        )

        # --- Strategy 1: direct page -----------------------------------
        target: Page | Frame = self.page
        products = await self._try_extract(target)

        if products:
            logger.info("[%s] Found %d products on direct page", self.slug, len(products))
        else:
            # --- Strategy 2: fall back to iframe ------------------------
            logger.info("[%s] No products on direct page — trying iframe", self.slug)
            frame = await self._find_jane_iframe()

            if frame is not None:
                await dismiss_age_gate(frame)
                target = frame
                products = await self._try_extract(target)
                logger.info(
                    "[%s] Found %d products inside iframe", self.slug, len(products),
                )
            else:
                logger.warning("[%s] No iframe found either — 0 products", self.slug)
                await self.save_debug_info("no_products_no_iframe")
                return []

        # --- Progressive loading via "View More" -----------------------
        try:
            view_more_clicks = await handle_jane_view_more(target)
            if view_more_clicks > 0:
                # Jane's "View More" appends products to the DOM, so
                # re-extracting should return everything.  Keep the
                # pre-click list as a safety net in case re-extraction
                # returns fewer products (selector mismatch, timing, etc.).
                pre_click_products = products
                products = await self._try_extract(target)
                if len(products) < len(pre_click_products):
                    logger.warning(
                        "[%s] Post-View-More extraction returned fewer products "
                        "(%d vs %d pre-click) — keeping pre-click set",
                        self.slug, len(products), len(pre_click_products),
                    )
                    products = pre_click_products
                else:
                    logger.info(
                        "[%s] After %d 'View More' clicks → %d products (was %d)",
                        self.slug, view_more_clicks, len(products),
                        len(pre_click_products),
                    )
        except Exception as exc:
            logger.warning(
                "[%s] 'View More' loading failed (%s) — keeping %d products already collected",
                self.slug, exc, len(products),
            )

        logger.info("[%s] Scrape complete — %d products", self.slug, len(products))
        return products

    # ------------------------------------------------------------------
    # Iframe detection
    # ------------------------------------------------------------------

    async def _find_jane_iframe(self) -> Frame | None:
        """Try Jane-specific iframe selectors, then fall back to generic."""
        for selector in _JANE_IFRAME_SELECTORS:
            try:
                locator = self.page.locator(selector).first
                await locator.wait_for(state="attached", timeout=10_000)
                element = await locator.element_handle()
                if element is None:
                    continue
                frame = await element.content_frame()
                if frame is not None:
                    await frame.wait_for_load_state("domcontentloaded", timeout=15_000)
                    logger.info(
                        "[%s] Jane iframe found via %r — %s",
                        self.slug, selector, frame.url,
                    )
                    return frame
            except PlaywrightTimeout:
                continue

        # Last resort: use the generic handler from handlers/iframe.py.
        return await get_iframe(self.page)

    # ------------------------------------------------------------------
    # Product extraction — tries every known selector
    # ------------------------------------------------------------------

    async def _try_extract(self, target: Page | Frame) -> list[dict[str, Any]]:
        """Try each product selector against *target* and return the first
        set of results that yields products."""
        for selector in _PRODUCT_SELECTORS:
            try:
                await target.locator(selector).first.wait_for(
                    state="attached", timeout=5_000,
                )
            except PlaywrightTimeout:
                continue

            elements = await target.locator(selector).all()
            if not elements:
                continue

            products: list[dict[str, Any]] = []
            for el in elements:
                try:
                    text_block = await el.inner_text()
                    lines = [ln.strip() for ln in text_block.split("\n") if ln.strip()]

                    # --- Brand extraction from dedicated DOM element ----------
                    scraped_brand = ""
                    try:
                        dom_brand = await el.evaluate(_JS_EXTRACT_BRAND)
                        if dom_brand:
                            low_brand = dom_brand.lower().strip()
                            if low_brand not in _STRAIN_ONLY and low_brand not in _CATEGORY_ONLY:
                                scraped_brand = dom_brand.strip()
                    except Exception:
                        pass

                    # --- Name extraction (skip promo/category/brand lines) ----
                    # Collect up to two valid text lines.  Jane cards often
                    # render brand on line 1 and product name on line 2.
                    valid_lines: list[str] = []
                    for ln in lines:
                        low = ln.lower().strip()
                        if low in _STRAIN_ONLY or low in _CATEGORY_ONLY:
                            continue
                        if re.match(r"^\$\d+\.?\d*\s*off\b", ln, re.IGNORECASE):
                            continue
                        if _PROMO_LINE.match(ln):
                            continue
                        by_m = _BY_BRAND.match(ln)
                        if by_m:
                            if not scraped_brand:
                                scraped_brand = by_m.group(1).strip()
                            continue
                        if re.match(
                            r"^(?:Indica|Sativa|Hybrid)"
                            r"(?:\s*[|/]\s*|\s+)"
                            r"(?:Flower|Vape|Edible|Concentrate|Preroll|Pre-Roll)",
                            ln, re.IGNORECASE,
                        ):
                            continue
                        if re.match(r"^\$[\d.]+$", ln):
                            continue
                        if re.match(r"^(?:THC|CBD|CBN)\s*:", ln, re.IGNORECASE):
                            continue
                        if scraped_brand and low == scraped_brand.lower():
                            continue
                        valid_lines.append(ln)
                        if len(valid_lines) >= 2:
                            break

                    # Decide name vs brand from the valid text lines.
                    # If no DOM brand was found and we have 2+ valid lines,
                    # the first short line (≤3 words, no digits) is likely
                    # the brand label, and the second is the product name.
                    name = "Unknown"
                    if valid_lines:
                        first = valid_lines[0]
                        if (
                            not scraped_brand
                            and len(valid_lines) >= 2
                            and len(first.split()) <= 3
                            and not re.search(r"\d", first)
                        ):
                            scraped_brand = first
                            name = valid_lines[1]
                        else:
                            name = first

                    product: dict[str, Any] = {
                        "name": name,
                        "raw_text": text_block.strip(),
                        "product_url": self.url,  # fallback: dispensary menu URL
                        "source_platform": "jane",
                    }
                    if scraped_brand:
                        product["scraped_brand"] = scraped_brand

                    # Try to extract a product link from an <a> ancestor or child
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
                    logger.debug("Failed to extract a Jane product", exc_info=True)

            if products:
                logger.debug(
                    "Selector %r yielded %d products", selector, len(products),
                )
                return products

        return []
