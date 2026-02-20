"""Tests for Phase D' passive data enrichment features.

Covers:
  1. Brand detection rate + unmatched brand tracking in metrics_collector
  2. Price cap rejection counting in deal_detector
  3. Concentrate + edible subtype classification in product_classifier
  4. Price distribution + brand pricing snapshots in enrichment_snapshots
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from deal_detector import failed_by_price_cap, detect_deals
from enrichment_snapshots import (
    _weight_tier,
    compute_price_distributions,
    compute_brand_pricing,
    write_snapshots,
)
from metrics_collector import collect_daily_metrics
from product_classifier import classify_product


# =====================================================================
# 1. Brand detection rate + unmatched brand tracking
# =====================================================================

class TestBrandDetectionMetrics:
    """Metrics collector tracks brand null count and detection rate."""

    def test_brand_metrics_included(self, make_product):
        """brand_null_count and detection rate appear in metrics output."""
        deals = [make_product(brand="STIIIZY", category="vape", deal_score=80)]
        metrics = collect_daily_metrics(
            MagicMock(),
            deals,
            total_products=100,
            brand_null_count=30,
            dry_run=True,
        )
        assert metrics["brand_null_count"] == 30
        assert metrics["brand_detection_rate"] == 70.0

    def test_brand_detection_rate_zero_products(self):
        """Zero total products produces 0% detection rate, not a division error."""
        metrics = collect_daily_metrics(
            MagicMock(),
            [],
            total_products=0,
            brand_null_count=0,
            dry_run=True,
        )
        assert metrics["brand_detection_rate"] == 0

    def test_top_unmatched_brands_capped(self, make_product):
        """Top unmatched brands list is capped at 20 entries."""
        brands = [f"Brand{i}" for i in range(30)]
        metrics = collect_daily_metrics(
            MagicMock(),
            [],
            total_products=100,
            brand_null_count=30,
            top_unmatched_brands=brands,
            dry_run=True,
        )
        assert len(metrics["top_unmatched_brands"]) == 20

    def test_price_cap_reject_metrics(self, make_product):
        """Price cap rejection count and rate appear in metrics."""
        deals = [make_product(brand="Rove", category="vape", deal_score=70)]
        metrics = collect_daily_metrics(
            MagicMock(),
            deals,
            total_products=200,
            price_cap_reject_count=45,
            dry_run=True,
        )
        assert metrics["price_cap_reject_count"] == 45
        assert metrics["price_cap_reject_rate"] == 22.5


# =====================================================================
# 2. Price cap rejection detection
# =====================================================================

class TestPriceCapRejection:
    """failed_by_price_cap correctly identifies cap-specific rejections."""

    def test_flower_over_cap(self, make_product):
        """Flower at $40/3.5g exceeds $25 cap → rejected by price cap."""
        product = make_product(
            category="flower", sale_price=40.0, weight_value=3.5, weight_unit="g",
        )
        assert failed_by_price_cap(product) is True

    def test_flower_under_cap(self, make_product):
        """Flower at $20/3.5g is under cap → not rejected by price cap."""
        product = make_product(
            category="flower", sale_price=20.0, weight_value=3.5, weight_unit="g",
        )
        assert failed_by_price_cap(product) is False

    def test_vape_over_cap(self, make_product):
        """Vape at $35 exceeds $28 cap → rejected by price cap."""
        product = make_product(
            category="vape", sale_price=35.0, weight_value=1.0,
        )
        assert failed_by_price_cap(product) is True

    def test_global_floor_not_price_cap(self, make_product):
        """Product at $1 fails global floor, not price cap → returns False."""
        product = make_product(
            category="flower", sale_price=1.0, weight_value=3.5,
        )
        assert failed_by_price_cap(product) is False

    def test_infused_preroll_higher_cap(self, make_product):
        """Infused preroll at $13 is within $15 infused cap → not rejected."""
        product = make_product(
            category="preroll", sale_price=13.0,
            product_subtype="infused_preroll",
        )
        assert failed_by_price_cap(product) is False

    def test_infused_preroll_over_cap(self, make_product):
        """Infused preroll at $18 exceeds $15 infused cap → rejected."""
        product = make_product(
            category="preroll", sale_price=18.0,
            product_subtype="infused_preroll",
        )
        assert failed_by_price_cap(product) is True

    def test_price_cap_rejects_in_detect_deals(self, make_product):
        """detect_deals report data includes price_cap_rejects count."""
        products = [
            # This one passes hard filters
            make_product(
                name="Good Deal 3.5g", brand="Cookies", category="flower",
                sale_price=15.0, original_price=30.0, discount_percent=50,
                weight_value=3.5, weight_unit="g",
            ),
            # This one fails by price cap (flower $40/3.5g > $25 cap)
            make_product(
                name="Overpriced Eighth 3.5g", brand="Cookies", category="flower",
                sale_price=40.0, original_price=60.0, discount_percent=33,
                weight_value=3.5, weight_unit="g",
            ),
        ]
        from deal_detector import get_last_report_data
        detect_deals(products)
        rd = get_last_report_data()
        assert "price_cap_rejects" in rd
        assert rd["price_cap_rejects"] >= 1


# =====================================================================
# 3. Concentrate + edible subtype classification
# =====================================================================

class TestConcentrateSubtypes:
    """product_classifier detects concentrate subtypes."""

    @pytest.mark.parametrize("name, expected", [
        ("Blue Dream Live Resin 1g", "live_resin"),
        ("OG Kush Cured Resin Badder", "cured_resin"),
        ("Wedding Cake Budder", "budder"),
        ("GMO Badder 1g", "badder"),
        ("Zkittlez Shatter", "shatter"),
        ("Platinum OG Diamonds", "diamonds"),
        ("Papaya Sauce 1g", "sauce"),
        ("Ice Cream Cake Hash Rosin", "hash_rosin"),
        ("Gelato Live Rosin 1g", "live_rosin"),
        ("Sundae Driver Rosin", "rosin"),
        ("Purple Punch Crumble", "crumble"),
        ("GSC Wax 1g", "wax"),
        ("Durban Sugar", "sugar"),
        ("RSO Syringe 1g", "rso"),
        ("Rick Simpson Oil", "rso"),
        ("FSHO Syringe 1g", "fsho"),
    ])
    def test_concentrate_subtypes(self, name, expected):
        result = classify_product(name, brand=None, category="concentrate")
        assert result["product_subtype"] == expected

    def test_concentrate_no_subtype(self):
        """Generic concentrate name gets no subtype."""
        result = classify_product("Premium Extract 1g", brand=None, category="concentrate")
        assert result["product_subtype"] is None

    def test_concentrate_subtype_only_for_concentrates(self):
        """Concentrate keywords in non-concentrate category don't trigger."""
        result = classify_product("Live Resin Infused Preroll", brand=None, category="preroll")
        # Should be infused_preroll, not live_resin
        assert result["product_subtype"] == "infused_preroll"


class TestEdibleSubtypes:
    """product_classifier detects edible subtypes."""

    @pytest.mark.parametrize("name, expected", [
        ("Watermelon Gummies 100mg", "gummy"),
        ("Dark Chocolate Bar 100mg", "chocolate"),
        ("Lemonade Drink 100mg", "beverage"),
        ("CBD Tincture 1000mg", "tincture"),
        ("THC Capsule 10mg", "capsule"),
        ("Softgel 25mg", "capsule"),
        ("Peppermint Lozenge 10mg", "lozenge"),
        ("Hard Candy 5mg", "lozenge"),
        ("Mint Drops 100mg", "lozenge"),
        ("Brownie 100mg", "baked_good"),
        ("Chocolate Chip Cookie 50mg", "chocolate"),  # "chocolate" matches first
        ("Caramel Chew 10mg", "chew"),
    ])
    def test_edible_subtypes(self, name, expected):
        result = classify_product(name, brand=None, category="edible")
        assert result["product_subtype"] == expected

    def test_edible_no_subtype(self):
        """Generic edible name gets no subtype."""
        result = classify_product("Party Mix 100mg", brand=None, category="edible")
        assert result["product_subtype"] is None

    def test_edible_subtype_only_for_edibles(self):
        """Edible keywords in non-edible category don't trigger edible subtype."""
        result = classify_product("Gummy Bear OG 3.5g", brand=None, category="flower")
        # flower category → no edible subtype detection
        assert result["product_subtype"] is None


# =====================================================================
# 4. Enrichment snapshots
# =====================================================================

class TestWeightTier:
    """_weight_tier maps raw values to canonical tiers."""

    @pytest.mark.parametrize("category, value, unit, expected", [
        ("flower", 3.5, "g", "3.5g"),
        ("flower", 7.0, "g", "7g"),
        ("flower", 14.0, "g", "14g"),
        ("flower", 28.0, "g", "28g"),
        ("vape", 0.5, "g", "0.5g"),
        ("vape", 1.0, "g", "1g"),
        ("concentrate", 1.0, "g", "1g"),
        ("concentrate", 2.0, "g", "2g"),
        ("edible", 100, "mg", "100mg"),
        ("flower", 5.0, "g", "7g"),  # 5g falls in the 7g tier
    ])
    def test_weight_tier_mapping(self, category, value, unit, expected):
        assert _weight_tier(category, value, unit) == expected

    def test_weight_tier_none_value(self):
        assert _weight_tier("flower", None, None) is None

    def test_weight_tier_unknown_category(self):
        assert _weight_tier("topical", 1.0, "g") is None


class TestPriceDistributions:
    """compute_price_distributions returns valid distribution snapshots."""

    def test_basic_distribution(self):
        """Computes percentiles from mock product data."""
        db = MagicMock()

        # 10 flower products at 3.5g across two regions
        products = []
        for i in range(10):
            products.append({
                "dispensary_id": "disp-nv" if i < 5 else "disp-mi",
                "category": "flower",
                "weight_value": 3.5,
                "weight_unit": "g",
                "sale_price": 15.0 + i * 2,
                "original_price": 30.0,
            })

        db.table.return_value.select.return_value.eq.return_value.gt.return_value.execute.return_value.data = products
        db.table.return_value.select.return_value.execute.return_value.data = [
            {"id": "disp-nv", "region": "southern-nv"},
            {"id": "disp-mi", "region": "michigan"},
        ]

        results = compute_price_distributions(db)
        assert len(results) >= 1
        for r in results:
            assert r["snapshot_type"] == "price_distribution"
            assert r["category"] == "flower"
            assert r["weight_tier"] == "3.5g"
            assert r["p25"] is not None
            assert r["p50"] is not None
            assert r["p75"] is not None
            assert r["sample_size"] >= 5


class TestBrandPricing:
    """compute_brand_pricing returns valid brand pricing snapshots."""

    def test_basic_brand_pricing(self):
        """Computes median prices per brand per region."""
        db = MagicMock()

        products = []
        for i in range(5):
            products.append({
                "dispensary_id": "disp-nv",
                "brand": "STIIIZY",
                "category": "vape",
                "weight_value": 1.0,
                "weight_unit": "g",
                "sale_price": 25.0 + i,
            })
        for i in range(5):
            products.append({
                "dispensary_id": "disp-mi",
                "brand": "STIIIZY",
                "category": "vape",
                "weight_value": 1.0,
                "weight_unit": "g",
                "sale_price": 20.0 + i,
            })

        db.table.return_value.select.return_value.eq.return_value.gt.return_value.not_.is_.return_value.execute.return_value.data = products
        db.table.return_value.select.return_value.execute.return_value.data = [
            {"id": "disp-nv", "region": "southern-nv"},
            {"id": "disp-mi", "region": "michigan"},
        ]

        results = compute_brand_pricing(db, min_brand_products=3)
        assert len(results) >= 2  # one per region
        brands = {r["brand"] for r in results}
        assert "STIIIZY" in brands
        regions = {r["region"] for r in results}
        assert "southern-nv" in regions
        assert "michigan" in regions


class TestWriteSnapshots:
    """write_snapshots handles dry run and DB writes."""

    def test_dry_run_returns_count(self):
        snapshots = [{"snapshot_type": "test", "region": "nv"}]
        count = write_snapshots(MagicMock(), snapshots, dry_run=True)
        assert count == 1

    def test_empty_list_returns_zero(self):
        count = write_snapshots(MagicMock(), [], dry_run=False)
        assert count == 0

    def test_db_write_calls_upsert(self):
        db = MagicMock()
        snapshots = [{"snapshot_type": "test", "region": "nv"}]
        write_snapshots(db, snapshots, dry_run=False)
        db.table.assert_called_with("enrichment_snapshots")
        db.table().upsert.assert_called_once()
