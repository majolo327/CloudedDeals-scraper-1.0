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
    """150+ pre-scored deals spanning all categories, brands, and dispensaries.

    Used by ``test_deal_detector.py`` for top-100 selection tests.
    """
    deals = []
    brands_by_cat = {
        "flower": ["Cookies", "Connected", "Alien Labs", "CAMP", "Kynd",
                    "Old Pal", "Tahoe Hydro", "Fleur", "AMA", "Stone Road"],
        "vape": ["STIIIZY", "Rove", "Select", "Raw Garden", "Heavy Hitters",
                 "Plug Play", "City Trees", "Trendi"],
        "edible": ["Wyld", "Kiva", "Wana", "PLUS", "Camino", "Incredibles"],
        "concentrate": ["MPX", "AMA", "Tsunami", "Matrix", "City Trees", "Virtue"],
        "preroll": ["Jeeter", "Cookies", "Lowell", "Stone Road", "Dogwalkers"],
    }
    dispensaries = [
        "planet13", "medizin", "curaleaf_strip", "curaleaf_western",
        "curaleaf_north", "td-gibson", "td-eastern", "oasis",
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
    return deals
