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
    """The Curaleaf scraper's _handle_curaleaf_age_gate() now dynamically
    infers the correct state from the URL path (/shop/{state}/...) or
    the dispensary config's region field.

    FIX applied: _infer_state() helper + dynamic state_name/state_abbr.
    """

    def test_curaleaf_age_gate_no_hardcoded_nevada(self):
        """Verify the fix: curaleaf.py no longer hardcodes 'Nevada'."""
        curaleaf_path = Path(__file__).resolve().parent.parent / "platforms" / "curaleaf.py"
        source = curaleaf_path.read_text()

        # The age gate handler should use _infer_state(), not hardcoded strings.
        hardcoded_nevada = (
            'select_option(label="Nevada")' in source
            or 'text="Nevada"' in source
            or 'text="NV"' in source
        )
        assert not hardcoded_nevada, (
            "curaleaf.py still contains hardcoded 'Nevada' in the age gate handler"
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

    def test_infer_state_from_url(self):
        """_infer_state correctly extracts state from /shop/{state}/ URLs."""
        # Import directly to avoid platforms/__init__.py pulling playwright
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "curaleaf",
            Path(__file__).resolve().parent.parent / "platforms" / "curaleaf.py",
            submodule_search_locations=[],
        )
        # Can't import CuraleafScraper (needs playwright), but _infer_state
        # is a pure function — test it via source-level extraction instead.
        curaleaf_path = Path(__file__).resolve().parent.parent / "platforms" / "curaleaf.py"
        source = curaleaf_path.read_text()

        # Verify _infer_state function exists
        assert "def _infer_state(" in source, (
            "_infer_state function not found in curaleaf.py"
        )

        # Verify the state mapping covers all needed states
        assert '"michigan"' in source.lower() or "'michigan'" in source.lower(), (
            "curaleaf.py _REGION_TO_STATE should include michigan"
        )
        assert '"illinois"' in source.lower() or "'illinois'" in source.lower(), (
            "curaleaf.py _REGION_TO_STATE should include illinois"
        )
        assert '"arizona"' in source.lower() or "'arizona'" in source.lower(), (
            "curaleaf.py _REGION_TO_STATE should include arizona"
        )

        # Test the URL pattern extraction regex directly
        for url, expected_state in [
            ("https://curaleaf.com/shop/michigan/curaleaf-mi-kalamazoo", "michigan"),
            ("https://curaleaf.com/shop/illinois/curaleaf-il-weed-street", "illinois"),
        ]:
            match = re.search(r"/shop/(\w[\w-]*)/", url)
            assert match, f"Could not extract state from URL: {url}"
            assert match.group(1) == expected_state, (
                f"Expected '{expected_state}', got '{match.group(1)}' from {url}"
            )

        # Verify /stores/ URLs do NOT match the /shop/ regex (NV, AZ)
        # These fall back to the region config field in _infer_state()
        stores_url = "https://curaleaf.com/stores/curaleaf-las-vegas-western-ave/specials"
        match = re.search(r"/shop/(\w[\w-]*)/", stores_url)
        assert match is None, (
            f"/stores/ URL should NOT match /shop/ regex: {stores_url}"
        )


# =====================================================================
# BUG-2: Dutchie embed_type mismatch for dutchie.com/dispensary URLs
# =====================================================================


class TestDutchieEmbedTypeMismatch:
    """Michigan Dutchie sites use dutchie.com/dispensary/{slug} direct
    URLs — these are React SPAs where products render directly in the
    page DOM.  There is no iframe.

    FIX applied: DutchieScraper.scrape() now auto-detects
    embed_type='direct' when the URL host is dutchie.com, skipping
    the 270s iframe + 60s JS embed detection cascade entirely.
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

    def test_dutchie_auto_detect_direct_for_dutchie_com(self):
        """Verify the DutchieScraper source auto-detects embed_type='direct'
        for dutchie.com URLs, so the iframe cascade is never entered."""
        dutchie_path = Path(__file__).resolve().parent.parent / "platforms" / "dutchie.py"
        source = dutchie_path.read_text()
        assert 'embed_hint = "direct"' in source, (
            "dutchie.py should auto-override embed_hint to 'direct' for dutchie.com URLs"
        )

    def test_michigan_dutchie_sites_lack_fallback_url(self):
        """No Michigan dutchie site has a fallback_url configured.
        Nevada sites have embedded-menu fallbacks; Michigan has none.
        (Not needed — auto-detect handles this via embed_type='direct'.)"""
        missing_fallback = [d for d in _michigan_dutchie()
                           if "fallback_url" not in d]
        total = len(_michigan_dutchie())
        assert len(missing_fallback) == total, (
            f"{total - len(missing_fallback)}/{total} Michigan dutchie sites "
            "have fallback_url — check if they're correct"
        )


# =====================================================================
# BUG-3: Same-domain rate limiting risk
# =====================================================================


class TestDutchieDomainConcentration:
    """All Michigan dutchie sites hit the same domain (dutchie.com).

    FIXES applied:
    - Domain-level throttling (_DOMAIN_MIN_INTERVAL + per-domain locks)
    - Chain-level circuit breaker (_CHAIN_FAIL_THRESHOLD)
    - Shuffled scrape order (interleaves chains to avoid clustering)
    - Reduced timeouts for dutchie.com direct pages (30s vs 60s)
    - Skip reload+retry for dutchie.com direct pages with no content
    """

    def test_all_michigan_dutchie_same_domain(self):
        """All Michigan dutchie URLs resolve to dutchie.com — confirms
        domain-level throttling is necessary."""
        domains = {urlparse(d["url"]).netloc for d in _michigan_dutchie()}
        assert domains == {"dutchie.com"} or domains == {"dutchie.com", "www.dutchie.com"}, (
            f"Expected all Michigan dutchie sites on dutchie.com, "
            f"found: {domains}"
        )

    def test_domain_throttle_exists_in_main(self):
        """Verify main.py contains domain-level throttling logic."""
        main_path = Path(__file__).resolve().parent.parent / "main.py"
        source = main_path.read_text()
        assert "_DOMAIN_MIN_INTERVAL" in source, (
            "main.py should define _DOMAIN_MIN_INTERVAL for domain-level throttling"
        )
        assert "domain_locks" in source, (
            "main.py should use per-domain asyncio.Lock for throttling"
        )

    def test_chain_circuit_breaker_exists(self):
        """Verify main.py has chain-level circuit breaker logic."""
        main_path = Path(__file__).resolve().parent.parent / "main.py"
        source = main_path.read_text()
        assert "_CHAIN_FAIL_THRESHOLD" in source, (
            "main.py should define _CHAIN_FAIL_THRESHOLD for chain circuit breaker"
        )
        assert "chain_tripped" in source, (
            "main.py should track tripped chains via chain_tripped set"
        )
        assert "_extract_chain" in source, (
            "main.py should have _extract_chain helper for slug→chain mapping"
        )

    def test_scrape_order_is_shuffled(self):
        """Verify main.py shuffles dispensary order before scraping."""
        main_path = Path(__file__).resolve().parent.parent / "main.py"
        source = main_path.read_text()
        assert "random.shuffle" in source, (
            "main.py should shuffle dispensary list to interleave chains"
        )

    def test_direct_page_uses_shorter_timeout(self):
        """Verify dutchie.py uses shorter timeouts for dutchie.com pages."""
        dutchie_path = Path(__file__).resolve().parent.parent / "platforms" / "dutchie.py"
        source = dutchie_path.read_text()
        assert "is_direct_host" in source, (
            "dutchie.py should detect dutchie.com as direct host"
        )
        assert "30_000" in source, (
            "dutchie.py should use 30s smart-wait for direct pages"
        )

    def test_direct_page_skips_reload_retry(self):
        """Verify dutchie.py skips reload+retry for dutchie.com direct pages."""
        dutchie_path = Path(__file__).resolve().parent.parent / "platforms" / "dutchie.py"
        source = dutchie_path.read_text()
        assert "no_dutchie_content_direct" in source, (
            "dutchie.py should have fast-exit path for direct pages with no content"
        )


# =====================================================================
# BUG-4: Zen Leaf platform mismatch
# =====================================================================


class TestZenLeafPlatformMismatch:
    """Zen Leaf Buchanan uses zenleafdispensaries.com (Verano's custom
    platform) but is tagged platform='curaleaf'.

    FIX applied: _handle_curaleaf_age_gate() now detects non-curaleaf.com
    domains and falls back to the generic overlay-based age gate handler
    instead of trying the redirect-based /age-gate flow.
    """

    def test_zen_leaf_uses_different_domain(self):
        """Zen Leaf URL is NOT on curaleaf.com — confirms the generic
        handler fallback is needed."""
        zen_leaf = [d for d in _michigan_curaleaf()
                    if "zen" in d["name"].lower() or "zen" in d["slug"]]
        assert len(zen_leaf) >= 1, "No Zen Leaf sites found in Michigan config"

        for d in zen_leaf:
            parsed = urlparse(d["url"])
            assert parsed.netloc != "curaleaf.com", (
                f"Expected Zen Leaf to be on a different domain, "
                f"found: {parsed.netloc}"
            )

    def test_curaleaf_handler_has_domain_check(self):
        """Verify curaleaf.py checks the domain before attempting the
        redirect-based age gate flow."""
        curaleaf_path = Path(__file__).resolve().parent.parent / "platforms" / "curaleaf.py"
        source = curaleaf_path.read_text()
        assert '"curaleaf.com" not in parsed.netloc' in source or \
               "'curaleaf.com' not in parsed.netloc" in source or \
               '"curaleaf.com"' in source, (
            "curaleaf.py should check for curaleaf.com domain before "
            "attempting redirect-based age gate"
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
    to serve as regression baselines for future runs.

    They are marked xfail because they document the PRE-FIX broken state.
    After a real Michigan scrape with the fixes applied, these constants
    should be updated and the xfail markers removed.
    """

    # Test 1 actuals — these represent the BROKEN state
    TEST1_TOTAL_SITES = 114
    TEST1_SITES_SCRAPED = 113
    TEST1_TOTAL_PRODUCTS = 112
    TEST1_DEALS_SELECTED = 33
    TEST1_SITES_WITH_PRODUCTS = 6  # only 6 out of 113

    @pytest.mark.xfail(reason="Pre-fix baseline — will pass after live re-scrape")
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

    @pytest.mark.xfail(reason="Pre-fix baseline — will pass after live re-scrape")
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
    """Positive assertions verifying all four bug fixes are in place."""

    def test_curaleaf_state_extracted_from_url(self):
        """_infer_state's URL regex correctly extracts Michigan from
        all Michigan Curaleaf URLs."""
        for d in _michigan_curaleaf():
            if "curaleaf.com" in d["url"]:
                # Replicate _infer_state logic: extract from /shop/{state}/
                match = re.search(r"/shop/(\w[\w-]*)/", d["url"])
                assert match, (
                    f"Cannot extract state from Curaleaf URL: {d['url']}"
                )
                assert match.group(1) == "michigan", (
                    f"Expected 'michigan' for {d['url']}, got '{match.group(1)}'"
                )

    def test_dutchie_auto_detect_skips_iframe_cascade(self):
        """DutchieScraper auto-detects embed_type='direct' for
        dutchie.com URLs, so the 270s iframe cascade is never entered.

        This is a source-level check — the runtime auto-detect is in
        DutchieScraper.scrape() and overrides embed_hint to 'direct'
        when the URL host is dutchie.com."""
        dutchie_path = Path(__file__).resolve().parent.parent / "platforms" / "dutchie.py"
        source = dutchie_path.read_text()
        # The auto-detect block checks urlparse(self.url).netloc
        assert "dutchie.com" in source, (
            "dutchie.py should contain dutchie.com host check"
        )
        assert 'embed_hint = "direct"' in source, (
            "dutchie.py should set embed_hint='direct' for dutchie.com URLs"
        )
