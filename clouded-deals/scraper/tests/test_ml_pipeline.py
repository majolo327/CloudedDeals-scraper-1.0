"""Tests for ML pipeline features — dynamic price caps and brand auto-discovery.

Covers:
  1. Dynamic price cap loading and fallback behavior
  2. Price cap recommendations from enrichment data
  3. Approved brand loading into runtime lookup
  4. Brand learner candidate analysis
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from deal_detector import (
    _get_dynamic_cap,
    _passes_price_cap,
    load_dynamic_caps,
    passes_hard_filters,
    _dynamic_caps,
)
from enrichment_snapshots import (
    _lookup_hardcoded_cap,
    compute_price_cap_recommendations,
)
from clouded_logic import BRANDS, BRANDS_LOWER, _BRAND_PATTERNS, load_approved_brands
from brand_learner import analyze_candidates, _cluster_similar_names


# =====================================================================
# 1. Dynamic price cap loading
# =====================================================================

class TestLoadDynamicCaps:
    """load_dynamic_caps populates the module-level cache."""

    def test_loads_active_caps(self):
        """Active caps from DB are loaded into the cache."""
        db = MagicMock()
        db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {"region": "michigan", "category": "flower", "weight_tier": "3.5g",
             "recommended_cap": 14.50, "sample_size": 200},
            {"region": "michigan", "category": "vape", "weight_tier": "1g",
             "recommended_cap": 20.00, "sample_size": 150},
        ]

        count = load_dynamic_caps(db)
        assert count == 2

    def test_empty_table_returns_zero(self):
        """Empty ml_price_caps table loads zero caps."""
        db = MagicMock()
        db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

        count = load_dynamic_caps(db)
        assert count == 0

    def test_db_error_returns_zero(self):
        """DB errors are caught and fall back gracefully."""
        db = MagicMock()
        db.table.return_value.select.return_value.eq.return_value.execute.side_effect = Exception("connection failed")

        count = load_dynamic_caps(db)
        assert count == 0


class TestGetDynamicCap:
    """_get_dynamic_cap looks up caps from the loaded cache."""

    def setup_method(self):
        """Load test caps into the module-level cache."""
        import deal_detector
        deal_detector._dynamic_caps = {
            ("michigan", "flower", "3.5g"): 14.50,
            ("michigan", "vape", "1g"): 20.00,
            ("southern-nv", "flower", "3.5g"): 22.00,
        }

    def teardown_method(self):
        """Reset the cache."""
        import deal_detector
        deal_detector._dynamic_caps = {}

    def test_exact_match(self):
        cap = _get_dynamic_cap("flower", 3.5, "michigan")
        assert cap == 14.50

    def test_no_match_returns_none(self):
        cap = _get_dynamic_cap("edible", 100, "michigan")
        assert cap is None

    def test_empty_cache_returns_none(self):
        import deal_detector
        deal_detector._dynamic_caps = {}
        cap = _get_dynamic_cap("flower", 3.5, "michigan")
        assert cap is None

    def test_no_region_returns_none(self):
        cap = _get_dynamic_cap("flower", 3.5, None)
        assert cap is None

    def test_sharded_region_fallback(self):
        """'michigan-2' should fall back to 'michigan' caps."""
        cap = _get_dynamic_cap("flower", 3.5, "michigan-2")
        assert cap == 14.50


class TestPassesPriceCapWithDynamic:
    """_passes_price_cap uses dynamic caps when available."""

    def setup_method(self):
        import deal_detector
        deal_detector._dynamic_caps = {
            ("michigan", "flower", "3.5g"): 14.50,
        }

    def teardown_method(self):
        import deal_detector
        deal_detector._dynamic_caps = {}

    def test_dynamic_cap_used(self):
        """$13 flower eighth in Michigan passes with dynamic cap $14.50."""
        assert _passes_price_cap(13.0, "flower", 3.5, "michigan") is True

    def test_dynamic_cap_rejects(self):
        """$16 flower eighth in Michigan exceeds dynamic cap $14.50."""
        assert _passes_price_cap(16.0, "flower", 3.5, "michigan") is False

    def test_fallback_when_no_dynamic(self):
        """Categories without dynamic caps fall back to hardcoded."""
        # Edible has no dynamic cap loaded — should use MI hardcoded $12
        assert _passes_price_cap(11.0, "edible", None, "michigan") is True

    def test_hardcoded_used_when_cache_empty(self):
        """When no dynamic caps loaded, hardcoded caps are used."""
        import deal_detector
        deal_detector._dynamic_caps = {}
        # NV flower eighth hardcoded cap = $22
        assert _passes_price_cap(20.0, "flower", 3.5, "southern-nv") is True
        assert _passes_price_cap(25.0, "flower", 3.5, "southern-nv") is False


# =====================================================================
# 2. Price cap recommendations
# =====================================================================

class TestLookupHardcodedCap:
    """_lookup_hardcoded_cap retrieves the correct hardcoded cap."""

    def test_nv_flower_eighth(self):
        cap = _lookup_hardcoded_cap("flower", "3.5g", "southern-nv")
        assert cap == 22

    def test_michigan_flower_eighth(self):
        cap = _lookup_hardcoded_cap("flower", "3.5g", "michigan")
        assert cap == 15

    def test_edible_flat_cap(self):
        cap = _lookup_hardcoded_cap("edible", "100mg", "southern-nv")
        assert cap == 15

    def test_unknown_category(self):
        cap = _lookup_hardcoded_cap("topical", "1g", "southern-nv")
        assert cap is None


class TestComputePriceCapRecommendations:
    """compute_price_cap_recommendations produces valid recommendations."""

    def test_basic_recommendations(self):
        db = MagicMock()

        # 30 flower products at 3.5g in michigan — prices $10-$25
        products = []
        for i in range(30):
            products.append({
                "dispensary_id": "disp-mi",
                "category": "flower",
                "weight_value": 3.5,
                "weight_unit": "g",
                "sale_price": 10.0 + i * 0.5,
            })

        db.table.return_value.select.return_value.eq.return_value.gt.return_value.execute.return_value.data = products
        db.table.return_value.select.return_value.execute.return_value.data = [
            {"id": "disp-mi", "region": "michigan"},
        ]

        recs = compute_price_cap_recommendations(db, min_sample_size=20)
        assert len(recs) >= 1

        mi_flower = [r for r in recs if r["region"] == "michigan" and r["category"] == "flower"]
        assert len(mi_flower) == 1
        rec = mi_flower[0]
        assert rec["sample_size"] == 30
        assert rec["is_active"] is True
        assert rec["recommended_cap"] > 0
        assert rec["p30"] > 0
        assert rec["hardcoded_cap"] == 15  # michigan flower 3.5g = $15

    def test_small_sample_inactive(self):
        """Buckets with < min_sample_size are marked inactive."""
        db = MagicMock()

        products = [
            {"dispensary_id": "disp-mi", "category": "flower",
             "weight_value": 3.5, "weight_unit": "g", "sale_price": 15.0}
            for _ in range(5)
        ]

        db.table.return_value.select.return_value.eq.return_value.gt.return_value.execute.return_value.data = products
        db.table.return_value.select.return_value.execute.return_value.data = [
            {"id": "disp-mi", "region": "michigan"},
        ]

        recs = compute_price_cap_recommendations(db, min_sample_size=20)
        for rec in recs:
            assert rec["is_active"] is False


# =====================================================================
# 3. Approved brand loading
# =====================================================================

class TestLoadApprovedBrands:
    """load_approved_brands merges approved candidates into BRANDS_LOWER."""

    def test_loads_approved_brands(self):
        db = MagicMock()
        db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {"name": "TestBrandXYZ", "canonical_name": None},
            {"name": "AnotherTestBrand", "canonical_name": "Another Test Brand"},
        ]

        count = load_approved_brands(db)
        assert count == 2
        assert "testbrandxyz" in BRANDS_LOWER
        assert "another test brand" in BRANDS_LOWER
        # Verify patterns were also created
        assert "TestBrandXYZ" in _BRAND_PATTERNS
        assert "Another Test Brand" in _BRAND_PATTERNS

        # Clean up — remove test brands from all global state
        BRANDS_LOWER.pop("testbrandxyz", None)
        BRANDS_LOWER.pop("another test brand", None)
        _BRAND_PATTERNS.pop("TestBrandXYZ", None)
        _BRAND_PATTERNS.pop("Another Test Brand", None)
        if "TestBrandXYZ" in BRANDS:
            BRANDS.remove("TestBrandXYZ")
        if "Another Test Brand" in BRANDS:
            BRANDS.remove("Another Test Brand")

    def test_skip_existing_brands(self):
        """Brands already in BRANDS_LOWER are not duplicated."""
        db = MagicMock()
        db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {"name": "STIIIZY", "canonical_name": None},  # already exists
        ]

        count = load_approved_brands(db)
        assert count == 0  # already in DB, not added again

    def test_db_error_returns_zero(self):
        """DB errors are handled gracefully."""
        db = MagicMock()
        db.table.return_value.select.return_value.eq.return_value.execute.side_effect = Exception("no table")

        count = load_approved_brands(db)
        assert count == 0


# =====================================================================
# 4. Brand learner analysis
# =====================================================================

class TestClusterSimilarNames:
    """_cluster_similar_names groups similar brand names."""

    def test_groups_variants(self):
        names = ["STIIIZY Michigan", "STIIIZY MI", "STIIIZY"]
        clusters = _cluster_similar_names(names, threshold=0.70)
        # All should cluster together (the longest name becomes canonical)
        assert len(clusters) <= 2

    def test_distinct_names_separate(self):
        names = ["Connected", "Alien Labs", "Jungle Boys"]
        clusters = _cluster_similar_names(names, threshold=0.80)
        assert len(clusters) == 3


class TestAnalyzeCandidates:
    """analyze_candidates produces valid brand candidate records."""

    def test_basic_analysis(self):
        rows = []
        for i in range(15):
            rows.append({
                "region": "michigan" if i % 2 == 0 else "illinois",
                "run_date": f"2026-03-0{(i % 5) + 1}",
                "top_unmatched_brands": ["TestNewBrand", "AnotherNew"],
            })

        candidates = analyze_candidates(rows, min_observations=5)
        names = {c["name"] for c in candidates}
        # "TestNewBrand" appeared 15 times, should be a candidate
        assert any("TestNewBrand" in n or "AnotherNew" in n for n in names)

    def test_low_observation_filtered(self):
        """Names appearing fewer than min_observations are excluded."""
        rows = [
            {"region": "michigan", "run_date": "2026-03-01",
             "top_unmatched_brands": ["RareBrand"]},
        ]
        candidates = analyze_candidates(rows, min_observations=10)
        assert len(candidates) == 0

    def test_existing_brands_skipped(self):
        """Names matching existing brands (>= 95% similarity) are skipped."""
        rows = []
        for _ in range(20):
            rows.append({
                "region": "michigan", "run_date": "2026-03-01",
                "top_unmatched_brands": ["STIIIZY"],  # exact match
            })
        candidates = analyze_candidates(rows, min_observations=5)
        stiiizy_candidates = [c for c in candidates if "STIIIZY" in c["name"]]
        assert len(stiiizy_candidates) == 0
