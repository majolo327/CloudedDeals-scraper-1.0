"""
Iframe detection and readiness handler for Dutchie-embedded menus.

Many dispensary sites embed their product menu inside an ``<iframe>``
served by dutchie.com (or a white-label domain).  This module locates
that frame and waits for it to be interactive before returning.

The Dutchie embed is injected by a ``<script>`` tag, so the iframe
may not exist immediately on DOMContentLoaded.  The selector list
includes ``iframe[src*="embed"]`` for white-label variants and a
**last-resort** strategy that picks the only iframe on the page.
"""

import asyncio
import logging

from playwright.async_api import Page, Frame, TimeoutError as PlaywrightTimeout

logger = logging.getLogger(__name__)

# Selectors tried in order — the first match wins.
IFRAME_SELECTORS = [
    'iframe[src*="dutchie"]',
    'iframe[src*="menu"]',
    'iframe[src*="embed"]',
]

_IFRAME_READY_TIMEOUT_MS = 30_000


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

    # Filter to iframes with a real src
    real_iframes = []
    for el in iframes:
        src = await el.get_attribute("src") or ""
        if src and src != "about:blank":
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
