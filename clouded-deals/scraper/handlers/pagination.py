"""
Platform-specific pagination handlers.

CRITICAL: Always check ``is_enabled()`` before clicking a pagination
control.  A disabled button means we have reached the last page — this
is the *expected* termination signal, NOT an error.
"""

import asyncio
import logging
import random

from playwright.async_api import Page, Frame, TimeoutError as PlaywrightTimeout

logger = logging.getLogger(__name__)

# JavaScript to dismiss overlays that block pagination clicks on Curaleaf.
# Targets: OneTrust cookie consent banner, Curaleaf cart drawer, and any
# other modal overlays that intercept pointer events.
_JS_DISMISS_OVERLAYS = """
() => {
    let dismissed = 0;

    // 1. OneTrust cookie consent banner
    const onetrust = document.getElementById('onetrust-consent-sdk');
    if (onetrust) { onetrust.remove(); dismissed++; }

    // 2. Curaleaf cart drawer (MUI modal overlay)
    const drawers = document.querySelectorAll(
        '.MuiDrawer-root, .MuiDrawer-modal, [class*="cart-dropdown"]'
    );
    for (const d of drawers) { d.remove(); dismissed++; }

    // 3. Any remaining MUI backdrop / overlay
    const backdrops = document.querySelectorAll('.MuiBackdrop-root');
    for (const b of backdrops) { b.remove(); dismissed++; }

    // 4. Re-enable scrolling
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';

    return dismissed;
}
"""

# How long to wait for content to settle after a page change.
# PRD: 5 s between pages for Dutchie, 3 s for Curaleaf.
# Randomized ±1.5s to avoid predictable timing patterns.
_POST_NAV_SETTLE_BASE = 5


def _settle_delay(base: float = _POST_NAV_SETTLE_BASE) -> float:
    """Return a randomized settle delay around *base* seconds."""
    return base + random.uniform(-1.0, 2.0)


# ------------------------------------------------------------------
# Dutchie / TD sites
# ------------------------------------------------------------------

async def _click_with_fallback(
    target: Page | Frame,
    locator,
    selector: str,
    label: str,
) -> bool:
    """Try multiple click strategies: normal → force → JavaScript.

    Returns ``True`` if any click strategy succeeded.
    """
    # Strategy 1: normal click
    try:
        await locator.click(timeout=5_000)
        logger.info("%s via normal click on %s", label, selector)
        return True
    except Exception:
        logger.debug("%s normal click failed on %s", label, selector)

    # Strategy 2: force click (bypasses visibility/actionability checks)
    try:
        await locator.click(force=True, timeout=5_000)
        logger.info("%s via force click on %s", label, selector)
        return True
    except Exception:
        logger.debug("%s force click failed on %s", label, selector)

    # Strategy 3: JavaScript click as last resort
    try:
        await locator.evaluate("el => el.click()")
        logger.info("%s via JS click on %s", label, selector)
        return True
    except Exception:
        logger.debug("%s JS click failed on %s", label, selector)

    return False


_DUTCHIE_NAV_MAX_RETRIES = 2


async def navigate_dutchie_page(
    target: Page | Frame,
    page_number: int,
) -> bool:
    """Navigate to a specific page on a Dutchie-powered menu.

    Tries multiple selector strategies with multi-click fallback
    (normal → force → JS click) and up to 2 retries per page:
      1. ``button[aria-label="go to page N"]`` (standard Dutchie iframe)
      2. ``a[aria-label="go to page N"]`` (some sites use links)
      3. Case-insensitive ``Go to page N`` variants
      4. Generic ``[aria-label]`` catch-all

    Parameters
    ----------
    target:
        The ``Page`` or ``Frame`` containing the Dutchie menu.
    page_number:
        1-indexed page number to navigate to.

    Returns
    -------
    bool
        ``True`` if navigation succeeded, ``False`` if the target page
        does not exist or the button is disabled (end of results).
    """
    selectors = [
        f'button[aria-label="go to page {page_number}"]',
        f'a[aria-label="go to page {page_number}"]',
        f'button[aria-label="Go to page {page_number}"]',
        f'a[aria-label="Go to page {page_number}"]',
        f'[aria-label="go to page {page_number}"]',
        f'[aria-label="Go to page {page_number}"]',
        # Fallback: "Next" / arrow buttons (some Dutchie embeds use these)
        'button[aria-label="Next"]',
        'button[aria-label="next"]',
        'button[aria-label="Next page"]',
        'a[aria-label="Next"]',
        'button:has-text("Next")',
        '[aria-label="next page"]',
    ]

    for attempt in range(1, _DUTCHIE_NAV_MAX_RETRIES + 1):
        for selector in selectors:
            try:
                locator = target.locator(selector).first
                await locator.wait_for(state="attached", timeout=5_000)
            except PlaywrightTimeout:
                continue

            # CRITICAL: a disabled button means pagination is COMPLETE.
            if not await locator.is_enabled():
                logger.info(
                    "Dutchie page %d button is disabled — pagination complete",
                    page_number,
                )
                return False

            label = f"Navigated to Dutchie page {page_number}"
            if await _click_with_fallback(target, locator, selector, label):
                await asyncio.sleep(_settle_delay(5))
                return True

        if attempt < _DUTCHIE_NAV_MAX_RETRIES:
            logger.info(
                "Dutchie page %d — attempt %d failed, retrying in 2s",
                page_number, attempt,
            )
            await asyncio.sleep(2)

    logger.info(
        "Dutchie page %d — no pagination button found after %d attempts — reached last page",
        page_number, _DUTCHIE_NAV_MAX_RETRIES,
    )
    return False


# ------------------------------------------------------------------
# Curaleaf sites
# ------------------------------------------------------------------

async def navigate_curaleaf_page(
    page: Page,
    page_number: int,
) -> bool:
    """Navigate to a numbered page on a Curaleaf specials listing.

    Curaleaf uses standard next/numbered pagination buttons.

    Parameters
    ----------
    page:
        The Playwright ``Page`` (Curaleaf is always a direct page, never
        an iframe).
    page_number:
        1-indexed page number to navigate to.

    Returns
    -------
    bool
        ``True`` if navigation succeeded, ``False`` if pagination is
        complete (button missing or disabled).
    """
    # Dismiss overlays (cart drawer, cookie banner) that block clicks.
    try:
        removed = await page.evaluate(_JS_DISMISS_OVERLAYS)
        if removed:
            logger.info(
                "Dismissed %d overlay(s) before Curaleaf page %d click",
                removed, page_number,
            )
            await asyncio.sleep(0.5)
    except Exception:
        logger.debug("Overlay dismissal JS failed", exc_info=True)

    # Try exact page-number button first, then fall back to "Next" style.
    for selector in (
        f'button[aria-label="Go to page {page_number}"]',
        f'a[aria-label="Go to page {page_number}"]',
        f'button:has-text("{page_number}")',
        'button[aria-label="Next page"]',
        'a[aria-label="Next page"]',
        'button:has-text("Next")',
    ):
        try:
            locator = page.locator(selector).first
            await locator.wait_for(state="attached", timeout=4_000)
        except PlaywrightTimeout:
            continue

        # CRITICAL: check is_enabled() — disabled means we are on the
        # last page.  This is the EXPECTED end condition.
        if not await locator.is_enabled():
            logger.info(
                "Curaleaf page %d button disabled — pagination complete",
                page_number,
            )
            return False

        label = f"Navigated to Curaleaf page {page_number}"
        if await _click_with_fallback(page, locator, selector, label):
            await asyncio.sleep(_settle_delay(3))
            return True

    logger.info(
        "Curaleaf page %d — no pagination button found — reached end", page_number
    )
    return False


# ------------------------------------------------------------------
# Jane sites
# ------------------------------------------------------------------

_JANE_MAX_LOAD_MORE = 30
_JANE_LOAD_MORE_SETTLE_BASE = 2.0  # Settle time after each View More click
_JANE_VIEW_MORE_TIMEOUT_MS = 12_000  # 12 s — Jane pages render slowly

# JS to scroll to the bottom of the page / frame to expose the
# "View More" button.  Uses human-like scroll patterns: variable
# distances (200-500px), variable pauses (100-500ms), and occasional
# longer "reading" pauses to mimic real user behavior.
_JS_SCROLL_TO_BOTTOM = """
async () => {
    const delay = ms => new Promise(r => setTimeout(r, ms));
    const totalHeight = document.body.scrollHeight;
    let currentPos = window.scrollY;

    while (currentPos < totalHeight - 200) {
        // Variable scroll distance (200-500px per step)
        const step = 200 + Math.floor(Math.random() * 300);
        window.scrollBy({ top: step, behavior: 'smooth' });
        currentPos += step;

        // Variable pause between scrolls (100-500ms)
        await delay(100 + Math.floor(Math.random() * 400));

        // ~15% chance of a longer "reading" pause (0.5-1.5s)
        if (Math.random() < 0.15) {
            await delay(500 + Math.floor(Math.random() * 1000));
        }

        // Re-check in case content loaded and height changed
        if (currentPos >= document.body.scrollHeight - 200) break;
    }

    // Final scroll to absolute bottom
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    await delay(200);

    // Also handle scrollable containers (for iframes where the
    // window itself isn't scrollable).
    const containers = document.querySelectorAll(
        '[style*="overflow"], [class*="scroll"], [class*="menu-list"], main'
    );
    for (const c of containers) {
        c.scrollTop = c.scrollHeight;
    }
}
"""

async def handle_jane_view_more(
    target: Page | Frame,
    *,
    max_attempts: int = _JANE_MAX_LOAD_MORE,
) -> int:
    """Progressively load all products on a Jane-powered menu.

    Jane menus use a "View More" / "Load More" button instead of
    numbered pages.  We click it repeatedly until it disappears or
    ``max_attempts`` is reached.

    Each attempt scrolls the page first to expose the button (some Jane
    embeds hide it until the user scrolls near the bottom), then waits
    up to 12 s for the button to become visible.

    Parameters
    ----------
    target:
        The ``Page`` or ``Frame`` containing the Jane menu.
    max_attempts:
        Safety cap on the number of clicks (default 15).

    Returns
    -------
    int
        Number of times the button was successfully clicked.
    """
    view_more_selectors = [
        'button:has-text("View More")',
        'button:has-text("Load More")',
        'button:has-text("Show More")',
        'a:has-text("View More")',
        'a:has-text("Load More")',
    ]

    clicks = 0

    for attempt in range(1, max_attempts + 1):
        # Scroll to bottom to expose the View More button.  Jane sites
        # sometimes require vertical (and occasionally horizontal)
        # scrolling before the button becomes visible.
        try:
            await target.evaluate(_JS_SCROLL_TO_BOTTOM)
        except Exception:
            pass  # best-effort; button may already be visible

        clicked = False

        for selector in view_more_selectors:
            try:
                locator = target.locator(selector).first
                await locator.wait_for(
                    state="visible", timeout=_JANE_VIEW_MORE_TIMEOUT_MS,
                )
            except PlaywrightTimeout:
                continue

            if not await locator.is_enabled():
                logger.info(
                    "Jane 'View More' disabled on attempt %d — all loaded",
                    attempt,
                )
                return clicks

            # Scroll the button into view before clicking — handles
            # Jane layouts where the button is below the fold.
            try:
                await locator.scroll_into_view_if_needed(timeout=3_000)
            except Exception:
                pass  # best-effort

            await locator.click()
            clicks += 1
            clicked = True
            logger.info(
                "Jane 'View More' click %d/%d succeeded", clicks, max_attempts
            )
            await asyncio.sleep(_settle_delay(_JANE_LOAD_MORE_SETTLE_BASE))
            break  # restart selector loop for next attempt

        if not clicked:
            logger.info(
                "Jane 'View More' not found on attempt %d — all products loaded",
                attempt,
            )
            break

    return clicks
