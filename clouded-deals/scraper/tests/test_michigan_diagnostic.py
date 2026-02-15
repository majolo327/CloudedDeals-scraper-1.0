"""
Michigan scraper diagnostic tests — Test 1 results analysis.

These tests validate the root causes identified in the Michigan Test 1
scrape that yielded only 112 products and 33 deals from 114 sites
(95% of dutchie sites returned 0 products, 100% of curaleaf sites
returned 0 products).

Root causes identified:
  BUG-1: Curaleaf age gate hardcodes "Nevada" state selection — Michigan
         sites need "Michigan" but never get it.
  BUG-2: Dutchie embed_type default is "iframe" but dutchie.com/dispensary/*
         pages are direct SPAs — no iframe exists, causing ~330s of wasted
         timeout before falling through to "direct" detection.
  BUG-3: No domain-level rate limiting — 111 dutchie.com requests from one
         IP triggers bot detection / rate limiting.
  BUG-4: Zen Leaf Buchanan is platform="curaleaf" but uses a completely
         different domain (zenleafdispensaries.com) with different page
         structure.

Run with:  python -m pytest tests/test_michigan_diagnostic.py -v
"""

from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

import pytest

# Ensure the scraper package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config.dispensaries import DISPENSARIES, PLATFORM_DEFAULTS


# =====================================================================
# Helpers
# =====================================================================

def _michigan_dispensaries() -> list[dict]:
    """All active Michigan dispensaries."""
    return [d for d in DISPENSARIES
            if d.get("region") == "michigan" and d.get("is_active", True)]


def _michigan_dutchie() -> list[dict]:
    """Michigan dispensaries using the dutchie platform."""
    return [d for d in _michigan_dispensaries() if d["platform"] == "dutchie"]


def _michigan_curaleaf() -> list[dict]:
    """Michigan dispensaries using the curaleaf platform."""
    return [d for d in _michigan_dispensaries() if d["platform"] == "curaleaf"]


# =====================================================================
# BUG-1: Curaleaf age gate hardcodes "Nevada"
# =====================================================================


class TestCuraleafAgeGateStateMismatch:
    """The Curaleaf scraper's _handle_curaleaf_age_gate() hardcodes
    'Nevada' for state selection (curaleaf.py line 249).  Michigan
    sites need 'Michigan' selected to proceed past the age gate.

    This is the root cause of 0 products for all 3 Curaleaf/Zen Leaf
    Michigan sites.
    """

    def test_curaleaf_age_gate_hardcodes_nevada(self):
        """Verify the bug exists: curaleaf.py contains hardcoded 'Nevada'."""
        curaleaf_path = Path(__file__).resolve().parent.parent / "platforms" / "curaleaf.py"
        source = curaleaf_path.read_text()

        # The age gate handler selects "Nevada" from the state dropdown.
        # For Michigan sites, this is wrong — they need "Michigan".
        hardcoded_nevada = (
            'select_option(label="Nevada")' in source
            or 'text="Nevada"' in source
            or 'text="NV"' in source
        )
        assert hardcoded_nevada, (
            "Expected to find hardcoded 'Nevada' in curaleaf.py — "
            "if this was fixed, remove this test and add a positive test"
        )

    def test_michigan_curaleaf_sites_exist(self):
        """Confirm Michigan has Curaleaf-platform sites that need state fix."""
        sites = _michigan_curaleaf()
        assert len(sites) >= 2, (
            f"Expected at least 2 Michigan curaleaf sites, found {len(sites)}"
        )

    def test_curaleaf_michigan_urls_are_michigan_paths(self):
        """Michigan Curaleaf URLs use /shop/michigan/ — confirm the state
        is inferrable from the URL for a future fix."""
        for d in _michigan_curaleaf():
            url = d["url"]
            parsed = urlparse(url)
            # Curaleaf MI sites: /shop/michigan/...
            # Zen Leaf: different domain entirely
            if "curaleaf.com" in parsed.netloc:
                assert "/michigan/" in parsed.path or "/mi/" in parsed.path.lower(), (
                    f"Curaleaf MI site '{d['name']}' URL does not contain "
                    f"'/michigan/' in path: {url}"
                )

    def test_no_state_param_in_dispensary_config(self):
        """Dispensary configs don't carry a 'state' field — the age gate
        handler has no way to know which state to select.  This confirms
        the architectural gap."""
        for d in _michigan_curaleaf():
            assert "state" not in d, (
                f"If 'state' field exists in config for '{d['name']}', "
                "the age gate handler should use it (bug may be partially fixed)"
            )


# =====================================================================
# BUG-2: Dutchie embed_type mismatch for dutchie.com/dispensary URLs
# =====================================================================


class TestDutchieEmbedTypeMismatch:
    """Michigan Dutchie sites use dutchie.com/dispensary/{slug} direct
    URLs — these are React SPAs where products render directly in the
    page DOM.  There is no iframe.

    But PLATFORM_DEFAULTS["dutchie"]["embed_type"] = "iframe", which
    causes the scraper to spend ~270s trying 6 iframe selectors (each
    with a 45s timeout) before falling through to direct page detection.
    This wastes more than half the 600s per-site timeout budget.
    """

    def test_all_michigan_dutchie_use_direct_urls(self):
        """All Michigan dutchie sites point to dutchie.com/dispensary/...
        (direct SPA pages, NOT dispensary-hosted iframe embeds)."""
        for d in _michigan_dutchie():
            parsed = urlparse(d["url"])
            assert parsed.netloc in ("dutchie.com", "www.dutchie.com"), (
                f"Michigan dutchie site '{d['name']}' does not use "
                f"dutchie.com URL: {d['url']}"
            )
            assert "/dispensary/" in parsed.path, (
                f"Michigan dutchie site '{d['name']}' URL is not a "
                f"/dispensary/ path: {d['url']}"
            )

    def test_dutchie_default_embed_type_is_iframe(self):
        """PLATFORM_DEFAULTS still says 'iframe' — confirms the mismatch."""
        assert PLATFORM_DEFAULTS["dutchie"]["embed_type"] == "iframe", (
            "If embed_type was changed from 'iframe', this mismatch may be "
            "resolved — update tests accordingly"
        )

    def test_michigan_dutchie_sites_lack_embed_type_override(self):
        """No Michigan dutchie site has a per-site embed_type override.
        They all inherit the 'iframe' default, which is wrong for
        dutchie.com/dispensary/ direct pages."""
        for d in _michigan_dutchie():
            # Per-site embed_type override would fix this for individual sites
            assert "embed_type" not in d, (
                f"Site '{d['name']}' has embed_type override '{d['embed_type']}' — "
                "good, but check if it's correct for dutchie.com/dispensary URLs"
            )

    def test_michigan_dutchie_sites_lack_fallback_url(self):
        """No Michigan dutchie site has a fallback_url configured.
        Nevada sites have embedded-menu fallbacks; Michigan has none."""
        missing_fallback = [d for d in _michigan_dutchie()
                           if "fallback_url" not in d]
        total = len(_michigan_dutchie())
        assert len(missing_fallback) == total, (
            f"{total - len(missing_fallback)}/{total} Michigan dutchie sites "
            "have fallback_url — check if they're correct"
        )

    def test_iframe_detection_timeout_budget(self):
        """Quantify the time wasted on iframe detection for direct pages.

        With 6 IFRAME_SELECTORS and 45s timeout each, the scraper burns
        up to 270s looking for iframes that don't exist on
        dutchie.com/dispensary/* pages.
        """
        try:
            from handlers.iframe import IFRAME_SELECTORS
        except ImportError:
            # playwright not installed — use known count from source
            IFRAME_SELECTORS = [
                'iframe[src*="dutchie.com"]',
                'iframe[src*="dutchie"]',
                'iframe[src*="embedded-menu"]',
                'iframe[src*="goshango.com"]',
                'iframe[src*="menu"]',
                'iframe[src*="embed"]',
            ]

        iframe_timeout_ms = 45_000  # passed by dutchie.py to find_dutchie_content
        js_embed_timeout_sec = 60   # also passed

        # Worst case: all iframe selectors time out, then JS embed times out
        max_iframe_wait_sec = len(IFRAME_SELECTORS) * (iframe_timeout_ms / 1000)
        max_js_embed_wait_sec = js_embed_timeout_sec
        total_wasted = max_iframe_wait_sec + max_js_embed_wait_sec

        site_timeout = 600  # SITE_TIMEOUT_SEC
        budget_pct = (total_wasted / site_timeout) * 100

        # This should fail — proving the detection cascade burns too much budget
        assert budget_pct < 30, (
            f"Iframe + JS embed detection can waste up to {total_wasted:.0f}s "
            f"({budget_pct:.0f}% of the {site_timeout}s site timeout) on "
            f"dutchie.com/dispensary pages that have NO iframe. "
            f"IFRAME_SELECTORS count: {len(IFRAME_SELECTORS)}, "
            f"each with {iframe_timeout_ms}ms timeout = {max_iframe_wait_sec:.0f}s, "
            f"plus JS embed {max_js_embed_wait_sec:.0f}s"
        )


# =====================================================================
# BUG-3: Same-domain rate limiting risk
# =====================================================================


class TestDutchieDomainConcentration:
    """All Michigan dutchie sites hit the same domain (dutchie.com).
    With 111 sites and only per-platform concurrency (3), the scraper
    sends rapid sequential requests to dutchie.com, risking WAF/bot
    detection.
    """

    def test_all_michigan_dutchie_same_domain(self):
        """All Michigan dutchie URLs resolve to dutchie.com — no domain
        diversity to distribute load."""
        domains = {urlparse(d["url"]).netloc for d in _michigan_dutchie()}
        assert domains == {"dutchie.com"} or domains == {"dutchie.com", "www.dutchie.com"}, (
            f"Expected all Michigan dutchie sites on dutchie.com, "
            f"found: {domains}"
        )

    def test_dutchie_concurrent_cap_vs_site_count(self):
        """With 3 concurrent dutchie slots and 111 sites, the scraper
        makes ~37 sequential waves of requests to the same domain.
        This is a rate-limiting risk indicator."""
        try:
            from main import _PLATFORM_CONCURRENCY
            cap = _PLATFORM_CONCURRENCY.get("dutchie", 3)
        except Exception:
            # main.py has heavy imports (supabase, etc.) — use known default
            cap = 3
        sites = len(_michigan_dutchie())
        waves = sites // cap

        # Flag if more than 20 sequential waves to the same domain
        assert waves <= 20, (
            f"{sites} dutchie sites with concurrency cap {cap} = "
            f"{waves} sequential waves to dutchie.com. "
            f"This high volume to a single domain risks rate limiting. "
            f"Consider: domain-level throttling, request delays, or "
            f"rotating user agents/IPs."
        )

    def test_no_inter_request_delay_configured(self):
        """Check if there's any delay between requests to the same domain.
        Currently the only delay is between pagination pages, not between
        sites."""
        dutchie_cfg = PLATFORM_DEFAULTS["dutchie"]
        # There's no "inter_site_delay" or "domain_cooldown" setting
        assert "inter_site_delay_sec" not in dutchie_cfg, (
            "If inter_site_delay_sec was added, this test should be updated "
            "to verify it's a reasonable value (e.g., 2-5s)"
        )


# =====================================================================
# BUG-4: Zen Leaf platform mismatch
# =====================================================================


class TestZenLeafPlatformMismatch:
    """Zen Leaf Buchanan uses zenleafdispensaries.com (Verano's custom
    platform) but is tagged platform='curaleaf'.  The Curaleaf scraper's
    age gate handler (redirect to /age-gate) won't work for Zen Leaf's
    different site structure."""

    def test_zen_leaf_uses_different_domain(self):
        """Zen Leaf URL is NOT on curaleaf.com but is tagged as curaleaf."""
        zen_leaf = [d for d in _michigan_curaleaf()
                    if "zen" in d["name"].lower() or "zen" in d["slug"]]
        assert len(zen_leaf) >= 1, "No Zen Leaf sites found in Michigan config"

        for d in zen_leaf:
            parsed = urlparse(d["url"])
            assert parsed.netloc != "curaleaf.com", (
                f"Expected Zen Leaf to be on a different domain, "
                f"found: {parsed.netloc}"
            )
            assert d["platform"] == "curaleaf", (
                f"Expected Zen Leaf to be (incorrectly) tagged as curaleaf, "
                f"found platform='{d['platform']}'"
            )


# =====================================================================
# Config quality: Michigan dispensary health checks
# =====================================================================


class TestMichiganConfigQuality:
    """Verify Michigan dispensary configs are well-formed and consistent."""

    def test_michigan_has_expected_count(self):
        """Michigan should have ~114 dispensaries."""
        sites = _michigan_dispensaries()
        assert 100 <= len(sites) <= 130, (
            f"Expected ~114 Michigan dispensaries, found {len(sites)}"
        )

    def test_all_slugs_unique(self):
        """No duplicate slugs in Michigan config."""
        slugs = [d["slug"] for d in _michigan_dispensaries()]
        dupes = [s for s, c in Counter(slugs).items() if c > 1]
        assert not dupes, f"Duplicate slugs in Michigan config: {dupes}"

    def test_all_urls_valid(self):
        """All Michigan URLs should be well-formed HTTPS URLs."""
        for d in _michigan_dispensaries():
            parsed = urlparse(d["url"])
            assert parsed.scheme in ("http", "https"), (
                f"Invalid URL scheme for '{d['name']}': {d['url']}"
            )
            assert parsed.netloc, (
                f"Missing domain in URL for '{d['name']}': {d['url']}"
            )

    def test_platform_distribution(self):
        """Michigan is dutchie-dominant — verify expected distribution."""
        platforms = Counter(d["platform"] for d in _michigan_dispensaries())
        # All Michigan sites should be dutchie or curaleaf
        assert set(platforms.keys()).issubset({"dutchie", "curaleaf"}), (
            f"Unexpected platforms in Michigan: {dict(platforms)}"
        )
        # Dutchie should be the vast majority
        assert platforms["dutchie"] >= 100, (
            f"Expected 100+ dutchie sites in Michigan, found {platforms['dutchie']}"
        )
        assert platforms.get("curaleaf", 0) >= 2, (
            f"Expected 2+ curaleaf sites in Michigan, found {platforms.get('curaleaf', 0)}"
        )

    def test_dutchie_urls_are_consistent_pattern(self):
        """All Michigan dutchie URLs should follow dutchie.com/dispensary/{slug}."""
        pattern = re.compile(r"^https://dutchie\.com/dispensary/[\w-]+$")
        non_matching = []
        for d in _michigan_dutchie():
            if not pattern.match(d["url"]):
                non_matching.append((d["name"], d["url"]))

        if non_matching:
            details = "\n".join(f"  {name}: {url}" for name, url in non_matching[:5])
            # This is informational — some sites may have valid variant URLs
            assert len(non_matching) <= 5, (
                f"{len(non_matching)} Michigan dutchie URLs don't match "
                f"standard pattern:\n{details}"
            )


# =====================================================================
# Scrape yield analysis — quantify the Test 1 failure modes
# =====================================================================


class TestScrapeYieldExpectations:
    """These tests encode the expected vs actual yield from Test 1
    to serve as regression baselines for future runs."""

    # Test 1 actuals — these represent the BROKEN state
    TEST1_TOTAL_SITES = 114
    TEST1_SITES_SCRAPED = 113
    TEST1_TOTAL_PRODUCTS = 112
    TEST1_DEALS_SELECTED = 33
    TEST1_SITES_WITH_PRODUCTS = 6  # only 6 out of 113

    def test_yield_rate_is_unacceptable(self):
        """Only 6/113 sites (5.3%) returned products. A healthy scrape
        should have 60%+ yield rate."""
        yield_rate = self.TEST1_SITES_WITH_PRODUCTS / self.TEST1_SITES_SCRAPED
        # This SHOULD fail — documenting the broken state
        assert yield_rate >= 0.60, (
            f"Scrape yield rate is {yield_rate:.1%} "
            f"({self.TEST1_SITES_WITH_PRODUCTS}/{self.TEST1_SITES_SCRAPED} sites). "
            f"Target: 60%+. Root causes: embed_type mismatch, "
            f"hardcoded Nevada state, dutchie.com rate limiting."
        )

    def test_category_minimums_met(self):
        """Test 1 category distribution vs CATEGORY_MINIMUMS from deal_detector."""
        from deal_detector import CATEGORY_MINIMUMS

        # Test 1 actuals
        test1_categories = {
            "flower": 5,
            "vape": 13,
            "edible": 5,
            "concentrate": 4,
            "preroll": 4,
        }

        under_minimum = {}
        for cat, minimum in CATEGORY_MINIMUMS.items():
            actual = test1_categories.get(cat, 0)
            if actual < minimum:
                under_minimum[cat] = (actual, minimum)

        # This SHOULD fail — 4/5 categories are under minimum
        assert not under_minimum, (
            f"Categories under minimum: "
            + ", ".join(
                f"{cat}: {actual}/{minimum}"
                for cat, (actual, minimum) in under_minimum.items()
            )
        )


# =====================================================================
# Fix verification tests — will pass AFTER bugs are fixed
# =====================================================================


class TestFixVerification:
    """These tests verify the proposed fixes. They should be updated
    as bugs are fixed to become positive assertions."""

    def test_curaleaf_state_should_be_configurable(self):
        """After fix: the Curaleaf age gate should determine state from
        the dispensary config or URL, not hardcode 'Nevada'.

        Proposed fix: extract state from URL path (/shop/{state}/...)
        or add a 'state' field to dispensary configs.
        """
        # Verify the URL pattern allows state extraction
        for d in _michigan_curaleaf():
            if "curaleaf.com" in d["url"]:
                # URL format: /shop/michigan/curaleaf-mi-kalamazoo
                match = re.search(r"/shop/(\w+)/", d["url"])
                assert match, (
                    f"Cannot extract state from Curaleaf URL: {d['url']}"
                )
                state = match.group(1)
                assert state == "michigan", (
                    f"Expected state 'michigan' in URL, got '{state}': {d['url']}"
                )

    def test_dutchie_direct_urls_should_use_direct_embed_type(self):
        """After fix: dutchie.com/dispensary/* URLs should use
        embed_type='direct' to skip the 270s iframe detection cascade.

        Proposed fix options:
        A) Auto-detect: if URL host is dutchie.com, use 'direct'
        B) Per-site: add embed_type='direct' to each Michigan config
        C) Smart default: change PLATFORM_DEFAULTS to 'direct' and
           add 'iframe' overrides to NV sites that use custom domains
        """
        for d in _michigan_dutchie():
            effective_type = d.get("embed_type") or PLATFORM_DEFAULTS["dutchie"]["embed_type"]
            url_host = urlparse(d["url"]).netloc

            if url_host in ("dutchie.com", "www.dutchie.com"):
                # dutchie.com/dispensary/* pages are direct SPAs — no iframe
                assert effective_type == "direct", (
                    f"Site '{d['name']}' at {url_host} should use "
                    f"embed_type='direct', not '{effective_type}'. "
                    f"dutchie.com/dispensary pages render products directly "
                    f"in the page DOM — there is no iframe to detect."
                )
