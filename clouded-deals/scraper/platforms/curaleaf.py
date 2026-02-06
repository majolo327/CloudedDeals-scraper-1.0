"""
Scraper for Curaleaf dispensary pages.

Flow:
  1. Navigate directly to the ``/shop/nevada/`` store URL (no iframe).
  2. Dismiss the age gate (30-second post-dismiss wait).
  3. Extract product cards from the direct page.
  4. Paginate via numbered / "Next" buttons.

The new ``/shop/nevada/`` URL paths already include state selection so
the old state-dropdown step is no longer needed.

CRITICAL: Always check ``is_enabled()`` before clicking any pagination
button.  A disabled button means pagination is COMPLETE — not an error.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from playwright.async_api import TimeoutError as PlaywrightTimeout

from config.dispensaries import PLATFORM_DEFAULTS
from handlers import dismiss_age_gate, navigate_curaleaf_page
from .base import BaseScraper

logger = logging.getLogger(__name__)

_CURALEAF_CFG = PLATFORM_DEFAULTS["curaleaf"]
_POST_AGE_GATE_WAIT = _CURALEAF_CFG["wait_after_age_gate_sec"]  # 30 s

# Curaleaf product card selectors (tried in order).
_PRODUCT_SELECTORS = [
    '[data-testid*="product"]',
    '[class*="ProductCard"]',
    '[class*="product-card"]',
    "article[class*='product']",
    ".product-tile",
]


class CuraleafScraper(BaseScraper):
    """Scraper for Curaleaf direct-page dispensary menus."""

    async def scrape(self) -> list[dict[str, Any]]:
        await self.goto()

        # --- Age gate (30 s wait) ---------------------------------------
        await self.handle_age_gate(post_wait_sec=_POST_AGE_GATE_WAIT)

        # --- Paginate and collect products ------------------------------
        all_products: list[dict[str, Any]] = []
        page_num = 1

        while True:
            products = await self._extract_products()
            all_products.extend(products)
            logger.info(
                "[%s] Page %d → %d products (total %d)",
                self.slug, page_num, len(products), len(all_products),
            )

            page_num += 1
            # CRITICAL: navigate_curaleaf_page checks is_enabled() internally.
            if not await navigate_curaleaf_page(self.page, page_num):
                break

        if not all_products:
            await self.save_debug_info("zero_products")
        logger.info("[%s] Scrape complete — %d products", self.slug, len(all_products))
        return all_products

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
                    lines = [ln.strip() for ln in text_block.split("\n") if ln.strip()]

                    product: dict[str, Any] = {
                        "name": lines[0] if lines else "Unknown",
                        "raw_text": text_block.strip(),
                    }

                    for line in lines:
                        if "$" in line:
                            product["price"] = line
                            break

                    products.append(product)
                except Exception:
                    logger.debug("Failed to extract a Curaleaf product", exc_info=True)

            # Found products with this selector — no need to try others.
            break

        return products
