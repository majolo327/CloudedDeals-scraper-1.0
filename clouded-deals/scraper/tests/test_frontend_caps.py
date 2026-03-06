"""Verify frontend deal-feed cap values in api.ts match expected thresholds.

These tests read the frontend source file and assert that chain and brand cap
values are set correctly.  This prevents accidental regressions where the
frontend silently drops deals that the scraper selected.

Run with:  python -m pytest tests/test_frontend_caps.py -v
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


_API_TS = (
    Path(__file__).resolve().parent.parent.parent
    / "frontend"
    / "src"
    / "lib"
    / "api.ts"
)


def _read_api_ts() -> str:
    """Read the frontend api.ts file contents."""
    if not _API_TS.exists():
        pytest.skip("frontend/src/lib/api.ts not found (frontend not checked out)")
    return _API_TS.read_text()


class TestFrontendCaps:
    """Ensure frontend capping values are tuned to show enough deals."""

    def test_chain_cap_is_at_least_40(self):
        """Chain cap should be >= 40 to avoid hiding deals from multi-location chains."""
        source = _read_api_ts()
        match = re.search(r"applyChainDiversityCap\(\w+,\s*(\d+)\)", source)
        assert match, "Could not find applyChainDiversityCap call in api.ts"
        chain_cap = int(match.group(1))
        assert chain_cap >= 40, (
            f"Chain cap is {chain_cap}, should be >= 40 to avoid hiding deals. "
            f"With 277 selected deals, a cap of 25 was dropping ~96 deals."
        )

    def test_brand_per_category_cap_is_at_least_6(self):
        """Brand-per-category cap should be >= 6 to preserve variety."""
        source = _read_api_ts()
        match = re.search(r"applyGlobalBrandCap\(\w+,\s*(\d+),\s*(\d+)\)", source)
        assert match, "Could not find applyGlobalBrandCap call in api.ts"
        per_cat_cap = int(match.group(1))
        assert per_cat_cap >= 6, (
            f"Brand-per-category cap is {per_cat_cap}, should be >= 6. "
            f"The scraper already applies brand diversity at selection time."
        )

    def test_brand_total_cap_is_at_least_18(self):
        """Brand total cap should be >= 18 to avoid hiding popular brand deals."""
        source = _read_api_ts()
        match = re.search(r"applyGlobalBrandCap\(\w+,\s*(\d+),\s*(\d+)\)", source)
        assert match, "Could not find applyGlobalBrandCap call in api.ts"
        total_cap = int(match.group(2))
        assert total_cap >= 18, (
            f"Brand total cap is {total_cap}, should be >= 18. "
            f"The scraper already applies brand diversity at selection time."
        )

    def test_caps_are_not_excessively_high(self):
        """Caps shouldn't be removed entirely — some diversity enforcement is needed."""
        source = _read_api_ts()
        chain_match = re.search(r"applyChainDiversityCap\(\w+,\s*(\d+)\)", source)
        brand_match = re.search(r"applyGlobalBrandCap\(\w+,\s*(\d+),\s*(\d+)\)", source)
        assert chain_match and brand_match

        chain_cap = int(chain_match.group(1))
        per_cat = int(brand_match.group(1))
        total = int(brand_match.group(2))

        assert chain_cap <= 100, f"Chain cap {chain_cap} is too high — no diversity enforcement"
        assert per_cat <= 15, f"Brand per-cat cap {per_cat} is too high — no diversity enforcement"
        assert total <= 50, f"Brand total cap {total} is too high — no diversity enforcement"
