"""Tests for handlers/pagination.py — Dutchie pagination selectors and fallbacks.

Validates that the pagination handler covers the selector patterns needed for
Dutchie iframe embeds (TD Gibson, Planet 13, etc.) and that the JS DOM
fallback and scroll-to-bottom strategies are correctly wired.

These tests mock Playwright's Page/Frame to test the logic without a browser.
"""

from __future__ import annotations

import asyncio
import importlib
import sys
from pathlib import Path
from types import ModuleType
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


# ---------------------------------------------------------------------------
# Install a permissive playwright mock that handles any import.
# Uses a module subclass that returns MagicMock for any attribute access,
# so `from playwright.async_api import Page, Frame, Error, ...` all work.
# ---------------------------------------------------------------------------
class _PermissiveMock(ModuleType):
    """Module that returns MagicMock for any attribute not explicitly set."""
    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(name)
        return MagicMock


_need_cleanup = False
if "playwright" not in sys.modules:
    _need_cleanup = True
    _pw = _PermissiveMock("playwright")
    _pw_async = _PermissiveMock("playwright.async_api")
    _pw_async.TimeoutError = type("PlaywrightTimeout", (Exception,), {})
    _pw.async_api = _pw_async
    sys.modules["playwright"] = _pw
    sys.modules["playwright.async_api"] = _pw_async

if "playwright_stealth" not in sys.modules:
    _stealth = _PermissiveMock("playwright_stealth")
    _stealth.stealth_async = AsyncMock()
    sys.modules["playwright_stealth"] = _stealth

from handlers.pagination import navigate_dutchie_page  # noqa: E402


# ---------------------------------------------------------------------------
# Helpers — mock Playwright target (Page or Frame)
# ---------------------------------------------------------------------------

def _make_mock_target(
    *,
    matching_selector: str | None = None,
    js_result=None,
    button_enabled: bool = True,
):
    """Build a mock Playwright Page/Frame.

    Parameters
    ----------
    matching_selector
        If set, ``query_selector(matching_selector)`` returns a visible, enabled
        button mock.  All other selectors return ``None``.
    js_result
        Return value of ``target.evaluate(...)`` for the JS DOM fallback.
        ``None`` means JS fallback found nothing.
    button_enabled
        Whether the matched button reports ``is_enabled() == True``.
    """
    target = AsyncMock()

    btn_mock = AsyncMock()
    btn_mock.is_visible = AsyncMock(return_value=True)
    btn_mock.is_enabled = AsyncMock(return_value=button_enabled)
    btn_mock.click = AsyncMock()

    async def fake_query_selector(sel):
        if matching_selector and sel == matching_selector:
            return btn_mock
        return None

    target.query_selector = AsyncMock(side_effect=fake_query_selector)

    async def fake_evaluate(js_code, *args):
        if not args:
            return None  # scroll-to-bottom call
        return js_result  # JS DOM fallback call

    target.evaluate = AsyncMock(side_effect=fake_evaluate)

    return target, btn_mock


# ---------------------------------------------------------------------------
# Test: page-number selector coverage
# ---------------------------------------------------------------------------

class TestPageNumberSelectors:
    """Verify that navigate_dutchie_page finds buttons via various selector patterns."""

    @pytest.mark.parametrize("selector", [
        'button[aria-label="go to page 2"]',
        'button[aria-label="Go to page 2"]',
        'a[aria-label="go to page 2"]',
        'a[aria-label="Go to page 2"]',
        '[data-page="2"]',
        'nav li a:has-text("2")',
        'nav li button:has-text("2")',
        '[class*="pagination"] a:has-text("2")',
        '[class*="pagination"] button:has-text("2")',
        '[class*="Pagination"] a:has-text("2")',
        '[class*="Pagination"] button:has-text("2")',
        '[class*="pager"] a:has-text("2")',
        '[class*="pager"] button:has-text("2")',
        'ul[class*="page"] li a:has-text("2")',
        'ul[class*="page"] li button:has-text("2")',
        'button:has-text("2")',
    ])
    async def test_page_selector_navigates(self, selector):
        """Each page-number selector pattern should successfully navigate."""
        target, btn = _make_mock_target(matching_selector=selector)
        with patch("handlers.pagination.asyncio.sleep", new_callable=AsyncMock):
            result = await navigate_dutchie_page(target, 2)
        assert result is True
        btn.click.assert_called_once()

    async def test_disabled_button_returns_false(self):
        """A disabled pagination button means end of results — return False."""
        selector = 'button[aria-label="go to page 5"]'
        target, btn = _make_mock_target(matching_selector=selector, button_enabled=False)
        with patch("handlers.pagination.asyncio.sleep", new_callable=AsyncMock):
            result = await navigate_dutchie_page(target, 5)
        assert result is False
        btn.click.assert_not_called()


# ---------------------------------------------------------------------------
# Test: "Next" button selectors
# ---------------------------------------------------------------------------

class TestNextSelectors:
    """Verify that the "Next" / arrow fallback selectors work."""

    @pytest.mark.parametrize("selector", [
        'button[aria-label="Go to next page"]',
        'button[aria-label="go to next page"]',
        'button[aria-label="Next page"]',
        'button[aria-label="Next"]',
        'a[aria-label="Go to next page"]',
        'a[aria-label="Next"]',
        '[class*="pagination"] a[rel="next"]',
        '[class*="pagination"] button[rel="next"]',
        'nav a[rel="next"]',
        '[class*="pagination"] li:last-child a',
        '[class*="Pagination"] li:last-child a',
        'button:has-text("Next")',
        'a:has-text("Next")',
        'button:has-text("\u203a")',
        'a:has-text("\u203a")',
        'button:has-text("\u00bb")',
        'a:has-text("\u00bb")',
        'button:has-text(">")',
    ])
    async def test_next_selector_navigates(self, selector):
        """Each 'Next' selector pattern should successfully navigate."""
        target, btn = _make_mock_target(matching_selector=selector)
        with patch("handlers.pagination.asyncio.sleep", new_callable=AsyncMock):
            result = await navigate_dutchie_page(target, 2)
        assert result is True
        btn.click.assert_called_once()


# ---------------------------------------------------------------------------
# Test: JS DOM fallback
# ---------------------------------------------------------------------------

class TestJsDomFallback:
    """Verify that the JavaScript DOM search fallback fires when selectors miss."""

    async def test_js_fallback_page_number(self):
        """When no CSS selector matches, JS fallback returning 'page_number' succeeds."""
        target, _ = _make_mock_target(js_result="page_number")
        with patch("handlers.pagination.asyncio.sleep", new_callable=AsyncMock):
            result = await navigate_dutchie_page(target, 3)
        assert result is True

    async def test_js_fallback_next_arrow(self):
        """When no CSS selector matches, JS fallback returning 'next_arrow' succeeds."""
        target, _ = _make_mock_target(js_result="next_arrow")
        with patch("handlers.pagination.asyncio.sleep", new_callable=AsyncMock):
            result = await navigate_dutchie_page(target, 3)
        assert result is True

    async def test_js_fallback_broad_match(self):
        """When no CSS selector matches, JS fallback returning 'broad_match' succeeds."""
        target, _ = _make_mock_target(js_result="broad_match")
        with patch("handlers.pagination.asyncio.sleep", new_callable=AsyncMock):
            result = await navigate_dutchie_page(target, 3)
        assert result is True

    async def test_no_pagination_returns_false(self):
        """When nothing works (no selectors, no JS fallback), return False."""
        target, _ = _make_mock_target(js_result=None)
        with patch("handlers.pagination.asyncio.sleep", new_callable=AsyncMock):
            result = await navigate_dutchie_page(target, 3)
        assert result is False


# ---------------------------------------------------------------------------
# Test: scroll-to-bottom is called before pagination attempts
# ---------------------------------------------------------------------------

class TestScrollToBottom:
    """Verify that the page scrolls to bottom before trying pagination buttons."""

    async def test_evaluate_called_for_scroll(self):
        """target.evaluate() should be called (for scroll) before selector checks."""
        target, _ = _make_mock_target(
            matching_selector='button[aria-label="go to page 2"]'
        )
        with patch("handlers.pagination.asyncio.sleep", new_callable=AsyncMock):
            await navigate_dutchie_page(target, 2)

        # evaluate() is called at least once for scroll-to-bottom
        assert target.evaluate.call_count >= 1


# ---------------------------------------------------------------------------
# Test: high page numbers (regression: Gibson has 15 pages)
# ---------------------------------------------------------------------------

class TestHighPageNumbers:
    """Ensure pagination works for page numbers up to 15+ (Gibson specials)."""

    @pytest.mark.parametrize("page_num", [5, 10, 15])
    async def test_high_page_number_via_aria_label(self, page_num):
        selector = f'button[aria-label="go to page {page_num}"]'
        target, btn = _make_mock_target(matching_selector=selector)
        with patch("handlers.pagination.asyncio.sleep", new_callable=AsyncMock):
            result = await navigate_dutchie_page(target, page_num)
        assert result is True

    @pytest.mark.parametrize("page_num", [5, 10, 15])
    async def test_high_page_number_via_js_fallback(self, page_num):
        target, _ = _make_mock_target(js_result="page_number")
        with patch("handlers.pagination.asyncio.sleep", new_callable=AsyncMock):
            result = await navigate_dutchie_page(target, page_num)
        assert result is True


# ---------------------------------------------------------------------------
# Test: retry behavior
# ---------------------------------------------------------------------------

class TestRetries:
    """Ensure the function retries before giving up."""

    async def test_retries_before_giving_up(self):
        """Should attempt 3 retries before returning False."""
        target, _ = _make_mock_target(js_result=None)
        with patch("handlers.pagination.asyncio.sleep", new_callable=AsyncMock):
            result = await navigate_dutchie_page(target, 2)
        assert result is False
        # evaluate() called once per attempt for scroll + once for JS fallback
        # = 2 calls x 3 attempts = 6 total evaluate calls
        assert target.evaluate.call_count == 6
