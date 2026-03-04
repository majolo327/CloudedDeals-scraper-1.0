"""Tests for product_classifier.py — infused/pack detection and recategorization."""

from __future__ import annotations

import pytest

from product_classifier import classify_product


class TestInfusedDetection:

    @pytest.mark.parametrize("name", [
        "Diamond Infused Preroll",
        "Caviar Gold Joint",
        "Moon Rock Preroll",
        "Sun Rock Joint 1g",
        "Kief Dusted Preroll",
        "Diamond Coated Joint",
        "Hash Infused Premium Joint",
    ])
    def test_infused_keywords_detected(self, name):
        r = classify_product(name, brand=None, category="preroll")
        assert r["is_infused"] is True
        assert r["product_subtype"] == "infused_preroll"

    def test_40s_detected(self):
        r = classify_product("Jeeter 40s", brand="Jeeter", category="preroll")
        assert r["is_infused"] is True

    def test_brand_specific_jeeter_baby_xl(self):
        r = classify_product("Baby Jeeter XL Indica", brand="Jeeter", category="preroll")
        assert r["is_infused"] is True

    def test_brand_specific_heavy_hitters_diamond(self):
        r = classify_product("Diamond Joint 1g", brand="Heavy Hitters", category="preroll")
        assert r["is_infused"] is True

    def test_regular_preroll_not_infused(self):
        r = classify_product("Regular Joint 1g", brand=None, category="preroll")
        assert r["is_infused"] is False
        assert r["product_subtype"] is None

    def test_infused_concentrate_recategorized(self):
        """Infused item misclassified as concentrate should be corrected to preroll."""
        r = classify_product("Infused Joint 1g", brand=None, category="concentrate")
        assert r["is_infused"] is True
        assert r["corrected_category"] == "preroll"


class TestPackDetection:

    @pytest.mark.parametrize("name", [
        "5-pack Preroll",
        "3 pack Joint",
        "10pk Mini Prerolls",
        "Multi-Pack Variety",
    ])
    def test_pack_detected(self, name):
        r = classify_product(name, brand=None, category="preroll")
        assert r["product_subtype"] == "preroll_pack"

    def test_dogwalkers_always_pack(self):
        r = classify_product("Indica", brand="Dogwalkers", category="preroll")
        assert r["product_subtype"] == "preroll_pack"

    def test_edible_pack_not_preroll_pack(self):
        """Gummies 10pk should NOT be classified as preroll_pack."""
        r = classify_product("Gummies 10pk", brand=None, category="edible")
        assert r["product_subtype"] != "preroll_pack"
        assert r["product_subtype"] == "gummy"  # now correctly identified as gummy

    def test_edible_keyword_in_name_suppresses_pack(self):
        """Even without edible category, edible keywords prevent pack detection."""
        r = classify_product("Chocolate 5-pack", brand=None, category=None)
        assert r["product_subtype"] != "preroll_pack"


class TestVapeDisposableDetection:
    """Test disposable vape subtype detection — multi-layer strategy.

    Layer 1: Explicit keyword indicators (disposable, AIO, RTU, etc.)
    Layer 2: Brand-specific disposable product lines (STIIIZY LIIIL, etc.)
    Layer 3: NOT-disposable exclusions (510, cartridge, battery, etc.)
    """

    # --- Layer 1: Explicit keyword indicators ---

    @pytest.mark.parametrize("name", [
        "Strawberry All In One Live Resin 0.5g",
        "STIIIZY All-In-One Pen 1g",
        "AIO Live Resin Vape",
        "Ready To Use Disposable Pen",
        "Ready-To-Use Live Resin 0.5g",
        "Disposable Vape 0.3g",
        "RTU Live Resin 0.5g",
        "Draw Activated Vape Pen",
        "Draw-Activated Live Resin",
        "Built In Battery Vape",
        "Non-Rechargeable Vape Pen",
        "Rechargeable Disposable 1g",
        "Ripper OG 0.5g",
    ])
    def test_disposable_indicators_when_vape(self, name):
        r = classify_product(name, brand=None, category="vape")
        assert r["product_subtype"] == "disposable"

    def test_stiiizy_all_in_one_is_disposable_not_pod(self):
        """STIIIZY is normally a pod brand, but 'All In One' overrides to disposable."""
        r = classify_product(
            "Strawberry Milkshake All In One Live Resin Liquid Diamonds Pen",
            brand="STIIIZY", category="vape",
        )
        assert r["product_subtype"] == "disposable"

    # --- Layer 2: Brand-specific disposable product lines ---

    def test_stiiizy_liiil_is_disposable(self):
        """STIIIZY LIIIL is their disposable line."""
        r = classify_product("LIIIL Indica 0.5g", brand="STIIIZY", category="vape")
        assert r["product_subtype"] == "disposable"

    def test_stiiizy_pod_is_disposable(self):
        """STIIIZY pods are closed systems (AIO-equivalent)."""
        r = classify_product("Birthday Cake Pod", brand="STIIIZY", category="vape")
        assert r["product_subtype"] == "disposable"

    def test_stiiizy_generic_name_is_disposable(self):
        """STIIIZY with generic strain name → disposable (all STIIIZY = closed system)."""
        r = classify_product("Blue Dream 0.5g", brand="STIIIZY", category="vape")
        assert r["product_subtype"] == "disposable"

    def test_stiiizy_strain_only_is_disposable(self):
        """STIIIZY with just a strain name → disposable (catch-all)."""
        r = classify_product("OG Kush", brand="STIIIZY", category="vape")
        assert r["product_subtype"] == "disposable"

    def test_select_bite_is_disposable(self):
        """Select Bite is their disposable line."""
        r = classify_product("Bite Blueberry 0.5g", brand="Select", category="vape")
        assert r["product_subtype"] == "disposable"

    def test_select_cliq_is_disposable(self):
        """Select Cliq is their pod/disposable line."""
        r = classify_product("Cliq Blue Dream", brand="Select", category="vape")
        assert r["product_subtype"] == "disposable"

    def test_rove_ready_is_disposable(self):
        """Rove Ready is their ready-to-use disposable line."""
        r = classify_product("Ready Live Resin 0.5g", brand="Rove", category="vape")
        assert r["product_subtype"] == "disposable"

    def test_airopro_is_disposable(self):
        """AiroPro devices are proprietary closed systems."""
        r = classify_product("Blue Dream 0.5g", brand="AiroPro", category="vape")
        assert r["product_subtype"] == "disposable"

    # --- Layer 3: NOT-disposable exclusions ---

    def test_stiiizy_510_cartridge_not_disposable(self):
        """STIIIZY 510 Cartridge has a NOT-disposable signal → should not be disposable."""
        r = classify_product("Blue Dream 510 Cartridge", brand="STIIIZY", category="vape")
        assert r["product_subtype"] == "cartridge"

    def test_510_cart_not_disposable(self):
        """Products with only '510' are standard carts, not disposable."""
        r = classify_product("Blue Dream 510 0.5g", brand=None, category="vape")
        assert r["product_subtype"] == "cartridge"

    def test_replacement_not_disposable(self):
        """Products with 'replacement' are refill parts, not disposable."""
        r = classify_product("Replacement Pod 0.5g", brand=None, category="vape")
        # "pod" keyword takes priority over NOT-disposable check
        assert r["product_subtype"] == "pod"

    def test_battery_not_disposable(self):
        """Products with 'battery' are just battery devices."""
        r = classify_product("Pen Battery Starter Kit", brand=None, category="vape")
        # "pen" heuristic is blocked by NOT-disposable "battery" signal
        assert r["product_subtype"] is None

    def test_explicit_disposable_overrides_not_disposable(self):
        """Explicit 'disposable' keyword overrides NOT-disposable signals."""
        r = classify_product("510 Disposable Pen", brand=None, category="vape")
        assert r["product_subtype"] == "disposable"

    # --- Standard cart/pod detection still works ---

    def test_cartridge_keyword(self):
        r = classify_product("Blue Dream Cartridge 0.5g", brand=None, category="vape")
        assert r["product_subtype"] == "cartridge"

    def test_pod_keyword(self):
        r = classify_product("Blue Dream Pod 0.5g", brand=None, category="vape")
        assert r["product_subtype"] == "pod"

    def test_pax_brand_fallback_pod(self):
        """PAX brand → pod fallback (not in disposable brand lines)."""
        r = classify_product("Blue Dream 0.5g", brand="PAX", category="vape")
        assert r["product_subtype"] == "pod"

    def test_kingpen_brand_fallback_cartridge(self):
        """Kingpen brand → cartridge fallback (not in disposable brand lines)."""
        r = classify_product("Blue Dream 0.5g", brand="Kingpen", category="vape")
        assert r["product_subtype"] == "cartridge"

    # --- Category correction safety net ---

    @pytest.mark.parametrize("name,wrong_cat", [
        ("Strawberry Milkshake All In One Live Resin", "flower"),
        ("AIO Live Resin Pen", "edible"),
        ("Ready To Use Vape", "concentrate"),
        ("Disposable Pen 0.5g", "other"),
    ])
    def test_disposable_corrects_wrong_category(self, name, wrong_cat):
        """Disposable indicators should override a wrong category to vape."""
        r = classify_product(name, brand=None, category=wrong_cat)
        assert r["corrected_category"] == "vape"
        assert r["product_subtype"] == "disposable"


class TestNoFlags:

    def test_regular_flower(self):
        r = classify_product("Blue Dream 3.5g", brand="Cookies", category="flower")
        assert r["is_infused"] is False
        assert r["product_subtype"] is None
        assert r["corrected_category"] is None

    def test_none_inputs(self):
        r = classify_product(None, brand=None, category=None)
        assert r["is_infused"] is False
        assert r["product_subtype"] is None

    def test_empty_name(self):
        r = classify_product("", brand="", category="")
        assert r["is_infused"] is False
