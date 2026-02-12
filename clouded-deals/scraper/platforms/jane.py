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
from typing import Any

from playwright.async_api import Page, Frame, TimeoutError as PlaywrightTimeout

from config.dispensaries import PLATFORM_DEFAULTS
from handlers import dismiss_age_gate, get_iframe, handle_jane_view_more
from .base import BaseScraper

logger = logging.getLogger(__name__)

_JANE_CFG = PLATFORM_DEFAULTS["jane"]

# Strain types that are NOT real product names — skip to next line.
_STRAIN_ONLY = {"indica", "sativa", "hybrid", "cbd", "thc"}

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
                # Re-extract after new content loaded.
                products = await self._try_extract(target)
                logger.info(
                    "[%s] After %d 'View More' clicks → %d products",
                    self.slug, view_more_clicks, len(products),
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

                    # Pick the first line that is NOT just a strain type
                    name = "Unknown"
                    for ln in lines:
                        if ln.lower() not in _STRAIN_ONLY:
                            name = ln
                            break

                    product: dict[str, Any] = {
                        "name": name,
                        "raw_text": text_block.strip(),
                        "product_url": self.url,  # fallback: dispensary menu URL
                        "source_platform": "jane",
                    }

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
