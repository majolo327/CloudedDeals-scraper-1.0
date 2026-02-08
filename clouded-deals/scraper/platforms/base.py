"""
Abstract base class for all platform scrapers.

Provides shared browser lifecycle management, viewport/user-agent setup,
and age-gate dismissal.  Subclasses implement ``scrape()`` with their
platform-specific navigation and extraction logic.
"""

from __future__ import annotations

import abc
import logging
import os
from pathlib import Path
from typing import Any

from playwright.async_api import (
    async_playwright,
    Browser,
    BrowserContext,
    Frame,
    Page,
    Playwright,
)

from config.dispensaries import BROWSER_ARGS, GOTO_TIMEOUT_MS, PLATFORM_DEFAULTS, USER_AGENT, VIEWPORT, WAIT_UNTIL
from handlers import dismiss_age_gate

DEBUG_DIR = Path(os.getenv("DEBUG_DIR", "debug_screenshots"))

logger = logging.getLogger(__name__)


class BaseScraper(abc.ABC):
    """Skeleton shared by every platform scraper.

    Usage (standalone — creates its own browser)::

        async with DutchieScraper(dispensary_cfg) as scraper:
            products = await scraper.scrape()

    Usage (shared browser — for parallel scraping)::

        browser = await pw.chromium.launch(...)
        async with DutchieScraper(dispensary_cfg, browser=browser) as scraper:
            products = await scraper.scrape()
    """

    def __init__(
        self,
        dispensary: dict[str, Any],
        *,
        browser: Browser | None = None,
    ) -> None:
        self.dispensary = dispensary
        self.name: str = dispensary["name"]
        self.slug: str = dispensary["slug"]
        self.url: str = dispensary["url"]
        self.platform: str = dispensary["platform"]

        # External browser = shared mode (parallel scraping)
        self._shared_browser = browser

        # Set by __aenter__
        self._pw: Playwright | None = None
        self._browser: Browser | None = None
        self._context: BrowserContext | None = None
        self._page: Page | None = None

    # ------------------------------------------------------------------
    # Async context manager — browser lifecycle
    # ------------------------------------------------------------------

    async def __aenter__(self) -> "BaseScraper":
        if self._shared_browser:
            # Shared mode: reuse the pre-launched browser, create a fresh context
            self._browser = self._shared_browser
        else:
            # Standalone mode: launch our own browser
            self._pw = await async_playwright().start()
            self._browser = await self._pw.chromium.launch(
                headless=True,
                args=BROWSER_ARGS,
            )
        self._context = await self._browser.new_context(
            viewport=VIEWPORT,
            user_agent=USER_AGENT,
        )
        self._page = await self._context.new_page()
        logger.info("[%s] Browser ready (shared=%s)", self.slug, bool(self._shared_browser))
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        # Always close page and context (we own them)
        for obj in (self._page, self._context):
            if obj:
                try:
                    await obj.close()
                except Exception:
                    pass
        # Only close browser + playwright if we own them (standalone mode)
        if not self._shared_browser:
            if self._browser:
                try:
                    await self._browser.close()
                except Exception:
                    pass
            if self._pw:
                await self._pw.stop()
        logger.info("[%s] Cleanup done", self.slug)

    # ------------------------------------------------------------------
    # Shared helpers
    # ------------------------------------------------------------------

    @property
    def page(self) -> Page:
        assert self._page is not None, "BaseScraper must be used as an async context manager"
        return self._page

    async def goto(self, url: str | None = None) -> None:
        """Navigate to *url* (defaults to ``self.url``) using the
        platform-specific ``wait_until`` strategy and ``GOTO_TIMEOUT_MS``."""
        target = url or self.url
        platform_cfg = PLATFORM_DEFAULTS.get(self.platform, {})
        wait_until = platform_cfg.get("wait_until", WAIT_UNTIL)
        logger.info("[%s] Navigating to %s (wait_until=%s)", self.slug, target, wait_until)
        await self.page.goto(target, wait_until=wait_until, timeout=GOTO_TIMEOUT_MS)

    async def handle_age_gate(self, *, post_wait_sec: float = 0) -> bool:
        """Try to dismiss any age-verification overlay on the current page."""
        return await dismiss_age_gate(
            self.page,
            post_dismiss_wait_sec=post_wait_sec,
        )

    # ------------------------------------------------------------------
    # Debug helpers
    # ------------------------------------------------------------------

    async def save_debug_info(self, label: str, target: Page | Frame | None = None) -> None:
        """Save a screenshot, HTML, and diagnostic logs for debugging.

        Creates files under ``DEBUG_DIR/<slug>_<label>.png`` and
        ``<slug>_<label>.html``.  Also logs the current URL, page title,
        all iframes, and counts for common product selectors.
        Errors are caught so this never breaks the scrape.
        """
        target = target or self.page
        prefix = f"{self.slug}_{label}"
        try:
            DEBUG_DIR.mkdir(parents=True, exist_ok=True)

            # Log URL and title
            if isinstance(target, Page):
                logger.info("[%s] DEBUG url=%s", self.slug, target.url)
                title = await target.title()
                logger.info("[%s] DEBUG title=%s", self.slug, title)
            else:
                logger.info("[%s] DEBUG frame url=%s", self.slug, target.url)
                parent = target.page
                if parent:
                    logger.info("[%s] DEBUG parent page url=%s", self.slug, parent.url)

            # Screenshot
            if isinstance(target, Page):
                await target.screenshot(path=str(DEBUG_DIR / f"{prefix}.png"), full_page=True)
            else:
                parent = target.page
                if parent:
                    await parent.screenshot(path=str(DEBUG_DIR / f"{prefix}.png"), full_page=True)

            # HTML dump (first 50 KB)
            html = await target.content()
            (DEBUG_DIR / f"{prefix}.html").write_text(html[:50_000], encoding="utf-8")

            # Log first 3000 chars of HTML to the log stream
            logger.info("[%s] DEBUG html[:3000]=%s", self.slug, html[:3000])

            # Log all iframes on the page
            page_for_iframes = target if isinstance(target, Page) else (target.page or target)
            iframes = await page_for_iframes.query_selector_all("iframe")
            logger.info("[%s] DEBUG %d iframe(s) found on page", self.slug, len(iframes))
            for i, iframe in enumerate(iframes):
                src = await iframe.get_attribute("src") or "(no src)"
                logger.info("[%s] DEBUG iframe[%d]: src=%s", self.slug, i, src)

            # Count common product-like elements
            probe_selectors = [
                '[data-testid*="product"]',
                'div[class*="product"]',
                'div[class*="ProductCard"]',
                'a[href*="/product/"]',
                'article',
                '[class*="card"]',
            ]
            for sel in probe_selectors:
                try:
                    count = await target.locator(sel).count()
                    if count > 0:
                        logger.info("[%s] DEBUG selector %r → %d elements", self.slug, sel, count)
                except Exception:
                    pass

            logger.info("[%s] Debug artifacts saved: %s", self.slug, DEBUG_DIR / prefix)
        except Exception as exc:
            logger.warning("[%s] Failed to save debug info: %s", self.slug, exc)

    # ------------------------------------------------------------------
    # Abstract interface
    # ------------------------------------------------------------------

    @abc.abstractmethod
    async def scrape(self) -> list[dict[str, Any]]:
        """Scrape products from this dispensary.

        Returns a list of dicts, each representing one product/deal.
        The exact keys depend on what the site exposes, but callers can
        expect at least ``name`` and ``price`` when available.
        """
        ...
