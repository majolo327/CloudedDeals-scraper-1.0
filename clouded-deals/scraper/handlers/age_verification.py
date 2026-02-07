"""
Universal age-gate dismissal handler.

Tries a sequence of common selectors found across dispensary sites.
Falls back to JavaScript overlay removal when no clickable button is found.

The JS fallback explicitly targets TD's ``<aside id="agc_form">`` overlay
which persists even after the button click and intercepts pointer events
on pagination controls.
"""

import asyncio
import logging

from playwright.async_api import Page, Frame, TimeoutError as PlaywrightTimeout

logger = logging.getLogger(__name__)

# TD-specific selectors — these get a LONGER timeout (10 s) because the
# TD age gate renders late (after heavy JS bundles load).
TD_AGE_GATE_SELECTORS = [
    "button#agc_yes",
    "#agc_form button",
    "#agc_form a",
]
TD_SELECTOR_TIMEOUT_MS = 10_000

# Generic selectors tried AFTER the TD-specific ones.
AGE_GATE_SELECTORS = [
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
# Explicitly targets TD's #agc_form / .agc_screen overlay, plus generic
# age-gate / modal selectors.
_JS_REMOVE_OVERLAY = """
() => {
    const candidates = document.querySelectorAll(
        '#agc_form, #agc_container, .agc_screen, '
        + '.age-gate, .age-verification, .overlay, .modal-backdrop, '
        + '[class*="age"], [class*="gate"], [class*="verify"], '
        + '[class*="modal"], [class*="overlay"], [id*="age"], '
        + '[id*="gate"], [id*="verify"]'
    );
    let removed = 0;
    for (const el of candidates) {
        const style = window.getComputedStyle(el);
        if (
            style.position === 'fixed' ||
            style.position === 'absolute' ||
            el.id === 'agc_form' ||
            el.classList.contains('agc_screen')
        ) {
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
    # Try TD-specific selectors first with a longer timeout — these are
    # the real age gate buttons that trigger the Dutchie embed callback.
    all_selectors = [
        (s, TD_SELECTOR_TIMEOUT_MS) for s in TD_AGE_GATE_SELECTORS
    ] + [
        (s, SELECTOR_TIMEOUT_MS) for s in AGE_GATE_SELECTORS
    ]

    for selector, timeout in all_selectors:
        try:
            locator = target.locator(selector).first
            await locator.wait_for(state="visible", timeout=timeout)
            await locator.click()
            logger.info("Age gate dismissed via selector: %s (timeout=%dms)", selector, timeout)

            if post_dismiss_wait_sec > 0:
                logger.info(
                    "Waiting %.0f s for post-age-gate content to load …",
                    post_dismiss_wait_sec,
                )
                await asyncio.sleep(post_dismiss_wait_sec)

            # Always run the JS fallback after clicking to clean up any
            # lingering overlays (e.g. TD's #agc_form that reappears).
            await force_remove_age_gate(target)

            return True
        except PlaywrightTimeout:
            continue
        except Exception:
            logger.debug("Selector %s raised unexpected error", selector, exc_info=True)
            continue

    # ---------------------------------------------------------------
    # Fallback: nuke the overlay via JavaScript
    # ---------------------------------------------------------------
    removed = await force_remove_age_gate(target)
    if removed > 0:
        logger.info(
            "Age gate dismissed via JS fallback (%d element(s) removed)", removed
        )
        if post_dismiss_wait_sec > 0:
            await asyncio.sleep(post_dismiss_wait_sec)
        return True

    logger.debug("No age gate detected — continuing normally")
    return False


async def force_remove_age_gate(target: Page | Frame) -> int:
    """JavaScript fallback to forcibly remove age-gate overlays.

    Returns the number of elements removed.
    """
    try:
        removed = await target.evaluate(_JS_REMOVE_OVERLAY)
        if removed > 0:
            logger.debug("JS overlay removal cleared %d element(s)", removed)
        return removed
    except Exception:
        logger.debug("JS overlay removal failed", exc_info=True)
        return 0
