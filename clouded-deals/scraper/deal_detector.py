"""
Deal qualification, scoring, and top-200 selection engine.

Pipeline:
  1. **Hard filters** (``passes_hard_filters``) — category price caps,
     minimum discount, price floor/ceiling.  Products that fail get
     ``deal_score = 0`` and are never shown.
  2. **Scoring** (``calculate_deal_score``) — 0-100 composite score for
     every product that passes hard filters.
  3. **Quality gate** (``passes_quality_gate``) — rejects deals with
     incomplete/garbage data (missing name, strain-only names, missing
     weight for categories that need it).
  4. **Top-200 selection** (``select_top_deals``) — stratified pick with
     brand, dispensary, and category diversity constraints.

Only the ~200 deals returned by ``select_top_deals`` should have
``deal_score > 0`` and ``is_active = True`` in the database.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from itertools import cycle
from typing import Any

logger = logging.getLogger("deal_detector")

# =====================================================================
# Phase 1: Category price caps — maximum acceptable SALE price
# =====================================================================

CATEGORY_PRICE_CAPS: dict[str, dict[str, float] | float] = {
    "flower": {
        "3.5": 19,   # eighth — max $19 sale price
        "7": 30,      # quarter — max $30
        "14": 40,     # half oz — max $40
        "28": 79,     # full oz — max $79
    },
    "vape": 25,           # carts/pods — max $25
    "edible": 9,          # gummies/chocolates — max $9
    "concentrate": 25,    # wax/shatter/live resin — max $25
    "preroll": 6,         # single prerolls — max $6
    "preroll_pack": 20,   # preroll multi-packs — max $20
}

# Global hard-filter thresholds (apply to ALL categories)
HARD_FILTERS = {
    "min_discount_percent": 20,   # must be at least 20% off
    "min_price": 3,               # below $3 = data error
    "max_price_absolute": 80,     # nothing over $80 regardless
    "require_original_price": True,
}

# =====================================================================
# Phase 2: Scoring constants
# =====================================================================

PREMIUM_BRANDS: set[str] = {
    "STIIIZY", "Cookies", "Raw Garden", "Kiva", "Wyld",
    "Select", "Trendi", "CAMP", "Old Pal", "Pacific Stone",
    "Fleur", "Virtue", "Rove", "Heavy Hitters",
    # Existing premium brands kept for backwards compat
    "Runtz", "Connected", "Alien Labs", "Jungle Boys",
    "Packwoods", "Doja", "Kingpen", "Plug Play", "PAX",
    "Jeeter", "Backpack Boyz", "Wonderbrett", "Ember Valley",
}

CATEGORY_BOOST: dict[str, int] = {
    "flower": 10,
    "vape": 10,
    "edible": 8,
    "concentrate": 7,
    "preroll": 6,
}

# =====================================================================
# Phase 3: Top-100 selection parameters
# =====================================================================

TARGET_DEAL_COUNT = 200

CATEGORY_TARGETS: dict[str, int] = {
    "flower": 60,
    "vape": 50,
    "edible": 30,
    "concentrate": 30,
    "preroll": 20,
    "other": 10,
}

MAX_SAME_BRAND_TOTAL = 5
MAX_SAME_DISPENSARY_TOTAL = 30
MAX_CONSECUTIVE_SAME_CATEGORY = 3

# =====================================================================
# Phase 4: Badge thresholds
# =====================================================================

BADGE_THRESHOLDS = {
    "steal": 85,
    "fire": 70,
    "solid": 50,
}

# =====================================================================
# Phase 1: Hard Filters
# =====================================================================


def passes_hard_filters(product: dict[str, Any]) -> bool:
    """Return ``False`` if the product should be completely excluded.

    Checks global price bounds, minimum discount, original price
    presence, and category-specific price caps.
    """
    # Exclude infused pre-rolls and pre-roll packs from Top 100.
    # They remain searchable in the full feed — just not curated.
    if product.get("is_infused"):
        return False
    subtype = product.get("product_subtype")
    if subtype in ("infused_preroll", "preroll_pack"):
        return False

    sale_price = product.get("sale_price") or product.get("current_price") or 0
    original_price = product.get("original_price") or 0
    discount = product.get("discount_percent") or 0
    category = product.get("category", "other")
    weight_value = product.get("weight_value")

    # --- Global filters ---
    if not sale_price or sale_price < HARD_FILTERS["min_price"]:
        return False
    if sale_price > HARD_FILTERS["max_price_absolute"]:
        return False
    if not discount or discount < HARD_FILTERS["min_discount_percent"]:
        return False
    if HARD_FILTERS["require_original_price"]:
        if not original_price or original_price <= sale_price:
            return False

    # --- Category-specific price caps ---
    caps = CATEGORY_PRICE_CAPS.get(category)
    if caps is None:
        # Unknown category — apply general max of $40
        return sale_price <= 40

    if isinstance(caps, dict):
        # Weight-based caps (flower)
        if weight_value:
            weight_str = str(weight_value)
            # Normalize: 3.5 → "3.5", 7.0 → "7", 28.0 → "28"
            if float(weight_value) == int(float(weight_value)):
                weight_str = str(int(float(weight_value)))
            cap = caps.get(weight_str)
            if cap and sale_price > cap:
                return False
            # If weight doesn't match any cap key, let it through
            # (uncommon weight — don't penalize)
            if cap is None:
                # Fall back to 3.5g cap as default for flower
                default_cap = caps.get("3.5", 19)
                if sale_price > default_cap:
                    return False
        else:
            # Flower with no weight detected — use 3.5g cap as default
            if sale_price > caps.get("3.5", 19):
                return False
    else:
        # Flat cap for category
        if sale_price > caps:
            return False

    return True


# =====================================================================
# Quality gate — reject incomplete / garbage deals
# =====================================================================

# Names that are just strain types or classifications, not real products
_STRAIN_ONLY_NAMES = {"indica", "sativa", "hybrid", "cbd", "thc", "unknown"}

# Categories that should always have a detected weight
_WEIGHT_REQUIRED_CATEGORIES = {"flower", "concentrate", "vape"}


def passes_quality_gate(product: dict[str, Any]) -> bool:
    """Return ``False`` if the product has garbage or incomplete data.

    Called AFTER hard filters and scoring, this is the final check
    before a deal can enter the top-200 selection.  We have enough
    volume (~1000+ qualifying deals) that we can afford to reject
    imperfect entries.
    """
    name = product.get("name") or ""
    brand = product.get("brand")
    category = product.get("category", "other")
    weight_value = product.get("weight_value")

    # Reject strain-type-only product names
    if name.strip().lower() in _STRAIN_ONLY_NAMES:
        return False

    # Reject very short names (likely garbage)
    if len(name.strip()) < 5:
        return False

    # Reject products where name == brand (redundant display)
    if brand and name.strip().lower() == brand.lower():
        return False

    # Reject products with no weight in categories that need it
    if category in _WEIGHT_REQUIRED_CATEGORIES and not weight_value:
        return False

    return True


# =====================================================================
# Phase 2: Deal Scoring (0-100)
# =====================================================================


def calculate_deal_score(product: dict[str, Any]) -> int:
    """Score a qualifying deal on a 0-100 scale.

    Only called after ``passes_hard_filters()`` returns ``True``.

    Components:
      1. Discount depth   — up to 40 pts
      2. Brand recognition — up to 20 pts
      3. Category boost    — up to 10 pts
      4. Price sweet spot  — up to 15 pts
      5. THC potency       — up to 15 pts
    """
    score = 0
    discount = product.get("discount_percent") or 0
    sale_price = product.get("sale_price") or product.get("current_price") or 0
    category = product.get("category", "other")

    # 1. DISCOUNT DEPTH (up to 40 points)
    #    20% off = 16pts, 30% = 24pts, 40% = 32pts, 50%+ = 40pts
    score += min(40, int(discount * 0.8))

    # 2. BRAND RECOGNITION (up to 20 points)
    brand = product.get("brand") or ""
    if brand in PREMIUM_BRANDS:
        score += 20
    elif brand:  # known brand but not premium
        score += 8

    # 3. CATEGORY POPULARITY (up to 10 points)
    score += CATEGORY_BOOST.get(category, 3)

    # 4. PRICE SWEET SPOT (up to 15 points)
    #    Vegas shoppers love $10-30 range deals
    if 10 <= sale_price <= 30:
        score += 15
    elif 5 <= sale_price < 10 or 30 < sale_price <= 45:
        score += 8

    # 5. THC POTENCY BONUS (up to 15 points)
    thc = product.get("thc_percent")
    if thc and thc >= 30:
        score += 15
    elif thc and thc >= 25:
        score += 10
    elif thc and thc >= 20:
        score += 5

    return min(100, score)


# =====================================================================
# Phase 3: Top-100 Selection with Variety
# =====================================================================


def select_top_deals(
    scored_deals: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Select the best ~100 deals with category, brand, and dispensary diversity.

    ``scored_deals`` must already have ``deal_score`` set (from
    ``calculate_deal_score``).  Returns a list of up to
    ``TARGET_DEAL_COUNT`` deals ordered for display.
    """
    if not scored_deals:
        return []

    # ------------------------------------------------------------------
    # Step 1: Bucket by category, sorted by deal_score DESC within each
    # ------------------------------------------------------------------
    buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for deal in scored_deals:
        cat = deal.get("category", "other")
        if cat not in CATEGORY_TARGETS:
            cat = "other"
        buckets[cat].append(deal)

    for cat in buckets:
        buckets[cat].sort(key=lambda d: d.get("deal_score", 0), reverse=True)

    # ------------------------------------------------------------------
    # Step 2: Pick per category with brand diversity
    # ------------------------------------------------------------------
    category_picks: dict[str, list[dict[str, Any]]] = {}
    total_available = sum(len(v) for v in buckets.values())
    target = min(TARGET_DEAL_COUNT, total_available)

    # Calculate how many slots each category gets
    category_slots: dict[str, int] = {}
    remaining_slots = target
    for cat, cat_target in CATEGORY_TARGETS.items():
        pool_size = len(buckets.get(cat, []))
        slots = min(cat_target, pool_size)
        category_slots[cat] = slots
        remaining_slots -= slots

    # Redistribute surplus slots to categories that have more deals
    if remaining_slots > 0:
        for cat in sorted(buckets.keys(), key=lambda c: len(buckets[c]), reverse=True):
            pool_size = len(buckets[cat])
            current = category_slots.get(cat, 0)
            can_add = pool_size - current
            if can_add > 0:
                add = min(can_add, remaining_slots)
                category_slots[cat] = current + add
                remaining_slots -= add
            if remaining_slots <= 0:
                break

    # Pick deals from each category pool with brand diversity.
    # NOTE: Products without a detected brand each get a unique key
    # so they are NOT all collapsed into one "Unknown" bucket that
    # gets capped at MAX_SAME_BRAND_TOTAL = 5.  Only per-dispensary
    # and per-category limits constrain brandless products.
    brand_counts: dict[str, int] = defaultdict(int)
    dispensary_counts: dict[str, int] = defaultdict(int)
    _unknown_counter = 0

    def _brand_key(deal: dict[str, Any]) -> str:
        nonlocal _unknown_counter
        b = deal.get("brand")
        if b:
            return b
        _unknown_counter += 1
        return f"_unknown_{_unknown_counter}"

    for cat, slots in category_slots.items():
        pool = buckets.get(cat, [])
        picks: list[dict[str, Any]] = []

        # First pass: one deal per brand (best score wins)
        seen_brands: set[str] = set()
        for deal in pool:
            if len(picks) >= slots:
                break
            brand = _brand_key(deal)
            disp_id = deal.get("dispensary_id") or ""
            if brand in seen_brands:
                continue
            if brand_counts[brand] >= MAX_SAME_BRAND_TOTAL:
                continue
            if dispensary_counts[disp_id] >= MAX_SAME_DISPENSARY_TOTAL:
                continue
            seen_brands.add(brand)
            brand_counts[brand] += 1
            dispensary_counts[disp_id] += 1
            picks.append(deal)

        # Second pass: allow repeat brands if pool still has capacity
        if len(picks) < slots:
            for deal in pool:
                if len(picks) >= slots:
                    break
                if deal in picks:
                    continue
                brand = _brand_key(deal)
                disp_id = deal.get("dispensary_id") or ""
                if brand_counts[brand] >= MAX_SAME_BRAND_TOTAL:
                    continue
                if dispensary_counts[disp_id] >= MAX_SAME_DISPENSARY_TOTAL:
                    continue
                brand_counts[brand] += 1
                dispensary_counts[disp_id] += 1
                picks.append(deal)

        category_picks[cat] = picks

    # ------------------------------------------------------------------
    # Step 3: Interleave categories for feed variety
    # ------------------------------------------------------------------
    result: list[dict[str, Any]] = []
    # Sort categories by their target weight (most popular first)
    cat_order = sorted(
        category_picks.keys(),
        key=lambda c: CATEGORY_TARGETS.get(c, 0),
        reverse=True,
    )
    # Create iterators for each category
    cat_iters: dict[str, list[dict[str, Any]]] = {
        cat: list(category_picks[cat]) for cat in cat_order
    }
    cat_cycle = cycle(cat_order)
    last_cats: list[str] = []

    while len(result) < target:
        # Try each category in round-robin
        tried = 0
        placed = False
        while tried < len(cat_order):
            cat = next(cat_cycle)
            tried += 1

            # Check consecutive-same-category constraint
            if (
                len(last_cats) >= MAX_CONSECUTIVE_SAME_CATEGORY
                and all(c == cat for c in last_cats[-MAX_CONSECUTIVE_SAME_CATEGORY:])
            ):
                continue

            if cat_iters.get(cat):
                deal = cat_iters[cat].pop(0)
                result.append(deal)
                last_cats.append(cat)
                placed = True
                break

        if not placed:
            # All iterators empty or blocked — force-drain remaining
            for cat in cat_order:
                while cat_iters.get(cat):
                    result.append(cat_iters[cat].pop(0))
                    if len(result) >= target:
                        break
                if len(result) >= target:
                    break
            break

    # ------------------------------------------------------------------
    # Step 4: Dispensary cap enforcement
    # ------------------------------------------------------------------
    final_disp_counts: dict[str, int] = defaultdict(int)
    for deal in result:
        disp_id = deal.get("dispensary_id") or ""
        final_disp_counts[disp_id] += 1

    over_cap = [
        disp_id for disp_id, count in final_disp_counts.items()
        if count > MAX_SAME_DISPENSARY_TOTAL
    ]
    if over_cap:
        # Remove lowest-scored excess from over-represented dispensaries
        for disp_id in over_cap:
            disp_deals = [
                (i, d) for i, d in enumerate(result)
                if (d.get("dispensary_id") or "") == disp_id
            ]
            disp_deals.sort(key=lambda x: x[1].get("deal_score", 0))
            excess = len(disp_deals) - MAX_SAME_DISPENSARY_TOTAL
            remove_indices = {idx for idx, _ in disp_deals[:excess]}
            result = [d for i, d in enumerate(result) if i not in remove_indices]

    return result[:TARGET_DEAL_COUNT]


# =====================================================================
# Main pipeline entry point
# =====================================================================


def detect_deals(
    products: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Full pipeline: filter -> score -> select top 100.

    Returns only the curated top deals with ``deal_score`` set.
    All other products should get ``deal_score = 0``.

    Also stores reporting data on the module for the scrape report
    (accessible via ``get_last_report_data()``).
    """
    global _last_report_data

    # Step 1: Hard filter
    qualifying: list[dict[str, Any]] = []
    for product in products:
        if passes_hard_filters(product):
            qualifying.append(product)

    logger.info(
        "Hard filter: %d/%d products passed", len(qualifying), len(products)
    )

    # Step 2: Score qualifying deals
    scored: list[dict[str, Any]] = []
    for product in qualifying:
        score = calculate_deal_score(product)
        scored.append({**product, "deal_score": score})

    scored.sort(key=lambda d: d["deal_score"], reverse=True)
    logger.info(
        "Scored %d deals (top score: %d, median: %d)",
        len(scored),
        scored[0]["deal_score"] if scored else 0,
        scored[len(scored) // 2]["deal_score"] if scored else 0,
    )

    # Step 3: Quality gate — reject incomplete / garbage data
    quality_before = len(scored)
    scored = [d for d in scored if passes_quality_gate(d)]
    quality_rejected = quality_before - len(scored)
    if quality_rejected > 0:
        logger.info(
            "Quality gate: %d/%d deals rejected (incomplete data)",
            quality_rejected, quality_before,
        )

    # Step 4: Select top ~200 with diversity
    top_deals = select_top_deals(scored)
    logger.info("Selected %d top deals for display", len(top_deals))

    # Store reporting data for the scrape summary
    selected_keys = {
        (d.get("name", ""), d.get("sale_price")) for d in top_deals
    }
    cut_deals = [
        d for d in scored
        if (d.get("name", ""), d.get("sale_price")) not in selected_keys
    ]
    _last_report_data = {
        "total_products": len(products),
        "passed_hard_filter": len(qualifying),
        "scored": len(scored),
        "selected": len(top_deals),
        "top_deals": top_deals,
        "cut_deals": cut_deals,
    }

    return top_deals


# Module-level storage for the last run's report data
_last_report_data: dict[str, Any] = {}


def get_last_report_data() -> dict[str, Any]:
    """Return the report data from the most recent ``detect_deals`` call."""
    return _last_report_data
