"""
Deal qualification and scoring engine.

Takes parsed product dicts (output of ``parser.parse_product``) and
decides which ones are worth surfacing as deals.  Products that pass
the qualification thresholds are scored on a 0–100 scale and returned
sorted best-first.

Scoring breakdown (max 100):
  - Discount bonus  : discount% × 0.8, capped at 40 pts
  - Brand bonus     : +25 for premium brands, +15 for mid-tier
  - Category bonus  : +10 for flower / vape / edible
  - Price sweet spot: +15 when sale price is $15–$40
  - THC bonus       : +15 for 25 %+ THC
"""

from __future__ import annotations

from typing import Any

# =====================================================================
# Category-specific price caps — maximum sale price to qualify as a deal
# (from PRD Section 9.1)
# =====================================================================

PRICE_CAPS: dict[str, dict[str, float]] = {
    "flower": {
        "1g": 10.0,
        "3.5g": 19.0,   # eighth
        "7g": 30.0,      # quarter
        "14g": 40.0,     # half
        "28g": 79.0,     # ounce
    },
    "concentrate": {
        "0.5g": 15.0,
        "1g": 25.0,
        "2g": 45.0,
    },
    "edible": {
        "default": 9.0,
    },
    "vape": {
        "0.5g": 25.0,
        "1g": 40.0,
    },
    "preroll": {
        "1g": 6.0,
        "default": 25.0,
    },
}

# =====================================================================
# Qualification thresholds (fallback when no category cap matches)
# =====================================================================

MIN_DISCOUNT_PCT: float = 20.0   # PRD: must be at least 20% off
PRICE_MIN: float = 5.0
PRICE_MAX: float = 100.0         # PRD: scoring range (5, 100)

# =====================================================================
# Brand tiers for scoring
# =====================================================================

PREMIUM_BRANDS: set[str] = {
    "Cookies", "Runtz", "Connected", "Alien Labs", "Jungle Boys",
    "Packwoods", "Doja", "STIIIZY", "Raw Garden", "Heavy Hitters",
    "Kingpen", "Select", "Plug Play", "PAX", "Jeeter",
    "Backpack Boyz", "Wonderbrett", "Ember Valley",
}

MID_TIER_BRANDS: set[str] = {
    "Kynd", "Verano", "MPX", "Tsunami", "Virtue", "Matrix",
    "Tahoe Hydro", "The Clear", "City Trees", "Trendi",
    "Qualcan", "NLVO", "Vapen", "Cannabiotix", "Rove",
    "Cresco", "Wyld", "Kiva", "Wana",
}

BONUS_CATEGORIES: set[str] = {"flower", "vape", "edible"}

PRICE_SWEET_SPOT_LO: float = 15.0
PRICE_SWEET_SPOT_HI: float = 40.0

THC_THRESHOLD_PCT: float = 25.0

# Point values
MAX_DISCOUNT_PTS: float = 40.0
DISCOUNT_MULTIPLIER: float = 0.8
PREMIUM_BRAND_PTS: float = 25.0
MID_TIER_BRAND_PTS: float = 15.0
CATEGORY_PTS: float = 10.0
PRICE_SWEET_SPOT_PTS: float = 15.0   # PRD: +15 (was +10)
THC_PTS: float = 15.0


# =====================================================================
# Core logic
# =====================================================================


def _get_price_cap(product: dict[str, Any]) -> float | None:
    """Return the category-specific price cap for a product, or None."""
    category = product.get("category")
    if not category or category not in PRICE_CAPS:
        return None

    caps = PRICE_CAPS[category]

    # Try matching by weight
    weight_val = product.get("weight_value")
    weight_unit = product.get("weight_unit", "g")
    if weight_val is not None:
        weight_key = f"{weight_val}{'g' if weight_unit == 'g' else weight_unit}"
        # Normalise: 3.5 → "3.5g"
        if weight_key in caps:
            return caps[weight_key]
        # Try integer form: 1.0 → "1g"
        if weight_val == int(weight_val):
            weight_key = f"{int(weight_val)}{weight_unit or 'g'}"
            if weight_key in caps:
                return caps[weight_key]

    # Fallback to "default" cap for the category
    return caps.get("default")


def qualifies_as_deal(product: dict[str, Any]) -> bool:
    """Return ``True`` if *product* meets the deal thresholds.

    A product qualifies when:

    1. ``discount_percent`` is present and >= ``MIN_DISCOUNT_PCT`` (20 %).
    2. ``sale_price`` is present and within ``PRICE_MIN``–``PRICE_MAX``.
    3. If a category-specific price cap exists, the sale price must be
       at or below that cap.
    """
    discount = product.get("discount_percent")
    if discount is None or discount < MIN_DISCOUNT_PCT:
        return False

    sale_price = product.get("sale_price")
    if sale_price is None:
        return False
    if not (PRICE_MIN <= sale_price <= PRICE_MAX):
        return False

    # Category-specific cap check
    cap = _get_price_cap(product)
    if cap is not None and sale_price > cap:
        return False

    return True


def score_deal(product: dict[str, Any]) -> float:
    """Calculate a 0–100 deal score for a **qualified** product.

    Components:
      1. **Discount bonus** — ``discount_percent × 0.8``, max 40 pts.
      2. **Brand bonus** — +25 for premium brands, +15 for mid-tier.
      3. **Category bonus** — +10 if category is flower, vape, or edible.
      4. **Price sweet spot** — +15 if sale price is $15–$40.
      5. **THC bonus** — +15 if THC >= 25%.
    """
    score: float = 0.0

    # 1. Discount bonus (max 40)
    discount = product.get("discount_percent") or 0.0
    score += min(discount * DISCOUNT_MULTIPLIER, MAX_DISCOUNT_PTS)

    # 2. Brand bonus (+25 premium, +15 mid-tier)
    brand = product.get("brand")
    if brand is not None:
        if brand in PREMIUM_BRANDS:
            score += PREMIUM_BRAND_PTS
        elif brand in MID_TIER_BRANDS:
            score += MID_TIER_BRAND_PTS

    # 3. Category bonus (+10)
    category = product.get("category")
    if category is not None and category in BONUS_CATEGORIES:
        score += CATEGORY_PTS

    # 4. Price sweet spot (+15)
    sale_price = product.get("sale_price")
    if sale_price is not None and PRICE_SWEET_SPOT_LO <= sale_price <= PRICE_SWEET_SPOT_HI:
        score += PRICE_SWEET_SPOT_PTS

    # 5. THC bonus (+15)
    thc = product.get("thc_percent")
    if thc is not None and thc >= THC_THRESHOLD_PCT:
        score += THC_PTS

    return min(score, 100.0)


def detect_deals(products: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Filter and score a list of parsed products.

    Returns only products that pass ``qualifies_as_deal``, each enriched
    with a ``deal_score`` key, sorted by ``deal_score`` descending.
    """
    deals: list[dict[str, Any]] = []

    for product in products:
        if not qualifies_as_deal(product):
            continue

        deal = {**product, "deal_score": score_deal(product)}
        deals.append(deal)

    deals.sort(key=lambda d: d["deal_score"], reverse=True)
    return deals
