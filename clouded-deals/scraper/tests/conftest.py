"""Shared fixtures for the CloudedDeals scraper test suite."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Ensure the scraper package is importable from tests/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from clouded_logic import CloudedLogic


@pytest.fixture
def logic():
    """Fresh CloudedLogic instance per test (clean stats)."""
    return CloudedLogic()


@pytest.fixture
def make_product():
    """Factory that builds product dicts with sensible defaults.

    Any keyword argument overrides the default. Useful for both
    ``deal_detector`` and ``clouded_logic`` tests.
    """

    def _make(
        *,
        name="Test Product 3.5g",
        brand="Cookies",
        category="flower",
        sale_price=15.0,
        original_price=30.0,
        discount_percent=50,
        weight_value=3.5,
        weight_unit="g",
        thc_percent=25.0,
        dispensary_id="planet13",
        is_infused=False,
        product_subtype=None,
        deal_score=0,
        **overrides,
    ):
        product = {
            "name": name,
            "brand": brand,
            "category": category,
            "sale_price": sale_price,
            "current_price": sale_price,
            "original_price": original_price,
            "discount_percent": discount_percent,
            "weight_value": weight_value,
            "weight_unit": weight_unit,
            "thc_percent": thc_percent,
            "dispensary_id": dispensary_id,
            "is_infused": is_infused,
            "product_subtype": product_subtype,
            "deal_score": deal_score,
        }
        product.update(overrides)
        return product

    return _make


@pytest.fixture
def scored_deals_pool(make_product):
    """350+ pre-scored deals spanning all categories, brands, and dispensaries.

    Used by ``test_deal_detector.py`` for top-300 selection tests.
    """
    deals = []
    brands_by_cat = {
        "flower": ["Cookies", "Connected", "Alien Labs", "CAMP", "Kynd",
                    "Old Pal", "Tahoe Hydro", "Fleur", "AMA", "Stone Road",
                    "Pacific Stone", "Runtz", "Jungle Boys", "Cannabiotix"],
        "vape": ["STIIIZY", "Rove", "Select", "Raw Garden", "Heavy Hitters",
                 "Plug Play", "City Trees", "Trendi", "PAX", "Kingpen",
                 "AiroPro", "Dime"],
        "edible": ["Wyld", "Kiva", "Wana", "PLUS", "Camino", "Incredibles",
                   "Smokiez", "Dixie", "Sip", "Kanha"],
        "concentrate": ["MPX", "AMA", "Tsunami", "Matrix", "City Trees",
                        "Virtue", "Sublime", "Rove", "Trendi", "Cresco"],
        "preroll": ["Lowell", "Stone Road", "Dogwalkers", "Old Pal",
                    "Pacific Stone"],
    }
    dispensaries = [
        "planet13", "medizin", "curaleaf_strip", "curaleaf_western",
        "curaleaf_north", "td-gibson", "td-eastern", "oasis",
        "the-sanctuary", "thrive-north", "nuwu", "reef",
    ]
    score = 95

    for cat, brands in brands_by_cat.items():
        for i, brand in enumerate(brands):
            for j in range(4):
                disp = dispensaries[(i + j) % len(dispensaries)]
                deals.append(make_product(
                    name=f"{brand} Product {j} {cat}",
                    brand=brand,
                    category=cat,
                    sale_price=12.0 + j,
                    original_price=30.0 + j,
                    discount_percent=40 + j,
                    dispensary_id=disp,
                    deal_score=max(20, score - i * 3 - j * 2),
                ))

    # Disposable vape deals (category=vape, product_subtype=disposable).
    # These are bucketed as "disposable" virtual category during selection.
    disposable_brands = ["STIIIZY", "Rove", "Cookies", "Select",
                         "Heavy Hitters", "Trendi", "City Trees", "Puff Bar",
                         "AMA", "Matrix", "Sundaze", "&Shine", "Jeeter"]
    for i, brand in enumerate(disposable_brands):
        for j in range(4):
            disp = dispensaries[(i + j) % len(dispensaries)]
            deals.append(make_product(
                name=f"{brand} Disposable {j}",
                brand=brand,
                category="vape",
                product_subtype="disposable",
                sale_price=18.0 + j,
                original_price=36.0 + j,
                discount_percent=40 + j,
                weight_value=0.5 if j % 2 == 0 else 1.0,
                dispensary_id=disp,
                deal_score=max(20, score - i * 3 - j * 2),
            ))

    # Infused preroll deals (category=preroll, product_subtype=infused_preroll).
    # Bucketed as "infused_preroll" virtual category during selection.
    infused_brands = ["Jeeter", "Cookies", "Rove", "CAMP", "Cannavative",
                      "Heavy Hitters", "Virtue", "Kynd"]
    for i, brand in enumerate(infused_brands):
        for j in range(4):
            disp = dispensaries[(i + j) % len(dispensaries)]
            deals.append(make_product(
                name=f"{brand} Infused Preroll {j}",
                brand=brand,
                category="preroll",
                product_subtype="infused_preroll",
                is_infused=True,
                sale_price=8.0 + j,
                original_price=15.0 + j,
                discount_percent=35 + j,
                weight_value=1.0,
                dispensary_id=disp,
                deal_score=max(20, score - i * 3 - j * 2),
            ))

    # Preroll pack deals (category=preroll, product_subtype=preroll_pack).
    # Bucketed as "preroll_pack" virtual category during selection.
    pack_brands = ["Jeeter", "Cookies", "Old Pal", "Stone Road", "Lowell",
                   "Pacific Stone"]
    for i, brand in enumerate(pack_brands):
        for j in range(4):
            disp = dispensaries[(i + j) % len(dispensaries)]
            deals.append(make_product(
                name=f"{brand} 5pk Prerolls {j}",
                brand=brand,
                category="preroll",
                product_subtype="preroll_pack",
                sale_price=15.0 + j,
                original_price=30.0 + j,
                discount_percent=40 + j,
                weight_value=3.5,
                dispensary_id=disp,
                deal_score=max(20, score - i * 3 - j * 2),
            ))

    return deals
