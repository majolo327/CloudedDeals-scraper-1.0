"""Tests for clouded_logic.py — the core business logic module.

Covers: category detection, weight validation (.35g bug), edible normalization,
brand detection, text cleaning, product parsing, qualification, and scoring.
"""

from __future__ import annotations

import pytest

from clouded_logic import (
    BRANDS,
    DISPENSARIES,
    PRICE_CAPS,
    PRICE_CAP_GLOBAL,
    CloudedLogic,
)


# =====================================================================
# Category Detection (order-dependent — most critical tests)
# =====================================================================


class TestDetectCategory:
    """Validates the strict category detection ordering in CloudedLogic."""

    # ── Skip products ──────────────────────────────────────────────

    @pytest.mark.parametrize("text,expected", [
        ("RSO Syringe 1g", "skip"),
        ("CBD Tincture 30ml", "skip"),
        ("Topical Cream", "skip"),
        ("THC Capsule 10mg", "skip"),
        ("Merch T-Shirt", "skip"),
    ])
    def test_skip_products(self, logic, text, expected):
        assert logic.detect_category(text) == expected

    # ── Drinks → edible (checked before preroll) ───────────────────

    @pytest.mark.parametrize("text", [
        "Drink Loud Pink Lemonade 100mg",
        "Cannabis Shot 50mg",
        "Infused Beverage",
    ])
    def test_drinks_are_edible(self, logic, text):
        assert logic.detect_category(text) == "edible"

    # ── Preroll ────────────────────────────────────────────────────

    @pytest.mark.parametrize("text", [
        "Preroll Joint 1g",
        "Dogwalker Indica 1g",
        "Infused Blunt 1.5g",
        "Diamond Infused Preroll 1g",
        "1G | LV Kush Cake BaM Hybrid 10 PR's - $50",
        "1g | Cotton Kandy Grapes BaM Hybrid 10 PRs - $50",
        "1g | GMO Sherbert Jasper Indica-Hybrid 10 PR's - $50",
    ])
    def test_preroll(self, logic, text):
        assert logic.detect_category(text) == "preroll"

    # ── Concentrate (requires keyword AND weight) ──────────────────

    def test_concentrate_keyword_and_weight(self, logic):
        assert logic.detect_category("AMA Live Resin 1.0g") == "concentrate"

    def test_concentrate_keyword_without_weight_not_concentrate(self, logic):
        """Concentrate keywords alone should NOT trigger concentrate."""
        result = logic.detect_category("Live Resin")
        assert result != "concentrate"

    def test_concentrate_badder_with_weight(self, logic):
        assert logic.detect_category("City Trees Badder 1g") == "concentrate"

    def test_live_resin_cart_is_vape_not_concentrate(self, logic):
        """'Live Resin Cart 0.5g' has concentrate keywords + weight but
        the vape keyword 'cart' should take priority."""
        assert logic.detect_category("AMA Live Resin Cart 0.5g") == "vape"

    def test_live_resin_pod_is_vape_not_concentrate(self, logic):
        """'Live Resin Pod 1g' — pod keyword = vape, not concentrate."""
        assert logic.detect_category("STIIIZY Live Resin Pod 1g") == "vape"

    def test_live_resin_without_vape_keyword_is_concentrate(self, logic):
        """'AMA Live Resin 1g' — no vape keyword = concentrate."""
        assert logic.detect_category("AMA Live Resin 1g") == "concentrate"

    def test_shatter_is_concentrate_not_vape(self, logic):
        """Shatter with weight and no vape keywords = concentrate."""
        assert logic.detect_category(
            "Orange Push Pop .5g Shatter Medizin Hybrid 2g For $30 .5g Shatter (.5g)"
        ) == "concentrate"

    # ── Flower by weight (BEFORE vape) ─────────────────────────────

    @pytest.mark.parametrize("text,expected", [
        ("Cookies Gary Payton 3.5g", "flower"),
        ("Quarter OG Kush 7g", "flower"),
        ("Half Oz Smalls 14g", "flower"),
        ("Full Oz 28g", "flower"),
    ])
    def test_flower_by_weight(self, logic, text, expected):
        assert logic.detect_category(text) == expected

    def test_flower_weight_prevents_false_vape(self, logic):
        """'Aspen OG 3.5g' — 'pen' inside 'Aspen' must NOT trigger vape."""
        assert logic.detect_category("Aspen OG 3.5g") == "flower"

    # ── Vape ───────────────────────────────────────────────────────

    @pytest.mark.parametrize("text", [
        "Rove Cart 0.5g",
        "STIIIZY Pod 0.5g",
        "Disposable Pen 0.3g",
        "Select Essentials Pod 0.5g",
        "STIIIZY All In One Live Resin 0.5g",
        "Strawberry AIO Pen 1g",
        "Ready To Use Vape Pen 0.5g",
        "Ready-To-Use Live Resin 0.5g",
        "All-In-One Disposable 0.3g",
    ])
    def test_vape(self, logic, text):
        assert logic.detect_category(text) == "vape"

    def test_vape_suppressed_by_edible_keywords(self, logic):
        """If text has both cart and gummies, edible wins (not vape)."""
        # "cart" triggers vape check, but "gummies" suppresses it
        assert logic.detect_category("cart gummies 100mg") != "vape"

    # ── Flower by keyword ──────────────────────────────────────────

    @pytest.mark.parametrize("text", [
        "Premium Flower Smalls",
        "Eighth Shelf OG",
        "CAMP Flower Smalls 3.5g",
    ])
    def test_flower_by_keyword(self, logic, text):
        assert logic.detect_category(text) == "flower"

    # ── Edible ─────────────────────────────────────────────────────

    @pytest.mark.parametrize("text", [
        "Wyld Gummies 100mg",
        "Kiva Chocolate Bar",
    ])
    def test_edible(self, logic, text):
        assert logic.detect_category(text) == "edible"

    # ── Other (fallback) ───────────────────────────────────────────

    def test_other_fallback(self, logic):
        assert logic.detect_category("Random Accessory Thing") == "other"

    def test_empty_string(self, logic):
        assert logic.detect_category("") == "other"

    def test_none_input(self, logic):
        assert logic.detect_category(None) == "other"

    # ── Ordering edge cases ────────────────────────────────────────

    def test_preroll_before_concentrate(self, logic):
        """Infused preroll has resin keywords, but preroll is checked first."""
        assert logic.detect_category("Diamond Infused Preroll 1g") == "preroll"

    def test_drink_before_preroll(self, logic):
        """'shot' could be preroll-adjacent but drink is checked first."""
        assert logic.detect_category("Cannabis Shot") == "edible"


# =====================================================================
# Weight Validation — THE .35g BUG FIX
# =====================================================================


class TestValidateWeight:
    """The most critical test class: context-aware weight validation."""

    # ── Flower context ─────────────────────────────────────────────

    @pytest.mark.parametrize("weight_in,expected", [
        (".35g",  "3.5g"),   # THE .35g BUG FIX
        ("0.35g", "3.5g"),   # Same bug, explicit leading zero
        ("0.7g",  "7g"),     # Decimal-point drop: 0.7 → 7g
        ("3.5g",  "3.5g"),   # Normal eighth
        ("7g",    "7g"),     # Quarter
        ("14g",   "14g"),    # Half
        ("28g",   "28g"),    # Full oz
        ("0.5g",  "0.5g"),   # Valid lower bound
    ])
    def test_flower_weights(self, logic, weight_in, expected):
        assert logic.validate_weight(weight_in, "flower") == expected

    def test_flower_mg_rejected(self, logic):
        assert logic.validate_weight("100mg", "flower") is None

    # ── Vape context ───────────────────────────────────────────────

    @pytest.mark.parametrize("weight_in,expected", [
        ("0.35g",  "0.35g"),   # Small disposable IS valid for vapes
        ("0.5g",   "0.5g"),
        ("0.85g",  "0.85g"),   # STIIIZY pod size
        ("1g",     "1g"),
        ("2g",     "2g"),      # Upper boundary
    ])
    def test_vape_weights(self, logic, weight_in, expected):
        assert logic.validate_weight(weight_in, "vape") == expected

    def test_vape_over_2g_rejected(self, logic):
        assert logic.validate_weight("3g", "vape") is None

    def test_vape_under_03g_rejected(self, logic):
        assert logic.validate_weight("0.2g", "vape") is None

    def test_vape_mg_valid_range(self, logic):
        assert logic.validate_weight("500mg", "vape") == "500mg"

    def test_vape_mg_below_200_rejected(self, logic):
        assert logic.validate_weight("100mg", "vape") is None

    # ── Preroll context ────────────────────────────────────────────

    def test_preroll_1g_only(self, logic):
        assert logic.validate_weight("1g", "preroll") == "1g"

    @pytest.mark.parametrize("weight_in", ["0.5g", "1.5g", "2g"])
    def test_preroll_non_1g_rejected(self, logic, weight_in):
        assert logic.validate_weight(weight_in, "preroll") is None

    # ── Edible context ─────────────────────────────────────────────

    @pytest.mark.parametrize("weight_in,expected", [
        ("100mg", "100mg"),
        ("200mg", "200mg"),
        ("95mg",  "100mg"),  # Fuzzy 82-118 → 100mg
        ("82mg",  "100mg"),  # Lower bound
        ("118mg", "100mg"),  # Upper bound
        ("180mg", "200mg"),  # Fuzzy 180-220 → 200mg
        ("220mg", "200mg"),  # Upper bound
    ])
    def test_edible_mg_fuzzy(self, logic, weight_in, expected):
        assert logic.validate_weight(weight_in, "edible") == expected

    def test_edible_10mg_rejected(self, logic):
        """Single-dose too small."""
        assert logic.validate_weight("10mg", "edible") is None

    def test_edible_grams_rejected(self, logic):
        assert logic.validate_weight("3.5g", "edible") is None

    # ── Concentrate context ────────────────────────────────────────

    @pytest.mark.parametrize("weight_in,expected", [
        ("0.5g", "0.5g"),
        ("1g",   "1g"),
        ("2g",   "2g"),
    ])
    def test_concentrate_weights(self, logic, weight_in, expected):
        assert logic.validate_weight(weight_in, "concentrate") == expected

    def test_concentrate_3g_rejected(self, logic):
        assert logic.validate_weight("3g", "concentrate") is None

    def test_concentrate_03g_rejected(self, logic):
        assert logic.validate_weight("0.3g", "concentrate") is None

    # ── Edge cases ─────────────────────────────────────────────────

    def test_none_input(self, logic):
        assert logic.validate_weight(None, "flower") is None

    def test_empty_string(self, logic):
        assert logic.validate_weight("", "flower") is None

    def test_no_match(self, logic):
        assert logic.validate_weight("abc", "flower") is None


# =====================================================================
# Normalize Weight (edible mg fuzzy ranges)
# =====================================================================


class TestNormalizeWeight:

    @pytest.mark.parametrize("weight_in,expected", [
        ("100mg", "100mg"),
        ("200mg", "200mg"),
        ("95mg",  "100mg"),
        ("82mg",  "100mg"),
        ("118mg", "100mg"),
        ("180mg", "200mg"),
        ("220mg", "200mg"),
    ])
    def test_fuzzy_normalization(self, logic, weight_in, expected):
        assert logic.normalize_weight(weight_in) == expected

    def test_below_50mg_rejected(self, logic):
        assert logic.normalize_weight("10mg") is None

    def test_49mg_rejected(self, logic):
        assert logic.normalize_weight("49mg") is None

    def test_50mg_passthrough(self, logic):
        assert logic.normalize_weight("50mg") == "50mg"

    def test_grams_passthrough(self, logic):
        assert logic.normalize_weight("3.5g") == "3.5g"

    def test_none_passthrough(self, logic):
        assert logic.normalize_weight(None) is None

    def test_empty_passthrough(self, logic):
        assert logic.normalize_weight("") == ""


# =====================================================================
# Brand Detection
# =====================================================================


class TestDetectBrand:

    def test_exact_match(self, logic):
        assert logic.detect_brand("AMA Gary Peyton Live Resin 1.0g") == "AMA"

    def test_longest_match_wins(self, logic):
        assert logic.detect_brand("Kiva Lost Farm Gummies") == "Kiva Lost Farm"

    def test_case_insensitive(self, logic):
        assert logic.detect_brand("stiiizy pod") == "STIIIZY"

    def test_none_for_unknown(self, logic):
        assert logic.detect_brand("Random Unknown Product") is None

    def test_none_for_empty(self, logic):
        assert logic.detect_brand("") is None

    def test_none_for_none(self, logic):
        assert logic.detect_brand(None) is None

    def test_none_prefix_filtered(self, logic):
        """Text starting with 'none ' returns None."""
        assert logic.detect_brand("none Premium Flower") is None

    # ---- Word-boundary protection: prevent substring false positives ----

    def test_haze_not_in_hazel(self, logic):
        """'Haze' brand should NOT match inside 'Hazel'."""
        assert logic.detect_brand("Hazel Nut Flower 3.5g") is None

    def test_cake_not_in_cupcake(self, logic):
        """'Cake' brand should NOT match inside 'Cupcake'."""
        assert logic.detect_brand("Cupcake Twist Flower 3.5g") is None

    def test_raw_garden_not_in_strawberry(self, logic):
        """'Raw Garden' should NOT match from 'strawberry'."""
        assert logic.detect_brand("Strawberry Cough Flower 3.5g") is None

    def test_rove_standalone(self, logic):
        """'Rove' as a standalone word should match."""
        assert logic.detect_brand("Rove Featured Farms 1g Cart") == "Rove"

    def test_camp_not_in_compound(self, logic):
        """'CAMP' should NOT match inside 'Campfire'."""
        assert logic.detect_brand("Campfire OG 3.5g") is None

    # ---- Strain-name protection: common strains that contain brand words ----

    def test_wedding_cake_not_cake_brand(self, logic):
        """Wedding Cake is a strain, NOT the Cake brand."""
        assert logic.detect_brand("Wedding Cake Flower 3.5g") is None

    def test_ice_cream_cake_not_cake_brand(self, logic):
        """Ice Cream Cake is a strain, NOT the Cake brand."""
        assert logic.detect_brand("Ice Cream Cake Flower 3.5g") is None

    def test_birthday_cake_not_cake_brand(self, logic):
        """Birthday Cake is a strain, NOT the Cake brand."""
        assert logic.detect_brand("Birthday Cake Pre-Roll 1g") is None

    def test_ghost_train_haze_not_haze_brand(self, logic):
        """Ghost Train Haze is a strain, NOT the Haze brand."""
        assert logic.detect_brand("Ghost Train Haze 3.5g") is None

    def test_super_lemon_haze_not_haze_brand(self, logic):
        """Super Lemon Haze is a strain, NOT the Haze brand."""
        assert logic.detect_brand("Super Lemon Haze 3.5g") is None

    def test_purple_haze_not_haze_brand(self, logic):
        """Purple Haze is a strain, NOT the Haze brand."""
        assert logic.detect_brand("Purple Haze Flower 7g") is None

    def test_girl_scout_cookies_not_cookies_brand(self, logic):
        """Girl Scout Cookies is a strain, NOT the Cookies brand."""
        assert logic.detect_brand("Girl Scout Cookies 3.5g") is None

    def test_haze_brand_at_start_is_brand(self, logic):
        """'Haze' at the start of text IS the Haze brand."""
        assert logic.detect_brand("Haze Premium Flower 3.5g") == "Haze"

    def test_cake_brand_at_start_is_brand(self, logic):
        """'Cake' at the start of text IS the Cake brand."""
        assert logic.detect_brand("Cake She Hits Different 1g") == "Cake"

    def test_cookies_at_start_is_brand(self, logic):
        """'Cookies' at the start IS the Cookies brand."""
        assert logic.detect_brand("Cookies Gary Payton 3.5g") == "Cookies"

    def test_brand_with_another_brand_in_strain(self, logic):
        """When a real brand is present alongside a strain-embedded brand word,
        the real brand should win. E.g., '&shine Ghost Train Haze' → not Haze."""
        # &shine isn't in our brand DB, but if it were this test would verify
        # that Haze is blocked by the strain pattern
        result = logic.detect_brand("Ghost Train Haze 3.5g Flower")
        assert result != "Haze"

    def test_pound_cake_not_cake_brand(self, logic):
        """Pound Cake is a strain, NOT the Cake brand."""
        assert logic.detect_brand("Pound Cake Flower 3.5g") is None

    def test_lava_cake_not_cake_brand(self, logic):
        """Lava Cake is a strain, NOT the Cake brand."""
        assert logic.detect_brand("Lava Cake Indica 3.5g") is None

    # ---- PACKS brand false positive protection ----

    def test_ice_packs_not_packs_brand(self, logic):
        """'Infused Ice Packs' is a product form, NOT the PACKS brand."""
        assert logic.detect_brand("Peaches & Cream - Infused Ice Packs") != "PACKS"

    def test_variety_packs_not_packs_brand(self, logic):
        """'Variety Pack' is a product form, NOT the PACKS brand."""
        assert logic.detect_brand("Variety Pack Gummies 100mg") != "PACKS"

    def test_packs_brand_standalone(self, logic):
        """'PACKS' at start of text IS the PACKS brand."""
        assert logic.detect_brand("PACKS Premium Pre-Roll 1g") == "PACKS"


# =====================================================================
# Category detection — concentrate with fractional oz weight
# =====================================================================


class TestConcentrateWithOzWeight:
    """Concentrates listed with fractional oz should still be detected."""

    def test_concentrate_with_one_eighth_oz(self, logic):
        """Live Resin listed as 1/8oz should detect as concentrate."""
        assert logic.detect_category("AMA Live Resin 1/8oz") == "concentrate"

    def test_concentrate_with_one_eighth_oz_no_space(self, logic):
        assert logic.detect_category("Shatter 1/8oz") == "concentrate"


# =====================================================================
# Weight validation — oz-based inputs
# =====================================================================


class TestWeightValidationOz:
    """Fractional oz weights should be properly converted and validated."""

    def test_frac_oz_flower_weight(self, logic):
        """'3.5g' (from 1/8oz conversion) is valid flower weight."""
        assert logic.validate_weight("3.5g", "flower") == "3.5g"

    def test_frac_oz_concentrate_weight(self, logic):
        """'1g' concentrate weight from oz conversion."""
        assert logic.validate_weight("1g", "concentrate") == "1g"


# =====================================================================
# Clean Product Text
# =====================================================================


class TestCleanProductText:

    def test_removes_add_to_cart(self, logic):
        assert "Add to cart" not in logic.clean_product_text("Blue Dream 3.5g Add to cart")

    def test_removes_add_to_bag(self, logic):
        assert "Add to bag" not in logic.clean_product_text("Product Add to bag")

    def test_removes_trailing_indica(self, logic):
        result = logic.clean_product_text("OG Kush Indica")
        assert "Indica" not in result

    def test_removes_trailing_sativa(self, logic):
        result = logic.clean_product_text("Jack Herer Sativa")
        assert "Sativa" not in result

    def test_collapses_whitespace(self, logic):
        assert "  " not in logic.clean_product_text("Blue   Dream   3.5g")

    def test_none_returns_empty(self, logic):
        assert logic.clean_product_text(None) == ""

    def test_empty_returns_empty(self, logic):
        assert logic.clean_product_text("") == ""


# =====================================================================
# Clean Product Name
# =====================================================================


class TestCleanProductName:

    def test_removes_brand_prefix(self, logic):
        result = logic.clean_product_name("Cookies Gary Payton", brand="Cookies")
        assert result.startswith("Gary Payton")

    def test_removes_brand_with_dash(self, logic):
        result = logic.clean_product_name("Cookies - Gary Payton", brand="Cookies")
        assert "Cookies" not in result

    def test_truncates_over_60_chars(self, logic):
        long_name = "A" * 70
        result = logic.clean_product_name(long_name)
        assert len(result) <= 60

    def test_removes_duplicate_words(self, logic):
        result = logic.clean_product_name("Blue Blue Dream")
        assert result == "Blue Dream"

    def test_no_brand_keeps_name(self, logic):
        result = logic.clean_product_name("OG Kush 3.5g", brand=None)
        assert "OG Kush" in result


# =====================================================================
# Infused Preroll Check
# =====================================================================


class TestIsInfusedPreroll:

    @pytest.mark.parametrize("text", [
        "Diamond Infused Preroll",
        "Jeeter 40s Joint",
        "Caviar Gold Preroll",
        "Moon Rock Joint",
        "Kief Dusted Preroll",
        "Diamond Coated Joint",
    ])
    def test_infused_detected(self, logic, text):
        assert logic.is_infused_preroll(text) is True

    def test_regular_preroll_not_infused(self, logic):
        assert logic.is_infused_preroll("Regular Preroll 1g") is False

    def test_none_input(self, logic):
        assert logic.is_infused_preroll(None) is False

    def test_empty_string(self, logic):
        assert logic.is_infused_preroll("") is False


# =====================================================================
# Wyld Brand Check
# =====================================================================


class TestCheckForWyldBrand:

    def test_wyld_present(self, logic):
        assert logic.check_for_wyld_brand([{"brand": "Wyld"}]) is True

    def test_wyld_lowercase(self, logic):
        assert logic.check_for_wyld_brand([{"brand": "wyld"}]) is True

    def test_no_wyld(self, logic):
        assert logic.check_for_wyld_brand([{"brand": "Cookies"}]) is False

    def test_empty_list(self, logic):
        assert logic.check_for_wyld_brand([]) is False


# =====================================================================
# Full Product Parser
# =====================================================================


class TestParseProduct:

    def test_full_flower_product(self, logic):
        text = "Cookies Gary Payton 3.5g $45 $15 THC: 30%"
        p = logic.parse_product(text, "Planet13")
        assert p is not None
        assert p["category"] == "flower"
        assert p["brand"] == "Cookies"
        assert p["weight"] == "3.5g"
        assert p["deal_price"] == 15.0
        assert p["original_price"] == 45.0
        assert p["dispensary"] == "Planet13"

    def test_skip_product_returns_none(self, logic):
        assert logic.parse_product("RSO Syringe 1g $25 $40", "Test") is None

    def test_short_text_returns_none(self, logic):
        assert logic.parse_product("abc", "Test") is None

    def test_infused_preroll_tagged(self, logic):
        p = logic.parse_product("Diamond Infused Preroll 1g $10 $5", "Test")
        assert p is not None
        assert p["is_infused"] is True

    def test_strain_type_indica(self, logic):
        p = logic.parse_product("OG Kush (I) 3.5g $40 $15", "Test")
        assert p is not None
        assert p["strain_type"] == "Indica"

    def test_strain_type_sativa(self, logic):
        p = logic.parse_product("Jack Herer (S) 3.5g $40 $15", "Test")
        assert p is not None
        assert p["strain_type"] == "Sativa"

    def test_strain_type_hybrid(self, logic):
        p = logic.parse_product("Blue Dream (H) 3.5g $40 $15", "Test")
        assert p is not None
        assert p["strain_type"] == "Hybrid"

    def test_stats_incremented(self, logic):
        logic.parse_product("Cookies Gary Payton 3.5g $45 $15", "Test")
        assert logic.stats["parsed_flower"] >= 1


# =====================================================================
# Deal Qualification
# =====================================================================


class TestIsQualifying:

    def test_none_product_rejected(self, logic):
        assert logic.is_qualifying(None) is False

    def test_no_deal_price_rejected(self, logic):
        assert logic.is_qualifying({"deal_price": None}) is False

    def test_over_global_cap_rejected(self, logic):
        p = {"deal_price": 31, "category": "flower", "weight": "3.5g"}
        assert logic.is_qualifying(p) is False

    def test_at_global_cap(self, logic):
        """$30 is at the global cap — may still fail category caps."""
        p = {"deal_price": 30, "category": "flower", "weight": "3.5g",
             "discount_percent": 30}
        # flower_3.5g max is $22, so this should fail
        assert logic.is_qualifying(p) is False

    # ── Edible caps ────────────────────────────────────────────────

    def test_edible_min_price(self, logic):
        p = {"deal_price": 2.99, "category": "edible", "weight": "100mg",
             "discount_percent": 30}
        assert logic.is_qualifying(p) is False

    def test_edible_max_price(self, logic):
        p = {"deal_price": 9.01, "category": "edible", "weight": "100mg",
             "discount_percent": 30}
        assert logic.is_qualifying(p) is False

    def test_edible_valid(self, logic):
        p = {"deal_price": 5.0, "category": "edible", "weight": "100mg",
             "discount_percent": 30}
        assert logic.is_qualifying(p) is True

    def test_edible_only_100mg_200mg(self, logic):
        p = {"deal_price": 5.0, "category": "edible", "weight": "50mg",
             "discount_percent": 30}
        assert logic.is_qualifying(p) is False

    # ── Preroll caps ───────────────────────────────────────────────

    def test_preroll_min(self, logic):
        p = {"deal_price": 1.99, "category": "preroll", "discount_percent": 30}
        assert logic.is_qualifying(p) is False

    def test_preroll_max(self, logic):
        p = {"deal_price": 6.01, "category": "preroll", "discount_percent": 30}
        assert logic.is_qualifying(p) is False

    def test_preroll_valid(self, logic):
        p = {"deal_price": 4.0, "category": "preroll", "discount_percent": 30}
        assert logic.is_qualifying(p) is True

    # ── Vape caps ──────────────────────────────────────────────────

    def test_vape_min(self, logic):
        p = {"deal_price": 9.99, "category": "vape", "discount_percent": 30}
        assert logic.is_qualifying(p) is False

    def test_vape_max(self, logic):
        p = {"deal_price": 25.01, "category": "vape", "discount_percent": 30}
        assert logic.is_qualifying(p) is False

    def test_vape_valid(self, logic):
        p = {"deal_price": 15.0, "category": "vape", "discount_percent": 30}
        assert logic.is_qualifying(p) is True

    # ── Flower weight-based caps ───────────────────────────────────

    def test_flower_35g_valid(self, logic):
        p = {"deal_price": 15.0, "category": "flower", "weight": "3.5g",
             "discount_percent": 30}
        assert logic.is_qualifying(p) is True

    def test_flower_35g_over_cap(self, logic):
        p = {"deal_price": 23.0, "category": "flower", "weight": "3.5g",
             "discount_percent": 30}
        assert logic.is_qualifying(p) is False

    def test_flower_7g_valid(self, logic):
        p = {"deal_price": 25.0, "category": "flower", "weight": "7g",
             "discount_percent": 30}
        assert logic.is_qualifying(p) is True

    def test_flower_14g_valid(self, logic):
        p = {"deal_price": 40.0, "category": "flower", "weight": "14g",
             "discount_percent": 30}
        # $40 > global cap $30, so fails global check first
        assert logic.is_qualifying(p) is False

    def test_flower_no_weight_defaults_35g(self, logic):
        p = {"deal_price": 15.0, "category": "flower", "weight": "",
             "discount_percent": 30}
        assert logic.is_qualifying(p) is True

    # ── Concentrate caps ───────────────────────────────────────────

    def test_concentrate_only_1g(self, logic):
        p = {"deal_price": 15.0, "category": "concentrate", "weight": "0.5g",
             "discount_percent": 30}
        assert logic.is_qualifying(p) is False

    def test_concentrate_valid(self, logic):
        p = {"deal_price": 15.0, "category": "concentrate", "weight": "1g",
             "discount_percent": 30}
        assert logic.is_qualifying(p) is True

    # ── Other category always rejected ─────────────────────────────

    def test_other_category_rejected(self, logic):
        p = {"deal_price": 10.0, "category": "other", "discount_percent": 30}
        assert logic.is_qualifying(p) is False

    # ── Discount bounds ────────────────────────────────────────────

    def test_discount_below_20_rejected(self, logic):
        p = {"deal_price": 15.0, "category": "flower", "weight": "3.5g",
             "discount_percent": 19}
        assert logic.is_qualifying(p) is False

    def test_discount_above_75_rejected(self, logic):
        p = {"deal_price": 15.0, "category": "flower", "weight": "3.5g",
             "discount_percent": 76}
        assert logic.is_qualifying(p) is False

    def test_discount_exactly_20_passes(self, logic):
        p = {"deal_price": 15.0, "category": "flower", "weight": "3.5g",
             "discount_percent": 20}
        assert logic.is_qualifying(p) is True

    def test_discount_exactly_75_passes(self, logic):
        p = {"deal_price": 15.0, "category": "flower", "weight": "3.5g",
             "discount_percent": 75}
        assert logic.is_qualifying(p) is True

    def test_discount_none_passes(self, logic):
        """No discount data means the discount check is skipped."""
        p = {"deal_price": 15.0, "category": "flower", "weight": "3.5g",
             "discount_percent": None}
        assert logic.is_qualifying(p) is True


# =====================================================================
# Deal Scoring
# =====================================================================


class TestScoreDeal:

    def test_score_components(self, logic):
        p = {"discount_percent": 50, "deal_price": 10, "savings": 20}
        score = logic.score_deal(p)
        # discount: min(40, 50*0.67)=33.5, price: max(0,30-10)=20, savings: min(20,20)=20
        assert score == round(33.5 + 20 + 20, 1)

    def test_max_discount_capped_at_40(self, logic):
        p = {"discount_percent": 70, "deal_price": 30, "savings": 0}
        score = logic.score_deal(p)
        # discount: min(40, 70*0.67)=min(40,46.9)=40, price: 0, savings: 0
        assert score == 40.0

    def test_price_bonus(self, logic):
        p = {"discount_percent": 0, "deal_price": 10, "savings": 0}
        score = logic.score_deal(p)
        # discount: 0, price: 20, savings: 0
        assert score == 20.0

    def test_savings_capped_at_20(self, logic):
        p = {"discount_percent": 0, "deal_price": 30, "savings": 30}
        score = logic.score_deal(p)
        # discount: 0, price: 0, savings: min(20,30)=20
        assert score == 20.0

    def test_zero_discount(self, logic):
        p = {"discount_percent": 0, "deal_price": 30, "savings": 0}
        assert logic.score_deal(p) == 0.0

    def test_defaults_when_missing(self, logic):
        """Missing keys default to safe values, no crash."""
        score = logic.score_deal({})
        assert isinstance(score, float)


# =====================================================================
# Constants Validation
# =====================================================================


class TestConstants:

    def test_dispensary_count(self):
        assert len(DISPENSARIES) == 27

    def test_all_dispensaries_have_required_keys(self):
        required = {"url", "platform", "name", "link", "expected"}
        for slug, config in DISPENSARIES.items():
            missing = required - set(config.keys())
            assert not missing, f"Dispensary '{slug}' missing keys: {missing}"

    def test_brands_no_duplicates(self):
        lowered = [b.lower() for b in BRANDS]
        assert len(lowered) == len(set(lowered)), "Duplicate brands detected"

    def test_price_caps_categories_complete(self):
        expected_keys = {"edible", "preroll", "vape", "flower_3.5g", "flower_7g",
                         "flower_14g", "concentrate_1g"}
        assert expected_keys == set(PRICE_CAPS.keys())
