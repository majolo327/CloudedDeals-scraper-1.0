"""
Universal age-gate dismissal handler.

Tries a sequence of common selectors found across dispensary sites.
Falls back to JavaScript overlay removal when no clickable button is found.
"""

import asyncio
import logging

from playwright.async_api import Page, Frame, TimeoutError as PlaywrightTimeout

logger = logging.getLogger(__name__)

# Ordered from most-specific to least-specific so we hit the real button
# before falling through to generic text matches.
AGE_GATE_SELECTORS = [
    "button#agc_yes",
    "button:has-text('I am 21 or older')",
    "button:has-text('over 21')",
    "button:has-text('21+')",
    "button:has-text('Enter')",
    "button:has-text('Yes')",
    "a:has-text('I am 21 or older')",
    "a:has-text('over 21')",
    "a:has-text('21+')",
    "a:has-text('Enter')",
    "a:has-text('Yes')",
]

SELECTOR_TIMEOUT_MS = 4_000

# JavaScript fallback: remove any fixed/absolute overlay that covers the page.
_JS_REMOVE_OVERLAY = """
() => {
    const candidates = document.querySelectorAll(
        '[class*="age"], [class*="gate"], [class*="verify"], '
        + '[class*="modal"], [class*="overlay"], [id*="age"], '
        + '[id*="gate"], [id*="verify"]'
    );
    let removed = 0;
    for (const el of candidates) {
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'absolute') {
            el.remove();
            removed++;
        }
    }
    // Also re-enable scrolling in case the overlay locked it.
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    return removed;
}
"""


async def dismiss_age_gate(
    target: Page | Frame,
    *,
    post_dismiss_wait_sec: float = 0,
) -> bool:
    """Attempt to dismiss an age-verification gate on *target*.

    Parameters
    ----------
    target:
        The Playwright ``Page`` or ``Frame`` that may contain the gate.
    post_dismiss_wait_sec:
        Seconds to wait after a successful dismissal (e.g. 45 s for TD
        sites while the Dutchie iframe loads behind the gate).

    Returns
    -------
    bool
        ``True`` if a gate was found and dismissed, ``False`` otherwise.
    """
    for selector in AGE_GATE_SELECTORS:
        try:
            locator = target.locator(selector).first
            await locator.wait_for(state="visible", timeout=SELECTOR_TIMEOUT_MS)
            await locator.click()
            logger.info("Age gate dismissed via selector: %s", selector)

            if post_dismiss_wait_sec > 0:
                logger.info(
                    "Waiting %.0f s for post-age-gate content to load …",
                    post_dismiss_wait_sec,
                )
                await asyncio.sleep(post_dismiss_wait_sec)

            return True
        except PlaywrightTimeout:
            continue
        except Exception:
            logger.debug("Selector %s raised unexpected error", selector, exc_info=True)
            continue

    # ---------------------------------------------------------------
    # Fallback: nuke the overlay via JavaScript
    # ---------------------------------------------------------------
    try:
        removed = await target.evaluate(_JS_REMOVE_OVERLAY)
        if removed > 0:
            logger.info(
                "Age gate dismissed via JS fallback (%d element(s) removed)", removed
            )
            if post_dismiss_wait_sec > 0:
                await asyncio.sleep(post_dismiss_wait_sec)
            return True
    except Exception:
        logger.debug("JS overlay removal failed", exc_info=True)

    logger.debug("No age gate detected — continuing normally")
    return False
