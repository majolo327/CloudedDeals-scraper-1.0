"""
Iframe detection and readiness handler for Dutchie-embedded menus.

Many dispensary sites embed their product menu inside an ``<iframe>``
served by dutchie.com (or a white-label domain).  This module locates
that frame and waits for it to be interactive before returning.
"""

import asyncio
import logging

from playwright.async_api import Page, Frame, TimeoutError as PlaywrightTimeout

logger = logging.getLogger(__name__)

# Selectors tried in order — the first match wins.
# Use broad "dutchie" match (not just "dutchie.com") to catch subdomains
# and white-label variants.
IFRAME_SELECTORS = [
    'iframe[src*="dutchie"]',
    'iframe[src*="menu"]',
]

_IFRAME_READY_TIMEOUT_MS = 30_000


async def get_iframe(
    page: Page,
    *,
    timeout_ms: int = _IFRAME_READY_TIMEOUT_MS,
    post_wait_sec: float = 5,
) -> Frame | None:
    """Locate and return the dispensary menu iframe on *page*.

    Parameters
    ----------
    page:
        The top-level Playwright ``Page`` that embeds the menu.
    timeout_ms:
        Maximum time (ms) to wait for the iframe element to appear and
        its inner frame to become ready.
    post_wait_sec:
        Seconds to sleep after the iframe is found before returning,
        giving embedded content time to render.

    Returns
    -------
    Frame | None
        The Playwright ``Frame`` for the menu iframe, or ``None`` if no
        matching iframe was found within the timeout.
    """
    for selector in IFRAME_SELECTORS:
        try:
            locator = page.locator(selector).first
            await locator.wait_for(state="attached", timeout=timeout_ms)
        except PlaywrightTimeout:
            logger.debug("Iframe selector %r not found, trying next", selector)
            continue

        # Resolve the ElementHandle so we can get at the content frame.
        element = await locator.element_handle()
        if element is None:
            logger.debug("Iframe selector %r matched but element_handle is None", selector)
            continue

        frame = await element.content_frame()
        if frame is None:
            logger.debug("Iframe selector %r has no content frame yet", selector)
            continue

        # Wait for the frame to have a loaded document before handing it
        # back — otherwise callers would race against frame navigation.
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

        # Wait for iframe content to settle (PRD: 5 s after finding iframe).
        if post_wait_sec > 0:
            await asyncio.sleep(post_wait_sec)

        return frame

    logger.warning("No menu iframe found on page %s", page.url)
    return None
