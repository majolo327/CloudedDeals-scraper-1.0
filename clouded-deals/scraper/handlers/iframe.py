"""
Iframe and JS-embed detection for Dutchie-powered menus.

Many dispensary sites embed their product menu inside an ``<iframe>``
served by dutchie.com (or a white-label domain).  This module locates
that frame and waits for it to be interactive before returning.

Some sites (notably TD Gibson and other TD locations) use a **JS embed**
instead: the Dutchie script injects product cards directly into the page
DOM via a container like ``<div id="dutchie--embed">``.  When no iframe
is found, ``find_dutchie_content()`` probes for these containers and
returns the main ``Page`` as the scrape target.

The Dutchie embed is injected by a ``<script>`` tag, so the iframe
may not exist immediately on DOMContentLoaded.  The selector list
includes ``iframe[src*="embed"]`` for white-label variants and a
**last-resort** strategy that picks the only iframe on the page.
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

# Selectors for Dutchie JS-embedded menus (no iframe, content in page DOM).
JS_EMBED_SELECTORS = [
    '#dutchie--embed',
    '[data-dutchie]',
    '.dutchie--embed',
    'div[id*="dutchie"]',
]

# Product selectors that confirm the JS embed has loaded content.
JS_EMBED_PRODUCT_PROBES = [
    '[data-testid*="product"]',
    'div[class*="product"]',
    '[class*="ProductCard"]',
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
    """Wait up to *timeout_sec* for a Dutchie JS embed container or
    product elements to appear in the page DOM (not inside an iframe).

    Returns ``True`` if any JS embed indicator is found.
    """
    all_selectors = JS_EMBED_SELECTORS + JS_EMBED_PRODUCT_PROBES
    combined = ", ".join(all_selectors)
    try:
        await page.locator(combined).first.wait_for(
            state="attached", timeout=int(timeout_sec * 1000),
        )
        # Figure out which selector matched for logging
        for sel in all_selectors:
            count = await page.locator(sel).count()
            if count > 0:
                logger.info("JS embed detected via %r (%d elements)", sel, count)
        return True
    except PlaywrightTimeout:
        return False


EmbedType = Literal["iframe", "js_embed"]


async def find_dutchie_content(
    page: Page,
    *,
    iframe_timeout_ms: int = 45_000,
    js_embed_timeout_sec: float = 60,
) -> tuple[Page | Frame | None, EmbedType | None]:
    """Locate Dutchie menu content — iframe first, then JS embed fallback.

    Returns
    -------
    (target, embed_type)
        *target* is a ``Frame`` (iframe) or ``Page`` (JS embed) to
        extract products from, or ``None`` if nothing was found.
        *embed_type* is ``"iframe"`` or ``"js_embed"`` accordingly.
    """
    # --- Try iframe first (fast path) ------------------------------------
    frame = await get_iframe(page, timeout_ms=iframe_timeout_ms)
    if frame is not None:
        return frame, "iframe"

    # --- Probe for JS-embedded Dutchie content on the main page ----------
    logger.info("No iframe found — probing for Dutchie JS embed on main page")
    if await _probe_js_embed(page, timeout_sec=js_embed_timeout_sec):
        logger.info("Using main page as scrape target (JS embed mode)")
        return page, "js_embed"

    logger.warning("Neither iframe nor JS embed found on %s", page.url)
    return None, None
