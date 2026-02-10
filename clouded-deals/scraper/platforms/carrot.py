"""
Scraper for Carrot (getcarrot.io) dispensary menus.

Carrot is a cannabis ecommerce platform headquartered in Las Vegas that
powers online menus for dispensaries like Wallflower, Inyo, Jenny's,
Euphoria, Silver Sage, and ShowGrow.

The menu widget is injected into the page via a ``<script>`` tag from
``nevada-store-core.getcarrot.io/carrot.js`` which renders product cards
directly into the page DOM (no cross-origin iframe).

Flow:
  1. Navigate to the dispensary menu page.
  2. Dismiss any age gate (up to 3 attempts for multi-gate sites).
  3. Wait for carrot.js to render the product menu into the DOM.
  4. Scroll the page to trigger any lazy-loaded products.
  5. Click "Load More" / "View More" buttons if present.
  6. Extract product cards.

Key recon signatures (Feb 2026):
  - Script src: ``nevada-store-core.getcarrot.io/carrot.js``
  - DOM containers: ``#carrot-menu``, ``[data-carrot]``
  - Product counts: ~50-62 per site (small catalogs, no pagination expected)
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

from playwright.async_api import TimeoutError as PlaywrightTimeout

from config.dispensaries import PLATFORM_DEFAULTS
from .base import BaseScraper

logger = logging.getLogger(__name__)

_CARROT_CFG = PLATFORM_DEFAULTS.get("carrot", {})
_POST_AGE_GATE_WAIT = _CARROT_CFG.get("wait_after_age_gate_sec", 10)

# Strain-only words that are NOT product names — skip to next line.
_STRAIN_ONLY = {"indica", "sativa", "hybrid", "cbd", "thc"}

# Carrot-specific selectors tried first, then generic fallbacks.
_PRODUCT_SELECTORS = [
    # Carrot-specific containers
    '#carrot-menu [class*="product"]',
    '[data-carrot] [class*="product"]',
    '#carrot-menu [class*="card"]',
    '[data-carrot] [class*="card"]',
    '#carrot-menu [class*="item"]',
    '[data-carrot] [class*="item"]',
    # Generic product selectors (Carrot may render with standard classes)
    '[class*="product-card"]',
    '[class*="ProductCard"]',
    '[data-testid*="product"]',
    'div[class*="product"]',
    '[class*="menu-item"]',
    '[class*="MenuItem"]',
    'article',
    '[class*="card"]',
]

# Wait for Carrot content to appear in the DOM (polled by wait_for_function).
_WAIT_FOR_CARROT_JS = """
() => {
    // Check for Carrot-specific containers
    const carrotMenu = document.querySelector('#carrot-menu');
    const dataCarrot = document.querySelector('[data-carrot]');
    const carrotClass = document.querySelector('[class*="carrot"]');

    const container = carrotMenu || dataCarrot || carrotClass;
    if (container) {
        // Check if products are rendered inside
        const products = container.querySelectorAll(
            '[class*="product"], [class*="card"], [class*="item"], article'
        );
        return products.length >= 1;
    }

    // Fallback: check for any product-like content on the page
    // (some Carrot embeds may not use named containers)
    const cards = document.querySelectorAll(
        '[class*="product-card"], [class*="ProductCard"], [class*="menu-item"]'
    );
    return cards.length >= 3;
}
"""

# Junk patterns to strip from raw text
_JUNK_PATTERNS = re.compile(
    r"(Add to (cart|bag|order)|Remove|View details|Out of stock|"
    r"Sale!|New!|Limited|Sold out|In stock|Pickup|Delivery|"
    r"\bQty\b.*$|\bQuantity\b.*$)",
    re.IGNORECASE | re.MULTILINE,
)

# JS to scroll to bottom and trigger lazy-loaded content.
_JS_SCROLL_TO_BOTTOM = """
async () => {
    const delay = ms => new Promise(r => setTimeout(r, ms));
    const maxScrolls = 15;
    let lastHeight = 0;
    for (let i = 0; i < maxScrolls; i++) {
        window.scrollTo(0, document.body.scrollHeight);
        await delay(800);
        const newHeight = document.body.scrollHeight;
        if (newHeight === lastHeight) break;
        lastHeight = newHeight;
    }
    window.scrollTo(0, 0);
}
"""

# "Load More" / "View More" button selectors
_LOAD_MORE_SELECTORS = [
    'button:has-text("Load More")',
    'button:has-text("View More")',
    'button:has-text("Show More")',
    'button:has-text("See More")',
    'button:has-text("Load more")',
    'a:has-text("Load More")',
    'a:has-text("View More")',
    'a:has-text("Show More")',
]


class CarrotScraper(BaseScraper):
    """Scraper for Carrot (getcarrot.io) dispensary menus."""

    async def scrape(self) -> list[dict[str, Any]]:
        await self.goto()
        logger.info("[%s] After navigation, URL is: %s", self.slug, self.page.url)

        # --- Dismiss age gate (up to 3 attempts for multi-gate sites) ---
        for attempt in range(3):
            dismissed = await self.handle_age_gate(post_wait_sec=3)
            if not dismissed:
                break
            logger.info("[%s] Age gate dismissed (attempt %d)", self.slug, attempt + 1)
            await asyncio.sleep(1)

        # --- Wait for Carrot content to render ---
        try:
            await self.page.wait_for_function(
                _WAIT_FOR_CARROT_JS, timeout=30_000,
            )
            logger.info("[%s] Carrot content detected in DOM", self.slug)
        except PlaywrightTimeout:
            logger.warning("[%s] No Carrot content after 30s — trying extraction anyway", self.slug)

        # Additional settle time for JS rendering
        await asyncio.sleep(_POST_AGE_GATE_WAIT)

        # --- Expand all products (scroll + click Load More) ---
        await self._expand_all_products()

        # --- Extract products ---
        products = await self._extract_products()

        if not products:
            await self.save_debug_info("zero_products")
            logger.warning("[%s] No products found — see debug artifacts", self.slug)

        logger.info("[%s] Scrape complete — %d products", self.slug, len(products))
        return products

    # ------------------------------------------------------------------
    # Load More / scroll expansion
    # ------------------------------------------------------------------

    async def _expand_all_products(self) -> None:
        """Scroll the page and click Load More buttons to reveal all products."""
        # Scroll to trigger lazy loading
        try:
            await self.page.evaluate(_JS_SCROLL_TO_BOTTOM)
            await asyncio.sleep(2)
        except Exception:
            pass

        # Click "Load More" / "View More" buttons until none remain
        max_clicks = 20
        for click_num in range(max_clicks):
            clicked = False
            for selector in _LOAD_MORE_SELECTORS:
                try:
                    btn = self.page.locator(selector).first
                    if await btn.count() > 0 and await btn.is_visible():
                        await btn.click()
                        clicked = True
                        logger.info("[%s] Clicked '%s' (round %d)", self.slug, selector, click_num + 1)
                        await asyncio.sleep(1.5)
                        break
                except Exception:
                    continue
            if not clicked:
                break

        # Final scroll after expanding
        if max_clicks > 0:
            try:
                await self.page.evaluate(_JS_SCROLL_TO_BOTTOM)
                await asyncio.sleep(1)
            except Exception:
                pass

    # ------------------------------------------------------------------
    # Product extraction
    # ------------------------------------------------------------------

    async def _extract_products(self) -> list[dict[str, Any]]:
        """Extract product cards from the Carrot-rendered page.

        Tries selectors in order, uses the first one that yields results
        with at least one price (``$``).  Each card's ``inner_text()``
        is captured as ``raw_text`` for downstream parsing by CloudedLogic.
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

                    # Pick the first line that isn't a strain type or price
                    name = "Unknown"
                    for ln in lines:
                        if ln.lower() not in _STRAIN_ONLY and "$" not in ln and len(ln) >= 3:
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
                    logger.debug("Failed to extract a Carrot product", exc_info=True)

            if products:
                logger.info(
                    "[%s] Products extracted via selector %r (%d found)",
                    self.slug, selector, len(products),
                )
                break

        # --- Dedup by name+price (safety net) ---
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
