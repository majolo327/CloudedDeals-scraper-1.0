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

# Primary selectors — tried FIRST with a 5 s timeout.
# "I am 21 or older" is the classic Dutchie/TD text.
# "Yes" is the most common button across Greenlight, Mint, Oasis, etc.
# TD-specific ID/form selectors follow as fallback.
PRIMARY_AGE_GATE_SELECTORS = [
    "button:has-text('I am 21 or older')",
    "button:has-text('Yes')",
    "button#agc_yes",
    "#agc_form button",
]
PRIMARY_SELECTOR_TIMEOUT_MS = 5_000

# Secondary selectors tried after primary ones with a shorter timeout.
SECONDARY_AGE_GATE_SELECTORS = [
    "#agc_form a",
    "button:has-text('over 21')",
    "button:has-text('21+')",
    "button:has-text('Enter')",
    "a:has-text('I am 21 or older')",
    "a:has-text('over 21')",
    "a:has-text('21+')",
    "a:has-text('Enter')",
    "a:has-text('Yes')",
]
SECONDARY_SELECTOR_TIMEOUT_MS = 3_000

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
    # Try primary selectors first (text-based "I am 21 or older" then
    # TD-specific IDs) with a longer timeout, then secondary generics.
    all_selectors = [
        (s, PRIMARY_SELECTOR_TIMEOUT_MS) for s in PRIMARY_AGE_GATE_SELECTORS
    ] + [
        (s, SECONDARY_SELECTOR_TIMEOUT_MS) for s in SECONDARY_AGE_GATE_SELECTORS
    ]

    for selector, timeout in all_selectors:
        try:
            locator = target.locator(selector).first

            # Debug: probe whether the button exists / is visible BEFORE waiting
            try:
                count = await target.locator(selector).count()
                is_visible = await locator.is_visible() if count > 0 else False
                logger.info(
                    "Age gate probe: %s → %d match(es), visible=%s",
                    selector, count, is_visible,
                )
            except Exception:
                pass

            await locator.wait_for(state="visible", timeout=timeout)
            await locator.click()
            logger.info("Age gate CLICKED via: %s (timeout=%dms)", selector, timeout)

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
