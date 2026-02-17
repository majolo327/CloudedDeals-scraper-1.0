"""
Scraper for Rise (GTI) dispensary menus.

Rise is a proprietary Next.js SPA operated by Green Thumb Industries.
All Nevada locations share the same codebase served from
``cdn-bong.risecannabis.com``.

Flow:
  1. Navigate directly to the pickup-menu / recreational-menu URL.
  2. Detect error pages early (``__next_error__``) and bail fast.
  3. Dismiss the age gate ("Yes" / "Enter" button).
  4. Wait for the React SPA to hydrate and render product cards.
  5. Extract products — Rise loads ALL products in a single render
     (~700-730 per location), so no pagination is needed.
  6. Scroll to trigger any lazy-loaded cards.

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

from config.dispensaries import GOTO_TIMEOUT_MS, PLATFORM_DEFAULTS
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

# JS to detect if the page is a Next.js error page or has no real content.
_JS_IS_ERROR_PAGE = """
() => {
    const html = document.documentElement;
    // Next.js sets id="__next_error__" on error pages
    if (html.id === '__next_error__') return 'nextjs_error';
    // Empty body (SSR placeholder only)
    const body = document.body;
    if (!body) return 'no_body';
    const text = body.innerText || '';
    if (text.trim().length < 50) return 'empty_body';
    // Cloudflare challenge page
    const title = document.title || '';
    if (title.includes('Just a moment')) return 'cloudflare_challenge';
    // Check for common error indicators (case-insensitive)
    const lower = text.toLowerCase();
    if (lower.includes('404') && lower.includes('not found')) return '404';
    if (lower.includes('500') && lower.includes('error')) return '500';
    return '';
}
"""

# JS to wait for product-like content to appear (polls every 500ms)
_JS_WAIT_FOR_PRODUCTS = """
() => {
    const selectors = [
        '[data-testid*="product"]',
        '[class*="product-card"]',
        '[class*="ProductCard"]',
        '[class*="product-tile"]',
        '[class*="menu-product"]',
    ];
    for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        if (els.length >= 3) return true;
    }
    // Also check for any elements containing "$" (price indicators)
    const cards = document.querySelectorAll(
        'div[class*="product"], article, [class*="card"]'
    );
    let withPrice = 0;
    for (const c of cards) {
        if (c.textContent && c.textContent.includes('$')) withPrice++;
        if (withPrice >= 3) return true;
    }
    return false;
}
"""


class RiseScraper(BaseScraper):
    """Scraper for Rise (GTI) direct-page dispensary menus."""

    # Maximum number of reload attempts when Rise returns a nextjs_error.
    _MAX_RELOAD_ATTEMPTS = 3
    _RELOAD_DELAY_SEC = 5

    async def scrape(self) -> list[dict[str, Any]]:
        # Stealth overrides and analytics blocking are now applied globally
        # in BaseScraper.__aenter__ — no per-platform setup needed.
        await self.goto()
        products = await self._attempt_scrape()

        # If first attempt got 0 products due to error page, retry with reload
        if not products:
            for reload_num in range(1, self._MAX_RELOAD_ATTEMPTS + 1):
                logger.info(
                    "[%s] Reload attempt %d/%d — waiting %ds then reloading",
                    self.slug, reload_num, self._MAX_RELOAD_ATTEMPTS,
                    self._RELOAD_DELAY_SEC,
                )
                await asyncio.sleep(self._RELOAD_DELAY_SEC)
                try:
                    await self.page.reload(wait_until="load", timeout=GOTO_TIMEOUT_MS)
                except Exception as exc:
                    logger.warning("[%s] Reload failed: %s", self.slug, exc)
                    continue
                products = await self._attempt_scrape()
                if products:
                    break

        # Final fallback: navigate to the store landing page first, then to
        # the menu.  This lets Next.js initialise on a lighter page before
        # loading the heavy product catalog, reducing hydration failures.
        if not products:
            products = await self._try_landing_page_first()

        if not products:
            await self.save_debug_info("zero_products")
            logger.warning("[%s] No products found after all attempts — see debug artifacts", self.slug)

        logger.info("[%s] Scrape complete — %d products", self.slug, len(products))
        return products

    async def _try_landing_page_first(self) -> list[dict[str, Any]]:
        """Fallback: visit the store landing page first so the Next.js SPA
        can initialise on a lighter page, then navigate to the menu."""
        # Derive landing page: strip /{store-id}/{menu-type}/ from URL.
        # e.g. .../west-tropicana/886/pickup-menu/ → .../west-tropicana/
        landing = re.sub(r"/\d+/(pickup|recreational|medical)-menu/?$", "/", self.url)
        if landing == self.url:
            return []  # could not derive landing page

        logger.info("[%s] Fallback: visiting landing page first: %s", self.slug, landing)
        try:
            await self.page.goto(landing, wait_until="load", timeout=GOTO_TIMEOUT_MS)
            await asyncio.sleep(3)

            # Dismiss age gate on landing page
            await self.handle_age_gate(post_wait_sec=5)

            # Now navigate to the menu (client-side nav within the SPA)
            logger.info("[%s] Navigating to menu: %s", self.slug, self.url)
            await self.page.goto(self.url, wait_until="load", timeout=GOTO_TIMEOUT_MS)
            return await self._attempt_scrape()
        except Exception as exc:
            logger.warning("[%s] Landing-page-first fallback failed: %s", self.slug, exc)
            return []

    async def _attempt_scrape(self) -> list[dict[str, Any]]:
        """Single attempt to extract products from the current page state."""
        logger.info("[%s] Page URL: %s", self.slug, self.page.url)

        # --- Cloudflare challenge detection (bail immediately) ---
        if await self.detect_cloudflare_challenge():
            return []

        # --- Early error page detection ---
        error_type = await self._detect_error_page()
        if error_type:
            logger.warning(
                "[%s] Error page detected (%s) — will retry via reload",
                self.slug, error_type,
            )
            return []

        # --- Dismiss age gate ---
        dismissed = await self.handle_age_gate(
            post_wait_sec=_POST_AGE_GATE_WAIT,
        )
        if dismissed:
            logger.info("[%s] Age gate dismissed, waited %ds", self.slug, _POST_AGE_GATE_WAIT)
        else:
            logger.info("[%s] No age gate — waiting for SPA hydration", self.slug)

        # --- Wait for actual product content to render ---
        products_ready = await self._wait_for_products()
        if not products_ready:
            # Check again if it became an error page after hydration
            error_type = await self._detect_error_page()
            if error_type:
                logger.warning("[%s] Page became error after hydration (%s)", self.slug, error_type)
                return []
            logger.warning("[%s] No product content detected after waiting — will attempt extraction", self.slug)

        # --- Scroll to trigger any lazy-loaded cards ---
        try:
            await self.page.evaluate(_JS_SCROLL_TO_BOTTOM)
            await asyncio.sleep(2)
        except Exception:
            pass

        # --- Extract products ---
        return await self._extract_products()

    # ------------------------------------------------------------------
    # Error detection & readiness checks
    # ------------------------------------------------------------------

    async def _detect_error_page(self) -> str:
        """Return a non-empty error type string if the page is broken."""
        try:
            result = await self.page.evaluate(_JS_IS_ERROR_PAGE)
            return result or ""
        except Exception:
            return ""

    async def _wait_for_products(self) -> bool:
        """Wait up to 20s for product elements to appear on the page.

        Uses a JS poll instead of a blind sleep — returns as soon as
        products are detected, saving time on fast-loading pages.
        """
        try:
            await self.page.wait_for_function(
                _JS_WAIT_FOR_PRODUCTS, timeout=20_000,
            )
            logger.info("[%s] Product content detected in DOM", self.slug)
            # Small extra settle for rendering
            await asyncio.sleep(2)
            return True
        except PlaywrightTimeout:
            return False

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
