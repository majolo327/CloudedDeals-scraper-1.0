"""
Deal qualification and scoring engine.

Takes parsed product dicts (output of ``parser.parse_product``) and
decides which ones are worth surfacing as deals.  Products that pass
the qualification thresholds are scored on a 0–100 scale and returned
sorted best-first.

Scoring breakdown (max 100):
  - Discount bonus  : discount% × 0.8, capped at 40 pts
  - Brand bonus     : +20 for preferred brands
  - Category bonus  : +10 for flower / vape / edible
  - Price sweet spot: +15 when sale price is $15–$40
  - THC bonus       : +15 for 25 %+ THC
"""

from __future__ import annotations

from typing import Any

# =====================================================================
# Qualification thresholds
# =====================================================================

MIN_DISCOUNT_PCT: float = 20.0
PRICE_MIN: float = 5.0
PRICE_MAX: float = 100.0

# =====================================================================
# Scoring constants
# =====================================================================

PREFERRED_BRANDS: set[str] = {"STIIIZY", "Cookies", "Wyld", "Trendi"}

BONUS_CATEGORIES: set[str] = {"flower", "vape", "edible"}

PRICE_SWEET_SPOT_LO: float = 15.0
PRICE_SWEET_SPOT_HI: float = 40.0

THC_THRESHOLD_PCT: float = 25.0

# Point values
MAX_DISCOUNT_PTS: float = 40.0
DISCOUNT_MULTIPLIER: float = 0.8
BRAND_PTS: float = 20.0
CATEGORY_PTS: float = 10.0
PRICE_SWEET_SPOT_PTS: float = 15.0
THC_PTS: float = 15.0


# =====================================================================
# Core logic
# =====================================================================


def qualifies_as_deal(product: dict[str, Any]) -> bool:
    """Return ``True`` if *product* meets the minimum deal thresholds.

    A product qualifies when **all** of the following hold:

    1. ``discount_percent`` is present and ≥ ``MIN_DISCOUNT_PCT`` (20 %).
    2. ``sale_price`` is present and within ``PRICE_MIN``–``PRICE_MAX``
       ($5–$100 inclusive).
    """
    discount = product.get("discount_percent")
    if discount is None or discount < MIN_DISCOUNT_PCT:
        return False

    sale_price = product.get("sale_price")
    if sale_price is None:
        return False
    if not (PRICE_MIN <= sale_price <= PRICE_MAX):
        return False

    return True


def score_deal(product: dict[str, Any]) -> float:
    """Calculate a 0–100 deal score for a **qualified** product.

    The caller should run ``qualifies_as_deal`` first; this function does
    not re-check thresholds.

    Components:
      1. **Discount bonus** — ``discount_percent × 0.8``, max 40 pts.
      2. **Brand bonus** — +20 if brand is in ``PREFERRED_BRANDS``.
      3. **Category bonus** — +10 if category is flower, vape, or edible.
      4. **Price sweet spot** — +15 if sale price is $15–$40.
      5. **THC bonus** — +15 if THC ≥ 25 %.
    """
    score: float = 0.0

    # 1. Discount bonus (max 40)
    discount = product.get("discount_percent") or 0.0
    score += min(discount * DISCOUNT_MULTIPLIER, MAX_DISCOUNT_PTS)

    # 2. Brand bonus (+20)
    brand = product.get("brand")
    if brand is not None and brand in PREFERRED_BRANDS:
        score += BRAND_PTS

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
