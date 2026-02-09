"""Tests for deal_detector.py — hard filters, scoring, quality gate, top-200 selection."""

from __future__ import annotations

from collections import Counter

import pytest

from deal_detector import (
    BADGE_THRESHOLDS,
    CATEGORY_PRICE_CAPS,
    CATEGORY_TARGETS,
    HARD_FILTERS,
    MAX_SAME_BRAND_TOTAL,
    MAX_SAME_DISPENSARY_TOTAL,
    PREMIUM_BRANDS,
    TARGET_DEAL_COUNT,
    calculate_deal_score,
    detect_deals,
    get_last_report_data,
    passes_hard_filters,
    passes_quality_gate,
    select_top_deals,
)


# =====================================================================
# passes_hard_filters
# =====================================================================


class TestPassesHardFilters:
    """Hard filter gate: products must pass to enter scoring."""

    # ── Infused / pack exclusion ───────────────────────────────────

    def test_infused_excluded(self, make_product):
        p = make_product(is_infused=True)
        assert passes_hard_filters(p) is False

    def test_infused_subtype_excluded(self, make_product):
        p = make_product(product_subtype="infused_preroll")
        assert passes_hard_filters(p) is False

    def test_preroll_pack_excluded(self, make_product):
        p = make_product(product_subtype="preroll_pack")
        assert passes_hard_filters(p) is False

    # ── Global filters ─────────────────────────────────────────────

    def test_no_sale_price_rejected(self, make_product):
        p = make_product(sale_price=0)
        assert passes_hard_filters(p) is False

    def test_below_min_price_rejected(self, make_product):
        p = make_product(sale_price=2.99)
        assert passes_hard_filters(p) is False

    def test_at_min_price_passes(self, make_product):
        p = make_product(sale_price=3.0, original_price=10.0, discount_percent=70,
                         category="preroll")
        assert passes_hard_filters(p) is True

    def test_above_max_price_rejected(self, make_product):
        p = make_product(sale_price=81.0)
        assert passes_hard_filters(p) is False

    def test_below_min_discount_rejected(self, make_product):
        p = make_product(discount_percent=19)
        assert passes_hard_filters(p) is False

    def test_at_min_discount_passes(self, make_product):
        p = make_product(sale_price=15.0, original_price=30.0, discount_percent=20,
                         category="flower", weight_value=3.5)
        assert passes_hard_filters(p) is True

    def test_no_discount_rejected(self, make_product):
        p = make_product(discount_percent=0)
        assert passes_hard_filters(p) is False

    def test_no_original_price_rejected(self, make_product):
        p = make_product(original_price=0)
        assert passes_hard_filters(p) is False

    def test_original_equals_sale_rejected(self, make_product):
        p = make_product(sale_price=15.0, original_price=15.0)
        assert passes_hard_filters(p) is False

    # ── Flower weight-based caps ───────────────────────────────────

    def test_flower_35g_at_cap(self, make_product):
        p = make_product(category="flower", sale_price=19.0, original_price=40.0,
                         discount_percent=52, weight_value=3.5)
        assert passes_hard_filters(p) is True

    def test_flower_35g_over_cap(self, make_product):
        p = make_product(category="flower", sale_price=20.0, original_price=40.0,
                         discount_percent=50, weight_value=3.5)
        assert passes_hard_filters(p) is False

    def test_flower_7g_at_cap(self, make_product):
        p = make_product(category="flower", sale_price=30.0, original_price=60.0,
                         discount_percent=50, weight_value=7)
        assert passes_hard_filters(p) is True

    def test_flower_7g_over_cap(self, make_product):
        p = make_product(category="flower", sale_price=31.0, original_price=60.0,
                         discount_percent=48, weight_value=7)
        assert passes_hard_filters(p) is False

    def test_flower_14g_at_cap(self, make_product):
        p = make_product(category="flower", sale_price=40.0, original_price=80.0,
                         discount_percent=50, weight_value=14)
        assert passes_hard_filters(p) is True

    def test_flower_no_weight_uses_35g_default(self, make_product):
        p = make_product(category="flower", sale_price=20.0, original_price=40.0,
                         discount_percent=50, weight_value=None)
        assert passes_hard_filters(p) is False  # > $19 default cap

    # ── Flat-cap categories ────────────────────────────────────────

    def test_vape_at_cap(self, make_product):
        p = make_product(category="vape", sale_price=25.0, original_price=50.0,
                         discount_percent=50)
        assert passes_hard_filters(p) is True

    def test_vape_over_cap(self, make_product):
        p = make_product(category="vape", sale_price=26.0, original_price=50.0,
                         discount_percent=48)
        assert passes_hard_filters(p) is False

    def test_edible_at_cap(self, make_product):
        p = make_product(category="edible", sale_price=9.0, original_price=18.0,
                         discount_percent=50)
        assert passes_hard_filters(p) is True

    def test_edible_over_cap(self, make_product):
        p = make_product(category="edible", sale_price=10.0, original_price=20.0,
                         discount_percent=50)
        assert passes_hard_filters(p) is False

    def test_concentrate_at_cap(self, make_product):
        p = make_product(category="concentrate", sale_price=25.0, original_price=50.0,
                         discount_percent=50)
        assert passes_hard_filters(p) is True

    def test_preroll_at_cap(self, make_product):
        p = make_product(category="preroll", sale_price=6.0, original_price=12.0,
                         discount_percent=50)
        assert passes_hard_filters(p) is True

    def test_preroll_over_cap(self, make_product):
        p = make_product(category="preroll", sale_price=7.0, original_price=12.0,
                         discount_percent=42)
        assert passes_hard_filters(p) is False

    # ── Unknown category ───────────────────────────────────────────

    def test_unknown_category_under_40(self, make_product):
        p = make_product(category="other", sale_price=39.0, original_price=60.0,
                         discount_percent=35)
        assert passes_hard_filters(p) is True

    def test_unknown_category_over_40(self, make_product):
        p = make_product(category="other", sale_price=41.0, original_price=60.0,
                         discount_percent=32)
        assert passes_hard_filters(p) is False

    # ── Fallback to current_price ──────────────────────────────────

    def test_current_price_fallback(self, make_product):
        p = make_product(category="preroll", sale_price=None, original_price=12.0,
                         discount_percent=50)
        p["current_price"] = 5.0
        p.pop("sale_price")
        assert passes_hard_filters(p) is True


# =====================================================================
# calculate_deal_score
# =====================================================================


class TestCalculateDealScore:
    """Scoring: 0-100 composite from discount, brand, category, price, THC."""

    # ── Discount depth (up to 40 pts) ──────────────────────────────

    def test_discount_20_pct(self, make_product):
        p = make_product(discount_percent=20, brand="", thc_percent=None,
                         sale_price=50.0, category="other")
        s = calculate_deal_score(p)
        # 20*0.8=16 + brand:0 + cat:3 + price:0 + thc:0 = 19
        assert s == 19

    def test_discount_50_capped(self, make_product):
        p = make_product(discount_percent=50, brand="", thc_percent=None,
                         sale_price=50.0, category="other")
        s = calculate_deal_score(p)
        # 50*0.8=40 + 0 + 3 + 0 + 0 = 43
        assert s == 43

    def test_discount_60_capped_at_40(self, make_product):
        p = make_product(discount_percent=60, brand="", thc_percent=None,
                         sale_price=50.0, category="other")
        s = calculate_deal_score(p)
        # min(40, 60*0.8=48)=40 + 0 + 3 + 0 + 0 = 43
        assert s == 43

    # ── Brand recognition (up to 20 pts) ───────────────────────────

    def test_premium_brand(self, make_product):
        p = make_product(discount_percent=0, brand="Cookies", thc_percent=None,
                         sale_price=50.0, category="other")
        s = calculate_deal_score(p)
        # 0 + 20 + 3 + 0 + 0 = 23
        assert s == 23

    def test_known_brand(self, make_product):
        p = make_product(discount_percent=0, brand="SomeBrand", thc_percent=None,
                         sale_price=50.0, category="other")
        s = calculate_deal_score(p)
        # 0 + 8 + 3 + 0 + 0 = 11
        assert s == 11

    def test_no_brand(self, make_product):
        p = make_product(discount_percent=0, brand="", thc_percent=None,
                         sale_price=50.0, category="other")
        s = calculate_deal_score(p)
        # 0 + 0 + 3 + 0 + 0 = 3
        assert s == 3

    # ── Category boost (up to 10 pts) ──────────────────────────────

    @pytest.mark.parametrize("category,boost", [
        ("flower", 10), ("vape", 10), ("edible", 8),
        ("concentrate", 7), ("preroll", 6),
    ])
    def test_category_boosts(self, make_product, category, boost):
        p = make_product(discount_percent=0, brand="", thc_percent=None,
                         sale_price=50.0, category=category)
        s = calculate_deal_score(p)
        assert s == boost

    # ── Price sweet spot (up to 15 pts) ────────────────────────────

    def test_price_sweet_spot(self, make_product):
        p = make_product(discount_percent=0, brand="", thc_percent=None,
                         sale_price=20.0, category="other")
        s = calculate_deal_score(p)
        # 0 + 0 + 3 + 15 + 0 = 18
        assert s == 18

    def test_price_below_5_no_bonus(self, make_product):
        p = make_product(discount_percent=0, brand="", thc_percent=None,
                         sale_price=3.0, category="other")
        s = calculate_deal_score(p)
        assert s == 3  # only category boost

    # ── THC potency (up to 15 pts) ─────────────────────────────────

    def test_thc_30_plus(self, make_product):
        p = make_product(discount_percent=0, brand="", sale_price=50.0,
                         category="other", thc_percent=32)
        s = calculate_deal_score(p)
        # 0 + 0 + 3 + 0 + 15 = 18
        assert s == 18

    def test_thc_25_to_29(self, make_product):
        p = make_product(discount_percent=0, brand="", sale_price=50.0,
                         category="other", thc_percent=27)
        s = calculate_deal_score(p)
        assert s == 13  # 3 + 10

    def test_thc_below_20(self, make_product):
        p = make_product(discount_percent=0, brand="", sale_price=50.0,
                         category="other", thc_percent=18)
        s = calculate_deal_score(p)
        assert s == 3  # only category boost

    # ── Total cap ──────────────────────────────────────────────────

    def test_score_capped_at_100(self, make_product):
        p = make_product(discount_percent=80, brand="Cookies", sale_price=20.0,
                         category="flower", thc_percent=35)
        s = calculate_deal_score(p)
        assert s <= 100


# =====================================================================
# passes_quality_gate
# =====================================================================


class TestPassesQualityGate:
    """Quality gate rejects incomplete / garbage deals."""

    def test_valid_deal_passes(self, make_product):
        p = make_product(name="Purple Punch 3.5g", brand="Cookies",
                         category="flower", weight_value=3.5)
        assert passes_quality_gate(p) is True

    def test_strain_only_name_rejected(self, make_product):
        for name in ("Hybrid", "indica", "SATIVA", "Thc"):
            p = make_product(name=name, brand="Cookies", category="vape",
                             weight_value=0.5)
            assert passes_quality_gate(p) is False, f"'{name}' should be rejected"

    def test_short_name_rejected(self, make_product):
        p = make_product(name="OG", brand="Cookies", category="flower",
                         weight_value=3.5)
        assert passes_quality_gate(p) is False

    def test_name_equals_brand_rejected(self, make_product):
        p = make_product(name="Cookies", brand="Cookies", category="flower",
                         weight_value=3.5)
        assert passes_quality_gate(p) is False

    def test_flower_without_weight_rejected(self, make_product):
        p = make_product(name="Purple Punch", brand="Cookies",
                         category="flower", weight_value=None)
        assert passes_quality_gate(p) is False

    def test_vape_without_weight_rejected(self, make_product):
        p = make_product(name="Lemon Cake Cart", brand="STIIIZY",
                         category="vape", weight_value=None)
        assert passes_quality_gate(p) is False

    def test_edible_without_weight_passes(self, make_product):
        """Edibles don't always have standardized weights — allow them."""
        p = make_product(name="Gummy Bears", brand="Wyld",
                         category="edible", weight_value=None)
        assert passes_quality_gate(p) is True

    def test_brandless_deal_passes(self, make_product):
        """Deals without a brand should still pass if name is good."""
        p = make_product(name="Purple Punch 3.5g", brand=None,
                         category="flower", weight_value=3.5)
        assert passes_quality_gate(p) is True

    def test_unknown_name_rejected(self, make_product):
        p = make_product(name="Unknown", brand="Cookies",
                         category="flower", weight_value=3.5)
        assert passes_quality_gate(p) is False


# =====================================================================
# select_top_deals
# =====================================================================


class TestSelectTopDeals:
    """Top-200 selection with diversity constraints."""

    def test_empty_input(self):
        assert select_top_deals([]) == []

    def test_returns_at_most_100(self, scored_deals_pool):
        result = select_top_deals(scored_deals_pool)
        assert len(result) <= TARGET_DEAL_COUNT

    def test_brand_diversity_enforced(self, scored_deals_pool):
        result = select_top_deals(scored_deals_pool)
        # Only check diversity for products WITH a detected brand.
        # Brandless products get unique keys so they are not constrained
        # by the per-brand cap — only per-dispensary limits apply.
        brand_counts = Counter(
            d["brand"] for d in result if d.get("brand")
        )
        for brand, count in brand_counts.items():
            assert count <= MAX_SAME_BRAND_TOTAL, \
                f"Brand '{brand}' has {count} deals (max {MAX_SAME_BRAND_TOTAL})"

    def test_dispensary_cap_enforced(self, scored_deals_pool):
        result = select_top_deals(scored_deals_pool)
        disp_counts = Counter(d.get("dispensary_id", "") for d in result)
        for disp, count in disp_counts.items():
            assert count <= MAX_SAME_DISPENSARY_TOTAL, \
                f"Dispensary '{disp}' has {count} deals (max {MAX_SAME_DISPENSARY_TOTAL})"

    def test_small_pool_returns_all(self, make_product):
        small = [
            make_product(name=f"P{i}", brand=f"B{i}", dispensary_id=f"D{i}",
                         category="flower", deal_score=50 + i)
            for i in range(10)
        ]
        result = select_top_deals(small)
        assert len(result) == 10

    def test_all_same_brand_capped(self, make_product):
        deals = [
            make_product(name=f"P{i}", brand="Cookies", dispensary_id=f"D{i}",
                         category="flower", deal_score=80 - i)
            for i in range(50)
        ]
        result = select_top_deals(deals)
        assert len(result) <= MAX_SAME_BRAND_TOTAL

    def test_all_same_dispensary_capped(self, make_product):
        deals = [
            make_product(name=f"P{i}", brand=f"B{i}", dispensary_id="planet13",
                         category="flower", deal_score=80 - i)
            for i in range(50)
        ]
        result = select_top_deals(deals)
        assert len(result) <= MAX_SAME_DISPENSARY_TOTAL


# =====================================================================
# detect_deals (full pipeline)
# =====================================================================


class TestDetectDeals:
    """End-to-end pipeline: filter → score → select."""

    def test_happy_path(self, make_product):
        products = []
        for i in range(50):
            products.append(make_product(
                name=f"Product {i}",
                brand=f"Brand{i % 10}",
                category="flower",
                sale_price=15.0,
                original_price=30.0,
                discount_percent=50,
                weight_value=3.5,
                dispensary_id=f"disp{i % 8}",
            ))
        result = detect_deals(products)
        assert len(result) > 0
        assert all("deal_score" in d for d in result)

    def test_no_qualifying_deals(self, make_product):
        products = [make_product(sale_price=0, discount_percent=0) for _ in range(10)]
        result = detect_deals(products)
        assert result == []

    def test_report_data_stored(self, make_product):
        products = [make_product(
            name=f"P{i}", brand=f"B{i}", dispensary_id=f"D{i}",
            sale_price=15.0, original_price=30.0, discount_percent=50,
            category="flower", weight_value=3.5,
        ) for i in range(5)]
        detect_deals(products)
        report = get_last_report_data()
        assert report["total_products"] == 5
        assert report["passed_hard_filter"] > 0
        assert "top_deals" in report

    def test_all_returned_have_deal_score(self, make_product):
        products = [make_product(
            name=f"P{i}", brand=f"B{i}", dispensary_id=f"D{i}",
            sale_price=15.0, original_price=30.0, discount_percent=50,
            category="flower", weight_value=3.5,
        ) for i in range(20)]
        result = detect_deals(products)
        for deal in result:
            assert "deal_score" in deal
            assert deal["deal_score"] > 0


# =====================================================================
# Constants validation
# =====================================================================


class TestConstants:

    def test_category_targets_sum_to_target(self):
        assert sum(CATEGORY_TARGETS.values()) == TARGET_DEAL_COUNT

    def test_premium_brands_are_strings(self):
        for b in PREMIUM_BRANDS:
            assert isinstance(b, str) and len(b) > 0

    def test_category_price_caps_complete(self):
        expected = {"flower", "vape", "edible", "concentrate", "preroll", "preroll_pack"}
        assert expected == set(CATEGORY_PRICE_CAPS.keys())

    def test_flower_caps_all_weights(self):
        flower = CATEGORY_PRICE_CAPS["flower"]
        assert isinstance(flower, dict)
        for key in ("3.5", "7", "14", "28"):
            assert key in flower

    def test_badge_thresholds_ordered(self):
        assert BADGE_THRESHOLDS["steal"] > BADGE_THRESHOLDS["fire"]
        assert BADGE_THRESHOLDS["fire"] > BADGE_THRESHOLDS["solid"]
