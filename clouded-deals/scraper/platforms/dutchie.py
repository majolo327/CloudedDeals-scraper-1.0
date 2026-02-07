"""
Scraper for Dutchie-powered dispensary menus (iframe *or* JS embed).

Flow:
  1. Navigate to the dispensary page with ``wait_until='load'``.
  2. Click the age gate button to trigger the Dutchie embed callback
     that creates the iframe (or JS-injected content).  The embed script
     only injects the menu AFTER the button-click callback fires —
     force-removing the overlay without clicking does NOT trigger it.
  3. Force-remove any lingering overlay residue so it can't intercept clicks.
  4. Detect Dutchie content: try iframe first (45 s), then fall back to
     JS embed probing (60 s) for sites like TD Gibson that inject product
     cards directly into the page DOM.
  5. Extract products from whichever target was found.
  6. Paginate via ``aria-label="go to page N"`` buttons.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Union

from playwright.async_api import Page, Frame, TimeoutError as PlaywrightTimeout

from config.dispensaries import PLATFORM_DEFAULTS
from handlers import dismiss_age_gate, force_remove_age_gate, find_dutchie_content, navigate_dutchie_page
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

        # --- Set age gate cookies -----------------------------------------
        await self.page.evaluate(_AGE_GATE_COOKIE_JS)

        # --- CLICK the age gate button FIRST ------------------------------
        # The Dutchie embed script only injects the menu iframe AFTER the
        # button-click callback fires — force-removing the overlay via JS
        # does NOT trigger it.  Click first, then clean up residue.
        clicked = await self.handle_age_gate(post_wait_sec=3)
        if clicked:
            logger.info("[%s] Age gate button clicked — waiting for Dutchie embed", self.slug)
        else:
            logger.warning("[%s] No age gate button found — embed may already be loaded", self.slug)

        # --- JS cleanup: remove any lingering overlay residue -------------
        removed = await force_remove_age_gate(self.page)
        if removed > 0:
            logger.info("[%s] Cleaned up %d lingering overlay(s) via JS", self.slug, removed)

        # --- Detect Dutchie content: iframe OR JS embed -------------------
        target, embed_type = await find_dutchie_content(
            self.page,
            iframe_timeout_ms=45_000,
            js_embed_timeout_sec=60,
        )

        if target is None:
            # Fallback: reload page and retry the full click flow once
            logger.warning("[%s] No Dutchie content after click — trying reload + re-click", self.slug)
            await self.page.evaluate(_AGE_GATE_COOKIE_JS)
            await self.page.reload(wait_until="load", timeout=60_000)
            await self.handle_age_gate(post_wait_sec=3)
            await force_remove_age_gate(self.page)
            target, embed_type = await find_dutchie_content(
                self.page,
                iframe_timeout_ms=45_000,
                js_embed_timeout_sec=60,
            )

        if target is None:
            logger.error("[%s] Could not find Dutchie content (iframe or JS embed) — aborting", self.slug)
            await self.save_debug_info("no_dutchie_content")
            return []

        logger.info("[%s] Dutchie content found via %s", self.slug, embed_type)

        # Also try age gate inside an iframe (some sites double-gate).
        if embed_type == "iframe":
            await dismiss_age_gate(target)

        # --- Paginate and collect products --------------------------------
        all_products: list[dict[str, Any]] = []
        page_num = 1

        while True:
            products = await self._extract_products(target)
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
                if not await navigate_dutchie_page(target, page_num):
                    break
            except Exception as exc:
                logger.warning(
                    "[%s] Pagination to page %d failed (%s) — keeping %d products from earlier pages",
                    self.slug, page_num, exc, len(all_products),
                )
                break

        if not all_products:
            await self.save_debug_info("zero_products", target)
        logger.info("[%s] Scrape complete — %d products (%s mode)", self.slug, len(all_products), embed_type)
        return all_products

    # ------------------------------------------------------------------
    # Product extraction
    # ------------------------------------------------------------------

    async def _extract_products(self, frame: Union[Page, Frame]) -> list[dict[str, Any]]:
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
