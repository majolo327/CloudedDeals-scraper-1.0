"""Tests for deal_detector.py — hard filters, scoring, quality gate, dedup, top-200 selection."""

from __future__ import annotations

from collections import Counter

import pytest

from deal_detector import (
    BADGE_THRESHOLDS,
    BRAND_TIERS,
    CATEGORY_PRICE_CAPS,
    CATEGORY_TARGETS,
    HARD_FILTERS,
    MAX_SAME_BRAND_PER_DISPENSARY,
    MAX_SAME_BRAND_TOTAL,
    MAX_SAME_DISPENSARY_TOTAL,
    PREMIUM_BRANDS,
    TARGET_DEAL_COUNT,
    _score_brand,
    _score_unit_value,
    calculate_deal_score,
    detect_deals,
    get_last_report_data,
    passes_hard_filters,
    passes_quality_gate,
    remove_similar_deals,
    select_top_deals,
)


# =====================================================================
# passes_hard_filters
# =====================================================================


class TestPassesHardFilters:
    """Hard filter gate: products must pass to enter scoring."""

    # ── Infused pre-rolls are now ALLOWED ────────────────────────────

    def test_infused_now_allowed(self, make_product):
        """Infused pre-rolls are popular products — they should pass."""
        p = make_product(is_infused=True, category="preroll",
                         sale_price=8.0, original_price=20.0,
                         discount_percent=60)
        assert passes_hard_filters(p) is True

    def test_infused_subtype_now_allowed(self, make_product):
        p = make_product(product_subtype="infused_preroll",
                         category="preroll",
                         sale_price=8.0, original_price=20.0,
                         discount_percent=60)
        assert passes_hard_filters(p) is True

    def test_preroll_pack_still_excluded(self, make_product):
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
        p = make_product(sale_price=101.0)
        assert passes_hard_filters(p) is False

    def test_at_max_price_passes(self, make_product):
        p = make_product(sale_price=100.0, original_price=100.0,  # doesn't pass orig > sale
                         discount_percent=20)
        # original_price must be > sale_price, so this should fail
        assert passes_hard_filters(p) is False

    def test_below_min_discount_rejected(self, make_product):
        p = make_product(discount_percent=14)
        assert passes_hard_filters(p) is False

    def test_at_min_discount_passes(self, make_product):
        """15% discount is now the minimum (relaxed from 20%)."""
        p = make_product(sale_price=15.0, original_price=30.0, discount_percent=15,
                         category="flower", weight_value=3.5)
        assert passes_hard_filters(p) is True

    def test_fake_discount_rejected(self, make_product):
        """Discounts over 85% are almost always data errors."""
        p = make_product(sale_price=5.0, original_price=60.0, discount_percent=92,
                         category="flower", weight_value=3.5)
        assert passes_hard_filters(p) is False

    def test_no_discount_rejected(self, make_product):
        p = make_product(discount_percent=0)
        assert passes_hard_filters(p) is False

    def test_no_original_price_rejected(self, make_product):
        p = make_product(original_price=0)
        assert passes_hard_filters(p) is False

    def test_original_equals_sale_rejected(self, make_product):
        p = make_product(sale_price=15.0, original_price=15.0)
        assert passes_hard_filters(p) is False

    # ── Flower weight-based caps (relaxed) ───────────────────────────

    def test_flower_35g_at_cap(self, make_product):
        p = make_product(category="flower", sale_price=25.0, original_price=50.0,
                         discount_percent=50, weight_value=3.5)
        assert passes_hard_filters(p) is True

    def test_flower_35g_over_cap(self, make_product):
        p = make_product(category="flower", sale_price=26.0, original_price=50.0,
                         discount_percent=48, weight_value=3.5)
        assert passes_hard_filters(p) is False

    def test_flower_7g_at_cap(self, make_product):
        p = make_product(category="flower", sale_price=45.0, original_price=90.0,
                         discount_percent=50, weight_value=7)
        assert passes_hard_filters(p) is True

    def test_flower_7g_over_cap(self, make_product):
        p = make_product(category="flower", sale_price=46.0, original_price=90.0,
                         discount_percent=49, weight_value=7)
        assert passes_hard_filters(p) is False

    def test_flower_14g_at_cap(self, make_product):
        p = make_product(category="flower", sale_price=65.0, original_price=100.0,
                         discount_percent=35, weight_value=14)
        assert passes_hard_filters(p) is True

    def test_flower_no_weight_uses_35g_default(self, make_product):
        p = make_product(category="flower", sale_price=26.0, original_price=50.0,
                         discount_percent=48, weight_value=None)
        assert passes_hard_filters(p) is False  # > $25 default cap

    # ── Flat-cap categories (relaxed) ────────────────────────────────

    def test_vape_at_cap(self, make_product):
        p = make_product(category="vape", sale_price=35.0, original_price=70.0,
                         discount_percent=50)
        assert passes_hard_filters(p) is True

    def test_vape_over_cap(self, make_product):
        p = make_product(category="vape", sale_price=36.0, original_price=70.0,
                         discount_percent=49)
        assert passes_hard_filters(p) is False

    def test_edible_at_cap(self, make_product):
        p = make_product(category="edible", sale_price=15.0, original_price=30.0,
                         discount_percent=50)
        assert passes_hard_filters(p) is True

    def test_edible_over_cap(self, make_product):
        p = make_product(category="edible", sale_price=16.0, original_price=32.0,
                         discount_percent=50)
        assert passes_hard_filters(p) is False

    def test_concentrate_at_cap(self, make_product):
        p = make_product(category="concentrate", sale_price=35.0, original_price=70.0,
                         discount_percent=50)
        assert passes_hard_filters(p) is True

    def test_preroll_at_cap(self, make_product):
        p = make_product(category="preroll", sale_price=10.0, original_price=20.0,
                         discount_percent=50)
        assert passes_hard_filters(p) is True

    def test_preroll_over_cap(self, make_product):
        p = make_product(category="preroll", sale_price=11.0, original_price=20.0,
                         discount_percent=45)
        assert passes_hard_filters(p) is False

    # ── Unknown category ───────────────────────────────────────────

    def test_unknown_category_under_50(self, make_product):
        p = make_product(category="other", sale_price=49.0, original_price=80.0,
                         discount_percent=39)
        assert passes_hard_filters(p) is True

    def test_unknown_category_over_50(self, make_product):
        p = make_product(category="other", sale_price=51.0, original_price=80.0,
                         discount_percent=36)
        assert passes_hard_filters(p) is False

    # ── Fallback to current_price ──────────────────────────────────

    def test_current_price_fallback(self, make_product):
        p = make_product(category="preroll", sale_price=None, original_price=20.0,
                         discount_percent=50)
        p["current_price"] = 5.0
        p.pop("sale_price")
        assert passes_hard_filters(p) is True


# =====================================================================
# Brand scoring
# =====================================================================


class TestBrandScoring:
    """Two-tier brand system: premium (20 pts), popular (12 pts), any (5 pts)."""

    def test_premium_brand(self):
        assert _score_brand("Cookies") == 20

    def test_premium_brand_case_insensitive(self):
        assert _score_brand("STIIIZY") == 20
        assert _score_brand("stiiizy") == 20

    def test_popular_brand(self):
        assert _score_brand("Rove") == 12

    def test_known_but_not_tiered_brand(self):
        assert _score_brand("SomeBrand") == 5

    def test_no_brand(self):
        assert _score_brand("") == 0

    def test_substring_match(self):
        """Compound brand names like 'Alien Labs Cannabis' should match."""
        assert _score_brand("Alien Labs Cannabis") == 20


# =====================================================================
# Unit value scoring
# =====================================================================


class TestUnitValueScoring:
    """Unit economics scoring: $/g, $/100mg, $/unit."""

    def test_flower_great_value(self):
        # $10 / 3.5g = $2.86/g → 15 pts
        assert _score_unit_value("flower", 10.0, 3.5) == 15

    def test_flower_good_value(self):
        # $15 / 3.5g = $4.29/g → 12 pts
        assert _score_unit_value("flower", 15.0, 3.5) == 12

    def test_flower_ok_value(self):
        # $20 / 3.5g = $5.71/g → 8 pts
        assert _score_unit_value("flower", 20.0, 3.5) == 8

    def test_edible_great_value(self):
        # $5 / 100mg = $5/100mg → 15 pts
        assert _score_unit_value("edible", 5.0, 100) == 15

    def test_edible_good_value(self):
        # $7 / 100mg = $7/100mg → 10 pts
        assert _score_unit_value("edible", 7.0, 100) == 10

    def test_vape_great_value(self):
        # $12 / 1g = $12/g → 15 pts
        assert _score_unit_value("vape", 12.0, 1.0) == 15

    def test_vape_good_value(self):
        # $20 / 1g = $20/g → 10 pts
        assert _score_unit_value("vape", 20.0, 1.0) == 10

    def test_preroll_great_value(self):
        # $4 preroll → 15 pts
        assert _score_unit_value("preroll", 4.0, 1.0) == 15

    def test_no_weight_returns_zero(self):
        assert _score_unit_value("flower", 15.0, None) == 0
        assert _score_unit_value("flower", 15.0, 0) == 0


# =====================================================================
# calculate_deal_score
# =====================================================================


class TestCalculateDealScore:
    """Scoring: 0-100 composite from discount, savings, brand, unit value,
    category, and price attractiveness."""

    def test_high_discount_premium_brand(self, make_product):
        """STIIIZY pod 1g, $20→$12, 40% off should score high."""
        p = make_product(
            discount_percent=40, brand="STIIIZY",
            sale_price=12.0, original_price=20.0,
            category="vape", weight_value=1.0,
        )
        s = calculate_deal_score(p)
        # 28 (discount) + 3 (saved) + 20 (brand) + 15 (unit) + 8 (cat) + 12 (price) = 86
        assert s >= 80

    def test_mediocre_unknown_brand(self, make_product):
        """Unknown brand, 15% off, no weight → low score."""
        p = make_product(
            discount_percent=15, brand="",
            sale_price=50.0, original_price=59.0,
            category="other", weight_value=None,
        )
        s = calculate_deal_score(p)
        # 7 (discount) + 3 (saved) + 0 (brand) + 0 (unit) + 3 (cat) + 0 (price) = 13
        assert s < 30

    def test_discount_50_pct(self, make_product):
        """50%+ discount should get max discount points (35)."""
        p = make_product(discount_percent=50, brand="", sale_price=10.0,
                         original_price=20.0, category="other",
                         weight_value=None)
        s = calculate_deal_score(p)
        # 35 (discount) + 4 (saved) + 0 (brand) + 0 (unit) + 3 (cat) + 12 (price) = 54
        assert s >= 50

    def test_popular_brand_scores_between_premium_and_none(self, make_product):
        p_premium = make_product(discount_percent=30, brand="Cookies",
                                 sale_price=15.0, original_price=30.0,
                                 category="flower", weight_value=3.5)
        p_popular = make_product(discount_percent=30, brand="Rove",
                                 sale_price=15.0, original_price=30.0,
                                 category="flower", weight_value=3.5)
        p_unknown = make_product(discount_percent=30, brand="NoName",
                                 sale_price=15.0, original_price=30.0,
                                 category="flower", weight_value=3.5)
        s_premium = calculate_deal_score(p_premium)
        s_popular = calculate_deal_score(p_popular)
        s_unknown = calculate_deal_score(p_unknown)
        assert s_premium > s_popular > s_unknown

    # ── Score cap ──────────────────────────────────────────────────

    def test_score_capped_at_100(self, make_product):
        p = make_product(discount_percent=80, brand="Cookies", sale_price=12.0,
                         original_price=60.0, category="flower", weight_value=3.5)
        s = calculate_deal_score(p)
        assert s <= 100

    # ── Category boosts are fair ─────────────────────────────────

    @pytest.mark.parametrize("category,boost", [
        ("flower", 8), ("vape", 8), ("edible", 8),
        ("concentrate", 7), ("preroll", 7),
    ])
    def test_category_boosts(self, make_product, category, boost):
        p = make_product(discount_percent=0, brand="", sale_price=50.0,
                         original_price=None, category=category, weight_value=None)
        # With 0 discount + no brand + no weight + $50 price, only cat boost applies
        # discount=0 → rejected by hard filter, but score function doesn't check that
        s = calculate_deal_score(p)
        assert s >= boost  # at minimum the category boost is included


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

    def test_brandless_deal_rejected(self, make_product):
        """Deals without a detected brand should be rejected — we never
        want to show 'UNKNOWN' brand cards to users."""
        p = make_product(name="Purple Punch 3.5g", brand=None,
                         category="flower", weight_value=3.5)
        assert passes_quality_gate(p) is False

    def test_unknown_name_rejected(self, make_product):
        p = make_product(name="Unknown", brand="Cookies",
                         category="flower", weight_value=3.5)
        assert passes_quality_gate(p) is False


# =====================================================================
# remove_similar_deals
# =====================================================================


class TestRemoveSimilarDeals:
    """Similarity dedup: max 3 per brand+category per dispensary."""

    def test_caps_same_brand_cat_dispo(self, make_product):
        """5 Stiiizy vapes from Planet 13 → only 3 kept."""
        deals = [
            make_product(name=f"STIIIZY Pod {i}", brand="STIIIZY",
                         category="vape", dispensary_id="planet13",
                         deal_score=80 - i)
            for i in range(5)
        ]
        result = remove_similar_deals(deals)
        assert len(result) == MAX_SAME_BRAND_PER_DISPENSARY

    def test_different_dispensaries_not_capped(self, make_product):
        """Same brand+cat at different dispensaries should all pass."""
        deals = [
            make_product(name=f"STIIIZY Pod {i}", brand="STIIIZY",
                         category="vape", dispensary_id=f"dispo{i}",
                         deal_score=80)
            for i in range(5)
        ]
        result = remove_similar_deals(deals)
        assert len(result) == 5

    def test_different_categories_not_capped(self, make_product):
        """Same brand at same dispensary but different categories should all pass."""
        deals = [
            make_product(name="Cookies Flower", brand="Cookies",
                         category="flower", dispensary_id="planet13",
                         deal_score=80),
            make_product(name="Cookies Preroll", brand="Cookies",
                         category="preroll", dispensary_id="planet13",
                         deal_score=75),
            make_product(name="Cookies Vape", brand="Cookies",
                         category="vape", dispensary_id="planet13",
                         deal_score=70),
        ]
        result = remove_similar_deals(deals)
        assert len(result) == 3

    def test_keeps_highest_scored(self, make_product):
        """Should keep the highest-scored entries from each group (top 2 per brand+cat+dispo)."""
        deals = [
            make_product(name=f"P{i}", brand="STIIIZY", category="vape",
                         dispensary_id="planet13", deal_score=90 - i * 5)
            for i in range(5)
        ]
        result = remove_similar_deals(deals)
        scores = [d["deal_score"] for d in result]
        assert scores == [90, 85]


# =====================================================================
# select_top_deals
# =====================================================================


class TestSelectTopDeals:
    """Top-200 selection with diversity constraints."""

    def test_empty_input(self):
        assert select_top_deals([]) == []

    def test_returns_at_most_target(self, scored_deals_pool):
        result = select_top_deals(scored_deals_pool)
        assert len(result) <= TARGET_DEAL_COUNT

    def test_brand_diversity_enforced(self, scored_deals_pool):
        result = select_top_deals(scored_deals_pool)
        # The scored_deals_pool fixture has limited dispensaries (8) which
        # triggers backfill with relaxed caps.  Check against backfill cap.
        from deal_detector import _BACKFILL_BRAND_TOTAL
        brand_counts = Counter(
            d["brand"] for d in result if d.get("brand")
        )
        for brand, count in brand_counts.items():
            assert count <= _BACKFILL_BRAND_TOTAL, \
                f"Brand '{brand}' has {count} deals (max {_BACKFILL_BRAND_TOTAL})"

    def test_dispensary_cap_enforced(self, scored_deals_pool):
        result = select_top_deals(scored_deals_pool)
        # The scored_deals_pool fixture triggers backfill — check relaxed cap.
        from deal_detector import _BACKFILL_DISPENSARY_TOTAL
        disp_counts = Counter(d.get("dispensary_id", "") for d in result)
        for disp, count in disp_counts.items():
            assert count <= _BACKFILL_DISPENSARY_TOTAL, \
                f"Dispensary '{disp}' has {count} deals (max {_BACKFILL_DISPENSARY_TOTAL})"

    def test_small_pool_returns_all(self, make_product):
        small = [
            make_product(name=f"P{i}", brand=f"B{i}", dispensary_id=f"D{i}",
                         category="flower", deal_score=50 + i)
            for i in range(10)
        ]
        result = select_top_deals(small)
        assert len(result) == 10

    def test_all_same_brand_capped(self, make_product):
        # When all deals are one brand, round 1 under-fills → backfill
        # kicks in with relaxed cap.
        from deal_detector import _BACKFILL_BRAND_TOTAL
        deals = [
            make_product(name=f"P{i}", brand="Cookies", dispensary_id=f"D{i}",
                         category="flower", deal_score=80 - i)
            for i in range(50)
        ]
        result = select_top_deals(deals)
        assert len(result) <= _BACKFILL_BRAND_TOTAL

    def test_all_same_dispensary_capped(self, make_product):
        # When all deals are one dispensary, round 1 under-fills → backfill
        # kicks in with relaxed cap.
        from deal_detector import _BACKFILL_DISPENSARY_TOTAL
        deals = [
            make_product(name=f"P{i}", brand=f"B{i}", dispensary_id="planet13",
                         category="flower", deal_score=80 - i)
            for i in range(50)
        ]
        result = select_top_deals(deals)
        assert len(result) <= _BACKFILL_DISPENSARY_TOTAL

    def test_tight_caps_when_pool_is_ample(self, make_product):
        """When the pool is diverse enough, round 1 fills > 85% and tight caps apply."""
        deals = []
        brands = [f"Brand{i}" for i in range(40)]
        dispensaries = [f"Dispo{i}" for i in range(25)]
        categories = ["flower", "vape", "edible", "concentrate", "preroll"]
        score = 90
        for cat in categories:
            for i, brand in enumerate(brands):
                for j in range(3):
                    disp = dispensaries[(i + j) % len(dispensaries)]
                    deals.append(make_product(
                        name=f"{brand} {cat} {j}",
                        brand=brand,
                        category=cat,
                        dispensary_id=disp,
                        deal_score=max(20, score - i - j),
                    ))
        result = select_top_deals(deals)
        # With 40 brands × 5 cats × 3 = 600 deals, 25 dispensaries,
        # round 1 should fill fine and tight caps should hold.
        brand_counts = Counter(d["brand"] for d in result if d.get("brand"))
        for brand, count in brand_counts.items():
            assert count <= MAX_SAME_BRAND_TOTAL, \
                f"Brand '{brand}' has {count} deals (max {MAX_SAME_BRAND_TOTAL})"


# =====================================================================
# detect_deals (full pipeline)
# =====================================================================


class TestDetectDeals:
    """End-to-end pipeline: filter → score → dedup → select."""

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

    def test_similarity_dedup_in_pipeline(self, make_product):
        """Pipeline should dedup 10 same brand+cat+dispo down to 3."""
        products = [make_product(
            name=f"STIIIZY Pod {i}", brand="STIIIZY",
            dispensary_id="planet13", category="vape",
            sale_price=12.0, original_price=25.0,
            discount_percent=52, weight_value=1.0,
        ) for i in range(10)]
        result = detect_deals(products)
        assert len(result) <= MAX_SAME_BRAND_PER_DISPENSARY


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

    def test_brand_tiers_exist(self):
        assert "premium" in BRAND_TIERS
        assert "popular" in BRAND_TIERS
        assert BRAND_TIERS["premium"]["points"] > BRAND_TIERS["popular"]["points"]

    def test_hard_filters_has_max_discount(self):
        assert "max_discount_percent" in HARD_FILTERS
        assert HARD_FILTERS["max_discount_percent"] <= 90
