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


async def get_iframe(
    page: Page,
    *,
    timeout_ms: int = _IFRAME_READY_TIMEOUT_MS,
    post_wait_sec: float = 3,
) -> tuple[Frame | None, list[str]]:
    """Locate and return the dispensary menu iframe on *page*.

    Uses the proven simple pattern: ``query_selector_all('iframe')``,
    check ``src`` for Dutchie keywords, grab ``content_frame()``, brief
    sleep, proceed.  No about:blank rejection — the product extraction
    layer handles empty frames gracefully via the normal retry logic.

    Returns ``(frame, about_blank_srcs)`` where *frame* is the content
    frame if successfully resolved, or ``None``.  *about_blank_srcs* is
    a list of iframe src URLs found but not yet loaded (usable as
    fallback URLs for direct navigation).
    """
    about_blank_srcs: list[str] = []

    # --- Quick check: any iframes on the page at all? --------------------
    all_iframes = await page.query_selector_all("iframe")
    if not all_iframes:
        logger.info("No iframes on page — skipping iframe detection")
        return None, []

    # --- Proven pattern: scan all iframes for Dutchie src ----------------
    # Matches the simple loop from the production scraper that worked for
    # months: iterate iframes, check src for 'dutchie', grab content_frame.
    dutchie_keywords = ("dutchie", "embedded-menu", "goshango")

    for el in all_iframes:
        src = await el.get_attribute("src") or ""
        if not src:
            continue
        # Skip known tracking / analytics iframes
        if any(domain in src for domain in _TRACKING_DOMAINS):
            continue
        # Check if this iframe has a Dutchie-related src
        if not any(kw in src.lower() for kw in dutchie_keywords):
            continue

        frame = await el.content_frame()
        if frame is None:
            continue

        # If frame is still about:blank, record the src as a potential
        # fallback URL but keep trying other iframes first.
        if frame.url in ("about:blank", ""):
            logger.info(
                "Iframe with src=%s is about:blank — recording as fallback",
                src[:120],
            )
            if src and src != "about:blank" and src not in about_blank_srcs:
                about_blank_srcs.append(src)
            continue

        # Found a loaded Dutchie iframe — brief settle and return
        logger.info("Iframe found via src match — frame URL: %s", frame.url)
        if post_wait_sec > 0:
            await asyncio.sleep(post_wait_sec)
        return frame, about_blank_srcs

    # --- No loaded Dutchie iframe found — log what we saw ----------------
    if about_blank_srcs:
        logger.info(
            "Dutchie iframe(s) found but still about:blank — %d fallback URL(s) recorded",
            len(about_blank_srcs),
        )
    else:
        # Log all iframes for debugging
        for i, el in enumerate(all_iframes):
            src = await el.get_attribute("src") or "(no src)"
            logger.info("  iframe[%d] src=%s", i, src)
        logger.warning(
            "No Dutchie iframe found on page %s (%d iframes seen)",
            page.url, len(all_iframes),
        )

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
