"""
Platform reconnaissance test suite.

Loads each unintegrated dispensary URL in a real Playwright browser,
screenshots the page, and probes for known platform signatures
(Dutchie, Jane, AIQ/Dispense, Carrot, Rise, etc.).

NOT a unit test — requires network access and a Chromium install.
Run manually with:

    cd clouded-deals/scraper
    pytest tests/test_platform_recon.py -v -s --tb=short 2>&1 | tee recon_report.txt

Each test is parametrized by site so you can target one store:

    pytest tests/test_platform_recon.py -k "jardin" -v -s

Results are written to ``recon_output/`` as:
  - <slug>.png          full-page screenshot
  - <slug>.html         first 80 KB of page HTML
  - recon_results.json  machine-readable summary of all probes
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import sys
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any

import pytest

# Ensure scraper package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config.dispensaries import BROWSER_ARGS, VIEWPORT, USER_AGENT, GOTO_TIMEOUT_MS

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Output directory
# ---------------------------------------------------------------------------

RECON_DIR = Path(os.getenv("RECON_DIR", "recon_output"))

# ---------------------------------------------------------------------------
# Platform signature definitions
#
# Each platform has a set of "probes" — CSS selectors, iframe src patterns,
# script src patterns, or DOM text markers that fingerprint it.  The recon
# runner checks all probes and reports which platforms matched.
# ---------------------------------------------------------------------------

PLATFORM_SIGNATURES: dict[str, dict[str, Any]] = {
    "dutchie": {
        "iframe_src_patterns": [
            "dutchie.com",
            "dutchie",
            "embedded-menu",
        ],
        "script_src_patterns": [
            "dutchie.com",
            "dutchie",
        ],
        "dom_selectors": [
            "#dutchie--embed",
            "[data-dutchie]",
            ".dutchie--embed",
            "#dutchie",
            'iframe[src*="dutchie"]',
        ],
        "html_markers": [
            "dutchie",
            "dtche",
        ],
    },
    "jane": {
        "iframe_src_patterns": [
            "iheartjane.com",
            "iheartjane",
            "jane.com",
        ],
        "script_src_patterns": [
            "iheartjane.com",
            "api.iheartjane.com",
            "jane",
        ],
        "dom_selectors": [
            'iframe[src*="iheartjane"]',
            'iframe[src*="jane"]',
            "[data-jane]",
            "#jane-menu",
            "[class*='jane']",
        ],
        "html_markers": [
            "iheartjane",
            "jane-frame",
            "jane-menu",
        ],
    },
    "aiq": {
        "iframe_src_patterns": [
            "alpineiq.com",
            "dispenseapp.com",
            "getaiq.com",
        ],
        "script_src_patterns": [
            "alpineiq.com",
            "dispenseapp.com",
            "getaiq.com",
            "aiq",
        ],
        "dom_selectors": [
            'iframe[src*="alpineiq"]',
            'iframe[src*="dispenseapp"]',
            "[data-aiq]",
            "#aiq-menu",
            "#dispense-menu",
        ],
        "html_markers": [
            "alpineiq",
            "dispenseapp",
            "getaiq",
            "aiq-embed",
            "dispense",
        ],
    },
    "carrot": {
        "iframe_src_patterns": [
            "getcarrot.io",
            "carrot",
        ],
        "script_src_patterns": [
            "getcarrot.io",
            "carrot",
        ],
        "dom_selectors": [
            'iframe[src*="getcarrot"]',
            'iframe[src*="carrot"]',
            "[data-carrot]",
            "#carrot-menu",
        ],
        "html_markers": [
            "getcarrot.io",
            "carrot",
        ],
    },
    "rise": {
        "iframe_src_patterns": [],
        "script_src_patterns": [
            "risecannabis.com",
        ],
        "dom_selectors": [
            "[class*='menu-product']",
            "[class*='ProductTile']",
            "[data-testid*='product']",
            "[class*='product-card']",
        ],
        "html_markers": [
            "risecannabis",
            "gtigrows",
            "greenthumb",
        ],
    },
    "curaleaf": {
        "iframe_src_patterns": [],
        "script_src_patterns": [
            "curaleaf.com",
        ],
        "dom_selectors": [
            "[class*='ProductCard']",
            "[data-testid*='product']",
        ],
        "html_markers": [
            "curaleaf",
        ],
    },
    "weedmaps": {
        "iframe_src_patterns": [
            "weedmaps.com",
        ],
        "script_src_patterns": [
            "weedmaps.com",
        ],
        "dom_selectors": [
            'iframe[src*="weedmaps"]',
        ],
        "html_markers": [
            "weedmaps",
        ],
    },
    "meadow": {
        "iframe_src_patterns": [
            "getmeadow.com",
        ],
        "script_src_patterns": [
            "getmeadow.com",
            "meadow",
        ],
        "dom_selectors": [
            'iframe[src*="meadow"]',
        ],
        "html_markers": [
            "getmeadow",
            "meadow",
        ],
    },
    "tymber": {
        "iframe_src_patterns": [
            "tymber.io",
        ],
        "script_src_patterns": [
            "tymber.io",
        ],
        "dom_selectors": [],
        "html_markers": [
            "tymber",
        ],
    },
    "rankreallyhigh": {
        "iframe_src_patterns": [],
        "script_src_patterns": [
            "rankreallyhigh.com",
        ],
        "dom_selectors": [],
        "html_markers": [
            "rankreallyhigh",
        ],
    },
}

# ---------------------------------------------------------------------------
# Recon result data class
# ---------------------------------------------------------------------------


@dataclass
class ReconResult:
    slug: str
    name: str
    url: str
    expected_platform: str
    detected_platforms: list[str] = field(default_factory=list)
    platform_scores: dict[str, int] = field(default_factory=dict)
    iframe_srcs: list[str] = field(default_factory=list)
    script_srcs: list[str] = field(default_factory=list)
    product_card_count: int = 0
    has_age_gate: bool = False
    page_title: str = ""
    final_url: str = ""
    error: str | None = None
    notes: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Sites to recon
#
# Grouped by suspected platform.  "expected_platform" is our best guess
# from the spreadsheet — the recon will confirm or correct it.
# ---------------------------------------------------------------------------

RECON_SITES: list[dict[str, str]] = [
    # --- AIQ / Dispense (6 sites) -------------------------------------------
    {
        "slug": "jardin",
        "name": "Jardin",
        "url": "https://www.jardinlasvegas.com/store",
        "expected_platform": "aiq",
    },
    {
        "slug": "nevada-made-henderson",
        "name": "Nevada Made Henderson",
        "url": "https://nevadamademarijuana.com/store/henderson",
        "expected_platform": "aiq",
    },
    {
        "slug": "nevada-made-warm-springs",
        "name": "Nevada Made Warm Springs",
        "url": "https://nevadamademarijuana.com/store/warmsprings",
        "expected_platform": "aiq",
    },
    {
        "slug": "nevada-made-casino-dr",
        "name": "Nevada Made Casino Dr",
        "url": "https://menus.dispenseapp.com/109b415eec40c64b/menu",
        "expected_platform": "aiq",
    },
    {
        "slug": "nevada-made-charleston",
        "name": "Nevada Made Charleston",
        "url": "https://menus.dispenseapp.com/566264bdaf01fa71/menu",
        "expected_platform": "aiq",
    },
    {
        "slug": "pisos",
        "name": "Pisos",
        "url": "https://www.pisoslv.com/menu/rec",
        "expected_platform": "aiq",
    },

    # --- Carrot / getcarrot.io (3 sites) ------------------------------------
    {
        "slug": "treehouse",
        "name": "The Treehouse Vegas",
        "url": "https://vegastreehouse.com/store/",
        "expected_platform": "carrot",
    },
    {
        "slug": "wallflower-blue-diamond",
        "name": "Wallflower Blue Diamond",
        "url": "https://wallflower-house.com/deals/",
        "expected_platform": "carrot",
    },
    # NOTE: Wallflower Volunteer shares the same URL as Blue Diamond.
    # Recon will tell us if there's a location selector or just one menu.

    # --- Rise proprietary (7 sites) -----------------------------------------
    {
        "slug": "rise-tropicana",
        "name": "Rise Tropicana",
        "url": "https://risecannabis.com/dispensaries/nevada/west-tropicana/886/pickup-menu/",
        "expected_platform": "rise",
    },
    {
        "slug": "rise-rainbow",
        "name": "Rise Rainbow",
        "url": "https://risecannabis.com/dispensaries/nevada/south-rainbow/1718/pickup-menu/",
        "expected_platform": "rise",
    },
    {
        "slug": "rise-nellis",
        "name": "Rise Nellis",
        "url": "https://risecannabis.com/dispensaries/nevada/nellis/5267/pickup-menu/",
        "expected_platform": "rise",
    },
    {
        "slug": "rise-boulder",
        "name": "Rise Boulder",
        "url": "https://risecannabis.com/dispensaries/nevada/henderson-boulder/6211/pickup-menu/",
        "expected_platform": "rise",
    },
    {
        "slug": "rise-durango",
        "name": "Rise Durango",
        "url": "https://risecannabis.com/dispensaries/nevada/south-durango/1885/pickup-menu/",
        "expected_platform": "rise",
    },
    {
        "slug": "rise-craig",
        "name": "Rise Craig",
        "url": "https://risecannabis.com/dispensaries/nevada/craig-rd/5429/pickup-menu/",
        "expected_platform": "rise",
    },
    {
        "slug": "cookies-strip-rise",
        "name": "Cookies on the Strip (Rise-operated)",
        "url": "https://risecannabis.com/dispensaries/nevada/cookies-on-the-strip/888/recreational-menu/",
        "expected_platform": "rise",
    },

    # --- Unknown / needs identification -------------------------------------
    {
        "slug": "green-hualapai",
        "name": "Green. Hualapai",
        "url": "https://greennv.com/menu/",
        "expected_platform": "unknown",
    },
    {
        "slug": "euphoria-wellness",
        "name": "Euphoria Wellness",
        "url": "https://euphoriawellnessnv.com/menu/",
        "expected_platform": "unknown",
    },
    {
        "slug": "inyo",
        "name": "Inyo Fine Cannabis",
        "url": "https://inyolasvegas.com/delivery-pickup-orders/",
        "expected_platform": "unknown",
    },
    {
        "slug": "jennys",
        "name": "Jenny's Dispensary",
        "url": "https://jennysdispensary.com/store/",
        "expected_platform": "unknown",
    },
    {
        "slug": "showgrow",
        "name": "ShowGrow",
        "url": "https://store.showgrowvegas.com/",
        "expected_platform": "unknown",
    },
    {
        "slug": "silver-sage",
        "name": "Silver Sage Wellness",
        "url": "https://store.sswlv.com/",
        "expected_platform": "unknown",
    },
    {
        "slug": "source-eastern",
        "name": "The Source Eastern",
        "url": "https://www.thesourcenv.com/specials/",
        "expected_platform": "unknown",
    },
    {
        "slug": "top-notch",
        "name": "Top Notch THC",
        "url": "https://topnotchthc.com/curbside-orders/",
        "expected_platform": "unknown",
    },
    {
        "slug": "cookies-flamingo",
        "name": "Cookies Flamingo",
        "url": "https://cookiesdispensary.com/flamingo/shop/",
        "expected_platform": "unknown",
    },

    # --- Dutchie candidates (easy adds if confirmed) ------------------------
    {
        "slug": "jade-desert-inn",
        "name": "Jade Cannabis Desert Inn",
        "url": "https://jadecannabisco.com/",
        "expected_platform": "dutchie",
    },
    {
        "slug": "jade-sky-pointe",
        "name": "Jade Cannabis Sky Pointe",
        "url": "https://skypointe.jadecannabisco.com/",
        "expected_platform": "dutchie",
    },
    {
        "slug": "slv",
        "name": "SLV Dispensary",
        "url": "https://slvcannabis.com/shop/",
        "expected_platform": "dutchie",
    },
    {
        "slug": "sahara-wellness",
        "name": "Sahara Wellness",
        "url": "https://dutchie.com/dispensary/sahara-wellness",
        "expected_platform": "dutchie",
    },
    {
        "slug": "grove-pahrump",
        "name": "The Grove Pahrump",
        "url": "https://www.thegrovenv.com/pahrump/",
        "expected_platform": "dutchie",
    },

    # --- Jane candidates (easy adds if confirmed) ---------------------------
    {
        "slug": "exhale",
        "name": "Exhale",
        "url": "https://exhalebrands.com/store/",
        "expected_platform": "jane",
    },
    {
        "slug": "thrive-southern-highlands",
        "name": "Thrive Southern Highlands",
        "url": "https://thrivenevada.com/southern-highlands-weed-dispensary-menu/",
        "expected_platform": "jane",
    },
    {
        "slug": "tree-of-life-jones",
        "name": "Tree of Life Jones",
        "url": "https://lasvegas.treeoflifenv.com/store",
        "expected_platform": "jane",
    },
    {
        "slug": "tree-of-life-centennial",
        "name": "Tree of Life Centennial",
        "url": "https://northlasvegas.treeoflifenv.com/store",
        "expected_platform": "jane",
    },
    {
        "slug": "sanctuary-n-lv",
        "name": "The Sanctuary N LV Blvd",
        "url": "https://thesanctuarynv.com/shop/",
        "expected_platform": "jane",
    },
]

# ---------------------------------------------------------------------------
# Probe runner
# ---------------------------------------------------------------------------

# Generic product card selectors — used to count products regardless of
# platform.  More = the menu is actually rendering.
GENERIC_PRODUCT_SELECTORS = [
    '[data-testid*="product"]',
    '[class*="ProductCard"]',
    '[class*="product-card"]',
    '[class*="product_card"]',
    'div[class*="product"]',
    "article",
    '[class*="menu-item"]',
    '[class*="MenuItem"]',
    '[class*="deal"]',
]

# Age gate selectors — check if the page has one
AGE_GATE_SELECTORS = [
    "button:has-text('I am 21 or older')",
    "button:has-text('Yes')",
    "button:has-text('21+')",
    "button:has-text('Enter')",
    "#agc_form",
    "[class*='age-gate']",
    "[class*='age_gate']",
    "[class*='agegate']",
    "[class*='AgeGate']",
    "[class*='age-verification']",
    "[id*='age-gate']",
    "[id*='agegate']",
]


async def _run_recon(page, site: dict[str, str]) -> ReconResult:
    """Load one site and probe for platform signatures."""
    result = ReconResult(
        slug=site["slug"],
        name=site["name"],
        url=site["url"],
        expected_platform=site["expected_platform"],
    )

    try:
        # Navigate
        logger.info("[%s] Loading %s ...", site["slug"], site["url"])
        response = await page.goto(
            site["url"],
            wait_until="domcontentloaded",
            timeout=GOTO_TIMEOUT_MS,
        )
        result.final_url = page.url
        result.page_title = await page.title()

        if response and response.status >= 400:
            result.error = f"HTTP {response.status}"
            result.notes.append(f"HTTP status {response.status}")

        # Give JS-heavy SPAs time to hydrate
        await asyncio.sleep(8)

        # ----- Check for age gate BEFORE dismissing it -----
        for sel in AGE_GATE_SELECTORS:
            try:
                count = await page.locator(sel).count()
                if count > 0:
                    result.has_age_gate = True
                    result.notes.append(f"Age gate found: {sel}")
                    break
            except Exception:
                continue

        # Try to dismiss the age gate so we can see the menu
        from handlers.age_verification import dismiss_age_gate
        dismissed = await dismiss_age_gate(page, post_dismiss_wait_sec=5)
        if dismissed:
            result.notes.append("Age gate dismissed successfully")
            # Extra settle time after age gate
            await asyncio.sleep(5)

        # ----- Collect all iframe srcs -----
        iframes = await page.query_selector_all("iframe")
        for el in iframes:
            src = await el.get_attribute("src") or ""
            if src and src != "about:blank":
                result.iframe_srcs.append(src)

        # ----- Collect all script srcs -----
        scripts = await page.query_selector_all("script[src]")
        for el in scripts:
            src = await el.get_attribute("src") or ""
            if src:
                result.script_srcs.append(src)

        # ----- Get page HTML for marker scanning -----
        html = await page.content()
        html_lower = html.lower()

        # ----- Probe each platform -----
        for platform, sigs in PLATFORM_SIGNATURES.items():
            score = 0

            # Check iframe srcs
            for pattern in sigs.get("iframe_src_patterns", []):
                for iframe_src in result.iframe_srcs:
                    if pattern.lower() in iframe_src.lower():
                        score += 3  # Strong signal
                        result.notes.append(
                            f"[{platform}] iframe match: '{pattern}' in {iframe_src[:100]}"
                        )

            # Check script srcs
            for pattern in sigs.get("script_src_patterns", []):
                for script_src in result.script_srcs:
                    if pattern.lower() in script_src.lower():
                        score += 2  # Medium signal
                        result.notes.append(
                            f"[{platform}] script match: '{pattern}' in {script_src[:100]}"
                        )

            # Check DOM selectors
            for sel in sigs.get("dom_selectors", []):
                try:
                    count = await page.locator(sel).count()
                    if count > 0:
                        score += 2
                        result.notes.append(
                            f"[{platform}] DOM match: {sel} ({count} elements)"
                        )
                except Exception:
                    continue

            # Check HTML markers (weakest signal — brand names appear in text too)
            for marker in sigs.get("html_markers", []):
                if marker.lower() in html_lower:
                    score += 1
                    # Only note if it's a strong enough marker (not just brand name)
                    if score == 1:
                        result.notes.append(
                            f"[{platform}] HTML marker: '{marker}'"
                        )

            if score > 0:
                result.platform_scores[platform] = score

        # Rank by score descending
        result.detected_platforms = sorted(
            result.platform_scores.keys(),
            key=lambda p: result.platform_scores[p],
            reverse=True,
        )

        # ----- Count product cards -----
        max_products = 0
        for sel in GENERIC_PRODUCT_SELECTORS:
            try:
                count = await page.locator(sel).count()
                if count > max_products:
                    max_products = count
            except Exception:
                continue
        result.product_card_count = max_products

        # ----- Also check inside iframes for product cards -----
        for el in iframes:
            try:
                frame = await el.content_frame()
                if frame is None:
                    continue
                for sel in GENERIC_PRODUCT_SELECTORS:
                    count = await frame.locator(sel).count()
                    if count > result.product_card_count:
                        result.product_card_count = count
                        result.notes.append(
                            f"Products found INSIDE iframe ({count} via {sel})"
                        )
            except Exception:
                continue

        # ----- Screenshot + HTML dump -----
        RECON_DIR.mkdir(parents=True, exist_ok=True)
        try:
            await page.screenshot(
                path=str(RECON_DIR / f"{site['slug']}.png"),
                full_page=True,
            )
        except Exception as exc:
            result.notes.append(f"Screenshot failed: {exc}")

        html_path = RECON_DIR / f"{site['slug']}.html"
        html_path.write_text(html[:80_000], encoding="utf-8")

    except Exception as exc:
        result.error = str(exc)
        logger.error("[%s] RECON FAILED: %s", site["slug"], exc)

    return result


# ---------------------------------------------------------------------------
# Browser launch helper
# ---------------------------------------------------------------------------

# Chromium paths to try when the default Playwright binary isn't installed.
# The GitHub Actions workflow caches browsers so the default usually works;
# this fallback covers local dev where only an older browser is installed.
_CHROMIUM_FALLBACK_PATHS = [
    "/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome-stable",
]


def _find_chromium_executable() -> str | None:
    """Return the first fallback Chromium path that exists on disk."""
    for path in _CHROMIUM_FALLBACK_PATHS:
        if os.path.isfile(path):
            return path
    return None


# ---------------------------------------------------------------------------
# Pytest parametrized test
# ---------------------------------------------------------------------------

# Extract just the slugs for pytest IDs
_SITE_IDS = [s["slug"] for s in RECON_SITES]


@pytest.mark.asyncio
@pytest.mark.parametrize("site", RECON_SITES, ids=_SITE_IDS)
async def test_recon_site(site: dict[str, str]):
    """Recon a single dispensary site and report platform detection."""
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        launch_kwargs: dict[str, Any] = {
            "headless": True,
            "args": BROWSER_ARGS,
        }
        # Try default Playwright binary first; fall back to system Chromium
        try:
            browser = await pw.chromium.launch(**launch_kwargs)
        except Exception:
            fallback = _find_chromium_executable()
            if fallback is None:
                pytest.skip(
                    "No Chromium binary found — run `playwright install chromium`"
                )
            logger.info("Using fallback Chromium: %s", fallback)
            launch_kwargs["executable_path"] = fallback
            browser = await pw.chromium.launch(**launch_kwargs)

        context = await browser.new_context(
            viewport=VIEWPORT,
            user_agent=USER_AGENT,
        )
        page = await context.new_page()

        try:
            result = await _run_recon(page, site)
        finally:
            await context.close()
            await browser.close()

    # --- Report to stdout (visible with pytest -s) ---
    print(f"\n{'='*72}")
    print(f"  RECON: {result.name}")
    print(f"  URL:   {result.url}")
    print(f"  Final: {result.final_url}")
    print(f"  Title: {result.page_title}")
    print(f"{'='*72}")

    if result.error:
        print(f"  ERROR: {result.error}")

    print(f"  Expected platform:  {result.expected_platform}")
    print(f"  Detected platforms: {result.detected_platforms or '(none)'}")
    if result.platform_scores:
        for p, s in sorted(result.platform_scores.items(), key=lambda x: -x[1]):
            print(f"    {p:20s} score={s}")
    print(f"  Product cards seen: {result.product_card_count}")
    print(f"  Age gate present:   {result.has_age_gate}")
    print(f"  Iframes ({len(result.iframe_srcs)}):")
    for src in result.iframe_srcs:
        print(f"    {src[:120]}")
    print(f"  Notes:")
    for note in result.notes:
        print(f"    - {note}")
    print()

    # Append to running JSON results file
    results_path = RECON_DIR / "recon_results.json"
    RECON_DIR.mkdir(parents=True, exist_ok=True)
    existing: list[dict] = []
    if results_path.exists():
        try:
            existing = json.loads(results_path.read_text())
        except (json.JSONDecodeError, ValueError):
            existing = []
    # Replace if slug already present, else append
    existing = [r for r in existing if r.get("slug") != result.slug]
    existing.append(asdict(result))
    results_path.write_text(json.dumps(existing, indent=2))

    # The test "passes" as long as it ran — recon is about gathering data,
    # not asserting correctness.  But we do flag suspicious results.
    if result.error and "HTTP" not in (result.error or ""):
        pytest.skip(f"Site unreachable: {result.error}")


# ---------------------------------------------------------------------------
# Batch summary — runs after all parametrized tests
# ---------------------------------------------------------------------------


def test_recon_summary():
    """Print a consolidated summary table from recon_results.json.

    Run this AFTER the parametrized tests (pytest runs it last by default
    since it sorts alphabetically after 'test_recon_site').
    """
    results_path = RECON_DIR / "recon_results.json"
    if not results_path.exists():
        pytest.skip("No recon results yet — run test_recon_site first")

    results: list[dict] = json.loads(results_path.read_text())

    print(f"\n{'='*90}")
    print("  PLATFORM RECON SUMMARY")
    print(f"{'='*90}")
    print(f"  {'Slug':<30s} {'Expected':<12s} {'Detected':<20s} {'Products':>8s} {'Match?'}")
    print(f"  {'-'*30} {'-'*12} {'-'*20} {'-'*8} {'-'*6}")

    confirmed = 0
    mismatched = 0
    undetected = 0

    for r in sorted(results, key=lambda x: x["slug"]):
        detected = r.get("detected_platforms", [])
        top = detected[0] if detected else "(none)"
        expected = r["expected_platform"]
        products = r.get("product_card_count", 0)

        if expected == "unknown":
            match = "NEW"
        elif top == expected:
            match = "YES"
            confirmed += 1
        elif expected in detected:
            match = "~yes"
            confirmed += 1
        elif not detected:
            match = "---"
            undetected += 1
        else:
            match = "NO"
            mismatched += 1

        print(f"  {r['slug']:<30s} {expected:<12s} {top:<20s} {products:>8d} {match}")

    print(f"\n  Confirmed: {confirmed}  |  Mismatched: {mismatched}  |  Undetected: {undetected}")

    # --- Group by detected platform for action planning ---
    by_platform: dict[str, list[str]] = {}
    for r in results:
        detected = r.get("detected_platforms", [])
        top = detected[0] if detected else "undetected"
        by_platform.setdefault(top, []).append(r["slug"])

    print(f"\n  BY DETECTED PLATFORM:")
    for platform, slugs in sorted(by_platform.items()):
        print(f"    {platform}: {', '.join(slugs)}")

    print(f"\n  Screenshots saved to: {RECON_DIR.resolve()}/")
    print(f"  Full results:         {results_path.resolve()}")
    print(f"{'='*90}\n")
