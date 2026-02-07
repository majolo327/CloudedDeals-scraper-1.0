"""
Scraper for Dutchie / The Dispensary NV (TD) iframe-embedded menus.

Flow (proven working):
  1. Navigate to the dispensary page with ``wait_until='load'`` so all
     scripts execute and the Dutchie embed creates the iframe.
  2. Force-remove the age gate overlay via JS (no button click needed —
     the iframe already exists behind the overlay after full page load).
  3. Locate the Dutchie iframe (``src`` contains ``dutchie``) and switch
     into it.
  4. Extract products from ``[data-testid*="product"]`` elements.
  5. Paginate via ``aria-label="go to page N"`` buttons, re-checking
     the parent page age gate after each page change (it can reappear).
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from playwright.async_api import Frame, TimeoutError as PlaywrightTimeout

from config.dispensaries import PLATFORM_DEFAULTS
from handlers import dismiss_age_gate, force_remove_age_gate, get_iframe, navigate_dutchie_page
from .base import BaseScraper

logger = logging.getLogger(__name__)

_DUTCHIE_CFG = PLATFORM_DEFAULTS["dutchie"]
_POST_AGE_GATE_WAIT = _DUTCHIE_CFG["wait_after_age_gate_sec"]  # 60 s
_BETWEEN_PAGES_SEC = _DUTCHIE_CFG["between_pages_sec"]          # 5 s
_PRODUCT_SELECTORS = [
    '[data-testid*="product"]',
    'div[class*="product"]',
]

# Age gate cookie to set if the site's own JS doesn't set one after overlay removal.
_AGE_GATE_COOKIE_JS = """
() => {
    document.cookie = 'agc=1; path=/; max-age=86400';
    document.cookie = 'age_verified=true; path=/; max-age=86400';
    document.cookie = 'ageGateConfirmed=1; path=/; max-age=86400';
}
"""


class DutchieScraper(BaseScraper):
    """Scraper for sites powered by the Dutchie embedded iframe menu."""

    async def scrape(self) -> list[dict[str, Any]]:
        # --- Navigate with wait_until='load' (scripts fully execute) ------
        await self.goto()

        # --- Remove age gate overlay + set cookies ------------------------
        # The Dutchie embed script creates the iframe during page load.
        # The age gate is just a CSS overlay on top.  Force-remove it so
        # we can interact with the iframe underneath.
        await self.page.evaluate(_AGE_GATE_COOKIE_JS)
        removed = await force_remove_age_gate(self.page)
        if removed > 0:
            logger.info("[%s] Removed %d age gate overlay(s) via JS", self.slug, removed)
        else:
            # If no overlay found via JS, try clicking the button as fallback
            await self.handle_age_gate(post_wait_sec=0)

        # Give the page a moment after overlay removal for any UI updates
        await asyncio.sleep(5)

        # --- Locate the Dutchie iframe ------------------------------------
        frame = await get_iframe(self.page)

        if frame is None:
            # Fallback: the embed script might need the age gate to be clicked
            # properly (not just removed).  Try clicking + waiting + reload.
            logger.warning("[%s] No iframe after overlay removal — trying button click + reload", self.slug)
            await self.handle_age_gate(post_wait_sec=10)
            await self.page.evaluate(_AGE_GATE_COOKIE_JS)
            await self.page.reload(wait_until="load", timeout=60_000)
            await force_remove_age_gate(self.page)
            await asyncio.sleep(5)
            frame = await get_iframe(self.page)

        if frame is None:
            logger.error("[%s] Could not find Dutchie iframe — aborting", self.slug)
            await self.save_debug_info("no_iframe")
            return []

        # Also try age gate inside the iframe itself (some sites double-gate).
        await dismiss_age_gate(frame)

        # --- Paginate and collect products --------------------------------
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

            # Re-check parent-page age gate before pagination (it can
            # reappear after scrolling / page changes on TD sites).
            await force_remove_age_gate(self.page)

            try:
                if not await navigate_dutchie_page(frame, page_num):
                    break
            except Exception as exc:
                logger.warning(
                    "[%s] Pagination to page %d failed (%s) — keeping %d products from earlier pages",
                    self.slug, page_num, exc, len(all_products),
                )
                break

        if not all_products:
            await self.save_debug_info("zero_products", frame)
        logger.info("[%s] Scrape complete — %d products", self.slug, len(all_products))
        return all_products

    # ------------------------------------------------------------------
    # Product extraction
    # ------------------------------------------------------------------

    async def _extract_products(self, frame: Frame) -> list[dict[str, Any]]:
        """Pull product data out of the current Dutchie page view."""
        products: list[dict[str, Any]] = []

        # Try each selector until one yields results
        elements = []
        for selector in _PRODUCT_SELECTORS:
            try:
                await frame.locator(selector).first.wait_for(
                    state="attached", timeout=10_000,
                )
            except PlaywrightTimeout:
                logger.debug("No products found with selector %s", selector)
                continue
            elements = await frame.locator(selector).all()
            if elements:
                logger.debug("Dutchie products matched via %r (%d)", selector, len(elements))
                break

        if not elements:
            return products

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
                    "product_url": self.url,  # fallback: dispensary menu URL
                }

                # Try to extract a product link from an <a> ancestor or child
                try:
                    href = await el.evaluate(
                        """el => {
                            const a = el.closest('a') || el.querySelector('a');
                            return a ? a.href : null;
                        }"""
                    )
                    if href:
                        product["product_url"] = href
                except Exception:
                    pass

                # Attempt to pull a price from lines containing "$".
                for line in lines:
                    if "$" in line:
                        product["price"] = line
                        break

                products.append(product)
            except Exception:
                logger.debug("Failed to extract a product element", exc_info=True)

        return products
