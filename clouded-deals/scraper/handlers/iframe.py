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
IFRAME_SELECTORS = [
    'iframe[src*="dutchie"]',
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


async def _resolve_frame(
    page: Page,
    selector: str,
    timeout_ms: int,
    post_wait_sec: float,
) -> Frame | None:
    """Try to find an iframe via *selector*, wait for it, and return
    its content frame.  Returns ``None`` on any failure."""
    try:
        locator = page.locator(selector).first
        await locator.wait_for(state="attached", timeout=timeout_ms)
    except PlaywrightTimeout:
        logger.debug("Iframe selector %r not found, trying next", selector)
        return None

    element = await locator.element_handle()
    if element is None:
        logger.debug("Iframe selector %r matched but element_handle is None", selector)
        return None

    frame = await element.content_frame()
    if frame is None:
        logger.debug("Iframe selector %r has no content frame yet", selector)
        return None

    try:
        await frame.wait_for_load_state("domcontentloaded", timeout=timeout_ms)
    except PlaywrightTimeout:
        logger.warning(
            "Iframe frame from %r did not reach domcontentloaded in %d ms",
            selector,
            timeout_ms,
        )
        # Return the frame anyway — partial content is better than nothing.

    logger.info("Iframe found via %r — frame URL: %s", selector, frame.url)

    if post_wait_sec > 0:
        await asyncio.sleep(post_wait_sec)

    return frame


async def get_iframe(
    page: Page,
    *,
    timeout_ms: int = _IFRAME_READY_TIMEOUT_MS,
    post_wait_sec: float = 5,
) -> Frame | None:
    """Locate and return the dispensary menu iframe on *page*.

    Tries each selector in ``IFRAME_SELECTORS``.  If none match, falls
    back to a **last-resort** strategy: if there is exactly one
    ``<iframe>`` on the page whose ``src`` is not blank/about:blank,
    assume it is the menu.
    """
    # --- Strategy 1: explicit selectors ----------------------------------
    for selector in IFRAME_SELECTORS:
        frame = await _resolve_frame(page, selector, timeout_ms, post_wait_sec)
        if frame is not None:
            return frame

    # --- Strategy 2: last-resort single-iframe fallback ------------------
    logger.info("No iframe matched explicit selectors — trying last-resort single-iframe fallback")
    iframes = await page.query_selector_all("iframe")

    # Log every iframe we see for debugging
    for i, el in enumerate(iframes):
        src = await el.get_attribute("src") or "(no src)"
        logger.info("  iframe[%d] src=%s", i, src)

    # Filter to iframes with a real src, excluding known tracking/analytics
    _TRACKING_DOMAINS = ["crwdcntrl.net", "doubleclick", "google-analytics", "facebook", "twitter"]
    real_iframes = []
    for el in iframes:
        src = await el.get_attribute("src") or ""
        if src and src != "about:blank":
            if any(domain in src for domain in _TRACKING_DOMAINS):
                logger.debug("  Skipping tracking iframe: %s", src[:100])
                continue
            real_iframes.append(el)

    if len(real_iframes) == 1:
        frame = await real_iframes[0].content_frame()
        if frame is not None:
            try:
                await frame.wait_for_load_state("domcontentloaded", timeout=timeout_ms)
            except PlaywrightTimeout:
                pass  # partial content is better than nothing
            logger.info(
                "Last-resort: single iframe found — frame URL: %s", frame.url,
            )
            if post_wait_sec > 0:
                await asyncio.sleep(post_wait_sec)
            return frame

    logger.warning("No menu iframe found on page %s (%d iframes seen)", page.url, len(iframes))
    return None


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


EmbedType = Literal["iframe", "js_embed"]


async def find_dutchie_content(
    page: Page,
    *,
    iframe_timeout_ms: int = 30_000,
    js_embed_timeout_sec: float = 60,
) -> tuple[Page | Frame | None, EmbedType | None]:
    """Locate Dutchie menu content — iframe first, JS embed fallback.

    Iframe detection is the proven path that has worked historically for
    all Dutchie sites.  JS embed probing runs only when no iframe is
    found, and uses a strict two-phase check (container + product cards)
    to avoid false positives.

    Returns
    -------
    (target, embed_type)
        *target* is a ``Frame`` (iframe) or ``Page`` (JS embed) to
        extract products from, or ``None`` if nothing was found.
        *embed_type* is ``"iframe"`` or ``"js_embed"`` accordingly.
    """
    # --- Try iframe first (proven path, capped at 30 s) ------------------
    logger.info("Looking for Dutchie iframe (max %d ms) …", iframe_timeout_ms)
    frame = await get_iframe(page, timeout_ms=iframe_timeout_ms)
    if frame is not None:
        return frame, "iframe"

    # --- Fall back to JS embed detection (strict two-phase check) --------
    logger.info("No iframe found — probing for Dutchie JS embed on main page")
    if await _probe_js_embed(page, timeout_sec=js_embed_timeout_sec):
        logger.info("JS embed confirmed — using main page as scrape target")
        return page, "js_embed"

    logger.warning("Neither iframe nor JS embed found on %s", page.url)
    return None, None
