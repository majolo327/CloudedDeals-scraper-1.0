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
  8. Click through category tabs (Flower, Edibles, Concentrates, etc.)
     and paginate each to capture the FULL product catalog.
  9. If specials returned 0 products, fall back to the base menu URL.
"""

from __future__ import annotations

import asyncio
import logging
import random
import re
from typing import Any, Union
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode

from playwright.async_api import Page, Frame, TimeoutError as PlaywrightTimeout

from clouded_logic import CONSECUTIVE_EMPTY_MAX
from config.dispensaries import PLATFORM_DEFAULTS, is_expansion_region
from handlers import dismiss_age_gate, force_remove_age_gate, find_dutchie_content, navigate_dutchie_page
from .base import BaseScraper

logger = logging.getLogger(__name__)

_DUTCHIE_CFG = PLATFORM_DEFAULTS["dutchie"]
_BETWEEN_PAGES_SEC = _DUTCHIE_CFG["between_pages_sec"]          # 5 s

_TD_SLUGS = {"td-gibson", "td-eastern", "td-decatur"}

# Smart-wait timeouts: content-based polling returns instantly when content
# appears, so the cap only matters if the page is slow to inject.
# Proven pattern uses a fixed 5s sleep — 30s is generous but prevents the
# 120s waits that were consuming most of the timeout budget.
_SMART_WAIT_MS = 30_000          # 30 s — if embed hasn't injected by now, it won't
_SMART_WAIT_RETRY_MS = 20_000    # 20 s on retry attempts

# Shorter timeouts for dutchie.com direct URLs (React SPAs) — these either
# render product cards within ~15 s or not at all.
_SMART_WAIT_DIRECT_MS = 15_000       # 15 s first attempt
_SMART_WAIT_DIRECT_RETRY_MS = 10_000  # 10 s retry

# Planet 13 / Medizin share planet13.com — a store selector in the header
# must be confirmed so the Dutchie embed loads the correct dispensary menu.
_P13_STORE_MAP: dict[str, str] = {
    "planet13": "planet 13",
    "medizin": "medizin",
}
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

# Category labels that appear as standalone lines in Dutchie card text.
# Map scraped text → normalized category for scraped_category.
_CATEGORY_LABEL_MAP: dict[str, str] = {
    "pre-roll": "preroll",
    "pre-rolls": "preroll",
    "pre roll": "preroll",
    "pre rolls": "preroll",
    "preroll": "preroll",
    "prerolls": "preroll",
    "pre-roll single": "preroll",
    "flower": "flower",
    "vape": "vape",
    "vapes": "vape",
    "cartridge": "vape",
    "cartridges": "vape",
    "concentrate": "concentrate",
    "concentrates": "concentrate",
    "edible": "edible",
    "edibles": "edible",
}

# Regex to detect standalone category labels in raw_text lines
_RE_CATEGORY_LABEL = re.compile(
    r"^\s*(?:Pre[-\s]?Rolls?|Prerolls?|Pre[-\s]?Roll\s+Single|"
    r"Flower|Vapes?|Cartridges?|Concentrates?|Edibles?)\s*$",
    re.IGNORECASE | re.MULTILINE,
)

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


async def _ensure_store_selected(page: Page, slug: str) -> None:
    """Ensure the correct store is selected on planet13.com.

    Planet 13 and Medizin share the same domain.  The site shows a store
    picker in the upper left ("Shopping at: ...").  If the wrong store is
    selected, the Dutchie embed loads the wrong menu.  This clicks the
    store selector and picks the correct location based on slug.
    """
    expected = _P13_STORE_MAP.get(slug)
    if expected is None:
        return  # not a P13/Medizin site

    logger.info("[%s] Checking store selector for planet13.com", slug)

    # Strategy 1: look for a store selector button/link with "Shopping at"
    # or similar text, or a location picker element.
    store_selector_patterns = [
        'button:has-text("Shopping at")',
        'a:has-text("Shopping at")',
        '[class*="store-selector"]',
        '[class*="storeSelector"]',
        '[class*="location-picker"]',
        '[class*="locationPicker"]',
        '[data-testid*="store"]',
        '[class*="StorePicker"]',
        '[class*="store-picker"]',
    ]

    selector_el = None
    for sel in store_selector_patterns:
        try:
            loc = page.locator(sel).first
            if await loc.count() > 0:
                selector_el = loc
                logger.info("[%s] Found store selector via %r", slug, sel)
                break
        except Exception:
            continue

    if selector_el is None:
        # Strategy 2: find any clickable element whose text contains
        # a store name in the upper portion of the page (top 200px).
        try:
            store_el = await page.evaluate("""
            () => {
                const els = document.querySelectorAll('button, a, [role="button"]');
                for (const el of els) {
                    const rect = el.getBoundingClientRect();
                    const text = (el.textContent || '').toLowerCase();
                    if (rect.top < 200 && (
                        text.includes('shopping at') ||
                        text.includes('select store') ||
                        text.includes('choose location') ||
                        text.includes('planet 13') ||
                        text.includes('medizin')
                    )) {
                        return el.textContent.trim();
                    }
                }
                return null;
            }
            """)
            if store_el:
                logger.info("[%s] Found store indicator text: %r", slug, store_el[:80])
                # Check if the correct store is already selected
                if expected in store_el.lower():
                    logger.info("[%s] Correct store already selected", slug)
                    return
        except Exception:
            pass

    # If we found a selector element, check if it shows the right store
    if selector_el is not None:
        try:
            current_text = (await selector_el.inner_text()).lower()
            if expected in current_text:
                logger.info("[%s] Correct store already selected: %r", slug, current_text[:80])
                return

            # Wrong store — click to open the picker
            logger.info("[%s] Wrong store selected (%r) — clicking to change", slug, current_text[:80])
            await selector_el.click()
            await asyncio.sleep(1)

            # Look for the correct store option and click it
            option = page.locator(f'text=/{expected}/i').first
            if await option.count() > 0:
                await option.click()
                logger.info("[%s] Selected store: %s", slug, expected)
                await asyncio.sleep(3)  # wait for menu to reload
            else:
                logger.warning("[%s] Could not find store option %r in picker", slug, expected)
        except Exception as exc:
            logger.warning("[%s] Store selector interaction failed: %s", slug, exc)
    else:
        logger.info("[%s] No store selector found — proceeding with current store", slug)


async def _scroll_to_load_content(
    target: Page | Frame,
    slug: str,
    *,
    max_scrolls: int = 8,
    scroll_pause_sec: float = 1.5,
) -> None:
    """Incrementally scroll to the bottom of *target* to trigger lazy loaders.

    Many Dutchie sites (especially content-heavy ones like td-gibson) defer
    rendering product cards until they enter the viewport.  This scrolls in
    increments, pausing between each to let the site's IntersectionObserver
    or scroll-based lazy loader fire.  Applied to all Dutchie sites as a
    universal fallback — fast sites already have their cards and the scroll
    is a no-op.
    """
    try:
        for step in range(max_scrolls):
            await target.evaluate(
                """(step) => {
                    const h = document.documentElement.scrollHeight || document.body.scrollHeight;
                    const stepSize = Math.ceil(h / 6);
                    window.scrollTo({ top: stepSize * (step + 1), behavior: 'smooth' });
                }""",
                step,
            )
            await asyncio.sleep(scroll_pause_sec)

        # Final scroll to absolute bottom
        await target.evaluate("() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })")
        await asyncio.sleep(scroll_pause_sec)

        # Scroll back to top so pagination buttons are accessible
        await target.evaluate("() => window.scrollTo({ top: 0, behavior: 'smooth' })")
        await asyncio.sleep(0.5)

        logger.info("[%s] Scroll-to-load complete (%d increments)", slug, max_scrolls)
    except Exception as exc:
        # Non-fatal — some iframe contexts may restrict scrolling
        logger.debug("[%s] Scroll-to-load failed (non-fatal): %s", slug, exc)


async def _wait_for_product_cards(
    target: Page | Frame,
    slug: str,
    timeout_ms: int = 45_000,
) -> bool:
    """Wait for product cards to render inside *target* before extraction.

    All Dutchie sites benefit from this — the smart-wait detects the
    container/iframe injection, but product cards inside may not have
    rendered yet.  Returns True if cards were found, False on timeout.
    Used as the primary pre-extraction gate and as a retry fallback
    when the first extraction yields 0 products.
    """
    js = """
    () => {
        const probes = [
            '[data-testid="product-card"]',
            '[data-testid*="product"]',
            '[class*="ProductCard"]',
            '[class*="product-card"]',
        ];
        for (const sel of probes) {
            if (document.querySelectorAll(sel).length >= 3) return true;
        }
        return false;
    }
    """
    try:
        await target.wait_for_function(js, timeout=timeout_ms)
        logger.info("[%s] Product cards populated in target", slug)
        return True
    except PlaywrightTimeout:
        logger.warning("[%s] Product cards not populated after %ds — proceeding anyway", slug, timeout_ms // 1000)
        return False


# Dutchie category tab selectors — used to click through each menu category
# and paginate independently.  Dutchie menus show category filters as tabs
# or buttons (e.g. "Flower", "Edibles", "Concentrates", "Vapes", "Pre-Rolls").
# Clicking each tab resets pagination and shows that category's products.
_CATEGORY_TAB_SELECTORS = [
    # Dutchie tab/filter button patterns
    'button[data-testid*="category"]',
    'button[class*="category"]',
    'button[class*="Category"]',
    'a[class*="category"]',
    'a[class*="Category"]',
    '[data-testid*="filter"]',
    '[role="tab"]',
    # Nav link patterns for category filters
    'nav button',
    'nav a',
    '[class*="filter"] button',
    '[class*="Filter"] button',
    '[class*="menu-type"] button',
    '[class*="MenuType"] button',
]

# Known Dutchie category labels to click through
_DUTCHIE_CATEGORIES = [
    "Flower", "Edibles", "Concentrates", "Vapes", "Pre-Rolls",
    "Topicals", "Tinctures", "Accessories", "Beverages",
    "Cartridges", "Pre-Roll", "Preroll", "Edible", "Vape",
]

# JS to find and return all clickable category filter buttons/tabs.
# Returns a list of {text, index} objects for each unique category button found.
_JS_FIND_CATEGORY_TABS = """
() => {
    const tabs = [];
    const seen = new Set();

    // Strategy 1: data-testid category buttons
    const testIdBtns = document.querySelectorAll(
        'button[data-testid*="category"], button[data-testid*="filter"], ' +
        '[data-testid*="category-tab"], [data-testid*="menu-type"]'
    );
    for (const btn of testIdBtns) {
        const text = (btn.textContent || '').trim();
        if (text && text.length >= 3 && text.length <= 30 && !seen.has(text.toLowerCase())) {
            seen.add(text.toLowerCase());
            tabs.push({text: text, index: tabs.length});
        }
    }
    if (tabs.length >= 3) return tabs;

    // Strategy 2: role="tab" elements (Dutchie's tab-based category nav)
    const roleTabs = document.querySelectorAll('[role="tab"], [role="tablist"] button, [role="tablist"] a');
    for (const tab of roleTabs) {
        const text = (tab.textContent || '').trim();
        if (text && text.length >= 3 && text.length <= 30 && !seen.has(text.toLowerCase())) {
            seen.add(text.toLowerCase());
            tabs.push({text: text, index: tabs.length});
        }
    }
    if (tabs.length >= 3) return tabs;

    // Strategy 3: nav buttons/links with category-like labels
    const categoryNames = new Set([
        'flower', 'edibles', 'edible', 'concentrates', 'concentrate',
        'vapes', 'vape', 'pre-rolls', 'pre-roll', 'preroll', 'prerolls',
        'topicals', 'topical', 'tinctures', 'tincture', 'accessories',
        'beverages', 'beverage', 'cartridges', 'cartridge', 'specials',
        'all', 'all products', 'shop all'
    ]);
    const allBtns = document.querySelectorAll('button, a, [role="button"]');
    for (const btn of allBtns) {
        const text = (btn.textContent || '').trim();
        const lower = text.toLowerCase();
        if (categoryNames.has(lower) && !seen.has(lower)) {
            seen.add(lower);
            tabs.push({text: text, index: tabs.length});
        }
    }

    return tabs;
}
"""


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
        # Randomized 2-5s to avoid predictable timing fingerprint
        await asyncio.sleep(2 + random.uniform(0, 3))

        # --- Cloudflare detection (bail early to save ~300s) --------------
        # If the primary site is Cloudflare-blocked, the full detection
        # cascade will burn 300+ seconds timing out on selectors that
        # will never match.  Skip directly to fallback URL if available.
        if await self.detect_cloudflare_challenge():
            # Retry once after a brief wait — Cloudflare challenges are
            # sometimes intermittent and a fresh page load can succeed.
            logger.info("[%s] Cloudflare detected — retrying after 5s delay", self.slug)
            await asyncio.sleep(5)
            await self.page.reload(wait_until="load", timeout=60_000)
            await asyncio.sleep(2 + random.uniform(0, 3))

            if await self.detect_cloudflare_challenge():
                if fallback_url and fallback_url != self.url:
                    logger.warning(
                        "[%s] Cloudflare blocked on primary (after retry) — skipping to fallback: %s",
                        self.slug, fallback_url,
                    )
                    return await self._scrape_with_fallback(fallback_url, embed_hint)
                logger.error("[%s] Cloudflare blocked and no fallback URL — aborting", self.slug)
                return []
            logger.info("[%s] Cloudflare challenge cleared on retry — proceeding", self.slug)

        # --- Planet 13 / Medizin store selector ----------------------------
        # P13 and Medizin share planet13.com — ensure the store picker in
        # the header shows the correct location before triggering the
        # Dutchie embed.
        await _ensure_store_selected(self.page, self.slug)

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

        # --- Smart-wait: poll DOM for Dutchie content ---------------------
        # Instead of a fixed asyncio.sleep(20), this returns the MOMENT
        # any iframe / container / product cards appear in the DOM.
        # 90 s cap (was 60 s) — content-based so fast sites return instantly;
        # the longer cap helps heavy pages (td-gibson, planet13) that take
        # longer for the Dutchie embed to inject.
        smart_wait_ms = _SMART_WAIT_DIRECT_MS if embed_hint == "direct" else _SMART_WAIT_MS
        smart_wait_ok = False
        try:
            await self.page.wait_for_function(
                _WAIT_FOR_DUTCHIE_JS, timeout=smart_wait_ms,
            )
            logger.info("[%s] Smart-wait: Dutchie content detected in DOM", self.slug)
            smart_wait_ok = True
        except PlaywrightTimeout:
            logger.warning("[%s] Smart-wait: no Dutchie content after %ds — will try detection anyway", self.slug, smart_wait_ms // 1000)
            # Re-check Cloudflare after smart-wait timeout — the page may
            # have been intermittently blocked (not detected on initial load
            # but Cloudflare challenge appeared during JS execution).  Bail
            # early to avoid burning 200+ s in the content detection cascade.
            if await self.detect_cloudflare_challenge():
                if fallback_url and fallback_url != self.url:
                    logger.warning("[%s] Cloudflare appeared during smart-wait — trying fallback", self.slug)
                    return await self._scrape_with_fallback(fallback_url, embed_hint)
                logger.error("[%s] Cloudflare appeared during smart-wait — aborting", self.slug)
                return []

        # --- Detect Dutchie content using embed_type hint -----------------
        # When we know the embed type (e.g. TD = js_embed), skip the
        # iframe detection phase entirely — saves ~45 s per site.
        logger.info("[%s] Detecting content (embed_hint=%s)", self.slug, embed_hint)
        target, embed_type, about_blank_srcs = await find_dutchie_content(
            self.page,
            iframe_timeout_ms=45_000,
            js_embed_timeout_sec=60,
            embed_type_hint=embed_hint,
            hint_only=(embed_hint == "direct"),
        )

        if target is None:
            # --- Dynamic fallback from about:blank iframe src URLs --------
            # When iframes were found with Dutchie src but stuck at
            # about:blank, use their src as a fallback URL (navigate to
            # it directly in "direct" mode).  This is more reliable than
            # the configured fallback_url because it uses the exact URL
            # the site's embed script was trying to load.
            if about_blank_srcs and not fallback_url:
                dynamic_fb = about_blank_srcs[0]
                logger.info(
                    "[%s] Using about:blank iframe src as dynamic fallback: %s",
                    self.slug, dynamic_fb,
                )
                return await self._scrape_with_fallback(dynamic_fb, "direct")

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

            # --- Fast-bail for dutchie.com direct pages -------------------
            # dutchie.com pages are React SPAs that render product cards
            # within seconds of the age gate click.  If nothing appeared
            # after the 120s smart-wait + 30s direct probe (~150s total),
            # the dispensary menu is empty or disabled on Dutchie's end.
            # Reloading won't help — skip the expensive 300s+ reload+retry
            # cycle that would otherwise burn until the site timeout.
            if embed_hint == "direct" and not smart_wait_ok:
                logger.warning(
                    "[%s] dutchie.com page loaded but no product cards after %ds — "
                    "dispensary menu may be empty or disabled",
                    self.slug, _SMART_WAIT_MS // 1000,
                )
                await self.save_debug_info("no_products_direct_bail")
                return []

            # No fallback: reload page and retry the full click flow once
            logger.warning("[%s] No Dutchie content after click — trying reload + re-click", self.slug)
            await self.page.evaluate(_AGE_GATE_COOKIE_JS)
            await self.page.reload(wait_until="load", timeout=120_000)
            await asyncio.sleep(3)

            # Check Cloudflare after reload — if blocked now, bail immediately
            # instead of burning 120+ s in another detection cascade
            if await self.detect_cloudflare_challenge():
                logger.error("[%s] Cloudflare blocked after reload — aborting", self.slug)
                return []

            await self.handle_age_gate(post_wait_sec=3)
            await force_remove_age_gate(self.page)

            # Smart-wait again after reload (shorter timeout on retry)
            retry_wait_ms = _SMART_WAIT_DIRECT_RETRY_MS if embed_hint == "direct" else _SMART_WAIT_RETRY_MS
            try:
                await self.page.wait_for_function(
                    _WAIT_FOR_DUTCHIE_JS, timeout=retry_wait_ms,
                )
                logger.info("[%s] Smart-wait (retry): Dutchie content detected", self.slug)
            except PlaywrightTimeout:
                logger.warning("[%s] Smart-wait (retry): still nothing after %ds", self.slug, retry_wait_ms // 1000)

            # On retry, keep the hint for direct sites (iframe/js_embed are
            # irrelevant) but drop it for other types to try the full cascade.
            retry_hint = embed_hint if embed_hint == "direct" else None
            target, embed_type, _ = await find_dutchie_content(
                self.page,
                iframe_timeout_ms=45_000,
                js_embed_timeout_sec=60,
                embed_type_hint=retry_hint,
                hint_only=(embed_hint == "direct"),
            )

        if target is None:
            logger.error("[%s] Could not find Dutchie content (iframe or JS embed) — aborting", self.slug)
            await self.save_debug_info("no_dutchie_content")
            return []

        logger.info("[%s] Dutchie content found via %s", self.slug, embed_type)

        # Also try age gate inside an iframe (some sites double-gate).
        if embed_type == "iframe":
            await dismiss_age_gate(target)

        # --- Scroll to trigger lazy-loaded content ----------------------------
        # Many Dutchie sites (td-gibson, planet13, etc.) defer rendering
        # product cards until they enter the viewport.  Scroll incrementally
        # to the bottom to trigger IntersectionObservers / lazy loaders,
        # then scroll back up.  Applied universally — fast sites are unaffected.
        await _scroll_to_load_content(target, self.slug)

        # --- Wait for product cards to render --------------------------------
        # All Dutchie sites benefit: the smart-wait detects when the
        # container/iframe is injected, but product cards inside may not
        # have rendered yet.  This is the primary pre-extraction gate.
        await _wait_for_product_cards(target, self.slug)

        # --- Paginate and collect products --------------------------------
        all_products: list[dict[str, Any]] = []
        page_num = 1
        consecutive_empty = 0

        while True:
            products = await self._extract_products(target)

            # --- Retry-on-zero fallback for page 1 ------------------------
            # If the first extraction yields 0 products, the DOM may still
            # be rendering (common on TD sites, Planet 13, and other heavy
            # pages).  Wait longer for cards and retry once before giving up.
            if page_num == 1 and len(products) == 0 and len(all_products) == 0:
                logger.warning("[%s] Page 1 extraction got 0 products — waiting longer and retrying", self.slug)
                await force_remove_age_gate(self.page)
                cards_found = await _wait_for_product_cards(target, self.slug, timeout_ms=45_000)
                if cards_found:
                    products = await self._extract_products(target)
                    logger.info("[%s] Retry extraction got %d products", self.slug, len(products))

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

        # --- Category tab iteration for expanded coverage ----------------------
        # EXPANSION STATES ONLY — production NV sites use proven stable patterns.
        # After paginating the initial view (usually "Specials" or "All"),
        # click through each category tab (Flower, Edibles, Concentrates,
        # etc.) and paginate each one independently.  This captures products
        # that are only shown when a specific category filter is active.
        # Dedup prevents double-counting products seen in the "All" view.
        region = self.dispensary.get("region", "southern-nv")
        if is_expansion_region(region) and len(all_products) > 0:
            category_products = await self._scrape_category_tabs(target, all_products)
            if category_products:
                all_products.extend(category_products)
                logger.info(
                    "[%s] Category tab scraping added %d new products (total %d)",
                    self.slug, len(category_products), len(all_products),
                )

        # --- Fallback URL from config (e.g. Jardin switched from AIQ to Dutchie) ---
        if not all_products:
            fallback_url = self.dispensary.get("fallback_url")
            if fallback_url and fallback_url != self.url:
                logger.warning(
                    "[%s] Primary scrape empty — trying fallback_url: %s",
                    self.slug, fallback_url,
                )
                await self.goto(fallback_url)
                await asyncio.sleep(3)
                await self.page.evaluate(_AGE_GATE_COOKIE_JS)
                await self.handle_age_gate(post_wait_sec=3)
                await force_remove_age_gate(self.page)

                try:
                    await self.page.wait_for_function(
                        _WAIT_FOR_DUTCHIE_JS, timeout=_SMART_WAIT_RETRY_MS,
                    )
                except PlaywrightTimeout:
                    pass

                # Auto-detect dutchie.com fallback URLs as "direct" type
                fb_host = urlparse(fallback_url).netloc
                inline_hint = embed_hint
                if fb_host in ("dutchie.com", "www.dutchie.com"):
                    inline_hint = "direct"
                    logger.info("[%s] Auto-detected embed_type='direct' for inline fallback %s", self.slug, fb_host)

                fb_target, fb_embed, _ = await find_dutchie_content(
                    self.page,
                    iframe_timeout_ms=45_000,
                    js_embed_timeout_sec=60,
                    embed_type_hint=inline_hint,
                )
                if fb_target is not None:
                    logger.info("[%s] Fallback URL content found via %s", self.slug, fb_embed)
                    if fb_embed == "iframe":
                        await dismiss_age_gate(fb_target)
                    await _scroll_to_load_content(fb_target, self.slug)
                    await _wait_for_product_cards(fb_target, self.slug)
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
                _WAIT_FOR_DUTCHIE_JS, timeout=_SMART_WAIT_RETRY_MS,
            )
            logger.info("[%s] Smart-wait (fallback): Dutchie content detected", self.slug)
        except PlaywrightTimeout:
            logger.warning("[%s] Smart-wait (fallback): no content after %ds", self.slug, _SMART_WAIT_RETRY_MS // 1000)

        # Auto-detect: dutchie.com fallback URLs are direct React SPAs —
        # skip the full 105s cascade (iframe 45s + js_embed 60s) that
        # wastes time and causes TD/Planet13/Grove to timeout.
        fb_host = urlparse(fallback_url).netloc
        fb_hint = embed_hint
        if fb_host in ("dutchie.com", "www.dutchie.com"):
            fb_hint = "direct"
            logger.info("[%s] Auto-detected embed_type='direct' for fallback %s", self.slug, fb_host)

        fb_target, fb_embed, _ = await find_dutchie_content(
            self.page,
            iframe_timeout_ms=45_000,
            js_embed_timeout_sec=60,
            embed_type_hint=fb_hint,
        )

        if fb_target is None:
            logger.error("[%s] No Dutchie content on fallback URL — aborting", self.slug)
            await self.save_debug_info("no_dutchie_content_fallback")
            return []

        logger.info("[%s] Fallback URL content found via %s", self.slug, fb_embed)
        if fb_embed == "iframe":
            await dismiss_age_gate(fb_target)

        await _scroll_to_load_content(fb_target, self.slug)
        await _wait_for_product_cards(fb_target, self.slug)

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
    # Category tab iteration (expansion states only)
    # ------------------------------------------------------------------

    async def _scrape_category_tabs(
        self,
        target: Page | Frame,
        existing_products: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Click through category tabs and paginate each to find new products.

        Only called for expansion state dispensaries.  Builds a dedup set
        from *existing_products* so only genuinely new products are returned.

        Returns a list of new products not already in *existing_products*.
        """
        # Build dedup set from existing products
        seen_names: set[str] = set()
        for p in existing_products:
            key = (p.get("name", "").lower().strip())
            if key:
                seen_names.add(key)

        # Find category tabs in the DOM
        try:
            tabs = await target.evaluate(_JS_FIND_CATEGORY_TABS)
        except Exception:
            logger.debug("[%s] Category tab detection JS failed", self.slug)
            return []

        if not tabs or len(tabs) < 2:
            logger.info("[%s] No category tabs found — skipping category iteration", self.slug)
            return []

        logger.info(
            "[%s] Found %d category tabs: %s",
            self.slug, len(tabs),
            ", ".join(t.get("text", "?") for t in tabs[:10]),
        )

        new_products: list[dict[str, Any]] = []
        max_categories = 8  # Safety cap to prevent infinite loops

        for i, tab_info in enumerate(tabs[:max_categories]):
            tab_text = tab_info.get("text", "")
            if not tab_text:
                continue

            # Skip "All" / "Shop All" / "Specials" — already scraped
            lower = tab_text.lower().strip()
            if lower in ("all", "all products", "shop all", "specials", "deals"):
                continue

            logger.info("[%s] Clicking category tab: %s", self.slug, tab_text)

            # Try to click the tab
            clicked = False
            for selector in _CATEGORY_TAB_SELECTORS:
                try:
                    locator = target.locator(f'{selector}:has-text("{tab_text}")').first
                    if await locator.count() > 0 and await locator.is_visible():
                        await locator.click(timeout=5_000)
                        clicked = True
                        break
                except Exception:
                    continue

            if not clicked:
                # Fallback: try exact text match
                try:
                    btn = target.locator(f'text="{tab_text}"').first
                    if await btn.count() > 0:
                        await btn.click(timeout=5_000)
                        clicked = True
                except Exception:
                    pass

            if not clicked:
                logger.debug("[%s] Could not click category tab: %s", self.slug, tab_text)
                continue

            # Wait for content to reload after tab click
            await asyncio.sleep(3 + random.uniform(0, 2))

            # Wait for product cards to appear
            await _wait_for_product_cards(target, self.slug, timeout_ms=15_000)

            # Paginate within this category
            page_num = 1
            consecutive_empty = 0
            while True:
                products = await self._extract_products(target)

                # Filter to only new products
                cat_new = []
                for p in products:
                    pkey = p.get("name", "").lower().strip()
                    if pkey and pkey not in seen_names:
                        seen_names.add(pkey)
                        cat_new.append(p)

                new_products.extend(cat_new)

                logger.info(
                    "[%s] Category '%s' page %d → %d products (%d new, %d total new)",
                    self.slug, tab_text, page_num, len(products),
                    len(cat_new), len(new_products),
                )

                if len(products) == 0:
                    consecutive_empty += 1
                    if consecutive_empty >= 2:
                        break
                else:
                    consecutive_empty = 0

                page_num += 1
                if page_num > 20:  # Safety cap per category
                    break

                try:
                    if not await navigate_dutchie_page(target, page_num):
                        break
                except Exception:
                    break

        logger.info(
            "[%s] Category tab iteration complete — %d new products across %d categories",
            self.slug, len(new_products), min(len(tabs), max_categories),
        )
        return new_products

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

                # --- Category extraction from card text ---
                # Dutchie cards often show a standalone category label
                # ("Flower", "Pre-Roll", etc.) as a visible line.  Extract
                # it BEFORE stripping so we get a high-confidence scraped
                # category, then remove it from raw_text to prevent it
                # from polluting text-based category detection downstream.
                scraped_category = None
                for line in raw_text.split("\n"):
                    label = line.strip().lower()
                    if label in _CATEGORY_LABEL_MAP:
                        scraped_category = _CATEGORY_LABEL_MAP[label]
                        break
                # Strip standalone category labels from raw_text
                raw_text = _RE_CATEGORY_LABEL.sub("", raw_text).strip()

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

                # --- Category extraction (separate element on card) ---
                # Some Dutchie layouts show category in a dedicated element.
                # This overrides the text-line extraction above (higher confidence).
                for cat_sel in (
                    "[class*='category']", "[class*='Category']",
                    "[data-testid*='category']", "[data-testid*='Category']",
                    "[class*='productType']", "[class*='product-type']",
                ):
                    try:
                        cat_el = el.locator(cat_sel).first
                        if await cat_el.count() > 0:
                            cat_text = (await cat_el.inner_text()).strip().lower()
                            if cat_text in _CATEGORY_LABEL_MAP:
                                scraped_category = _CATEGORY_LABEL_MAP[cat_text]
                                break
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
                if scraped_category:
                    product["scraped_category"] = scraped_category

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
