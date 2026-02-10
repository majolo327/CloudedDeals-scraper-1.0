"""
Scraper for Rise (GTI) dispensary menus.

Rise is a proprietary Next.js SPA operated by Green Thumb Industries.
All Nevada locations share the same codebase served from
``cdn-bong.risecannabis.com``.

Flow:
  1. Navigate directly to the pickup-menu / recreational-menu URL.
  2. Dismiss the age gate ("Yes" button).
  3. Wait for the React SPA to hydrate and render product cards.
  4. Extract products — Rise loads ALL products in a single render
     (~700-730 per location), so no pagination is needed.
  5. Optionally scroll to trigger any lazy-loaded cards.

Key selectors (confirmed via recon Feb 2026):
  - ``[data-testid*='product']`` → ~220 elements (primary card containers)
  - ``[class*='product-card']`` → ~720 elements (includes sub-elements)

The ``data-testid`` selector is preferred because it targets the actual
card wrapper, not inner elements like image/body/footer sub-divs.
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

from playwright.async_api import TimeoutError as PlaywrightTimeout

from config.dispensaries import PLATFORM_DEFAULTS
from handlers import dismiss_age_gate
from .base import BaseScraper

logger = logging.getLogger(__name__)

_RISE_CFG = PLATFORM_DEFAULTS.get("rise", {})
_POST_AGE_GATE_WAIT = _RISE_CFG.get("wait_after_age_gate_sec", 15)

# Strain types that are NOT real product names — skip to next line.
_STRAIN_ONLY = {"indica", "sativa", "hybrid", "cbd", "thc"}

# Rise product card selectors (tried in order).
# data-testid is the cleanest selector — it targets the card wrapper
# and avoids matching inner sub-elements that share 'product-card' classes.
_PRODUCT_SELECTORS = [
    '[data-testid*="product"]',
    '[class*="product-card"]',
    '[class*="ProductCard"]',
    '[class*="product-tile"]',
    '[class*="menu-product"]',
    'article[class*="product"]',
    # Broad fallbacks
    'div[class*="product"]',
    '[class*="card"]',
]

# Junk patterns to strip from raw_text before sending to CloudedLogic
_JUNK_PATTERNS = re.compile(
    r"(Add to (cart|bag|order)|Remove|View details|Out of stock|"
    r"Sale!|New!|Limited|Sold out|In stock|Pickup|Delivery|"
    r"\bQty\b.*$|\bQuantity\b.*$)",
    re.IGNORECASE | re.MULTILINE,
)

# JS to scroll the page and trigger any lazy-loaded content.
# Rise loads ~720 products eagerly, but this is a safety net.
_JS_SCROLL_TO_BOTTOM = """
async () => {
    const delay = ms => new Promise(r => setTimeout(r, ms));
    const maxScrolls = 10;
    let lastHeight = 0;
    for (let i = 0; i < maxScrolls; i++) {
        window.scrollTo(0, document.body.scrollHeight);
        await delay(500);
        const newHeight = document.body.scrollHeight;
        if (newHeight === lastHeight) break;
        lastHeight = newHeight;
    }
    window.scrollTo(0, 0);
}
"""


class RiseScraper(BaseScraper):
    """Scraper for Rise (GTI) direct-page dispensary menus."""

    async def scrape(self) -> list[dict[str, Any]]:
        await self.goto()
        logger.info("[%s] After navigation, URL is: %s", self.slug, self.page.url)

        # --- Dismiss age gate ---
        dismissed = await self.handle_age_gate(
            post_wait_sec=_POST_AGE_GATE_WAIT,
        )
        if dismissed:
            logger.info("[%s] Age gate dismissed, waited %ds", self.slug, _POST_AGE_GATE_WAIT)
        else:
            # Even without a visible age gate, wait for SPA hydration
            logger.info("[%s] No age gate — waiting %ds for SPA hydration", self.slug, _POST_AGE_GATE_WAIT)
            await asyncio.sleep(_POST_AGE_GATE_WAIT)

        # --- Scroll to trigger any lazy-loaded cards ---
        try:
            await self.page.evaluate(_JS_SCROLL_TO_BOTTOM)
            await asyncio.sleep(2)
        except Exception:
            pass

        # --- Extract products ---
        products = await self._extract_products()

        if not products:
            await self.save_debug_info("zero_products")
            logger.warning("[%s] No products found — see debug artifacts", self.slug)

        logger.info("[%s] Scrape complete — %d products", self.slug, len(products))
        return products

    # ------------------------------------------------------------------
    # Product extraction
    # ------------------------------------------------------------------

    async def _extract_products(self) -> list[dict[str, Any]]:
        """Extract product cards from the Rise page.

        Tries selectors in order, uses the first one that yields results.
        Each card's ``inner_text()`` is captured as ``raw_text`` for
        downstream parsing by CloudedLogic.
        """
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

            logger.info(
                "[%s] Trying selector %r — %d elements found",
                self.slug, selector, len(elements),
            )

            for el in elements:
                try:
                    text_block = await el.inner_text()

                    # Skip elements without a price — not a real product card
                    if "$" not in text_block:
                        continue

                    # Skip tiny fragments (sub-elements of a real card)
                    if len(text_block.strip()) < 10:
                        continue

                    lines = [ln.strip() for ln in text_block.split("\n") if ln.strip()]

                    # Pick the first line that isn't just a strain type
                    name = "Unknown"
                    for ln in lines:
                        if ln.lower() not in _STRAIN_ONLY and "$" not in ln:
                            name = ln
                            break

                    # Clean junk from raw text
                    clean_text = _JUNK_PATTERNS.sub("", text_block).strip()

                    product: dict[str, Any] = {
                        "name": name,
                        "raw_text": clean_text,
                        "product_url": self.url,
                    }

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

                    # Extract first price line
                    for line in lines:
                        if "$" in line:
                            product["price"] = line
                            break

                    products.append(product)
                except Exception:
                    logger.debug("Failed to extract a Rise product", exc_info=True)

            if products:
                logger.info(
                    "[%s] Products extracted via selector %r (%d found)",
                    self.slug, selector, len(products),
                )
                break

        # --- Dedup by name+price (Rise sometimes renders cards twice) ---
        if products:
            seen: set[str] = set()
            unique: list[dict[str, Any]] = []
            for p in products:
                key = f"{p.get('name', '')}|{p.get('price', '')}"
                if key not in seen:
                    seen.add(key)
                    unique.append(p)
            if len(unique) < len(products):
                logger.info(
                    "[%s] Deduped %d → %d products",
                    self.slug, len(products), len(unique),
                )
            products = unique

        return products
