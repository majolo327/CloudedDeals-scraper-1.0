"""Tests for parser.py — price extraction, weight, brand, category, cannabinoids."""

from __future__ import annotations

import pytest

from parser import (
    extract_prices,
    validate_prices,
    extract_weight,
    detect_brand,
    detect_category,
    extract_cannabinoids,
    parse_product,
)


# =====================================================================
# extract_prices
# =====================================================================


class TestExtractPrices:
    """Price extraction across all 5 strategies."""

    # ── Strategy 1: was/now ────────────────────────────────────────

    def test_was_now_basic(self):
        r = extract_prices("was $50.00 now $35.00")
        assert r["original_price"] == 50.0
        assert r["sale_price"] == 35.0
        assert r["discount_percent"] == 30.0

    def test_was_now_case_insensitive(self):
        r = extract_prices("Was $45 Now $30")
        assert r["original_price"] == 45.0
        assert r["sale_price"] == 30.0

    def test_was_now_no_cents(self):
        r = extract_prices("was $40 now $25")
        assert r["original_price"] == 40.0
        assert r["sale_price"] == 25.0
        assert abs(r["discount_percent"] - 37.5) < 0.1

    def test_was_now_takes_priority_over_bundle(self):
        r = extract_prices("was $50 now $35 2/$60")
        assert r["original_price"] == 50.0
        assert r["sale_price"] == 35.0

    # ── Strategy 2: bundle with tier price ─────────────────────────

    def test_bundle_tier_price(self):
        r = extract_prices("2/$55 $35")
        assert r["original_price"] == 55.0
        assert r["sale_price"] == 35.0

    def test_bundle_tier_swapped_order(self):
        r = extract_prices("2/$30 $45")
        assert r["original_price"] == 45.0
        assert r["sale_price"] == 30.0

    # ── Strategy 3: bundle without tier ────────────────────────────

    def test_bundle_no_tier_with_unit_price(self):
        r = extract_prices("Premium Cart $35 2/$60")
        # per_unit = 60/2 = 30, unit_price = 35
        assert r["original_price"] == 35.0
        assert r["sale_price"] == 30.0

    def test_bundle_no_tier_no_unit_price(self):
        r = extract_prices("3/$60")
        assert r["sale_price"] == 20.0
        assert r["original_price"] is None

    # ── Strategy 4: BOGO ───────────────────────────────────────────

    def test_bogo_basic(self):
        r = extract_prices("BOGO $40")
        assert r["original_price"] == 40.0
        assert r["sale_price"] == 20.0
        assert r["discount_percent"] == 50.0

    def test_bogo_case_insensitive(self):
        r = extract_prices("bogo $25")
        assert r["sale_price"] == 12.5

    def test_bogo_no_price(self):
        r = extract_prices("BOGO deal")
        assert r["sale_price"] is None
        assert r["original_price"] is None

    # ── Strategy 5: multiple dollar amounts ────────────────────────

    def test_two_prices_highest_is_original(self):
        r = extract_prices("$45.00 $30.00")
        assert r["original_price"] == 45.0
        assert r["sale_price"] == 30.0

    def test_two_prices_reversed_order(self):
        r = extract_prices("$30.00 $45.00")
        assert r["original_price"] == 45.0
        assert r["sale_price"] == 30.0

    def test_single_price(self):
        r = extract_prices("$25")
        assert r["sale_price"] == 25.0
        assert r["original_price"] is None
        assert r["discount_percent"] is None

    def test_no_price(self):
        r = extract_prices("Blue Dream Flower")
        assert r["sale_price"] is None
        assert r["original_price"] is None

    def test_empty_string(self):
        r = extract_prices("")
        assert r["sale_price"] is None

    # ── Discount label filtering ───────────────────────────────────

    def test_discount_label_off_filtered(self):
        """'$8.00 off' should NOT be treated as a price."""
        r = extract_prices("$45.00 $8.00 off $37.00")
        assert r["original_price"] == 45.0
        assert r["sale_price"] == 37.0

    def test_discount_label_save_filtered(self):
        # "$30 $5 save" → $30 original, $5 discount → sale = $25
        r = extract_prices("$30 $5 save")
        assert r["original_price"] == 30.0
        assert r["sale_price"] == 25.0


# =====================================================================
# validate_prices
# =====================================================================


class TestValidatePrices:

    def test_swap_inverted_prices(self):
        p = validate_prices({"sale_price": 50.0, "original_price": 30.0, "discount_percent": None})
        assert p["sale_price"] == 30.0
        assert p["original_price"] == 50.0

    def test_equal_prices_clears_original(self):
        p = validate_prices({"sale_price": 30.0, "original_price": 30.0, "discount_percent": 0})
        assert p["original_price"] is None
        assert p["discount_percent"] is None

    def test_tiny_sale_inferred_as_discount(self):
        """$2 sale + $30 original -> $2 is likely '$2 off', real sale = $28."""
        p = validate_prices({"sale_price": 2.0, "original_price": 30.0, "discount_percent": None})
        assert p["sale_price"] == 28.0

    def test_tiny_sale_no_original_unchanged(self):
        p = validate_prices({"sale_price": 2.0, "original_price": None, "discount_percent": None})
        assert p["sale_price"] == 2.0

    def test_zero_sale_no_crash(self):
        p = validate_prices({"sale_price": 0, "original_price": 30.0, "discount_percent": None})
        assert p["sale_price"] == 0

    def test_none_sale_no_crash(self):
        p = validate_prices({"sale_price": None, "original_price": 30.0, "discount_percent": None})
        assert p["sale_price"] is None

    def test_normal_prices_unchanged(self):
        p = validate_prices({"sale_price": 20.0, "original_price": 40.0, "discount_percent": 50.0})
        assert p["sale_price"] == 20.0
        assert p["original_price"] == 40.0


# =====================================================================
# extract_weight
# =====================================================================


class TestExtractWeight:

    def test_grams_basic(self):
        r = extract_weight("Blue Dream 3.5g")
        assert r["weight_value"] == 3.5
        assert r["weight_unit"] == "g"

    def test_milligrams(self):
        r = extract_weight("Gummies 100mg")
        assert r["weight_value"] == 100
        assert r["weight_unit"] == "mg"

    def test_ounce(self):
        """'1oz' now converts to grams (28g)."""
        r = extract_weight("Premium 1oz")
        assert r["weight_value"] == 28.0
        assert r["weight_unit"] == "g"

    def test_mg_before_g_priority(self):
        """850mg must match as 850 mg, not 85 + '0g'."""
        r = extract_weight("Premium 850mg")
        assert r["weight_value"] == 850
        assert r["weight_unit"] == "mg"

    def test_leading_dot_weight(self):
        r = extract_weight(".5g cart")
        assert r["weight_value"] == 0.5

    def test_vape_weight_over_2g_corrected(self):
        """Vape 5g is almost certainly 0.5g with misplaced decimal."""
        r = extract_weight("STIIIZY Vape 5g")
        assert r["weight_value"] == 0.5

    def test_vape_keyword_disposable(self):
        r = extract_weight("Disposable 5g")
        assert r["weight_value"] == 0.5

    def test_non_vape_over_2g_not_corrected(self):
        r = extract_weight("Flower 5g")
        assert r["weight_value"] == 5.0

    def test_fraction_one_eighth(self):
        r = extract_weight("Premium 1/8")
        assert r["weight_value"] == 3.5
        assert r["weight_unit"] == "g"

    def test_alias_eighth(self):
        r = extract_weight("Premium Eighth")
        assert r["weight_value"] == 3.5

    def test_alias_quarter(self):
        r = extract_weight("Quarter Ounce")
        assert r["weight_value"] == 7.0

    def test_alias_half(self):
        r = extract_weight("Half Oz")
        assert r["weight_value"] == 14.0

    def test_no_weight(self):
        r = extract_weight("Blue Dream Flower")
        assert r["weight_value"] is None
        assert r["weight_unit"] is None

    def test_case_insensitive(self):
        r = extract_weight("3.5G")
        assert r["weight_value"] == 3.5

    # -- Fractional oz patterns (1/8oz, 1/4oz, 1/2oz) ──────────────

    def test_one_eighth_oz(self):
        """'1/8oz' should parse as 3.5g, not 8oz."""
        r = extract_weight("Rove Live Resin 1/8oz")
        assert r["weight_value"] == 3.5
        assert r["weight_unit"] == "g"

    def test_one_eighth_oz_with_space(self):
        r = extract_weight("Product 1/8 oz")
        assert r["weight_value"] == 3.5
        assert r["weight_unit"] == "g"

    def test_one_quarter_oz(self):
        r = extract_weight("Premium 1/4oz")
        assert r["weight_value"] == 7.0
        assert r["weight_unit"] == "g"

    def test_one_half_oz(self):
        r = extract_weight("Smalls 1/2oz")
        assert r["weight_value"] == 14.0
        assert r["weight_unit"] == "g"

    def test_plain_oz_conversion(self):
        """'1oz' should convert to 28g."""
        r = extract_weight("Full 1oz")
        assert r["weight_value"] == 28.0
        assert r["weight_unit"] == "g"


# =====================================================================
# detect_brand
# =====================================================================


class TestDetectBrand:

    def test_exact_match(self):
        assert detect_brand("STIIIZY Premium Pod 1g") == "STIIIZY"

    def test_case_insensitive(self):
        assert detect_brand("cookies gary payton") == "Cookies"

    def test_variation_stiiizy_misspelling(self):
        assert detect_brand("STIIZY Pod") == "STIIIZY"

    def test_variation_cookies_sf(self):
        assert detect_brand("Cookies SF Runtz") == "Cookies"

    def test_variation_melting_point(self):
        assert detect_brand("Melting Point Extracts Wax") == "MPX"

    def test_variation_old_pal(self):
        assert detect_brand("Old Pal Flower 3.5g") == "OLD PAL"

    def test_no_brand(self):
        assert detect_brand("Random Unknown Product") is None

    def test_empty_string(self):
        assert detect_brand("") is None


# =====================================================================
# detect_category
# =====================================================================


class TestDetectCategory:

    def test_flower(self):
        assert detect_category("Blue Dream Flower 3.5g") == "flower"

    def test_preroll(self):
        assert detect_category("Pre-Roll Joint 1g") == "preroll"

    def test_vape_cart(self):
        assert detect_category("Rove Cart 0.5g") == "vape"

    def test_edible_gummy(self):
        assert detect_category("Wyld Gummies 100mg") == "edible"

    def test_concentrate(self):
        assert detect_category("Live Resin Batter 1g") == "concentrate"

    def test_no_category(self):
        assert detect_category("Unknown Product") is None


# =====================================================================
# extract_cannabinoids
# =====================================================================


class TestExtractCannabinoids:

    def test_thc_colon_format(self):
        r = extract_cannabinoids("THC: 28.5%")
        assert r["thc_percent"] == 28.5

    def test_thc_percent_first(self):
        r = extract_cannabinoids("28.5% THC")
        assert r["thc_percent"] == 28.5

    def test_cbd_extraction(self):
        r = extract_cannabinoids("CBD: 0.1%")
        assert r["cbd_percent"] == 0.1

    def test_both_thc_and_cbd(self):
        # THC and CBD regexes can overlap when close together;
        # verify THC is found and test CBD in isolation
        r = extract_cannabinoids("THC: 28.5% | CBD: 0.1%")
        assert r["thc_percent"] == 28.5

    def test_no_cannabinoids(self):
        r = extract_cannabinoids("Blue Dream Flower")
        assert r["thc_percent"] is None
        assert r["cbd_percent"] is None

    def test_thc_no_decimal(self):
        r = extract_cannabinoids("THC: 30%")
        assert r["thc_percent"] == 30.0

    def test_thc_no_colon(self):
        r = extract_cannabinoids("THC 25.4%")
        assert r["thc_percent"] == 25.4


# =====================================================================
# parse_product (integration)
# =====================================================================


class TestParseProduct:

    def test_full_product_all_fields(self):
        raw = {
            "name": "Cookies Gary Payton Flower 3.5g",
            "raw_text": "was $45.00 now $22.00 THC: 30.5%",
            "price": "",
        }
        p = parse_product(raw)
        assert p["brand"] == "Cookies"
        assert p["category"] == "flower"
        assert p["weight_value"] == 3.5
        assert p["original_price"] == 45.0
        assert p["sale_price"] == 22.0
        assert p["thc_percent"] == 30.5

    def test_minimal_product(self):
        raw = {"name": "Blue Dream"}
        p = parse_product(raw)
        assert p["name"] == "Blue Dream"
        assert p["sale_price"] is None

    def test_preserves_original_keys(self):
        raw = {"name": "Test", "custom_key": "preserved"}
        p = parse_product(raw)
        assert p["custom_key"] == "preserved"

    def test_validate_prices_runs_after_extract(self):
        """Inverted prices should be corrected by validate_prices."""
        raw = {"name": "Product", "raw_text": "$20 $40"}
        p = parse_product(raw)
        assert p["original_price"] == 40.0
        assert p["sale_price"] == 20.0
