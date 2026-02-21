"""
Iframe and JS-embed detection for Dutchie-powered menus.

Detection order:
  1. **Iframe** — tried first via ``IFRAME_SELECTORS`` with a 30 s cap.
     This is the proven path that worked for all 10 Dutchie sites
     historically and should remain the default.
  2. **JS embed** — fallback if no iframe is found.  Some sites inject
     product cards directly into the page DOM inside a known Dutchie
     container (``#dutchie--embed``, ``[data-dutchie]``).  Detection
     requires BOTH a Dutchie container AND product cards inside it to
     avoid false positives from generic page content.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Literal

from playwright.async_api import Page, Frame, TimeoutError as PlaywrightTimeout

logger = logging.getLogger(__name__)

# Selectors tried in order — the first match wins.
# 'embedded-menu' and 'dutchie.com' cover The Grove and similar sites
# whose iframe src is e.g. https://dutchie.com/embedded-menu/the-grove-las-vegas/specials
# 'goshango.com' covers SLV (Dutchie-powered menu served via goshango iframe).
IFRAME_SELECTORS = [
    'iframe[src*="dutchie.com"]',
    'iframe[src*="dutchie"]',
    'iframe[src*="embedded-menu"]',
    'iframe[src*="goshango.com"]',
    'iframe[src*="menu"]',
    'iframe[src*="embed"]',
]

# Selectors for Dutchie JS-embedded menu containers.
# These MUST be specific to actual Dutchie embed wrappers — generic
# selectors like div[class*="product"] cause false positives on the
# parent page and prevent iframe detection from ever running.
JS_EMBED_CONTAINERS = [
    '#dutchie--embed',
    '[data-dutchie]',
    '.dutchie--embed',
    '#dutchie',
]

# Product-card selectors to verify the JS embed has loaded real content.
# These are checked ONLY INSIDE a matched container, not on the full page.
JS_EMBED_PRODUCT_PROBES = [
    '[data-testid*="product"]',
    '[class*="ProductCard"]',
    '[class*="product-card"]',
]

_IFRAME_READY_TIMEOUT_MS = 60_000

# Domains that are definitely NOT menu iframes — skip immediately.
_TRACKING_DOMAINS = [
    "crwdcntrl.net", "doubleclick", "google-analytics", "facebook",
    "twitter", "recaptcha", "google.com/recaptcha", "strainbra.in",
    "surfside.io", "pixel.php",
]


async def _resolve_frame(
    page: Page,
    selector: str,
    timeout_ms: int,
    post_wait_sec: float,
    *,
    checked_srcs: set[str] | None = None,
) -> tuple[Frame | None, str | None]:
    """Try to find an iframe via *selector*, wait for it, and return
    its content frame.  Returns ``(None, None)`` on any failure.

    When the iframe is found but stuck at about:blank, returns
    ``(None, src_url)`` so the caller can use the src as a fallback.
    """
    try:
        locator = page.locator(selector).first
        await locator.wait_for(state="attached", timeout=timeout_ms)
    except PlaywrightTimeout:
        logger.debug("Iframe selector %r not found, trying next", selector)
        return None, None

    element = await locator.element_handle()
    if element is None:
        logger.debug("Iframe selector %r matched but element_handle is None", selector)
        return None, None

    # Check if we've already tried this iframe (by src attribute)
    src_attr = await element.get_attribute("src") or ""
    if checked_srcs is not None and src_attr in checked_srcs:
        logger.debug("Already checked iframe src=%s — skipping selector %r", src_attr[:80], selector)
        return None, None
    if checked_srcs is not None and src_attr:
        checked_srcs.add(src_attr)

    frame = await element.content_frame()
    if frame is None:
        logger.debug("Iframe selector %r has no content frame yet", selector)
        return None, None

    try:
        await frame.wait_for_load_state("domcontentloaded", timeout=timeout_ms)
    except PlaywrightTimeout:
        logger.warning(
            "Iframe frame from %r did not reach domcontentloaded in %d ms",
            selector,
            timeout_ms,
        )
        # Return the frame anyway — partial content is better than nothing.

    # Guard: if the iframe is still about:blank, the embed hasn't actually
    # loaded — the age gate callback may not have fired.  Wait up to 10 s
    # for the frame to navigate to its real URL before giving up.
    # (Reduced from 30 s — if it hasn't loaded in 10 s, it won't.)
    if frame.url in ("about:blank", ""):
        logger.info("Iframe from %r is about:blank — waiting for real URL (up to 10 s)", selector)
        for _ in range(10):
            await asyncio.sleep(1)
            if frame.url not in ("about:blank", ""):
                break
        if frame.url in ("about:blank", ""):
            logger.warning("Iframe from %r still about:blank after 10 s — skipping", selector)
            # Return the src URL so the caller can use it as a fallback
            if src_attr and src_attr != "about:blank":
                return None, src_attr
            return None, None

    logger.info("Iframe found via %r — frame URL: %s", selector, frame.url)

    if post_wait_sec > 0:
        await asyncio.sleep(post_wait_sec)

    return frame, None


async def get_iframe(
    page: Page,
    *,
    timeout_ms: int = _IFRAME_READY_TIMEOUT_MS,
    post_wait_sec: float = 5,
) -> tuple[Frame | None, list[str]]:
    """Locate and return the dispensary menu iframe on *page*.

    Returns ``(frame, about_blank_srcs)`` where *frame* is the content
    frame if successfully resolved, or ``None``.  *about_blank_srcs* is
    a list of iframe src URLs that were found but stuck at about:blank,
    which the caller can use as fallback URLs for direct navigation.

    Optimizations over the original implementation:
    - Quick-checks for zero iframes before iterating selectors.
    - Tracks already-checked iframe src attributes to prevent re-checking
      the same about:blank iframe across multiple selectors (was burning
      30 s × 5 selectors = 150 s on the same iframe).
    - Reduced about:blank poll from 30 s to 10 s.
    """
    about_blank_srcs: list[str] = []
    checked_srcs: set[str] = set()

    # --- Quick check: any iframes on the page at all? --------------------
    # If zero iframes exist, skip the entire selector cascade (saves up
    # to 270 s = 6 selectors × 45 s timeout each).
    all_iframes = await page.query_selector_all("iframe")
    if not all_iframes:
        logger.info("No iframes on page — skipping iframe selector cascade")
        return None, []

    # Pre-scan: collect all iframe src attributes for dedup and logging
    iframe_srcs: list[str] = []
    for el in all_iframes:
        src = await el.get_attribute("src") or ""
        iframe_srcs.append(src)

    has_dutchie_src = any(
        "dutchie" in s or "embedded-menu" in s or "goshango" in s
        for s in iframe_srcs if s
    )

    # If no iframes have Dutchie-related src, reduce per-selector timeout
    # dramatically (5 s instead of 45 s) — the selectors won't match.
    effective_timeout = timeout_ms if has_dutchie_src else 5_000

    # --- Strategy 1: explicit selectors ----------------------------------
    for selector in IFRAME_SELECTORS:
        frame, blank_src = await _resolve_frame(
            page, selector, effective_timeout, post_wait_sec,
            checked_srcs=checked_srcs,
        )
        if frame is not None:
            return frame, about_blank_srcs
        if blank_src and blank_src not in about_blank_srcs:
            about_blank_srcs.append(blank_src)

    # --- Strategy 2: last-resort single-iframe fallback ------------------
    logger.info("No iframe matched explicit selectors — trying last-resort single-iframe fallback")

    # Log every iframe we see for debugging
    for i, src in enumerate(iframe_srcs):
        logger.info("  iframe[%d] src=%s", i, src or "(no src)")

    # Filter to iframes with a real src, excluding known tracking/analytics
    real_iframes = []
    for i, el in enumerate(all_iframes):
        src = iframe_srcs[i]
        if src and src != "about:blank" and src != "javascript:false":
            if any(domain in src for domain in _TRACKING_DOMAINS):
                logger.debug("  Skipping tracking iframe: %s", src[:100])
                continue
            # Skip iframes we already checked via selector cascade
            if src in checked_srcs:
                logger.debug("  Skipping already-checked iframe: %s", src[:100])
                continue
            real_iframes.append(el)

    if len(real_iframes) == 1:
        frame = await real_iframes[0].content_frame()
        if frame is not None:
            try:
                await frame.wait_for_load_state("domcontentloaded", timeout=effective_timeout)
            except PlaywrightTimeout:
                pass  # partial content is better than nothing

            # Force-navigate if frame is stuck on about:blank (same fix
            # as _resolve_frame — the embed's src is set but the frame
            # never navigated).
            if frame.url in ("about:blank", ""):
                src_attr = await real_iframes[0].get_attribute("src") or ""
                if src_attr and src_attr != "about:blank":
                    logger.info(
                        "Last-resort iframe is about:blank — force-navigating to src=%s",
                        src_attr[:120],
                    )
                    try:
                        await frame.goto(src_attr, wait_until="domcontentloaded", timeout=30_000)
                    except PlaywrightTimeout:
                        logger.warning("Last-resort force-navigation timed out")
                    except Exception:
                        logger.warning("Last-resort force-navigation failed", exc_info=True)
                        if src_attr not in about_blank_srcs:
                            about_blank_srcs.append(src_attr)
                        return None, about_blank_srcs

            logger.info(
                "Last-resort: single iframe found — frame URL: %s", frame.url,
            )
            if post_wait_sec > 0:
                await asyncio.sleep(post_wait_sec)
            return frame, about_blank_srcs

    logger.warning("No menu iframe found on page %s (%d iframes seen)", page.url, len(all_iframes))
    return None, about_blank_srcs


# ------------------------------------------------------------------
# JS-embed detection
# ------------------------------------------------------------------


async def _probe_js_embed(page: Page, timeout_sec: float = 60) -> bool:
    """Two-phase detection of Dutchie JS-embedded menus.

    Phase 1: Wait for a **known Dutchie container** (``#dutchie--embed``,
             ``[data-dutchie]``, etc.) to appear on the page.
    Phase 2: Verify that the container has **product cards** inside it
             (prevents false positives from empty containers or random
             page elements matching a broad selector).

    Returns ``True`` only if both phases pass.
    """
    # Phase 1: find a Dutchie-specific container
    container_css = ", ".join(JS_EMBED_CONTAINERS)
    try:
        await page.locator(container_css).first.wait_for(
            state="attached", timeout=int(timeout_sec * 1000),
        )
    except PlaywrightTimeout:
        logger.debug("No Dutchie JS embed container found within %ds", timeout_sec)
        return False

    # Log which container matched
    matched_container = None
    for sel in JS_EMBED_CONTAINERS:
        count = await page.locator(sel).count()
        if count > 0:
            logger.info("JS embed container found via %r (%d elements)", sel, count)
            matched_container = sel
            break

    if matched_container is None:
        return False

    # Phase 2: wait for product cards INSIDE the container (up to 30 s)
    for probe in JS_EMBED_PRODUCT_PROBES:
        scoped = f"{matched_container} {probe}"
        try:
            await page.locator(scoped).first.wait_for(
                state="attached", timeout=30_000,
            )
            product_count = await page.locator(scoped).count()
            logger.info(
                "JS embed confirmed — %d product cards via %r", product_count, scoped
            )
            return True
        except PlaywrightTimeout:
            continue

    # Container exists but no product cards loaded — not a real embed
    logger.warning(
        "Dutchie container %r found but no product cards inside — ignoring",
        matched_container,
    )
    return False


EmbedType = Literal["iframe", "js_embed", "direct"]

# Selectors for Dutchie product cards rendered directly on the page
# (e.g., planet13.com, medizin).  The content is the standard Dutchie
# grid but NOT inside an iframe or a known JS-embed container.
DIRECT_PAGE_PRODUCT_PROBES = [
    '[data-testid="product-card"]',
    '[data-testid*="product"]',
    '[class*="ProductCard"]',
    '[class*="product-card"]',
]

_MIN_DIRECT_PRODUCTS = 3  # Need at least this many cards to confirm


async def _probe_direct_page(page: Page, timeout_sec: float = 30) -> bool:
    """Check if the page itself has Dutchie-style product cards (no container).

    This is the fallback for sites like Planet13 / Medizin where the Dutchie
    menu is rendered directly into the page DOM rather than inside an iframe
    or a ``#dutchie--embed`` wrapper.
    """
    for probe in DIRECT_PAGE_PRODUCT_PROBES:
        try:
            await page.locator(probe).first.wait_for(
                state="attached", timeout=int(timeout_sec * 1000),
            )
            count = await page.locator(probe).count()
            if count >= _MIN_DIRECT_PRODUCTS:
                logger.info(
                    "Direct page products found — %d cards via %r", count, probe,
                )
                return True
            logger.debug(
                "Direct page probe %r matched %d (need >= %d)",
                probe, count, _MIN_DIRECT_PRODUCTS,
            )
        except PlaywrightTimeout:
            continue
    return False


async def find_dutchie_content(
    page: Page,
    *,
    iframe_timeout_ms: int = 30_000,
    js_embed_timeout_sec: float = 60,
    embed_type_hint: str | None = None,
    hint_only: bool = False,
) -> tuple[Page | Frame | None, EmbedType | None, list[str]]:
    """Locate Dutchie menu content — iframe first, JS embed fallback.

    When *embed_type_hint* is provided (from the dispensary config),
    the known embed type is tried first to avoid wasting time on
    detection phases that won't match.  This saves ~45 s on JS-embed
    sites that would otherwise wait for iframe detection to time out.

    When *hint_only* is ``True``, the function returns ``(None, None, [])``
    immediately if the hinted embed type is not found, skipping the
    full cascade.  Use this for dutchie.com direct URLs where iframe
    and JS-embed detection are irrelevant and would waste ~105 s.

    Returns
    -------
    (target, embed_type, about_blank_srcs)
        *target* is a ``Frame`` (iframe) or ``Page`` (JS embed) to
        extract products from, or ``None`` if nothing was found.
        *embed_type* is ``"iframe"``, ``"js_embed"``, or ``"direct"``.
        *about_blank_srcs* is a list of iframe src URLs that were found
        but stuck at about:blank (usable as fallback URLs).
    """
    about_blank_srcs: list[str] = []

    # When we have a hint, try the expected type first with generous
    # timeouts, then fall through to the full cascade if it fails.
    if embed_type_hint == "js_embed":
        logger.info("embed_type hint = js_embed — trying JS embed first")
        if await _probe_js_embed(page, timeout_sec=js_embed_timeout_sec):
            logger.info("JS embed confirmed via hint — using main page as scrape target")
            return page, "js_embed", []
        if hint_only:
            logger.info("JS embed hint didn't match and hint_only=True — skipping cascade")
            return None, None, []
        logger.info("JS embed hint didn't match — falling through to full cascade")

    if embed_type_hint == "direct":
        logger.info("embed_type hint = direct — trying direct page first")
        if await _probe_direct_page(page, timeout_sec=30):
            logger.info("Direct page confirmed via hint — using main page as scrape target")
            return page, "direct", []
        # dutchie.com pages are React SPAs — they will never match iframe
        # or JS embed selectors.  Bail immediately instead of burning
        # 105+ seconds on a cascade that cannot succeed.
        logger.warning("Direct page has no product cards — skipping iframe/JS cascade")
        return None, None, []

    # --- Try iframe -------------------------------------------------------
    # Always try iframe in the cascade.  If a js_embed/direct hint failed
    # above, the site may have switched to iframe — don't skip it.
    logger.info("Looking for Dutchie iframe (max %d ms) …", iframe_timeout_ms)
    frame, iframe_blank_srcs = await get_iframe(page, timeout_ms=iframe_timeout_ms)
    about_blank_srcs.extend(iframe_blank_srcs)
    if frame is not None:
        return frame, "iframe", about_blank_srcs

    # --- Optimization: when about:blank iframes found, try direct first --
    # If we found dutchie.com iframes but they were about:blank, the embed
    # may have rendered content directly on the page instead of inside the
    # iframe.  Try direct detection BEFORE the expensive JS embed probe
    # (saves ~60 s).
    if about_blank_srcs:
        logger.info(
            "Found %d about:blank iframe(s) with Dutchie src — trying direct page detection first",
            len(about_blank_srcs),
        )
        if await _probe_direct_page(page, timeout_sec=15):
            logger.info("Direct page confirmed (after about:blank iframes) — using main page")
            return page, "direct", about_blank_srcs

    # --- Fall back to JS embed detection (strict two-phase check) --------
    if embed_type_hint != "js_embed":  # already tried above if hint was js_embed
        logger.info("No iframe found — probing for Dutchie JS embed on main page")
        if await _probe_js_embed(page, timeout_sec=js_embed_timeout_sec):
            logger.info("JS embed confirmed — using main page as scrape target")
            return page, "js_embed", about_blank_srcs

    # --- Fall back to direct page content (e.g., planet13.com) ----------
    if embed_type_hint != "direct" and not about_blank_srcs:  # already tried above if about:blank
        logger.info("No JS embed container — probing for direct Dutchie product cards on page")
        if await _probe_direct_page(page, timeout_sec=30):
            logger.info("Direct page confirmed — using main page as scrape target")
            return page, "direct", about_blank_srcs

    logger.warning("Neither iframe, JS embed, nor direct products found on %s", page.url)
    return None, None, about_blank_srcs
