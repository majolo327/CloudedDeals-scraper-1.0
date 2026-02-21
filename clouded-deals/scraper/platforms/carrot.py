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

# Shadow-DOM-aware Carrot detection — Stencil.js (used by Carrot) may render
# components with Shadow DOM.  document.querySelectorAll cannot pierce shadow
# boundaries, so we recursively walk shadow roots.
_WAIT_FOR_CARROT_JS = """
() => {
    // Shadow-DOM-piercing querySelectorAll
    function deepQSA(root, selector) {
        const results = [...root.querySelectorAll(selector)];
        const walk = (node) => {
            if (node.shadowRoot) {
                results.push(...node.shadowRoot.querySelectorAll(selector));
                node.shadowRoot.querySelectorAll('*').forEach(walk);
            }
        };
        root.querySelectorAll('*').forEach(walk);
        return results;
    }

    // Standalone Carrot SPA: #carrot-store-root with content
    const storeRoot = document.querySelector('#carrot-store-root');
    if (storeRoot && storeRoot.children.length > 0) {
        const inner = storeRoot.innerHTML;
        if (inner.length > 500) return true;
    }

    // Product links via deep query (pierces Shadow DOM)
    const links = deepQSA(document, 'a[href*="/product/"]');

    // WordPress+Carrot: data-carrot-route attribute on <html>
    const html = document.documentElement;
    if (html.hasAttribute('data-carrot-route') || html.hasAttribute('data-carrot-route-root')) {
        if (links.length >= 1) return true;
    }

    // SiteGen Carrot: look for hydrated class + product links
    if (html.classList.contains('hydrated')) {
        if (links.length >= 1) return true;
    }

    // Legacy containers
    const carrotMenu = document.querySelector('#carrot-menu');
    const dataCarrot = document.querySelector('[data-carrot]');
    const carrotClass = document.querySelector('[class*="carrot"]');
    const container = carrotMenu || dataCarrot || carrotClass;
    if (container) {
        const products = deepQSA(container,
            '[class*="product"], [class*="card"], [class*="item"], article'
        );
        if (products.length >= 1) return true;
    }

    // Broadest fallback: enough product links anywhere (including shadow DOM)
    return links.length >= 3;
}
"""

# JS to extract products by walking the DOM from product links upward.
# This is the primary extraction method — more robust than CSS selector
# matching because it finds the nearest ancestor containing both name
# and price regardless of class names.
#
# Uses a Shadow-DOM-piercing querySelectorAll (deepQSA) because Carrot
# sites built with Stencil.js may render products inside shadow roots.
# The parent-walk also crosses shadow boundaries via getRootNode().host.
_JS_EXTRACT_PRODUCTS = """
() => {
    // Shadow-DOM-piercing querySelectorAll
    function deepQSA(root, selector) {
        const results = [...root.querySelectorAll(selector)];
        const walk = (node) => {
            if (node.shadowRoot) {
                results.push(...node.shadowRoot.querySelectorAll(selector));
                node.shadowRoot.querySelectorAll('*').forEach(walk);
            }
        };
        root.querySelectorAll('*').forEach(walk);
        return results;
    }

    // Walk up the DOM tree, crossing shadow boundaries if needed.
    function getParent(node) {
        if (node.parentElement) return node.parentElement;
        // Cross shadow boundary: shadowRoot → host element
        const root = node.getRootNode();
        if (root && root.host) return root.host;
        return null;
    }

    const products = [];
    const seen = new Set();

    // Strategy 1: Find all product links and walk up to the price container.
    // Carrot renders product links as <a href="/product/..."> with the name
    // inside, and prices in a sibling or nearby ancestor element.
    // Uses deepQSA to pierce Shadow DOM boundaries.
    const links = deepQSA(document, 'a[href*="/product/"]');

    for (const link of links) {
        const href = link.href;
        if (!href || seen.has(href)) continue;

        // Extract name from the link itself (cleanest source)
        let name = '';
        const heading = link.querySelector('h1, h2, h3, h4, h5, h6, strong, b, [class*="name"], [class*="title"]');
        if (heading) {
            name = heading.innerText.trim();
        }
        if (!name) {
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

        // Walk up from the link to find the nearest ancestor with a price.
        // Uses getParent() to cross shadow DOM boundaries.
        let container = link;
        let priceText = '';
        let rawText = '';
        for (let i = 0; i < 10; i++) {
            const parent = getParent(container);
            if (!parent) break;
            container = parent;
            const cText = container.innerText || '';

            // Check if this container has a price
            if (cText.includes('$')) {
                // Is it a reasonable product card size? (not the whole grid)
                if (cText.length < 2000) {
                    rawText = cText;
                    const pm = cText.match(/\\$[\\d]+\\.?\\d{0,2}/);
                    if (pm) priceText = pm[0];
                    break;
                }
                // Container too big — check direct children for a price element
                const children = container.children;
                for (const child of children) {
                    const childText = child.innerText || '';
                    if (childText.includes('$') && childText.length < 500 && childText.length > 3) {
                        const pm = childText.match(/\\$[\\d]+\\.?\\d{0,2}/);
                        if (pm) {
                            priceText = pm[0];
                            rawText = name + '\\n' + childText;
                            break;
                        }
                    }
                }
                if (priceText) break;
            }
        }

        // Fallback: check siblings of the link for price info
        if (!priceText) {
            const parent = getParent(link);
            if (parent) {
                const siblings = parent.children;
                for (const sib of siblings) {
                    if (sib === link) continue;
                    const sibText = sib.innerText || '';
                    if (sibText.includes('$') && sibText.length < 500) {
                        const pm = sibText.match(/\\$[\\d]+\\.?\\d{0,2}/);
                        if (pm) {
                            priceText = pm[0];
                            rawText = name + '\\n' + sibText;
                            break;
                        }
                    }
                }
            }
        }

        if (!rawText) rawText = (container.innerText || '').substring(0, 1000);

        seen.add(href);
        products.push({
            name: name,
            raw_text: rawText.substring(0, 1000),
            product_url: href,
            price: priceText || null,
        });
    }

    // Strategy 2: If no product links found, try standalone SPA cards
    if (products.length === 0) {
        const root = document.querySelector('#carrot-store-root') || document.body;
        const cards = deepQSA(root,
            '[class*="product-card"], [class*="ProductCard"], '
            + '[data-testid*="product"], div[class*="product"]'
        );
        for (const card of cards) {
            const text = card.innerText || '';
            if (text.length < 10) continue;
            // Skip grid containers that are too large (contain many products)
            if (text.length > 3000) continue;

            const lines = text.split('\\n').map(l => l.trim()).filter(l => l);
            let cname = 'Unknown';
            let price = '';

            for (const line of lines) {
                if (cname === 'Unknown') {
                    if (line.length >= 3 && !line.includes('$') && !/^(indica|sativa|hybrid|cbd|thc)$/i.test(line)) {
                        cname = line;
                    }
                }
                if (!price && line.includes('$')) {
                    price = line;
                }
            }

            const clink = card.querySelector('a') || (card.shadowRoot && card.shadowRoot.querySelector('a'));
            const chref = clink ? clink.href : window.location.href;
            const key = cname + '|' + (price || chref);
            if (seen.has(key)) continue;
            seen.add(key);

            products.push({
                name: cname,
                raw_text: text.substring(0, 1000),
                product_url: chref,
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
        # 45s timeout — some Carrot sites (Wallflower, Jenny's) need extra
        # time after age gate dismissal before products appear in the DOM.
        try:
            await self.page.wait_for_function(
                _WAIT_FOR_CARROT_JS, timeout=45_000,
            )
            logger.info("[%s] Carrot content detected in DOM", self.slug)
        except PlaywrightTimeout:
            logger.warning("[%s] No Carrot content after 45s — trying extraction anyway", self.slug)

        # Additional settle time for JS rendering
        await asyncio.sleep(_POST_AGE_GATE_WAIT)

        # Post-content age gate retry — some Carrot sites (Wallflower)
        # show the age gate as a JS modal AFTER the main content starts
        # rendering.  Try once more to clear any lingering overlay.
        post_dismissed = await self.handle_age_gate(post_wait_sec=2)
        if post_dismissed:
            logger.info("[%s] Post-content age gate dismissed", self.slug)

        # Wait for prices to appear — Carrot sometimes renders links before
        # prices are loaded (separate API call / lazy hydration).
        # Uses shadow-DOM-piercing deepQSA so we find links inside shadow roots.
        try:
            await self.page.wait_for_function(
                """() => {
                    function deepQSA(root, selector) {
                        const results = [...root.querySelectorAll(selector)];
                        const walk = (node) => {
                            if (node.shadowRoot) {
                                results.push(...node.shadowRoot.querySelectorAll(selector));
                                node.shadowRoot.querySelectorAll('*').forEach(walk);
                            }
                        };
                        root.querySelectorAll('*').forEach(walk);
                        return results;
                    }
                    function getParent(node) {
                        if (node.parentElement) return node.parentElement;
                        const root = node.getRootNode();
                        if (root && root.host) return root.host;
                        return null;
                    }
                    const els = deepQSA(document, 'a[href*="/product/"]');
                    if (els.length === 0) return false;  // no products yet — keep waiting
                    // Check if at least some elements near product links contain '$'
                    let withPrice = 0;
                    for (const el of els) {
                        // Walk up (crossing shadow boundaries) to find price
                        let node = el;
                        for (let i = 0; i < 5; i++) {
                            node = getParent(node);
                            if (!node) break;
                            const text = node.innerText || '';
                            if (text.includes('$') && text.length < 3000) {
                                withPrice++;
                                break;
                            }
                        }
                        if (withPrice >= 3) return true;
                    }
                    // If we found product links but no prices after checking all,
                    // return true anyway — prices may not be in the DOM at all
                    // (some Carrot configs don't show prices on the grid).
                    return els.length >= 3;
                }""",
                timeout=15_000,
            )
            logger.info("[%s] Prices detected near product links", self.slug)
        except PlaywrightTimeout:
            logger.warning("[%s] Prices not detected near product links after 15s", self.slug)

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
        # Each click gets up to 2 retries with backoff before giving up.
        max_clicks = 20
        for click_num in range(max_clicks):
            clicked = False
            for selector in _LOAD_MORE_SELECTORS:
                for _retry in range(3):
                    try:
                        btn = self.page.locator(selector).first
                        if await btn.count() > 0 and await btn.is_visible():
                            await btn.click()
                            clicked = True
                            logger.info("[%s] Clicked '%s' (round %d)", self.slug, selector, click_num + 1)
                            await asyncio.sleep(1.5)
                        break  # success or button not found
                    except Exception:
                        if _retry < 2:
                            await asyncio.sleep(2 ** (_retry + 1))
                        continue
                if clicked:
                    break
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
        (``a[href*="/product/"]``) up to price containers — includes
        shadow DOM traversal for Stencil.js sites.

        Fallback 1: Playwright locator-based extraction that natively
        pierces Shadow DOM (handles cases where JS eval can't reach
        shadow roots).

        Fallback 2: Traditional CSS selector cascade for non-standard layouts.
        """
        # --- Primary: JS-based extraction (with shadow DOM walker) ---
        products = await self._extract_via_js()

        if products:
            logger.info(
                "[%s] JS extraction found %d products", self.slug, len(products),
            )
            return products

        # --- Fallback 1: Playwright locator extraction (pierces Shadow DOM) ---
        logger.info("[%s] JS extraction found 0 — trying Playwright locator extraction", self.slug)
        products = await self._extract_via_locators()

        if products:
            logger.info(
                "[%s] Locator extraction found %d products", self.slug, len(products),
            )
            return products

        # --- Fallback 2: CSS selector cascade ---
        logger.info("[%s] Locator extraction found 0 — trying selector cascade", self.slug)
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

    async def _extract_via_locators(self) -> list[dict[str, Any]]:
        """Extract using Playwright locators that natively pierce Shadow DOM.

        Playwright's ``page.locator()`` API automatically traverses shadow
        roots, so this works even when ``document.querySelectorAll`` fails
        on Stencil.js / Web Component sites.  For each product link, we use
        ``el.evaluate()`` to walk up the DOM tree (crossing shadow boundaries
        via ``getRootNode().host``) to find the price container.
        """
        products: list[dict[str, Any]] = []
        seen: set[str] = set()

        links = await self.page.locator('a[href*="/product/"]').all()
        if not links:
            return []

        logger.info("[%s] Playwright locator found %d product links", self.slug, len(links))

        for link in links:
            try:
                href = await link.get_attribute("href") or ""
                # Normalize href for dedup
                if href in seen:
                    continue
                seen.add(href)

                # Resolve full URL
                full_url = href
                if href and not href.startswith("http"):
                    try:
                        full_url = await link.evaluate("el => el.href")
                    except Exception:
                        full_url = self.url + href

                # Extract name from heading inside the link
                name = ""
                for heading_sel in ("h1", "h2", "h3", "h4", "h5", "h6", "strong", "b"):
                    heading = link.locator(heading_sel).first
                    if await heading.count() > 0:
                        name = (await heading.inner_text()).strip()
                        if name:
                            break

                if not name:
                    link_text = await link.inner_text()
                    for line in link_text.split("\n"):
                        line = line.strip()
                        if len(line) >= 3 and "$" not in line and line.lower() not in _STRAIN_ONLY:
                            name = line
                            break

                if not name:
                    name = "Unknown"

                # Walk up from the link element to find price container,
                # crossing shadow boundaries via getRootNode().host.
                price_data = await link.evaluate("""
                    (el) => {
                        function getParent(node) {
                            if (node.parentElement) return node.parentElement;
                            const root = node.getRootNode();
                            if (root && root.host) return root.host;
                            return null;
                        }

                        let container = el;
                        let priceText = '';
                        let rawText = '';

                        for (let i = 0; i < 10; i++) {
                            const parent = getParent(container);
                            if (!parent) break;
                            container = parent;
                            const cText = container.innerText || '';

                            if (cText.includes('$')) {
                                if (cText.length < 2000) {
                                    rawText = cText;
                                    const pm = cText.match(/\\$[\\d]+\\.?\\d{0,2}/);
                                    if (pm) priceText = pm[0];
                                    break;
                                }
                                const children = container.children;
                                for (const child of children) {
                                    const childText = child.innerText || '';
                                    if (childText.includes('$') && childText.length < 500 && childText.length > 3) {
                                        const pm = childText.match(/\\$[\\d]+\\.?\\d{0,2}/);
                                        if (pm) {
                                            priceText = pm[0];
                                            rawText = childText;
                                            break;
                                        }
                                    }
                                }
                                if (priceText) break;
                            }
                        }

                        // Check siblings
                        const linkParent = getParent(el);
                        if (!priceText && linkParent) {
                            const siblings = linkParent.children;
                            for (const sib of siblings) {
                                if (sib === el) continue;
                                const sibText = sib.innerText || '';
                                if (sibText.includes('$') && sibText.length < 500) {
                                    const pm = sibText.match(/\\$[\\d]+\\.?\\d{0,2}/);
                                    if (pm) {
                                        priceText = pm[0];
                                        rawText = sibText;
                                        break;
                                    }
                                }
                            }
                        }

                        if (!rawText) rawText = (container.innerText || '').substring(0, 1000);

                        return {
                            rawText: rawText.substring(0, 1000),
                            price: priceText || null
                        };
                    }
                """)

                raw_text = price_data.get("rawText", "")
                clean_text = _JUNK_PATTERNS.sub("", raw_text).strip()

                product: dict[str, Any] = {
                    "name": name,
                    "raw_text": clean_text,
                    "product_url": full_url,
                }
                if price_data.get("price"):
                    product["price"] = price_data["price"]

                products.append(product)
            except Exception:
                logger.debug("Failed to extract Carrot product via locator", exc_info=True)

        # Dedup
        if products:
            seen_keys: set[str] = set()
            unique: list[dict[str, Any]] = []
            for p in products:
                key = f"{p.get('name', '')}|{p.get('price', '')}"
                if key not in seen_keys:
                    seen_keys.add(key)
                    unique.append(p)
            if len(unique) < len(products):
                logger.info(
                    "[%s] Deduped %d → %d products (locator)",
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

                    # Skip tiny fragments
                    if len(text_block.strip()) < 10:
                        continue

                    # Skip grid containers that are too large — they contain
                    # many products, not one.  A single Carrot product card
                    # typically has <500 chars of text.
                    if len(text_block.strip()) > 2000:
                        continue

                    # If no price in the element itself, walk up to find it
                    # (Shadow DOM / Stencil.js sites put prices in siblings)
                    price_text = ""
                    if "$" not in text_block:
                        try:
                            parent_data = await el.evaluate("""
                                (el) => {
                                    function getParent(node) {
                                        if (node.parentElement) return node.parentElement;
                                        const root = node.getRootNode();
                                        if (root && root.host) return root.host;
                                        return null;
                                    }
                                    let node = el;
                                    for (let i = 0; i < 5; i++) {
                                        node = getParent(node);
                                        if (!node) break;
                                        const t = node.innerText || '';
                                        if (t.includes('$') && t.length < 2000) {
                                            const pm = t.match(/\\$[\\d]+\\.?\\d{0,2}/);
                                            return { text: t.substring(0, 1000), price: pm ? pm[0] : null };
                                        }
                                    }
                                    // Check siblings of the element
                                    const parent = getParent(el);
                                    if (parent) {
                                        for (const sib of parent.children) {
                                            if (sib === el) continue;
                                            const st = sib.innerText || '';
                                            if (st.includes('$') && st.length < 500) {
                                                const pm = st.match(/\\$[\\d]+\\.?\\d{0,2}/);
                                                if (pm) return { text: st, price: pm[0] };
                                            }
                                        }
                                    }
                                    return null;
                                }
                            """)
                            if parent_data:
                                price_text = parent_data.get("price", "")
                                # Merge parent text for raw_text
                                text_block = text_block + "\n" + parent_data.get("text", "")
                        except Exception:
                            pass

                        # If still no price anywhere, skip this element
                        if not price_text and "$" not in text_block:
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

                    if price_text:
                        product["price"] = price_text
                    else:
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
