"""
Scraper for AIQ / Dispense (Alpine IQ) dispensary menus.

Alpine IQ's Dispense platform powers online ordering menus for
dispensaries.  Menus are React SPAs that can be accessed in two modes:

  1. **Direct** — hosted at ``menus.dispenseapp.com/{hash}/menu``
  2. **Embedded** — injected via ``<script>`` from ``lab.alpineiq.com``
     or ``dispenseapp.com`` into the dispensary's own site.

Flow:
  1. Navigate to the menu page.
  2. Dismiss any age gate (up to 3 attempts).
  3. Detect content mode:
     a. Direct dispenseapp.com URL → products render on page.
     b. Embedded → look for iframe from alpineiq/dispenseapp,
        fall back to products injected into page DOM.
  4. Wait for the React SPA to hydrate and render products.
  5. Scroll and click "Load More" / "Show More" to expand full catalog.
  6. Extract product cards.

Key recon data (Feb 2026):
  - Green NV (Hualapai): 628 products via alpineiq embed
  - Pisos: 197 products
  - Jardin: 189 products
  - Nevada Made: direct dispenseapp.com menus (need extra settle time)

Script sources: ``lab.alpineiq.com``, ``dispenseapp.com``, ``getaiq.com``
DOM containers: ``#aiq-menu``, ``#dispense-menu``, ``[data-aiq]``
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any, Union

from playwright.async_api import Page, Frame, TimeoutError as PlaywrightTimeout

from config.dispensaries import PLATFORM_DEFAULTS
from handlers import dismiss_age_gate
from .base import BaseScraper

logger = logging.getLogger(__name__)

_AIQ_CFG = PLATFORM_DEFAULTS.get("aiq", {})
_POST_AGE_GATE_WAIT = _AIQ_CFG.get("wait_after_age_gate_sec", 15)

# Strain-only words — skip to next line when picking a product name.
_STRAIN_ONLY = {"indica", "sativa", "hybrid", "cbd", "thc"}

# Product selectors — data-testid preferred (cleanest, avoids sub-elements),
# then AIQ-specific, then generic fallbacks.
_PRODUCT_SELECTORS = [
    # data-testid is the cleanest — Jardin confirmed working with this
    '[data-testid*="product"]',
    # AIQ / Dispense specific containers
    '#dispense-menu [class*="product"]',
    '#aiq-menu [class*="product"]',
    '[data-aiq] [class*="product"]',
    '#dispense-menu [class*="card"]',
    '#aiq-menu [class*="card"]',
    # Dispense SPA selectors (React-rendered)
    '[class*="ProductCard"]',
    '[class*="productCard"]',
    '[class*="menu-product"]',
    '[class*="MenuProduct"]',
    # product-card last among specific selectors (matches sub-elements)
    '[class*="product-card"]',
    # Generic fallbacks
    'div[class*="product"]',
    '[class*="menu-item"]',
    '[class*="MenuItem"]',
    'article',
    '[class*="card"]',
]

# iframe patterns for detecting Dispense embeds on dispensary sites.
_IFRAME_PATTERNS = [
    "dispenseapp.com",
    "alpineiq.com",
    "getaiq.com",
    "dispense",
]

# iframe URL substrings that indicate a non-menu iframe (chat widgets,
# support embeds, etc.) — these must be excluded even if they match
# _IFRAME_PATTERNS above.
_IFRAME_EXCLUDE_PATTERNS = [
    "chat-widget",
    "chat",
    "support",
    "help",
    "stripe.com",
    "google.com/maps",
    "recaptcha",
]

# Wait for Dispense/AIQ content to appear in the DOM.
_WAIT_FOR_AIQ_JS = """
() => {
    // AIQ-specific containers
    const aiqMenu = document.querySelector('#aiq-menu');
    const dispenseMenu = document.querySelector('#dispense-menu');
    const dataAiq = document.querySelector('[data-aiq]');

    const container = aiqMenu || dispenseMenu || dataAiq;
    if (container) {
        const products = container.querySelectorAll(
            '[class*="product"], [class*="card"], [class*="item"], article'
        );
        return products.length >= 1;
    }

    // Check inside iframes (dispenseapp.com embeds)
    const iframes = document.querySelectorAll('iframe');
    for (const f of iframes) {
        const src = f.getAttribute('src') || '';
        if (src.includes('dispense') || src.includes('alpineiq') || src.includes('aiq')) {
            return true;  // iframe found — we'll switch context later
        }
    }

    // Fallback: any product-like content on page (for direct dispenseapp.com URLs)
    const cards = document.querySelectorAll(
        '[class*="product-card"], [class*="ProductCard"], [class*="productCard"], '
        + '[class*="menu-product"], [class*="MenuProduct"], '
        + '[class*="menu-item"], [class*="MenuItem"]'
    );
    if (cards.length >= 3) return true;

    // Also check for generic product containers with prices
    const allCards = document.querySelectorAll('[class*="card"], article, [class*="product"]');
    let withPrice = 0;
    for (const c of allCards) {
        if (c.textContent && c.textContent.includes('$')) withPrice++;
        if (withPrice >= 3) return true;
    }

    return false;
}
"""

# JS to extract products from Dispense/AIQ pages.
# Strategy: find all elements with data-testid containing "product" that
# also contain both a name (non-price text) and a price ($).  If those
# yield too few results, fall back to scanning all elements with $ text
# that look like product cards (reasonable size, contain a product name).
_JS_EXTRACT_AIQ_PRODUCTS = """
() => {
    const products = [];
    const seen = new Set();

    function extractFromCard(el) {
        const text = el.innerText || '';
        if (!text.includes('$')) return null;
        if (text.trim().length < 10 || text.trim().length > 2000) return null;

        const lines = text.split('\\n').map(l => l.trim()).filter(l => l);
        let name = '';
        let price = '';
        for (const line of lines) {
            if (!name && line.length >= 3 && !line.includes('$') &&
                !/^(indica|sativa|hybrid|cbd|thc)$/i.test(line) &&
                !/^(add|remove|qty|quantity)/i.test(line)) {
                name = line;
            }
            if (!price && line.includes('$')) {
                price = line;
            }
        }
        if (!name) return null;

        const a = el.querySelector('a') || el.closest('a');
        const href = a ? a.href : null;
        const key = name + '|' + price;
        if (seen.has(key)) return null;
        seen.add(key);

        return {
            name: name,
            raw_text: text.substring(0, 1000),
            product_url: href || window.location.href,
            price: price || null,
        };
    }

    // Strategy 1: data-testid product cards (Pisos, Jardin)
    // Only pick elements whose data-testid looks like a card wrapper,
    // not sub-elements like "product-image" or "product-price".
    const testIdEls = document.querySelectorAll('[data-testid]');
    for (const el of testIdEls) {
        const tid = el.getAttribute('data-testid') || '';
        // Match "product-card", "product-N", "productCard" etc.
        // Skip sub-elements: "product-image", "product-name", "product-price"
        if (/product/i.test(tid) &&
            !/image|img|name|title|price|weight|desc|badge|tag/i.test(tid)) {
            const p = extractFromCard(el);
            if (p) products.push(p);
        }
    }
    if (products.length >= 5) return products;

    // Strategy 2: AIQ-specific containers with child cards
    const containers = [
        document.querySelector('#aiq-menu'),
        document.querySelector('#dispense-menu'),
        document.querySelector('[data-aiq]'),
    ].filter(Boolean);

    for (const container of containers) {
        // Try direct children first
        for (const child of container.children) {
            const p = extractFromCard(child);
            if (p) products.push(p);
        }
        if (products.length >= 5) return products;

        // Try deeper: any element with "product" or "card" in class
        const cards = container.querySelectorAll(
            '[class*="product"], [class*="card"], [class*="item"]'
        );
        for (const card of cards) {
            const p = extractFromCard(card);
            if (p) products.push(p);
        }
        if (products.length >= 5) return products;
    }

    // Strategy 3: Scan all elements with product-like classes
    const allCards = document.querySelectorAll(
        '[class*="product-card"], [class*="ProductCard"], [class*="productCard"], '
        + '[class*="menu-product"], [class*="MenuProduct"], [class*="menu-item"], '
        + '[class*="MenuItem"], article[class*="product"]'
    );
    for (const card of allCards) {
        const p = extractFromCard(card);
        if (p) products.push(p);
    }
    if (products.length >= 5) return products;

    // Strategy 4: Broadest — any reasonably-sized div with a price
    // that also contains an <a> tag (likely a product link)
    const divs = document.querySelectorAll('div, article, li');
    for (const div of divs) {
        const text = div.innerText || '';
        // Must be card-sized (not a container, not a fragment)
        if (text.length < 20 || text.length > 800) continue;
        if (!text.includes('$')) continue;
        // Must contain a link (product cards almost always have one)
        if (!div.querySelector('a')) continue;
        // Must not be a child of an already-extracted element
        const p = extractFromCard(div);
        if (p) products.push(p);
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

# JS to scroll the AIQ/Dispense menu container element.
# Dispense React SPAs often render products inside a scrollable inner div
# rather than using window-level scroll.  This finds the menu container
# and scrolls IT to trigger infinite-scroll loading.
_JS_SCROLL_AIQ_CONTAINER = """
async () => {
    const delay = ms => new Promise(r => setTimeout(r, ms));

    // Find the scrollable menu container
    const candidates = [
        document.querySelector('#aiq-menu'),
        document.querySelector('#dispense-menu'),
        document.querySelector('[data-aiq]'),
        document.querySelector('[class*="menu-product"]'),
        document.querySelector('[class*="product-list"]'),
        document.querySelector('[class*="ProductList"]'),
        document.querySelector('[class*="product-grid"]'),
        document.querySelector('[class*="ProductGrid"]'),
        document.querySelector('[class*="menu-container"]'),
        document.querySelector('[class*="MenuContainer"]'),
        document.querySelector('main'),
    ].filter(Boolean);

    for (const container of candidates) {
        // Check if this element is scrollable
        if (container.scrollHeight > container.clientHeight + 50) {
            const maxScrolls = 25;
            let lastHeight = 0;
            for (let i = 0; i < maxScrolls; i++) {
                container.scrollTop = container.scrollHeight;
                await delay(800);
                if (container.scrollHeight === lastHeight) break;
                lastHeight = container.scrollHeight;
            }
            container.scrollTop = 0;
            return true;
        }
    }

    // Fallback: also scroll the window (some sites use both)
    window.scrollTo(0, document.body.scrollHeight);
    return false;
}
"""

# JS to scroll to bottom and trigger lazy-loaded content.
_JS_SCROLL_TO_BOTTOM = """
async () => {
    const delay = ms => new Promise(r => setTimeout(r, ms));
    const maxScrolls = 20;
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

# "Load More" / "View More" button selectors.
# Dispense React SPAs may use various button labels and sometimes
# render the button as a <div> or <span> with role="button".
_LOAD_MORE_SELECTORS = [
    'button:has-text("Load More")',
    'button:has-text("View More")',
    'button:has-text("Show More")',
    'button:has-text("See More")',
    'button:has-text("Load more")',
    'button:has-text("View more")',
    'button:has-text("Show more")',
    'button:has-text("See more")',
    'button:has-text("More Products")',
    'button:has-text("Next")',
    'a:has-text("Load More")',
    'a:has-text("View More")',
    'a:has-text("Show More")',
    'a:has-text("See More")',
    'a:has-text("Next")',
    '[role="button"]:has-text("Load More")',
    '[role="button"]:has-text("Show More")',
    '[role="button"]:has-text("See More")',
]


class AIQScraper(BaseScraper):
    """Scraper for AIQ / Dispense (Alpine IQ) dispensary menus."""

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

        # --- Detect content: iframe embed vs direct page ---
        target = await self._find_content()

        # --- Wait for products to render ---
        try:
            if isinstance(target, Page):
                await target.wait_for_function(
                    _WAIT_FOR_AIQ_JS, timeout=30_000,
                )
            logger.info("[%s] AIQ/Dispense content detected", self.slug)
        except PlaywrightTimeout:
            logger.warning("[%s] No AIQ content after 30s — trying extraction anyway", self.slug)

        # Additional settle time for React SPA rendering
        await asyncio.sleep(_POST_AGE_GATE_WAIT)

        # --- Expand all products (scroll + Load More) ---
        await self._expand_all_products(target)

        # --- Extract products ---
        products = await self._extract_products(target)

        # --- Fallback: if iframe extraction yielded 0, try page context ---
        if not products and isinstance(target, Frame):
            logger.info("[%s] Iframe extraction yielded 0 — falling back to page context", self.slug)
            await self._expand_all_products(self.page)
            products = await self._extract_products(self.page)

        if not products:
            await self.save_debug_info("zero_products", target)
            logger.warning("[%s] No products found — see debug artifacts", self.slug)

        logger.info("[%s] Scrape complete — %d products", self.slug, len(products))
        return products

    # ------------------------------------------------------------------
    # Content detection (iframe vs direct)
    # ------------------------------------------------------------------

    async def _find_content(self) -> Union[Page, Frame]:
        """Detect whether the Dispense menu is in an iframe or on the page.

        For direct ``dispenseapp.com`` URLs, the products render on the
        page itself.  For embedded sites (Jardin, Pisos, Green NV), the
        menu may be inside an iframe.

        Excludes non-menu iframes (chat widgets, payment processors, etc.)
        to avoid extracting from the wrong context.

        Returns the Page or Frame to extract products from.
        """
        # If we're already on a dispenseapp.com URL, products are on the page
        if "dispenseapp.com" in self.page.url:
            logger.info("[%s] Direct dispenseapp.com page — using page context", self.slug)
            return self.page

        # Check for iframes from dispenseapp / alpineiq, excluding non-menu iframes
        menu_frame: Frame | None = None
        iframes = self.page.frames
        for frame in iframes:
            frame_url = frame.url or ""
            if not frame_url:
                continue

            # Skip non-menu iframes (chat widgets, payments, maps, etc.)
            is_excluded = any(excl in frame_url.lower() for excl in _IFRAME_EXCLUDE_PATTERNS)
            if is_excluded:
                logger.debug("[%s] Skipping non-menu iframe: %s", self.slug, frame_url[:80])
                continue

            for pattern in _IFRAME_PATTERNS:
                if pattern in frame_url:
                    # Prefer iframes with "menu" in the URL over others
                    if "menu" in frame_url.lower():
                        logger.info(
                            "[%s] Found Dispense menu iframe: %s",
                            self.slug, frame_url[:120],
                        )
                        await dismiss_age_gate(frame, post_dismiss_wait_sec=3)
                        return frame
                    # Store as candidate but keep looking for a better match
                    if menu_frame is None:
                        menu_frame = frame
                    break

        if menu_frame:
            frame_url = menu_frame.url or ""
            logger.info(
                "[%s] Found Dispense iframe (non-menu): %s",
                self.slug, frame_url[:120],
            )
            await dismiss_age_gate(menu_frame, post_dismiss_wait_sec=3)
            return menu_frame

        # No iframe found — products may be injected directly into the page
        logger.info("[%s] No Dispense iframe — using page context (embedded or direct)", self.slug)
        return self.page

    # ------------------------------------------------------------------
    # Load More / scroll expansion
    # ------------------------------------------------------------------

    async def _expand_all_products(self, target: Union[Page, Frame]) -> None:
        """Scroll the page and click Load More buttons to reveal all products.

        Dispense React SPAs may use:
        - Window-level scroll (infinite scroll on the page)
        - Container-level scroll (scrollable inner menu div)
        - Load More buttons with various text labels
        We try all three approaches.
        """
        page = target if isinstance(target, Page) else self.page

        # Scroll the window (triggers infinite scroll on page-level listeners)
        try:
            await page.evaluate(_JS_SCROLL_TO_BOTTOM)
            await asyncio.sleep(2)
        except Exception:
            pass

        # Also scroll inside the frame if we're targeting a frame
        if isinstance(target, Frame):
            try:
                await target.evaluate(_JS_SCROLL_TO_BOTTOM)
                await asyncio.sleep(2)
            except Exception:
                pass

        # Scroll the AIQ menu container itself — Dispense often uses a
        # scrollable inner div rather than window scroll for infinite loading.
        try:
            await target.evaluate(_JS_SCROLL_AIQ_CONTAINER)
            await asyncio.sleep(2)
        except Exception:
            pass

        # Click "Load More" / "View More" buttons until none remain
        # Each click gets up to 2 retries with backoff before giving up.
        max_clicks = 30  # Green NV has 628 products — may need many clicks
        total_clicked = 0
        for click_num in range(max_clicks):
            clicked = False
            for selector in _LOAD_MORE_SELECTORS:
                for _retry in range(3):
                    try:
                        btn = target.locator(selector).first
                        if await btn.count() > 0 and await btn.is_visible():
                            await btn.click()
                            clicked = True
                            total_clicked += 1
                            if total_clicked <= 3 or total_clicked % 10 == 0:
                                logger.info(
                                    "[%s] Clicked '%s' (round %d)",
                                    self.slug, selector, click_num + 1,
                                )
                            await asyncio.sleep(1.5)
                            # Scroll after each click to trigger lazy rendering
                            try:
                                await target.evaluate(_JS_SCROLL_AIQ_CONTAINER)
                            except Exception:
                                pass
                        break  # success or button not found
                    except Exception:
                        if _retry < 2:
                            await asyncio.sleep(2 ** (_retry + 1))
                        continue
                if clicked:
                    break
            if not clicked:
                break

        if total_clicked:
            logger.info("[%s] Load More: clicked %d times total", self.slug, total_clicked)

        # Final scroll after expanding
        try:
            scroll_target = page if isinstance(target, Page) else target
            await scroll_target.evaluate(_JS_SCROLL_TO_BOTTOM)
            await asyncio.sleep(1)
        except Exception:
            pass

    # ------------------------------------------------------------------
    # Product extraction
    # ------------------------------------------------------------------

    async def _extract_products(
        self, target: Union[Page, Frame],
    ) -> list[dict[str, Any]]:
        """Extract product cards from the AIQ/Dispense page or frame.

        Tries selectors in order, uses the first one that yields results
        with at least one price (``$``).  If a selector matches a single
        large container (e.g. the entire menu wrapper), falls back to
        JS-based extraction that splits products by child elements.
        """
        # Try JS-based extraction first (most robust for Dispense SPAs)
        products = await self._extract_via_js(target)
        if products:
            return products

        # Fallback: CSS selector cascade
        products = await self._extract_via_selectors(target)
        return products

    async def _extract_via_js(self, target: Union[Page, Frame]) -> list[dict[str, Any]]:
        """Extract products using JS — walks DOM to find individual cards."""
        try:
            raw = await target.evaluate(_JS_EXTRACT_AIQ_PRODUCTS)
        except Exception:
            logger.debug("JS product extraction failed", exc_info=True)
            return []

        products: list[dict[str, Any]] = []
        for item in raw:
            name = item.get("name", "Unknown")
            raw_text = item.get("raw_text", "")
            clean_text = _JUNK_PATTERNS.sub("", raw_text).strip()
            product: dict[str, Any] = {
                "name": name,
                "raw_text": clean_text,
                "product_url": item.get("product_url", self.url),
            }
            if item.get("price"):
                product["price"] = item["price"]
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
                logger.info("[%s] JS deduped %d → %d products", self.slug, len(products), len(unique))
            products = unique

        if products:
            logger.info("[%s] JS extraction found %d products", self.slug, len(products))
        return products

    async def _extract_via_selectors(self, target: Union[Page, Frame]) -> list[dict[str, Any]]:
        """Fallback: extract via CSS selector cascade."""
        products: list[dict[str, Any]] = []

        for selector in _PRODUCT_SELECTORS:
            try:
                await target.locator(selector).first.wait_for(
                    state="attached", timeout=8_000,
                )
            except PlaywrightTimeout:
                continue

            elements = await target.locator(selector).all()
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

                    # Skip tiny fragments (sub-elements of a real card)
                    if len(text_block.strip()) < 10:
                        continue

                    # Skip oversized containers (entire grids, not cards)
                    if len(text_block.strip()) > 2000:
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
                    logger.debug("Failed to extract an AIQ product", exc_info=True)

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
