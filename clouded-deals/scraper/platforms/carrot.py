"""
Scraper for Carrot (getcarrot.io) dispensary menus.

Carrot is a cannabis ecommerce platform headquartered in Las Vegas that
powers online menus for dispensaries like Wallflower, Inyo, Jenny's,
Euphoria, Silver Sage, and ShowGrow.

Two deployment modes:
  1. **Standalone SPA** — ``store.sswlv.com``, ``store.showgrowvegas.com``
     use Carrot as the full page app with ``#carrot-store-root``.
  2. **WordPress embed** — ``jennysdispensary.com``, ``inyolasvegas.com``,
     ``wallflower-house.com``, ``euphoriawellnessnv.com`` integrate via
     ``<script>`` from ``nevada-store-core.getcarrot.io/carrot.js`` or
     a SiteGen build, rendering products into the page DOM.

Both modes render product links as ``<a href="/product/...">`` elements
containing product name, and prices in sibling or parent containers.

Flow:
  1. Navigate to the dispensary menu page.
  2. Dismiss any age gate (up to 3 attempts for multi-gate sites).
  3. Wait for Carrot content to render (detect via multiple signatures).
  4. Scroll the page to trigger any lazy-loaded products.
  5. Click "Load More" / "View More" buttons if present.
  6. Extract products via JS evaluation that walks the DOM tree.
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

# Carrot product card selectors — for element-based extraction fallback.
_PRODUCT_SELECTORS = [
    # Carrot standalone SPA containers
    '#carrot-store-root [class*="product"]',
    '#carrot-store-root [class*="card"]',
    '#carrot-store [class*="product"]',
    # Carrot WordPress embeds (data-carrot-route is the actual attribute)
    '[data-carrot-route] [class*="product"]',
    '[data-carrot-route-root] [class*="product"]',
    # Legacy selectors
    '#carrot-menu [class*="product"]',
    '[data-carrot] [class*="product"]',
    # Generic product selectors
    '[class*="product-card"]',
    '[class*="ProductCard"]',
    '[data-testid*="product"]',
    'div[class*="product"]',
    'article',
]

# Updated Carrot detection — checks for both standalone SPA and WordPress embed
# signatures, plus product links as the strongest signal.
_WAIT_FOR_CARROT_JS = """
() => {
    // Standalone Carrot SPA: #carrot-store-root with content
    const storeRoot = document.querySelector('#carrot-store-root');
    if (storeRoot && storeRoot.children.length > 0) {
        const inner = storeRoot.innerHTML;
        if (inner.length > 500) return true;
    }

    // WordPress+Carrot: data-carrot-route attribute on <html>
    const html = document.documentElement;
    if (html.hasAttribute('data-carrot-route') || html.hasAttribute('data-carrot-route-root')) {
        // Check for product links (the definitive signal)
        const links = document.querySelectorAll('a[href*="/product/"]');
        if (links.length >= 3) return true;
    }

    // SiteGen Carrot: look for hydrated class + product links
    if (html.classList.contains('hydrated')) {
        const links = document.querySelectorAll('a[href*="/product/"]');
        if (links.length >= 3) return true;
    }

    // Legacy containers
    const carrotMenu = document.querySelector('#carrot-menu');
    const dataCarrot = document.querySelector('[data-carrot]');
    const carrotClass = document.querySelector('[class*="carrot"]');
    const container = carrotMenu || dataCarrot || carrotClass;
    if (container) {
        const products = container.querySelectorAll(
            '[class*="product"], [class*="card"], [class*="item"], article'
        );
        if (products.length >= 1) return true;
    }

    // Broadest fallback: enough product links on any page
    const allLinks = document.querySelectorAll('a[href*="/product/"]');
    return allLinks.length >= 5;
}
"""

# JS to extract products by walking the DOM from product links upward.
# This is the primary extraction method — more robust than CSS selector
# matching because it finds the nearest ancestor containing both name
# and price regardless of class names.
_JS_EXTRACT_PRODUCTS = """
() => {
    const products = [];
    const seen = new Set();

    // Strategy 1: Find all product links and walk up to the price container
    const links = document.querySelectorAll('a[href*="/product/"]');

    for (const link of links) {
        const href = link.href;
        if (!href || seen.has(href)) continue;

        // Walk up from the link to find the nearest ancestor with a price
        let container = link;
        let foundPrice = false;
        for (let i = 0; i < 6; i++) {
            const parent = container.parentElement;
            if (!parent) break;
            container = parent;
            if (container.textContent && container.textContent.includes('$')) {
                foundPrice = true;
                // Check if this container is reasonably sized (not the whole page)
                if (container.textContent.length < 2000) break;
            }
        }

        // Get text from the container
        const text = container.innerText || '';
        if (text.length < 5) continue;

        // Extract name from the link itself (cleanest source)
        let name = '';
        // Try to find a heading or strong text inside the link
        const heading = link.querySelector('h1, h2, h3, h4, h5, h6, strong, b, [class*="name"], [class*="title"]');
        if (heading) {
            name = heading.innerText.trim();
        }
        if (!name) {
            // Use the link's text, excluding price-like content
            const linkLines = (link.innerText || '').split('\\n').filter(l => l.trim());
            for (const line of linkLines) {
                const trimmed = line.trim();
                if (trimmed.length >= 3 && !trimmed.includes('$') && !/^(indica|sativa|hybrid|cbd|thc)$/i.test(trimmed)) {
                    name = trimmed;
                    break;
                }
            }
        }
        if (!name) name = 'Unknown';

        // Extract price from the container text
        let price = '';
        const priceMatch = text.match(/\\$[\\d]+\\.?\\d{0,2}/);
        if (priceMatch) {
            price = priceMatch[0];
        }

        seen.add(href);
        products.push({
            name: name,
            raw_text: text.substring(0, 1000),
            product_url: href,
            price: price || null,
        });
    }

    // Strategy 2: If no product links found, try standalone SPA cards
    if (products.length === 0) {
        const root = document.querySelector('#carrot-store-root') || document.body;
        const cards = root.querySelectorAll(
            '[class*="product-card"], [class*="ProductCard"], '
            + '[data-testid*="product"], div[class*="product"]'
        );
        for (const card of cards) {
            const text = card.innerText || '';
            if (!text.includes('$') || text.length < 10) continue;

            const lines = text.split('\\n').map(l => l.trim()).filter(l => l);
            let name = 'Unknown';
            let price = '';

            for (const line of lines) {
                if (!name || name === 'Unknown') {
                    if (line.length >= 3 && !line.includes('$') && !/^(indica|sativa|hybrid|cbd|thc)$/i.test(line)) {
                        name = line;
                    }
                }
                if (!price && line.includes('$')) {
                    price = line;
                }
            }

            const link = card.querySelector('a');
            const href = link ? link.href : window.location.href;
            const key = name + '|' + price;
            if (seen.has(key)) continue;
            seen.add(key);

            products.push({
                name: name,
                raw_text: text.substring(0, 1000),
                product_url: href,
                price: price || null,
            });
        }
    }

    return products;
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
        """Extract product data from the Carrot-rendered page.

        Primary method: JS evaluation that walks from product links
        (``a[href*="/product/"]``) up to price containers.  This works
        for both standalone Carrot SPAs and WordPress+Carrot embeds.

        Fallback: traditional CSS selector cascade for non-standard layouts.
        """
        # --- Primary: JS-based extraction ---
        products = await self._extract_via_js()

        if products:
            logger.info(
                "[%s] JS extraction found %d products", self.slug, len(products),
            )
            return products

        # --- Fallback: CSS selector cascade ---
        logger.info("[%s] JS extraction found 0 — trying selector cascade", self.slug)
        products = await self._extract_via_selectors()

        return products

    async def _extract_via_js(self) -> list[dict[str, Any]]:
        """Extract products using JS evaluation (walks DOM from product links)."""
        try:
            raw_products = await self.page.evaluate(_JS_EXTRACT_PRODUCTS)
        except Exception:
            logger.debug("JS product extraction failed", exc_info=True)
            return []

        products: list[dict[str, Any]] = []
        for raw in raw_products:
            name = raw.get("name", "Unknown")
            raw_text = raw.get("raw_text", "")
            clean_text = _JUNK_PATTERNS.sub("", raw_text).strip()

            product: dict[str, Any] = {
                "name": name,
                "raw_text": clean_text,
                "product_url": raw.get("product_url", self.url),
            }
            if raw.get("price"):
                product["price"] = raw["price"]

            products.append(product)

        # Dedup
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

    async def _extract_via_selectors(self) -> list[dict[str, Any]]:
        """Fallback: extract via CSS selector cascade (traditional method)."""
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

                    # Skip elements without a price
                    if "$" not in text_block:
                        continue

                    # Skip tiny fragments
                    if len(text_block.strip()) < 10:
                        continue

                    lines = [ln.strip() for ln in text_block.split("\n") if ln.strip()]

                    name = "Unknown"
                    for ln in lines:
                        if ln.lower() not in _STRAIN_ONLY and "$" not in ln and len(ln) >= 3:
                            name = ln
                            break

                    clean_text = _JUNK_PATTERNS.sub("", text_block).strip()

                    product: dict[str, Any] = {
                        "name": name,
                        "raw_text": clean_text,
                        "product_url": self.url,
                    }

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
                    logger.debug("Failed to extract a Carrot product", exc_info=True)

            if products:
                logger.info(
                    "[%s] Products extracted via selector %r (%d found)",
                    self.slug, selector, len(products),
                )
                break

        # Dedup
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
