"""
Stealth stack regression tests.

Validates that the anti-detection infrastructure is correctly configured
and functional.  These tests catch regressions in the stealth stack
(e.g. playwright-stealth breaking in an update, Chrome channel becoming
unavailable, User-Agent version drift) before they cause Cloudflare
blocks on live sites.

Tests:
  - Browser launches with real Chrome channel (not bundled Chromium)
  - playwright-stealth patches are applied (navigator.webdriver = false)
  - User-Agent strings match current Chrome versions
  - Viewport randomization produces valid dimensions
  - Analytics blocking is active

Run with::

    pytest tests/test_stealth_stack.py -v -s --timeout=120

Markers:
    @pytest.mark.live   — launches a real browser (needs Playwright installed)
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config.dispensaries import (
    BROWSER_ARGS, BROWSER_CHANNEL, _USER_AGENT_POOL,
    get_user_agent, get_viewport,
)
from platforms.base import launch_stealth_browser, _HAS_STEALTH_PKG, _BLOCKED_ANALYTICS_PATTERNS

pytestmark = [
    pytest.mark.live,
    pytest.mark.asyncio,
]


# ===================================================================
# Stealth package availability
# ===================================================================

class TestStealthDependencies:
    """Verify playwright-stealth is installed and importable."""

    def test_playwright_stealth_installed(self):
        """playwright-stealth 2.0+ must be installed for full evasion."""
        assert _HAS_STEALTH_PKG, (
            "playwright-stealth is NOT installed. The scraper will fall back "
            "to legacy JS stealth (~5 vectors) instead of the full 30+ vector "
            "patch set. Run: pip install playwright-stealth>=2.0.0"
        )

    def test_stealth_class_importable(self):
        """Stealth class from playwright-stealth 2.0 API must be importable."""
        from playwright_stealth import Stealth
        stealth = Stealth()
        assert stealth is not None


# ===================================================================
# Browser launch configuration
# ===================================================================

class TestBrowserConfig:
    """Verify browser launch settings are correct."""

    def test_chrome_channel_configured(self):
        """BROWSER_CHANNEL must be 'chrome' for real TLS fingerprint."""
        assert BROWSER_CHANNEL == "chrome", (
            f"BROWSER_CHANNEL is {BROWSER_CHANNEL!r}, expected 'chrome'. "
            "Bundled Chromium has a detectable TLS fingerprint."
        )

    def test_automation_flags_disabled(self):
        """Browser args must disable automation detection markers."""
        assert "--disable-blink-features=AutomationControlled" in BROWSER_ARGS
        assert "--disable-features=AutomationControlled" in BROWSER_ARGS

    def test_no_sandbox_for_ci(self):
        """--no-sandbox required for GitHub Actions runners."""
        assert "--no-sandbox" in BROWSER_ARGS


# ===================================================================
# User-Agent validation
# ===================================================================

class TestUserAgentPool:
    """UA pool must track the actual Chrome version being used."""

    def test_pool_not_empty(self):
        assert len(_USER_AGENT_POOL) >= 3, "Need at least 3 UA strings for rotation"

    def test_all_uas_are_chrome(self):
        """Every UA string must be a Chrome user-agent."""
        for ua in _USER_AGENT_POOL:
            assert "Chrome/" in ua, f"Non-Chrome UA in pool: {ua}"

    def test_chrome_versions_are_current(self):
        """UA Chrome versions must be 130+ (current era).

        Stale versions (e.g. Chrome 128) create a mismatch between
        the UA header and the real Chrome binary's behavior, which
        Cloudflare detects.
        """
        for ua in _USER_AGENT_POOL:
            match = re.search(r"Chrome/(\d+)\.", ua)
            assert match, f"Could not parse Chrome version from: {ua}"
            version = int(match.group(1))
            assert version >= 130, (
                f"Chrome version {version} in UA pool is stale. "
                f"Update to match installed Chrome binary. UA: {ua}"
            )

    def test_get_user_agent_returns_from_pool(self):
        """get_user_agent() must return a string from the pool."""
        for _ in range(20):
            ua = get_user_agent()
            assert ua in _USER_AGENT_POOL


# ===================================================================
# Viewport randomization
# ===================================================================

class TestViewportRandomization:
    """Viewport must produce valid, varied dimensions."""

    def test_viewport_has_required_keys(self):
        vp = get_viewport()
        assert "width" in vp
        assert "height" in vp

    def test_viewport_dimensions_reasonable(self):
        """Dimensions must be in common desktop range."""
        for _ in range(50):
            vp = get_viewport()
            assert 1200 <= vp["width"] <= 2000, f"Width out of range: {vp['width']}"
            assert 700 <= vp["height"] <= 1200, f"Height out of range: {vp['height']}"

    def test_viewport_has_jitter(self):
        """Repeated calls should produce varied dimensions (not identical)."""
        viewports = [get_viewport() for _ in range(30)]
        widths = {vp["width"] for vp in viewports}
        assert len(widths) > 1, "Viewport width is not randomized"


# ===================================================================
# Analytics blocking
# ===================================================================

class TestAnalyticsBlocking:
    """Analytics domains must be blocked to prevent bot detection triggers."""

    def test_google_analytics_blocked(self):
        assert any("google-analytics" in p for p in _BLOCKED_ANALYTICS_PATTERNS)

    def test_gtm_blocked(self):
        assert any("googletagmanager" in p for p in _BLOCKED_ANALYTICS_PATTERNS)

    def test_facebook_blocked(self):
        assert any("facebook" in p for p in _BLOCKED_ANALYTICS_PATTERNS)

    def test_hotjar_blocked(self):
        assert any("hotjar" in p for p in _BLOCKED_ANALYTICS_PATTERNS)


# ===================================================================
# Live browser stealth validation (requires Playwright)
# ===================================================================

class TestLiveBrowserStealth:
    """Launch a real browser and verify stealth patches are active.

    These tests actually start a Playwright browser and check that
    automation signals are masked.  Slower than unit tests but catches
    real-world failures.
    """

    @pytest.mark.timeout(60)
    async def test_navigator_webdriver_is_false(self):
        """navigator.webdriver must be false/undefined in stealth browser."""
        from playwright.async_api import async_playwright
        from playwright_stealth import Stealth

        stealth = Stealth()
        async with async_playwright() as pw:
            browser = await launch_stealth_browser(pw)
            context = await browser.new_context(
                user_agent=get_user_agent(),
                viewport=get_viewport(),
            )
            await stealth.apply_stealth_async(context)
            page = await context.new_page()

            # Navigate to blank page and check webdriver
            await page.goto("about:blank")
            webdriver_val = await page.evaluate("() => navigator.webdriver")

            assert webdriver_val is not True, (
                f"navigator.webdriver = {webdriver_val!r} — stealth patches "
                "are NOT masking the webdriver flag. Cloudflare will detect this."
            )

            # Also verify chrome.runtime exists (present in real Chrome)
            has_chrome_runtime = await page.evaluate(
                "() => !!(window.chrome && window.chrome.runtime)"
            )
            assert has_chrome_runtime, (
                "window.chrome.runtime is missing — headless detection signal"
            )

            await context.close()
            await browser.close()

    @pytest.mark.timeout(60)
    async def test_plugins_not_empty(self):
        """navigator.plugins must not be empty (empty = headless signal)."""
        from playwright.async_api import async_playwright
        from playwright_stealth import Stealth

        stealth = Stealth()
        async with async_playwright() as pw:
            browser = await launch_stealth_browser(pw)
            context = await browser.new_context(
                user_agent=get_user_agent(),
                viewport=get_viewport(),
            )
            await stealth.apply_stealth_async(context)
            page = await context.new_page()

            await page.goto("about:blank")
            plugin_count = await page.evaluate("() => navigator.plugins.length")

            assert plugin_count > 0, (
                f"navigator.plugins.length = {plugin_count} — empty plugins "
                "array is a classic headless browser detection signal"
            )

            await context.close()
            await browser.close()

    @pytest.mark.timeout(60)
    async def test_languages_not_empty(self):
        """navigator.languages must be populated."""
        from playwright.async_api import async_playwright
        from playwright_stealth import Stealth

        stealth = Stealth()
        async with async_playwright() as pw:
            browser = await launch_stealth_browser(pw)
            context = await browser.new_context(
                user_agent=get_user_agent(),
                viewport=get_viewport(),
            )
            await stealth.apply_stealth_async(context)
            page = await context.new_page()

            await page.goto("about:blank")
            languages = await page.evaluate("() => navigator.languages")

            assert languages and len(languages) > 0, (
                "navigator.languages is empty — bot detection signal"
            )
            assert "en-US" in languages, (
                f"navigator.languages = {languages} — expected 'en-US'"
            )

            await context.close()
            await browser.close()
