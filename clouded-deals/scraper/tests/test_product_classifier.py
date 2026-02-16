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
        assert r["product_subtype"] is None

    def test_edible_keyword_in_name_suppresses_pack(self):
        """Even without edible category, edible keywords prevent pack detection."""
        r = classify_product("Chocolate 5-pack", brand=None, category=None)
        assert r["product_subtype"] is None


class TestVapeSubtype:

    def test_disposable_keyword(self):
        r = classify_product("Blue Dream Disposable 0.5g", brand=None, category="vape")
        assert r["product_subtype"] == "disposable"

    def test_all_in_one_is_disposable(self):
        r = classify_product("OG Kush All-In-One 0.3g", brand=None, category="vape")
        assert r["product_subtype"] == "disposable"

    def test_aio_is_disposable(self):
        r = classify_product("Sunset Sherbet AIO 0.5g", brand=None, category="vape")
        assert r["product_subtype"] == "disposable"

    def test_ready_to_use_is_disposable(self):
        r = classify_product("OG Kush Ready To Use 1g", brand=None, category="vape")
        assert r["product_subtype"] == "disposable"

    def test_ready_to_use_hyphenated(self):
        r = classify_product("Blue Dream Ready-To-Use 0.5g", brand=None, category="vape")
        assert r["product_subtype"] == "disposable"

    def test_rtu_is_disposable(self):
        r = classify_product("Live Resin RTU 1g", brand=None, category="vape")
        assert r["product_subtype"] == "disposable"

    def test_pen_is_disposable(self):
        r = classify_product("Blue Dream Pen 0.3g", brand=None, category="vape")
        assert r["product_subtype"] == "disposable"

    def test_cart_is_cartridge(self):
        r = classify_product("OG Kush Cart 0.5g", brand=None, category="vape")
        assert r["product_subtype"] == "cartridge"

    def test_pod_keyword(self):
        r = classify_product("Live Resin Pod 1g", brand=None, category="vape")
        assert r["product_subtype"] == "pod"

    def test_stiiizy_is_pod(self):
        r = classify_product("OG Kush 1g", brand="STIIIZY", category="vape")
        assert r["product_subtype"] == "pod"

    def test_airo_is_pod(self):
        r = classify_product("Blue Dream Live Resin 0.5g", brand="Airo", category="vape")
        assert r["product_subtype"] == "pod"

    def test_rove_is_cartridge(self):
        r = classify_product("Tangie 0.5g", brand="Rove", category="vape")
        assert r["product_subtype"] == "cartridge"

    def test_default_is_cartridge(self):
        """Vapes with no subtype indicators default to 510 cartridge."""
        r = classify_product("Blue Dream 1g", brand="Unknown", category="vape")
        assert r["product_subtype"] == "cartridge"

    def test_no_keyword_no_brand_defaults_cartridge(self):
        r = classify_product("Live Resin 0.5g", brand=None, category="vape")
        assert r["product_subtype"] == "cartridge"


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
