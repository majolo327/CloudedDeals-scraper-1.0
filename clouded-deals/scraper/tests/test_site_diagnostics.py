"""
Live diagnostic tests for sites that failed scraping or returned 0 products.

These tests hit live sites with a real browser — they are SLOW and
network-dependent.  They are NOT part of the fast CI suite.

Run with::

    # All diagnostic tests
    pytest tests/test_site_diagnostics.py -v -s --timeout=600

    # Single site
    pytest tests/test_site_diagnostics.py::TestP1Failures::test_td_gibson -v -s

    # Just the zero-product sites
    pytest tests/test_site_diagnostics.py::TestZeroProductSites -v -s

Markers:
    @pytest.mark.live   — requires network + Playwright browser
    @pytest.mark.slow   — takes 30–120 s per site
"""

from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path
from typing import Any

import pytest

# Ensure the scraper package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config.dispensaries import get_dispensary_by_slug, PLATFORM_DEFAULTS
from platforms.dutchie import DutchieScraper
from platforms.jane import JaneScraper
from platforms.carrot import CarrotScraper
from handlers.iframe import (
    find_dutchie_content,
    JS_EMBED_CONTAINERS,
    JS_EMBED_PRODUCT_PROBES,
    DIRECT_PAGE_PRODUCT_PROBES,
    IFRAME_SELECTORS,
)
from handlers.age_verification import (
    dismiss_age_gate,
    force_remove_age_gate,
    PRIMARY_AGE_GATE_SELECTORS,
    SECONDARY_AGE_GATE_SELECTORS,
)

logger = logging.getLogger(__name__)

# Configure verbose logging for diagnostics
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)

# ---------------------------------------------------------------------------
# Markers
# ---------------------------------------------------------------------------

pytestmark = [
    pytest.mark.live,
    pytest.mark.slow,
    pytest.mark.asyncio,
]


# ---------------------------------------------------------------------------
# Shared diagnostic helper
# ---------------------------------------------------------------------------

# Hard timeout for the asyncio-level kill switch.  pytest's signal-based
# timeout (SIGALRM) cannot interrupt a blocked asyncio event loop — the
# coroutine just keeps waiting.  asyncio.wait_for() cancels from inside
# the event loop and actually unblocks the stuck coroutine.
_DIAG_TIMEOUT_SEC = 300


async def _run_diagnostic(
    slug: str,
    scraper_cls: type,
    *,
    extra_probes: list[str] | None = None,
    timeout_sec: float = _DIAG_TIMEOUT_SEC,
) -> dict[str, Any]:
    """Run a full scrape for *slug* and return a diagnostic report.

    Wraps the actual work in ``asyncio.wait_for()`` so the scraper
    coroutine is cancelled if it exceeds *timeout_sec*.  This is the
    hard kill switch that pytest's signal timeout cannot provide.

    The report dict includes:
        products       — list of extracted products
        product_count  — len(products)
        page_url       — final URL after navigation
        page_title     — <title> text
        iframe_count   — number of <iframe> elements on the page
        iframe_srcs    — list of iframe src attributes
        probe_counts   — {selector: count} for common product selectors
        age_gate_found — whether an age gate was detected
        error          — exception message if the scrape crashed
    """
    cfg = get_dispensary_by_slug(slug)
    assert cfg is not None, f"No dispensary config found for slug={slug!r}"
    assert cfg.get("is_active", True), f"Dispensary {slug!r} is not active"

    report: dict[str, Any] = {
        "slug": slug,
        "name": cfg["name"],
        "platform": cfg["platform"],
        "url": cfg["url"],
        "embed_type": cfg.get("embed_type"),
        "products": [],
        "product_count": 0,
        "error": None,
    }

    try:
        report = await asyncio.wait_for(
            _run_diagnostic_inner(slug, cfg, scraper_cls, report, extra_probes),
            timeout=timeout_sec,
        )
    except asyncio.TimeoutError:
        report["error"] = f"Hard timeout after {timeout_sec}s — scraper hung"
        logger.error("Diagnostic HARD TIMEOUT for %s after %ds", slug, timeout_sec)
    except Exception as exc:
        report["error"] = f"{type(exc).__name__}: {exc}"
        logger.error("Diagnostic scrape FAILED for %s: %s", slug, exc, exc_info=True)

    return report


async def _run_diagnostic_inner(
    slug: str,
    cfg: dict[str, Any],
    scraper_cls: type,
    report: dict[str, Any],
    extra_probes: list[str] | None,
) -> dict[str, Any]:
    """Inner diagnostic logic — called inside asyncio.wait_for()."""
    async with scraper_cls(cfg) as scraper:
        page = scraper.page

        # --- Run the scrape ---
        products = await scraper.scrape()
        report["products"] = products
        report["product_count"] = len(products)

        # --- Page diagnostics ---
        report["page_url"] = page.url
        try:
            report["page_title"] = await page.title()
        except Exception:
            report["page_title"] = "(error)"

        # --- Iframe audit ---
        try:
            iframes = await page.query_selector_all("iframe")
            report["iframe_count"] = len(iframes)
            srcs = []
            for el in iframes:
                src = await el.get_attribute("src") or "(no src)"
                srcs.append(src)
            report["iframe_srcs"] = srcs
        except Exception:
            report["iframe_count"] = -1
            report["iframe_srcs"] = []

        # --- Product selector probes (on main page) ---
        probes = [
            '[data-testid*="product"]',
            'div[class*="product"]',
            'div[class*="ProductCard"]',
            'a[href*="/product/"]',
            'article',
            '[class*="card"]',
            '#carrot-store-root',
            '[data-carrot-route]',
            '#dutchie--embed',
            '[data-dutchie]',
            '._flex_80y9c_1',
        ]
        if extra_probes:
            probes.extend(extra_probes)

        probe_counts: dict[str, int] = {}
        for sel in probes:
            try:
                count = await page.locator(sel).count()
                if count > 0:
                    probe_counts[sel] = count
            except Exception:
                pass
        report["probe_counts"] = probe_counts

    return report


def _print_report(report: dict[str, Any]) -> None:
    """Pretty-print a diagnostic report to stdout."""
    print(f"\n{'='*70}")
    print(f"DIAGNOSTIC REPORT: {report['slug']}")
    print(f"{'='*70}")
    print(f"  Name:           {report.get('name')}")
    print(f"  Platform:       {report.get('platform')}")
    print(f"  Config URL:     {report.get('url')}")
    print(f"  Embed type:     {report.get('embed_type')}")
    print(f"  Final page URL: {report.get('page_url', '(not reached)')}")
    print(f"  Page title:     {report.get('page_title', '(not reached)')}")
    print(f"  Product count:  {report.get('product_count', 0)}")
    print(f"  Error:          {report.get('error', 'None')}")
    print(f"  Iframes:        {report.get('iframe_count', '?')}")

    for src in report.get("iframe_srcs", []):
        print(f"    - {src[:120]}")

    probes = report.get("probe_counts", {})
    if probes:
        print("  Selector probes (non-zero):")
        for sel, count in sorted(probes.items(), key=lambda x: -x[1]):
            print(f"    {sel:50s} → {count}")
    else:
        print("  Selector probes: ALL ZERO")

    products = report.get("products", [])
    if products:
        print(f"  First 3 products:")
        for p in products[:3]:
            print(f"    - {p.get('name', '?')[:60]}  |  {p.get('price', '?')}")
    print(f"{'='*70}\n")


# ===================================================================
# P1 FAILURES — Sites that crashed or timed out during scrape
# ===================================================================

class TestP1Failures:
    """Diagnostic tests for sites that failed with 'Failed after 2 attempts'.

    Root-cause hypotheses:
      - TD sites: age gate click doesn't trigger Dutchie JS embed injection
      - Planet 13: direct-page product cards not detected
      - Oasis: Jane iframe not found or location selector blocks products
    """

    @pytest.mark.timeout(600)
    async def test_td_gibson(self):
        """TD Gibson — Dutchie JS embed.

        Expected: Age gate button triggers Dutchie embed injection into
        ``#dutchie--embed``. Products appear as ``[data-testid="product-card"]``
        inside the embed container.
        """
        report = await _run_diagnostic("td-gibson", DutchieScraper)
        _print_report(report)

        assert report["error"] is None, f"Scrape crashed: {report['error']}"
        assert report["product_count"] > 0, (
            f"TD Gibson returned 0 products. "
            f"Probes: {report.get('probe_counts', {})}. "
            f"Iframes: {report.get('iframe_srcs', [])}"
        )

    @pytest.mark.timeout(600)
    async def test_td_eastern(self):
        """TD Eastern — Dutchie JS embed (same pattern as Gibson)."""
        report = await _run_diagnostic("td-eastern", DutchieScraper)
        _print_report(report)

        assert report["error"] is None, f"Scrape crashed: {report['error']}"
        assert report["product_count"] > 0, (
            f"TD Eastern returned 0 products. "
            f"Probes: {report.get('probe_counts', {})}. "
            f"Iframes: {report.get('iframe_srcs', [])}"
        )

    @pytest.mark.timeout(600)
    async def test_td_decatur(self):
        """TD Decatur — Dutchie JS embed (same pattern as Gibson)."""
        report = await _run_diagnostic("td-decatur", DutchieScraper)
        _print_report(report)

        assert report["error"] is None, f"Scrape crashed: {report['error']}"
        assert report["product_count"] > 0, (
            f"TD Decatur returned 0 products. "
            f"Probes: {report.get('probe_counts', {})}. "
            f"Iframes: {report.get('iframe_srcs', [])}"
        )

    @pytest.mark.timeout(600)
    async def test_planet13(self):
        """Planet 13 — Dutchie direct page.

        Expected: Products render directly on the page (no iframe, no
        ``#dutchie--embed``).  Detection should match via
        ``[data-testid="product-card"]`` or ``[class*="ProductCard"]``.
        """
        report = await _run_diagnostic("planet13", DutchieScraper)
        _print_report(report)

        assert report["error"] is None, f"Scrape crashed: {report['error']}"
        assert report["product_count"] > 0, (
            f"Planet 13 returned 0 products. "
            f"Probes: {report.get('probe_counts', {})}. "
            f"Iframes: {report.get('iframe_srcs', [])}"
        )

    @pytest.mark.timeout(600)
    async def test_oasis(self):
        """Oasis Cannabis — Jane hybrid (iframe or direct).

        Expected: Products render via Jane iframe from ``iheartjane.com``
        or directly on ``oasiscannabis.com/shop/menu/specials``.  May
        have a location selector that must be handled.
        """
        report = await _run_diagnostic(
            "oasis",
            JaneScraper,
            extra_probes=[
                'iframe[src*="iheartjane"]',
                'iframe[src*="jane"]',
                '._flex_80y9c_1[style*="--box-height: 100%"]',
                'div[class*="menu-item"]',
                'div[class*="product-card"]',
            ],
        )
        _print_report(report)

        assert report["error"] is None, f"Scrape crashed: {report['error']}"
        assert report["product_count"] > 0, (
            f"Oasis returned 0 products. "
            f"Probes: {report.get('probe_counts', {})}. "
            f"Iframes: {report.get('iframe_srcs', [])}"
        )


# ===================================================================
# ZERO-PRODUCT SITES — Scrape succeeds but returns 0 products
# ===================================================================

class TestZeroProductSites:
    """Diagnostic tests for sites that scrape successfully but return 0 products.

    These sites have unique/custom menus that differ from the majority
    of sites on each platform.  Each test captures detailed diagnostics
    to identify what's different about the site's DOM structure.

    Sites (by platform):
      Carrot (4): Wallflower, Jenny's, Euphoria Wellness, Silver Sage
      Jane (2):   Exhale, The Source
      Dutchie (1): Mint Paradise
    """

    # ------------------------------------------------------------------
    # CARROT SITES
    # ------------------------------------------------------------------

    @pytest.mark.timeout(180)
    async def test_wallflower_blue_diamond(self):
        """Wallflower Blue Diamond — Carrot WordPress embed.

        URL: wallflower-house.com/order/
        Expected: Carrot JS widget injects product links as
        ``a[href*="/product/"]`` into the WordPress page DOM.

        Diagnostic focus:
          - Does ``#carrot-store-root`` exist?
          - Does ``data-carrot-route`` attribute appear on <html>?
          - Are there ``a[href*="/product/"]`` links?
          - Is there an age gate blocking content?
        """
        report = await _run_diagnostic(
            "wallflower-blue-diamond",
            CarrotScraper,
            extra_probes=[
                '#carrot-store-root',
                '[data-carrot-route]',
                '[data-carrot-route-root]',
                'a[href*="/product/"]',
                '.hydrated',
                '[class*="carrot"]',
                '#carrot-menu',
            ],
        )
        _print_report(report)

        assert report["error"] is None, f"Scrape crashed: {report['error']}"
        assert report["product_count"] > 0, (
            f"Wallflower returned 0 products. "
            f"Probes: {report.get('probe_counts', {})}. "
            f"This is a Carrot WordPress embed — check if "
            f"``a[href*='/product/']`` links exist on the page."
        )

    @pytest.mark.timeout(180)
    async def test_jennys_dispensary(self):
        """Jenny's Dispensary — Carrot WordPress embed.

        URL: jennysdispensary.com/store/
        """
        report = await _run_diagnostic(
            "jennys",
            CarrotScraper,
            extra_probes=[
                '#carrot-store-root',
                '[data-carrot-route]',
                'a[href*="/product/"]',
                '[class*="carrot"]',
            ],
        )
        _print_report(report)

        assert report["error"] is None, f"Scrape crashed: {report['error']}"
        assert report["product_count"] > 0, (
            f"Jenny's returned 0 products. "
            f"Probes: {report.get('probe_counts', {})}."
        )

    @pytest.mark.timeout(180)
    async def test_euphoria_wellness(self):
        """Euphoria Wellness — Carrot WordPress embed.

        URL: euphoriawellnessnv.com/menu/
        """
        report = await _run_diagnostic(
            "euphoria-wellness",
            CarrotScraper,
            extra_probes=[
                '#carrot-store-root',
                '[data-carrot-route]',
                'a[href*="/product/"]',
                '[class*="carrot"]',
            ],
        )
        _print_report(report)

        assert report["error"] is None, f"Scrape crashed: {report['error']}"
        assert report["product_count"] > 0, (
            f"Euphoria Wellness returned 0 products. "
            f"Probes: {report.get('probe_counts', {})}."
        )

    @pytest.mark.timeout(180)
    async def test_silver_sage_wellness(self):
        """Silver Sage Wellness — Carrot standalone SPA.

        URL: store.sswlv.com/
        Expected: Standalone Carrot SPA with ``#carrot-store-root``
        as the app container.
        """
        report = await _run_diagnostic(
            "silver-sage",
            CarrotScraper,
            extra_probes=[
                '#carrot-store-root',
                '[data-carrot-route]',
                'a[href*="/product/"]',
                '[class*="carrot"]',
            ],
        )
        _print_report(report)

        assert report["error"] is None, f"Scrape crashed: {report['error']}"
        assert report["product_count"] > 0, (
            f"Silver Sage returned 0 products. "
            f"Probes: {report.get('probe_counts', {})}. "
            f"This is a standalone Carrot SPA — check ``#carrot-store-root``."
        )

    # ------------------------------------------------------------------
    # JANE SITES
    # ------------------------------------------------------------------

    @pytest.mark.timeout(180)
    async def test_exhale(self):
        """Exhale — Jane hybrid.

        URL: exhalebrands.com/store/
        Expected: Jane iframe from iheartjane.com or direct-page products.

        Diagnostic focus:
          - Does a Jane iframe exist?
          - Are there direct-page product cards?
          - Is there an age gate or location picker blocking?
        """
        report = await _run_diagnostic(
            "exhale",
            JaneScraper,
            extra_probes=[
                'iframe[src*="iheartjane"]',
                'iframe[src*="jane"]',
                '._flex_80y9c_1',
                'div[class*="product-card"]',
                'div[class*="menu-item"]',
                '[data-testid*="product"]',
            ],
        )
        _print_report(report)

        assert report["error"] is None, f"Scrape crashed: {report['error']}"
        assert report["product_count"] > 0, (
            f"Exhale returned 0 products. "
            f"Probes: {report.get('probe_counts', {})}. "
            f"Iframes: {report.get('iframe_srcs', [])}."
        )

    @pytest.mark.timeout(180)
    async def test_the_source(self):
        """The Source — Jane hybrid.

        URL: thesourcenv.com/specials/
        NOTE: The Source shares one /specials/ URL for all 4 locations.
        May require location selection before products appear.
        """
        report = await _run_diagnostic(
            "the-source",
            JaneScraper,
            extra_probes=[
                'iframe[src*="iheartjane"]',
                'iframe[src*="jane"]',
                '._flex_80y9c_1',
                'div[class*="product-card"]',
                'div[class*="menu-item"]',
                # Location picker selectors
                'select',
                '[class*="location"]',
                '[class*="store-select"]',
            ],
        )
        _print_report(report)

        assert report["error"] is None, f"Scrape crashed: {report['error']}"
        assert report["product_count"] > 0, (
            f"The Source returned 0 products. "
            f"Probes: {report.get('probe_counts', {})}. "
            f"Iframes: {report.get('iframe_srcs', [])}. "
            f"NOTE: may need location selection — check for <select> or "
            f"location picker elements."
        )

    # ------------------------------------------------------------------
    # DUTCHIE SITES
    # ------------------------------------------------------------------

    @pytest.mark.timeout(600)
    async def test_mint_paradise(self):
        """Mint Paradise — Dutchie iframe.

        URL: mintdeals.com/paradise-lv/menu/?dtche[path]=specials
        Expected: Standard Dutchie iframe embed — age gate then iframe
        with product cards inside.
        """
        report = await _run_diagnostic(
            "mint-paradise",
            DutchieScraper,
            extra_probes=[
                'iframe[src*="dutchie"]',
                'iframe[src*="embedded-menu"]',
                '#dutchie--embed',
                '[data-testid="product-card"]',
            ],
        )
        _print_report(report)

        assert report["error"] is None, f"Scrape crashed: {report['error']}"
        assert report["product_count"] > 0, (
            f"Mint Paradise returned 0 products. "
            f"Probes: {report.get('probe_counts', {})}. "
            f"Iframes: {report.get('iframe_srcs', [])}."
        )


# ===================================================================
# DEEP DIAGNOSTICS — Low-level probes for debugging specific issues
# ===================================================================

class TestDeepDiagnostics:
    """Targeted probes for specific failure modes.

    These tests isolate individual scraper steps (age gate, iframe
    detection, product extraction) to pinpoint exactly where the
    pipeline breaks for each site.
    """

    @pytest.mark.timeout(180)
    async def test_td_age_gate_triggers_embed(self):
        """Verify that clicking TD's age gate button injects the Dutchie embed."""
        try:
            await asyncio.wait_for(
                self._td_age_gate_inner(), timeout=120,
            )
        except asyncio.TimeoutError:
            pytest.fail("TD age gate test timed out after 120s — browser hung")

    async def _td_age_gate_inner(self):
        from playwright.async_api import async_playwright

        cfg = get_dispensary_by_slug("td-gibson")
        assert cfg is not None

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
            )
            context = await browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/131.0.0.0 Safari/537.36"
                ),
            )
            page = await context.new_page()

            print("\n--- TD Age Gate → Embed Injection Test ---")

            # Navigate
            await page.goto(cfg["url"], wait_until="load", timeout=120_000)
            await asyncio.sleep(3)
            print(f"  Navigated to: {page.url}")
            print(f"  Title: {await page.title()}")

            # Probe BEFORE age gate
            for sel in JS_EMBED_CONTAINERS:
                count = await page.locator(sel).count()
                print(f"  BEFORE age gate: {sel} → {count}")

            iframe_count_before = len(await page.query_selector_all("iframe"))
            print(f"  BEFORE age gate: iframes → {iframe_count_before}")

            # Click the age gate
            clicked = await dismiss_age_gate(page, post_dismiss_wait_sec=3)
            print(f"  Age gate clicked: {clicked}")

            # Wait for content (the real 45s+ wait)
            print("  Waiting 45s for Dutchie embed to inject...")
            await asyncio.sleep(45)

            # Probe AFTER age gate
            for sel in JS_EMBED_CONTAINERS:
                count = await page.locator(sel).count()
                print(f"  AFTER age gate: {sel} → {count}")

            iframe_count_after = len(await page.query_selector_all("iframe"))
            print(f"  AFTER age gate: iframes → {iframe_count_after}")

            # Check for product cards
            for sel in DIRECT_PAGE_PRODUCT_PROBES:
                count = await page.locator(sel).count()
                print(f"  AFTER age gate: {sel} → {count}")

            # Check iframes
            iframes = await page.query_selector_all("iframe")
            for i, el in enumerate(iframes):
                src = await el.get_attribute("src") or "(no src)"
                print(f"  iframe[{i}]: {src[:120]}")

            embed_detected = (
                iframe_count_after > iframe_count_before
                or any(
                    await page.locator(sel).count() > 0
                    for sel in JS_EMBED_CONTAINERS
                )
            )
            print(f"  Embed detected after age gate: {embed_detected}")

            await browser.close()

            assert embed_detected, (
                "Age gate click did NOT trigger Dutchie embed injection. "
                "The embed script may have changed or the age gate selector "
                "is no longer correct."
            )

    @pytest.mark.timeout(180)
    async def test_planet13_direct_page_products(self):
        """Verify that Planet 13 renders product cards directly on page."""
        try:
            await asyncio.wait_for(
                self._planet13_inner(), timeout=120,
            )
        except asyncio.TimeoutError:
            pytest.fail("Planet 13 test timed out after 120s — browser hung")

    async def _planet13_inner(self):
        from playwright.async_api import async_playwright

        cfg = get_dispensary_by_slug("planet13")
        assert cfg is not None

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
            )
            context = await browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/131.0.0.0 Safari/537.36"
                ),
            )
            page = await context.new_page()

            print("\n--- Planet 13 Direct Page Products Test ---")

            await page.goto(cfg["url"], wait_until="load", timeout=120_000)
            await asyncio.sleep(5)
            print(f"  Navigated to: {page.url}")
            print(f"  Title: {await page.title()}")

            # Dismiss any age gate
            await dismiss_age_gate(page, post_dismiss_wait_sec=3)
            await force_remove_age_gate(page)
            await asyncio.sleep(10)

            # Probe for direct product cards
            total_products = 0
            for sel in DIRECT_PAGE_PRODUCT_PROBES:
                count = await page.locator(sel).count()
                print(f"  {sel} → {count}")
                total_products = max(total_products, count)

            # Check if content is inside an iframe instead
            iframes = await page.query_selector_all("iframe")
            print(f"  Iframes on page: {len(iframes)}")
            for i, el in enumerate(iframes):
                src = await el.get_attribute("src") or "(no src)"
                print(f"    [{i}]: {src[:120]}")

            # Check for Dutchie containers
            for sel in JS_EMBED_CONTAINERS:
                count = await page.locator(sel).count()
                if count > 0:
                    print(f"  JS embed container: {sel} → {count}")

            # Log page text length as basic content check
            body_text = await page.evaluate("() => document.body?.innerText?.length || 0")
            print(f"  Body text length: {body_text}")

            await browser.close()

            assert total_products >= 3, (
                f"Planet 13 has only {total_products} direct product cards. "
                f"Expected >= 3.  The site may have changed to iframe or "
                f"JS-embed mode, or products need different selectors."
            )

    @pytest.mark.timeout(180)
    async def test_oasis_jane_iframe_detection(self):
        """Verify Oasis Jane iframe is detectable."""
        try:
            await asyncio.wait_for(
                self._oasis_jane_inner(), timeout=120,
            )
        except asyncio.TimeoutError:
            pytest.fail("Oasis Jane test timed out after 120s — browser hung")

    async def _oasis_jane_inner(self):
        from playwright.async_api import async_playwright

        cfg = get_dispensary_by_slug("oasis")
        assert cfg is not None

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
            )
            context = await browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/131.0.0.0 Safari/537.36"
                ),
            )
            page = await context.new_page()

            print("\n--- Oasis Jane Iframe Detection Test ---")

            await page.goto(cfg["url"], wait_until="domcontentloaded", timeout=120_000)
            await asyncio.sleep(5)
            print(f"  Navigated to: {page.url}")
            print(f"  Title: {await page.title()}")

            # Dismiss age gate
            clicked = await dismiss_age_gate(page, post_dismiss_wait_sec=5)
            print(f"  Age gate clicked: {clicked}")

            # Probe for Jane iframes
            jane_iframe_sels = [
                'iframe[src*="iheartjane.com"]',
                'iframe[src*="jane"]',
                'iframe[src*="menu"]',
            ]
            for sel in jane_iframe_sels:
                count = await page.locator(sel).count()
                print(f"  {sel} → {count}")

            # All iframes
            iframes = await page.query_selector_all("iframe")
            print(f"  Total iframes: {len(iframes)}")
            for i, el in enumerate(iframes):
                src = await el.get_attribute("src") or "(no src)"
                print(f"    [{i}]: {src[:150]}")

            # Probe for direct-page Jane products
            jane_product_sels = [
                '._flex_80y9c_1[style*="--box-height: 100%"]',
                'div[class*="product-card"]',
                'div[class*="menu-item"]',
                'div[class*="product-list-item"]',
                '.product-card',
                '[data-testid*="product"]',
                '[class*="ProductCard"]',
            ]
            for sel in jane_product_sels:
                count = await page.locator(sel).count()
                if count > 0:
                    print(f"  Direct product selector: {sel} → {count}")

            # Check for location picker
            selects = await page.query_selector_all("select")
            print(f"  <select> elements: {len(selects)}")
            for i, sel in enumerate(selects):
                options = await sel.evaluate("el => Array.from(el.options).map(o => o.textContent).join(', ')")
                print(f"    select[{i}]: {options[:120]}")

            body_text = await page.evaluate("() => document.body?.innerText?.length || 0")
            print(f"  Body text length: {body_text}")

            has_content = (
                len(iframes) > 0
                or any(
                    await page.locator(sel).count() > 0
                    for sel in jane_product_sels
                )
            )

            await browser.close()

            assert has_content, (
                "Oasis has no Jane iframe and no direct product cards. "
                "The site may have changed platforms or the URL may need updating."
            )

    @pytest.mark.timeout(300)
    async def test_carrot_site_dom_structure(self):
        """Probe all Carrot zero-product sites to identify DOM differences."""
        try:
            await asyncio.wait_for(
                self._carrot_dom_inner(), timeout=240,
            )
        except asyncio.TimeoutError:
            pytest.fail("Carrot DOM audit timed out after 240s — browser hung")

    async def _carrot_dom_inner(self):
        from playwright.async_api import async_playwright

        carrot_sites = [
            ("wallflower-blue-diamond", "https://wallflower-house.com/order/"),
            ("jennys", "https://jennysdispensary.com/store/"),
            ("euphoria-wellness", "https://euphoriawellnessnv.com/menu/"),
            ("silver-sage", "https://store.sswlv.com/"),
        ]

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
            )

            print("\n--- Carrot Site DOM Structure Audit ---")

            for slug, url in carrot_sites:
                context = await browser.new_context(
                    viewport={"width": 1920, "height": 1080},
                    user_agent=(
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/131.0.0.0 Safari/537.36"
                    ),
                )
                page = await context.new_page()

                print(f"\n  === {slug} ({url}) ===")
                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=60_000)
                    await asyncio.sleep(3)

                    # Dismiss age gate
                    await dismiss_age_gate(page, post_dismiss_wait_sec=3)
                    await asyncio.sleep(8)

                    # Probe Carrot-specific selectors
                    carrot_probes = {
                        "#carrot-store-root": await page.locator("#carrot-store-root").count(),
                        "[data-carrot-route]": await page.evaluate(
                            "() => document.documentElement.hasAttribute('data-carrot-route')"
                        ),
                        "[data-carrot-route-root]": await page.evaluate(
                            "() => document.documentElement.hasAttribute('data-carrot-route-root')"
                        ),
                        "html.hydrated": await page.evaluate(
                            "() => document.documentElement.classList.contains('hydrated')"
                        ),
                        'a[href*="/product/"]': await page.locator('a[href*="/product/"]').count(),
                        "[class*='carrot']": await page.locator("[class*='carrot']").count(),
                        "#carrot-menu": await page.locator("#carrot-menu").count(),
                        "[data-carrot]": await page.locator("[data-carrot]").count(),
                    }
                    for probe, val in carrot_probes.items():
                        if val:
                            print(f"    {probe:40s} → {val}")

                    # Generic product probes
                    generic_probes = [
                        'div[class*="product"]',
                        'article',
                        '[class*="card"]',
                        '[class*="item"]',
                    ]
                    for sel in generic_probes:
                        count = await page.locator(sel).count()
                        if count > 0:
                            print(f"    {sel:40s} → {count}")

                    body_len = await page.evaluate("() => document.body?.innerText?.length || 0")
                    print(f"    body text length: {body_len}")

                    # Check for scripts from getcarrot.io
                    carrot_scripts = await page.evaluate("""
                        () => {
                            const scripts = document.querySelectorAll('script[src]');
                            return Array.from(scripts)
                                .map(s => s.src)
                                .filter(s => s.includes('carrot') || s.includes('getcarrot'));
                        }
                    """)
                    if carrot_scripts:
                        print(f"    Carrot scripts: {carrot_scripts}")
                    else:
                        print("    WARNING: No Carrot scripts found!")

                except Exception as exc:
                    print(f"    ERROR: {type(exc).__name__}: {exc}")

                await context.close()

            await browser.close()
