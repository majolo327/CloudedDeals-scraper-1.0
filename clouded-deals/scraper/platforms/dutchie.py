"""
Scraper for Dutchie / The Dispensary NV (TD) iframe-embedded menus.

Flow:
  1. Navigate to the dispensary page.
  2. Dismiss the age gate (with a **45-second** post-dismiss wait so the
     Dutchie iframe has time to fully load behind the overlay).
  3. Locate the Dutchie iframe and switch into it.
  4. Extract products from ``[data-testid*="product"]`` elements.
  5. Paginate via ``aria-label="go to page N"`` buttons, collecting
     products from each page until pagination is exhausted.
"""

from __future__ import annotations

import logging
from typing import Any

from playwright.async_api import Frame, TimeoutError as PlaywrightTimeout

from config.dispensaries import PLATFORM_DEFAULTS
from handlers import dismiss_age_gate, get_iframe, navigate_dutchie_page
from .base import BaseScraper

logger = logging.getLogger(__name__)

_DUTCHIE_CFG = PLATFORM_DEFAULTS["dutchie"]
_POST_AGE_GATE_WAIT = _DUTCHIE_CFG["wait_after_age_gate_sec"]  # 45 s
_PRODUCT_SELECTOR = '[data-testid*="product"]'


class DutchieScraper(BaseScraper):
    """Scraper for sites powered by the Dutchie embedded iframe menu."""

    async def scrape(self) -> list[dict[str, Any]]:
        await self.goto()

        # --- Age gate (45 s wait for iframe to load behind it) ----------
        await self.handle_age_gate(post_wait_sec=_POST_AGE_GATE_WAIT)

        # --- Locate the Dutchie iframe ----------------------------------
        frame = await get_iframe(self.page)

        # If no iframe found, try a page reload — some TD sites need a
        # second page load before the Dutchie embed appears.
        if frame is None:
            logger.warning("[%s] No iframe on first try — reloading page", self.slug)
            await self.page.reload(wait_until="domcontentloaded")
            await self.handle_age_gate(post_wait_sec=_POST_AGE_GATE_WAIT)
            frame = await get_iframe(self.page)

        if frame is None:
            logger.error("[%s] Could not find Dutchie iframe — aborting", self.slug)
            return []

        # Also try age gate inside the iframe itself (some sites double-gate).
        await dismiss_age_gate(frame)

        # --- Paginate and collect products ------------------------------
        all_products: list[dict[str, Any]] = []
        page_num = 1

        while True:
            products = await self._extract_products(frame)
            all_products.extend(products)
            logger.info(
                "[%s] Page %d → %d products (total %d)",
                self.slug, page_num, len(products), len(all_products),
            )

            page_num += 1
            if not await navigate_dutchie_page(frame, page_num):
                break

        logger.info("[%s] Scrape complete — %d products", self.slug, len(all_products))
        return all_products

    # ------------------------------------------------------------------
    # Product extraction
    # ------------------------------------------------------------------

    @staticmethod
    async def _extract_products(frame: Frame) -> list[dict[str, Any]]:
        """Pull product data out of the current Dutchie page view."""
        products: list[dict[str, Any]] = []

        try:
            await frame.locator(_PRODUCT_SELECTOR).first.wait_for(
                state="attached", timeout=10_000,
            )
        except PlaywrightTimeout:
            logger.debug("No products found with selector %s", _PRODUCT_SELECTOR)
            return products

        elements = await frame.locator(_PRODUCT_SELECTOR).all()

        for el in elements:
            try:
                name = await el.get_attribute("aria-label") or (
                    await el.inner_text()
                ).split("\n")[0].strip()

                text_block = await el.inner_text()
                lines = [ln.strip() for ln in text_block.split("\n") if ln.strip()]

                product: dict[str, Any] = {
                    "name": name,
                    "raw_text": text_block.strip(),
                }

                # Attempt to pull a price from lines containing "$".
                for line in lines:
                    if "$" in line:
                        product["price"] = line
                        break

                products.append(product)
            except Exception:
                logger.debug("Failed to extract a product element", exc_info=True)

        return products
