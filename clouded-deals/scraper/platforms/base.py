"""
Abstract base class for all platform scrapers.

Provides shared browser lifecycle management, viewport/user-agent setup,
and age-gate dismissal.  Subclasses implement ``scrape()`` with their
platform-specific navigation and extraction logic.
"""

from __future__ import annotations

import abc
import logging
from typing import Any

from playwright.async_api import (
    async_playwright,
    Browser,
    BrowserContext,
    Page,
    Playwright,
)

from config.dispensaries import BROWSER_ARGS, USER_AGENT, VIEWPORT, WAIT_UNTIL
from handlers import dismiss_age_gate

logger = logging.getLogger(__name__)


class BaseScraper(abc.ABC):
    """Skeleton shared by every platform scraper.

    Usage::

        async with DutchieScraper(dispensary_cfg) as scraper:
            products = await scraper.scrape()
    """

    def __init__(self, dispensary: dict[str, Any]) -> None:
        self.dispensary = dispensary
        self.name: str = dispensary["name"]
        self.slug: str = dispensary["slug"]
        self.url: str = dispensary["url"]
        self.platform: str = dispensary["platform"]

        # Set by __aenter__
        self._pw: Playwright | None = None
        self._browser: Browser | None = None
        self._context: BrowserContext | None = None
        self._page: Page | None = None

    # ------------------------------------------------------------------
    # Async context manager — browser lifecycle
    # ------------------------------------------------------------------

    async def __aenter__(self) -> "BaseScraper":
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
        logger.info("[%s] Browser ready", self.slug)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        if self._context:
            await self._context.close()
        if self._browser:
            await self._browser.close()
        if self._pw:
            await self._pw.stop()
        logger.info("[%s] Browser closed", self.slug)

    # ------------------------------------------------------------------
    # Shared helpers
    # ------------------------------------------------------------------

    @property
    def page(self) -> Page:
        assert self._page is not None, "BaseScraper must be used as an async context manager"
        return self._page

    async def goto(self, url: str | None = None) -> None:
        """Navigate to *url* (defaults to ``self.url``) using the
        configured ``WAIT_UNTIL`` strategy."""
        target = url or self.url
        logger.info("[%s] Navigating to %s", self.slug, target)
        await self.page.goto(target, wait_until=WAIT_UNTIL)

    async def handle_age_gate(self, *, post_wait_sec: float = 0) -> bool:
        """Try to dismiss any age-verification overlay on the current page."""
        return await dismiss_age_gate(
            self.page,
            post_dismiss_wait_sec=post_wait_sec,
        )

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
