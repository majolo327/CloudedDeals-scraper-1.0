"""
Platform-specific pagination handlers.

CRITICAL: Always check ``is_enabled()`` before clicking a pagination
control.  A disabled button means we have reached the last page — this
is the *expected* termination signal, NOT an error.
"""

import asyncio
import logging

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
_POST_NAV_SETTLE_SEC = 5


# ------------------------------------------------------------------
# Dutchie / TD sites
# ------------------------------------------------------------------

async def navigate_dutchie_page(
    target: Page | Frame,
    page_number: int,
) -> bool:
    """Navigate to a specific page on a Dutchie-powered menu.

    Tries multiple selector strategies:
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
    ]

    for selector in selectors:
        try:
            locator = target.locator(selector).first
            await locator.wait_for(state="attached", timeout=3_000)
        except PlaywrightTimeout:
            continue

        # CRITICAL: a disabled button means pagination is COMPLETE.
        if not await locator.is_enabled():
            logger.info(
                "Dutchie page %d button is disabled — pagination complete",
                page_number,
            )
            return False

        await locator.click()
        logger.info("Navigated to Dutchie page %d via %s", page_number, selector)
        await asyncio.sleep(_POST_NAV_SETTLE_SEC)
        return True

    logger.info(
        "Dutchie page %d — no pagination button found — reached last page",
        page_number,
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

        await locator.click(force=True)
        logger.info("Navigated to Curaleaf page %d via %s", page_number, selector)
        await asyncio.sleep(3)  # PRD: 3 s between Curaleaf pages
        return True

    logger.info(
        "Curaleaf page %d — no pagination button found — reached end", page_number
    )
    return False


# ------------------------------------------------------------------
# Jane sites
# ------------------------------------------------------------------

_JANE_MAX_LOAD_MORE = 10
_JANE_LOAD_MORE_SETTLE_SEC = 1.5  # PRD: 1.5 s between View More clicks

async def handle_jane_view_more(
    target: Page | Frame,
    *,
    max_attempts: int = _JANE_MAX_LOAD_MORE,
) -> int:
    """Progressively load all products on a Jane-powered menu.

    Jane menus use a "View More" / "Load More" button instead of
    numbered pages.  We click it repeatedly until it disappears or
    ``max_attempts`` is reached.

    Parameters
    ----------
    target:
        The ``Page`` or ``Frame`` containing the Jane menu.
    max_attempts:
        Safety cap on the number of clicks (default 10).

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
        clicked = False

        for selector in view_more_selectors:
            try:
                locator = target.locator(selector).first
                await locator.wait_for(state="visible", timeout=5_000)
            except PlaywrightTimeout:
                continue

            if not await locator.is_enabled():
                logger.info(
                    "Jane 'View More' disabled on attempt %d — all loaded",
                    attempt,
                )
                return clicks

            await locator.click()
            clicks += 1
            clicked = True
            logger.info(
                "Jane 'View More' click %d/%d succeeded", clicks, max_attempts
            )
            await asyncio.sleep(_JANE_LOAD_MORE_SETTLE_SEC)
            break  # restart selector loop for next attempt

        if not clicked:
            logger.info(
                "Jane 'View More' not found on attempt %d — all products loaded",
                attempt,
            )
            break

    return clicks
