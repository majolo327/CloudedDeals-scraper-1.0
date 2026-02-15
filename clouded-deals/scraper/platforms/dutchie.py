"""
Scraper for Dutchie-powered dispensary menus (iframe *or* JS embed).

Flow:
  1. Navigate to the dispensary page with ``wait_until='load'``.
  2. Click the age gate button to trigger the Dutchie embed callback
     that creates the iframe (or JS-injected content).  The embed script
     only injects the menu AFTER the button-click callback fires —
     force-removing the overlay without clicking does NOT trigger it.
  3. Force-remove any lingering overlay residue so it can't intercept clicks.
  4. **Smart-wait** for Dutchie content to appear in the DOM (polling
     for iframes, JS-embed containers, or product cards) instead of a
     fixed sleep.  This proceeds as soon as content is detected.
  5. Detect Dutchie content: try iframe first (45 s), fall back to
     JS embed probing (60 s) for sites that inject into the page DOM.
  6. Extract products from whichever target was found.
  7. Paginate via ``aria-label="go to page N"`` buttons.
  8. If specials returned 0 products, fall back to the base menu URL.
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any, Union
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode

from playwright.async_api import Page, Frame, TimeoutError as PlaywrightTimeout

from clouded_logic import CONSECUTIVE_EMPTY_MAX
from config.dispensaries import PLATFORM_DEFAULTS
from handlers import dismiss_age_gate, force_remove_age_gate, find_dutchie_content, navigate_dutchie_page
from .base import BaseScraper

logger = logging.getLogger(__name__)

_DUTCHIE_CFG = PLATFORM_DEFAULTS["dutchie"]
_BETWEEN_PAGES_SEC = _DUTCHIE_CFG["between_pages_sec"]          # 5 s

_TD_SLUGS = {"td-gibson", "td-eastern", "td-decatur"}
_PRODUCT_SELECTORS = [
    '[data-testid="product-card"]',
    '[data-testid*="product"]',
    '[class*="ProductCard"]',
    '[class*="product-card"]',
    'div[class*="product"]',
]

# Junk patterns to strip from raw_text before sending to CloudedLogic
_JUNK_PATTERNS = re.compile(
    r"(Add to (cart|bag)|Remove|View details|Out of stock|"
    r"Sale!|New!|Limited|Sold out|In stock|"
    r"\bQty\b.*$|\bQuantity\b.*$|"
    r"\b(?:THC|CBD|CBN|CBG|CBC)\s*:\s*[\d.]+\s*(?:mg|%)|"  # cannabinoid content
    r"\bLocal Love!?|"                                        # NV promo badges
    r"\bNew Arrival!?|"
    r"\bStaff Pick!?)",
    re.IGNORECASE | re.MULTILINE,
)

# Trailing strain-type labels that shouldn't be in the product name
_TRAILING_STRAIN = re.compile(r"\s*(Indica|Sativa|Hybrid)\s*$", re.IGNORECASE)

# Age gate cookie to set if the site's own JS doesn't set one after overlay removal.
_AGE_GATE_COOKIE_JS = """
() => {
    document.cookie = 'agc=1; path=/; max-age=86400';
    document.cookie = 'age_verified=true; path=/; max-age=86400';
    document.cookie = 'ageGateConfirmed=1; path=/; max-age=86400';
}
"""

# Smart-wait JS: polls the DOM for any sign of Dutchie content.
# Returns true as soon as an iframe, JS-embed container, or product
# cards appear — NO fixed sleep.  This is the "wait until something
# loaded" approach that previously worked for all 9 Dutchie sites.
_WAIT_FOR_DUTCHIE_JS = """
() => {
    // Dutchie iframe injected?
    const iframes = document.querySelectorAll('iframe');
    for (const f of iframes) {
        const src = f.getAttribute('src') || '';
        if (src.includes('dutchie') || src.includes('embedded-menu') || src.includes('goshango') || src.includes('menu')) {
            return true;
        }
    }
    // JS-embed container injected?
    if (document.querySelector('#dutchie--embed') ||
        document.querySelector('[data-dutchie]') ||
        document.querySelector('.dutchie--embed') ||
        document.querySelector('#dutchie')) {
        return true;
    }
    // Direct product cards on page?
    if (document.querySelectorAll('[data-testid*="product"]').length >= 3 ||
        document.querySelectorAll('[class*="ProductCard"]').length >= 3) {
        return true;
    }
    return false;
}
"""


def _strip_specials_from_url(url: str) -> str | None:
    """Remove specials indicator from a Dutchie URL to get the base menu.

    Handles two patterns:
    - Query param: ``?dtche%5Bpath%5D=specials`` (TD sites)
    - URL path: ``/specials`` (Planet 13, etc.)

    Returns ``None`` if no specials indicator is present.
    """
    parsed = urlparse(url)

    # Case 1: dtche[path]=specials in query string (TD sites)
    params = parse_qs(parsed.query)
    if params.get("dtche[path]") == ["specials"]:
        params.pop("dtche[path]")
        new_query = urlencode(params, doseq=True)
        return urlunparse(parsed._replace(query=new_query))

    # Case 2: /specials in URL path
    if parsed.path.endswith("/specials") or "/specials/" in parsed.path:
        new_path = parsed.path.replace("/specials", "") or "/"
        return urlunparse(parsed._replace(path=new_path))

    return None


class DutchieScraper(BaseScraper):
    """Scraper for sites powered by the Dutchie embedded iframe menu."""

    async def scrape(self) -> list[dict[str, Any]]:
        # Read per-site embed_type hint (e.g. "js_embed" for TD sites)
        # so we skip detection phases that won't match.
        embed_hint = self.dispensary.get("embed_type") or _DUTCHIE_CFG.get("embed_type")
        fallback_url = self.dispensary.get("fallback_url")

        # Auto-detect: dutchie.com/dispensary/* pages are direct React SPAs
        # with NO iframe.  Override to "direct" to skip the 270s iframe
        # detection cascade + 60s JS embed cascade entirely.
        url_host = urlparse(self.url).netloc
        if url_host in ("dutchie.com", "www.dutchie.com"):
            embed_hint = "direct"
            logger.info("[%s] Auto-detected embed_type='direct' for %s URL", self.slug, url_host)

        # --- Navigate with wait_until='load' (scripts fully execute) ------
        await self.goto()

        # Post-navigate settle — let JS-heavy sites finish initializing
        await asyncio.sleep(3)

        # --- Cloudflare detection (bail early to save ~300s) --------------
        # If the primary site is Cloudflare-blocked, the full detection
        # cascade will burn 300+ seconds timing out on selectors that
        # will never match.  Skip directly to fallback URL if available.
        if await self.detect_cloudflare_challenge():
            if fallback_url and fallback_url != self.url:
                logger.warning(
                    "[%s] Cloudflare blocked on primary — skipping to fallback: %s",
                    self.slug, fallback_url,
                )
                return await self._scrape_with_fallback(fallback_url, embed_hint)
            logger.error("[%s] Cloudflare blocked and no fallback URL — aborting", self.slug)
            return []

        # --- Set age gate cookies -----------------------------------------
        await self.page.evaluate(_AGE_GATE_COOKIE_JS)

        # --- CLICK the age gate button FIRST ------------------------------
        # The Dutchie embed script only injects the menu iframe AFTER the
        # button-click callback fires — force-removing the overlay via JS
        # does NOT trigger it.  Click first, then smart-wait.
        # NOTE: post_wait_sec=3 (minimal) — the real wait is the smart poll below.
        clicked = await self.handle_age_gate(post_wait_sec=3)
        if clicked:
            logger.info("[%s] Age gate clicked — smart-waiting for Dutchie content", self.slug)
        else:
            logger.warning("[%s] No age gate button found — embed may already be loaded", self.slug)

        # --- JS cleanup: remove any lingering overlay residue -------------
        removed = await force_remove_age_gate(self.page)
        if removed > 0:
            logger.info("[%s] Cleaned up %d lingering overlay(s) via JS", self.slug, removed)

        # --- Smart-wait: poll DOM for Dutchie content -----------------------
        # Instead of a fixed asyncio.sleep(20), this returns the MOMENT
        # any iframe / container / product cards appear in the DOM.
        # For direct pages (dutchie.com/dispensary/*), use shorter timeout:
        # these are React SPAs — if they don't render in 30s, they won't.
        is_direct_host = url_host in ("dutchie.com", "www.dutchie.com")
        smart_wait_ms = 30_000 if is_direct_host else 60_000
        probe_timeout_sec = 15 if is_direct_host else 60
        try:
            await self.page.wait_for_function(
                _WAIT_FOR_DUTCHIE_JS, timeout=smart_wait_ms,
            )
            logger.info("[%s] Smart-wait: Dutchie content detected in DOM", self.slug)
        except PlaywrightTimeout:
            logger.warning(
                "[%s] Smart-wait: no Dutchie content after %ds — will try detection anyway",
                self.slug, smart_wait_ms // 1000,
            )

        # --- Detect Dutchie content using embed_type hint -----------------
        # When we know the embed type (e.g. TD = js_embed), skip the
        # iframe detection phase entirely — saves ~45 s per site.
        logger.info("[%s] Detecting content (embed_hint=%s)", self.slug, embed_hint)
        target, embed_type = await find_dutchie_content(
            self.page,
            iframe_timeout_ms=45_000,
            js_embed_timeout_sec=probe_timeout_sec,
            embed_type_hint=embed_hint,
        )

        if target is None:
            # --- Fast-path: skip reload+retry when fallback URL exists ----
            # The reload+retry cycle costs ~300s (navigation + smart-wait +
            # full detection cascade).  When a fallback_url is configured,
            # skip this expensive cycle and go directly to the fallback —
            # this keeps the total scrape within the 600s timeout.
            if fallback_url and fallback_url != self.url:
                logger.warning(
                    "[%s] No Dutchie content on primary — skipping to fallback: %s",
                    self.slug, fallback_url,
                )
                await self.save_debug_info("no_dutchie_content_primary")
                return await self._scrape_with_fallback(fallback_url, embed_hint)

            # For dutchie.com direct pages, skip the expensive reload+retry
            # cycle — if the SPA didn't render on first load, reloading
            # the same Cloudflare-degraded page won't help.
            if is_direct_host:
                logger.warning(
                    "[%s] No content on dutchie.com direct page — skipping reload retry",
                    self.slug,
                )
                await self.save_debug_info("no_dutchie_content_direct")
                return []

            # No fallback: reload page and retry the full click flow once
            logger.warning("[%s] No Dutchie content after click — trying reload + re-click", self.slug)
            await self.page.evaluate(_AGE_GATE_COOKIE_JS)
            await self.page.reload(wait_until="load", timeout=120_000)
            await asyncio.sleep(3)
            await self.handle_age_gate(post_wait_sec=3)
            await force_remove_age_gate(self.page)

            # Smart-wait again after reload
            try:
                await self.page.wait_for_function(
                    _WAIT_FOR_DUTCHIE_JS, timeout=smart_wait_ms,
                )
                logger.info("[%s] Smart-wait (retry): Dutchie content detected", self.slug)
            except PlaywrightTimeout:
                logger.warning("[%s] Smart-wait (retry): still nothing after %ds", self.slug, smart_wait_ms // 1000)

            # On retry, don't use the hint — try the full cascade
            target, embed_type = await find_dutchie_content(
                self.page,
                iframe_timeout_ms=45_000,
                js_embed_timeout_sec=probe_timeout_sec,
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
        consecutive_empty = 0

        while True:
            products = await self._extract_products(target)
            all_products.extend(products)
            logger.info(
                "[%s] Page %d → %d products (total %d)",
                self.slug, page_num, len(products), len(all_products),
            )

            # Track consecutive pages that returned 0 products.
            # Do NOT break on the first empty page — the DOM may still
            # be rendering.  Only bail after CONSECUTIVE_EMPTY_MAX (3)
            # consecutive empties (resilience logic from v102).
            if len(products) == 0:
                consecutive_empty += 1
                if consecutive_empty >= CONSECUTIVE_EMPTY_MAX:
                    logger.warning(
                        "[%s] %d consecutive empty pages — stopping pagination (total %d products)",
                        self.slug, consecutive_empty, len(all_products),
                    )
                    break
            else:
                consecutive_empty = 0

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

        # --- Fallback: if specials returned 0 products, try base menu ------
        if not all_products:
            base_url = _strip_specials_from_url(self.url)
            if base_url and base_url != self.url:
                logger.warning(
                    "[%s] Specials page returned 0 products — retrying base menu: %s",
                    self.slug, base_url,
                )
                await self.save_debug_info("zero_products_specials", target)

                await self.goto(base_url)
                await asyncio.sleep(3)
                await self.page.evaluate(_AGE_GATE_COOKIE_JS)
                clicked = await self.handle_age_gate(post_wait_sec=3)
                if clicked:
                    logger.info("[%s] Age gate clicked on base menu", self.slug)
                await force_remove_age_gate(self.page)

                try:
                    await self.page.wait_for_function(
                        _WAIT_FOR_DUTCHIE_JS, timeout=60_000,
                    )
                    logger.info("[%s] Smart-wait: Dutchie content detected on base menu", self.slug)
                except PlaywrightTimeout:
                    logger.warning("[%s] Smart-wait: no content on base menu after 60s", self.slug)

                target, embed_type = await find_dutchie_content(
                    self.page,
                    iframe_timeout_ms=45_000,
                    js_embed_timeout_sec=60,
                    embed_type_hint=embed_hint,
                )

                if target is not None:
                    logger.info("[%s] Base menu content found via %s", self.slug, embed_type)
                    if embed_type == "iframe":
                        await dismiss_age_gate(target)

                    page_num = 1
                    while True:
                        products = await self._extract_products(target)
                        all_products.extend(products)
                        logger.info(
                            "[%s] Base menu page %d → %d products (total %d)",
                            self.slug, page_num, len(products), len(all_products),
                        )
                        page_num += 1
                        await force_remove_age_gate(self.page)
                        try:
                            if not await navigate_dutchie_page(target, page_num):
                                break
                        except Exception as exc:
                            logger.warning(
                                "[%s] Base menu pagination to page %d failed (%s) — keeping %d products",
                                self.slug, page_num, exc, len(all_products),
                            )
                            break
                else:
                    logger.warning("[%s] No Dutchie content on base menu either", self.slug)

        # --- Fallback URL from config (e.g. Jardin switched from AIQ to Dutchie) ---
        if not all_products:
            fallback_url = self.dispensary.get("fallback_url")
            if fallback_url and fallback_url != self.url:
                logger.warning(
                    "[%s] Primary + base menu both empty — trying fallback_url: %s",
                    self.slug, fallback_url,
                )
                await self.goto(fallback_url)
                await asyncio.sleep(3)
                await self.page.evaluate(_AGE_GATE_COOKIE_JS)
                await self.handle_age_gate(post_wait_sec=3)
                await force_remove_age_gate(self.page)

                try:
                    await self.page.wait_for_function(
                        _WAIT_FOR_DUTCHIE_JS, timeout=60_000,
                    )
                except PlaywrightTimeout:
                    pass

                fb_target, fb_embed = await find_dutchie_content(
                    self.page,
                    iframe_timeout_ms=45_000,
                    js_embed_timeout_sec=60,
                )
                if fb_target is not None:
                    logger.info("[%s] Fallback URL content found via %s", self.slug, fb_embed)
                    if fb_embed == "iframe":
                        await dismiss_age_gate(fb_target)
                    page_num = 1
                    while True:
                        products = await self._extract_products(fb_target)
                        all_products.extend(products)
                        logger.info("[%s] Fallback page %d → %d products (total %d)",
                                    self.slug, page_num, len(products), len(all_products))
                        page_num += 1
                        await force_remove_age_gate(self.page)
                        try:
                            if not await navigate_dutchie_page(fb_target, page_num):
                                break
                        except Exception:
                            break

        if not all_products:
            await self.save_debug_info("zero_products", target)
        logger.info("[%s] Scrape complete — %d products (%s mode)", self.slug, len(all_products), embed_type)
        return all_products

    # ------------------------------------------------------------------
    # Fallback URL scraping
    # ------------------------------------------------------------------

    async def _scrape_with_fallback(
        self, fallback_url: str, embed_hint: str | None,
    ) -> list[dict[str, Any]]:
        """Navigate to *fallback_url* and run the full scrape flow there.

        Used when the primary URL is blocked (Cloudflare) or content
        detection fails.  Runs the same age gate → smart-wait → detect
        → paginate cycle but on the fallback URL.
        """
        logger.info("[%s] Trying fallback URL: %s", self.slug, fallback_url)
        await self.goto(fallback_url)
        await asyncio.sleep(3)

        # Cloudflare on fallback = give up
        if await self.detect_cloudflare_challenge():
            logger.error("[%s] Cloudflare blocked on fallback URL too — aborting", self.slug)
            return []

        await self.page.evaluate(_AGE_GATE_COOKIE_JS)
        await self.handle_age_gate(post_wait_sec=3)
        await force_remove_age_gate(self.page)

        try:
            await self.page.wait_for_function(
                _WAIT_FOR_DUTCHIE_JS, timeout=60_000,
            )
            logger.info("[%s] Smart-wait (fallback): Dutchie content detected", self.slug)
        except PlaywrightTimeout:
            logger.warning("[%s] Smart-wait (fallback): no content after 60s", self.slug)

        # Try detection — use full cascade (no hint) since fallback URL
        # may use a different embed type than the primary.
        fb_target, fb_embed = await find_dutchie_content(
            self.page,
            iframe_timeout_ms=45_000,
            js_embed_timeout_sec=60,
        )

        if fb_target is None:
            logger.error("[%s] No Dutchie content on fallback URL — aborting", self.slug)
            await self.save_debug_info("no_dutchie_content_fallback")
            return []

        logger.info("[%s] Fallback URL content found via %s", self.slug, fb_embed)
        if fb_embed == "iframe":
            await dismiss_age_gate(fb_target)

        all_products: list[dict[str, Any]] = []
        page_num = 1
        consecutive_empty = 0

        while True:
            products = await self._extract_products(fb_target)
            all_products.extend(products)
            logger.info(
                "[%s] Fallback page %d → %d products (total %d)",
                self.slug, page_num, len(products), len(all_products),
            )
            if len(products) == 0:
                consecutive_empty += 1
                if consecutive_empty >= CONSECUTIVE_EMPTY_MAX:
                    break
            else:
                consecutive_empty = 0

            page_num += 1
            await force_remove_age_gate(self.page)
            try:
                if not await navigate_dutchie_page(fb_target, page_num):
                    break
            except Exception:
                break

        if not all_products:
            await self.save_debug_info("zero_products_fallback", fb_target)
        logger.info(
            "[%s] Fallback scrape complete — %d products (%s mode)",
            self.slug, len(all_products), fb_embed,
        )
        return all_products

    # ------------------------------------------------------------------
    # Product extraction
    # ------------------------------------------------------------------

    async def _extract_products(self, frame: Union[Page, Frame]) -> list[dict[str, Any]]:
        """Pull product data out of the current Dutchie page view.

        Tries multiple selectors and extracts clean names, prices, and
        product URLs from each card.
        """
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

        seen_names: set[str] = set()

        for el in elements:
            try:
                # --- Name extraction (try multiple strategies) ---
                name = None

                # Strategy 1: aria-label on the card itself
                name = await el.get_attribute("aria-label")

                # Strategy 2: heading element inside the card
                if not name:
                    for heading_sel in ("h2", "h3", "h4", "[class*='name']", "[class*='Name']", "[class*='title']"):
                        try:
                            heading = el.locator(heading_sel).first
                            if await heading.count() > 0:
                                name = (await heading.inner_text()).strip()
                                if name:
                                    break
                        except Exception:
                            continue

                # Strategy 3: first meaningful line of text
                if not name:
                    text_block = await el.inner_text()
                    for line in text_block.split("\n"):
                        line = line.strip()
                        # Skip short/junk lines
                        if len(line) >= 3 and not line.startswith("$") and "Add to" not in line:
                            name = line
                            break

                if not name:
                    name = (await el.inner_text()).split("\n")[0].strip()

                # Clean the name
                name = _TRAILING_STRAIN.sub("", name).strip()
                name = _JUNK_PATTERNS.sub("", name).strip()
                name = re.sub(r"\s{2,}", " ", name).strip()

                if not name or len(name) < 3:
                    continue

                # --- Raw text extraction (cleaned) ---
                text_block = await el.inner_text()
                raw_text = _JUNK_PATTERNS.sub("", text_block).strip()
                raw_text = re.sub(r"\n{3,}", "\n\n", raw_text)  # collapse blank lines

                # --- Separate offer/bundle text from product text ---
                # Dutchie "Special Offers" sections live inside the same
                # card container.  Split them out so brand detection
                # doesn't pick up brands from bundle deals.
                offer_text = ""
                if re.search(r"Special Offers?\s*\(", raw_text):
                    parts = re.split(
                        r"Special Offers?\s*\(\s*\d+\s*\)",
                        raw_text, maxsplit=1,
                    )
                    raw_text = parts[0].strip()
                    offer_text = parts[1].strip() if len(parts) > 1 else ""

                # --- In-page dedup (same name on same page = duplicate) ---
                dedup_key = name.lower().strip()
                if dedup_key in seen_names:
                    continue
                seen_names.add(dedup_key)

                # --- Brand extraction (separate element on card) ---
                # Dutchie product cards show the brand name as a distinct
                # text element above the product title (e.g. "ROVE" above
                # "Peaches & Cream - Infused Ice Packs").  Extract it for
                # high-confidence brand identification.
                scraped_brand = None
                for brand_sel in (
                    "[class*='brand']", "[class*='Brand']",
                    "[data-testid*='brand']", "[data-testid*='Brand']",
                ):
                    try:
                        brand_el = el.locator(brand_sel).first
                        if await brand_el.count() > 0:
                            scraped_brand = (await brand_el.inner_text()).strip()
                            if scraped_brand and len(scraped_brand) >= 2:
                                break
                            scraped_brand = None
                    except Exception:
                        continue

                product: dict[str, Any] = {
                    "name": name,
                    "raw_text": raw_text,
                    "offer_text": offer_text,  # bundle text, kept separate
                    "product_url": self.url,  # fallback: dispensary menu URL
                }
                if scraped_brand:
                    product["scraped_brand"] = scraped_brand

                # --- Product link ---
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

                # --- Price extraction (all dollar amounts) ---
                lines = [ln.strip() for ln in text_block.split("\n") if ln.strip()]
                price_lines = [ln for ln in lines if "$" in ln]
                if price_lines:
                    # Join all price-containing lines for better parsing
                    product["price"] = " ".join(price_lines)

                products.append(product)
            except Exception:
                logger.debug("Failed to extract a product element", exc_info=True)

        return products
