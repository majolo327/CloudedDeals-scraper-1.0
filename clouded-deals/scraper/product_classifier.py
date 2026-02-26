"""
Product classification: post-detection subtype enrichment and safety nets.

ARCHITECTURE NOTE:
    Primary category detection is handled by CloudedLogic.detect_category()
    in clouded_logic.py (10-step hierarchical detection).  This module runs
    AFTER primary detection and provides:

    1. **Subtype enrichment** — infused prerolls, packs, vape subtypes
       (disposable/cartridge/pod), concentrate subtypes, edible subtypes
    2. **Category correction safety nets** — catches edge cases where the
       primary detector got the category wrong (e.g. "All-In-One 0.5g"
       classified as concentrate instead of vape)
    3. **1g flower → preroll recategorization** — 1g flower doesn't exist
       in retail; it's always a preroll

    This is complementary to clouded_logic, NOT a competing system.

Preroll subtypes:
  - infused_preroll: excluded from Top 100 but searchable
  - preroll_pack: excluded from Top 100 but searchable
  - (regular prerolls have subtype=None)

Vape subtypes (displayed on deal cards):
  - disposable: self-contained device, discarded after use (0.3-1g)
  - cartridge: threaded 510 cart, requires battery (0.5-1g)
  - pod: proprietary pod system (STIIIZY, PAX, Plug Play)
  - (fallback: None if subtype can't be determined)

Concentrate subtypes (Phase D' enrichment):
  - live_resin, cured_resin, budder, badder, shatter, diamonds,
    sauce, rosin, hash_rosin, live_rosin, crumble, wax, sugar, rso, fsho

Edible subtypes (Phase D' enrichment):
  - gummy, chocolate, beverage, tincture, capsule, lozenge, baked_good, chew
"""

from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

# =====================================================================
# Infused detection
# =====================================================================

_INFUSED_INDICATORS = [
    re.compile(r"\binfused\b", re.IGNORECASE),
    re.compile(r"\bcaviar\b", re.IGNORECASE),
    re.compile(r"\bmoon\s*rock\b", re.IGNORECASE),
    re.compile(r"\bsun\s*rock\b", re.IGNORECASE),
    re.compile(r"\bdiamond[- ]?infused\b", re.IGNORECASE),
    re.compile(r"\bkief[- ]?infused\b", re.IGNORECASE),
    re.compile(r"\blive[- ]?resin[- ]?infused\b", re.IGNORECASE),
    re.compile(r"\bdistillate[- ]?infused\b", re.IGNORECASE),
    re.compile(r"\bhash[- ]?infused\b", re.IGNORECASE),
    re.compile(r"\brosin[- ]?infused\b", re.IGNORECASE),
    re.compile(r"\bINFSD\b"),
    re.compile(r"\bcoated\b", re.IGNORECASE),
    re.compile(r"\bdusted\b", re.IGNORECASE),
    re.compile(r"\b40s\b", re.IGNORECASE),
    re.compile(r"\b40's\b", re.IGNORECASE),
]

# Brand-specific product lines that are ALWAYS infused
_INFUSED_BRAND_LINES: dict[str, list[re.Pattern]] = {
    "rove": [re.compile(r"\bice\b", re.IGNORECASE)],
    "jeeter": [
        re.compile(r"\binfused\b", re.IGNORECASE),
        re.compile(r"\bbaby\s+jeeter\s+xl\b", re.IGNORECASE),
    ],
    "presidential": [re.compile(r"\binfused\b", re.IGNORECASE)],
    "heavy hitters": [re.compile(r"\bdiamond\b", re.IGNORECASE)],
}

# =====================================================================
# Vape subtype detection
# =====================================================================

_VAPE_DISPOSABLE_INDICATORS = [
    re.compile(r"\bdisposable\b", re.IGNORECASE),
    re.compile(r"\ball[- ]?in[- ]?one\b", re.IGNORECASE),
    re.compile(r"\baio\b", re.IGNORECASE),
    re.compile(r"\bready[- ]?to[- ]?use\b", re.IGNORECASE),
    re.compile(r"\bripper\b", re.IGNORECASE),
]

_VAPE_CARTRIDGE_INDICATORS = [
    re.compile(r"\bcart(?:ridge)?s?\b", re.IGNORECASE),
    re.compile(r"\b510\b"),
]

_VAPE_POD_INDICATORS = [
    re.compile(r"\bpod\b", re.IGNORECASE),
]

# Brands whose vapes are ALWAYS pods (proprietary systems)
_POD_BRANDS = {"stiiizy", "pax", "plug play"}

# Brands whose vapes are ALWAYS cartridges (510 thread)
_CART_BRANDS = {"rove", "select", "kingpen", "brass knuckles", "raw garden"}


def _classify_vape_subtype(name_lower: str, brand_lower: str) -> str | None:
    """Determine vape subtype from product name and brand."""
    # Explicit keyword matches take priority
    if any(p.search(name_lower) for p in _VAPE_POD_INDICATORS):
        return "pod"
    if any(p.search(name_lower) for p in _VAPE_DISPOSABLE_INDICATORS):
        return "disposable"
    if any(p.search(name_lower) for p in _VAPE_CARTRIDGE_INDICATORS):
        return "cartridge"

    # Brand-based fallback
    if brand_lower in _POD_BRANDS:
        return "pod"
    if brand_lower in _CART_BRANDS:
        return "cartridge"

    # Keyword heuristics in product name
    # "pen" without other indicators usually means disposable
    if re.search(r"\bpen\b", name_lower):
        return "disposable"

    return None


# =====================================================================
# Pack detection
# =====================================================================

_PACK_INDICATORS = [
    re.compile(r"\d+\s*-?\s*pack\b", re.IGNORECASE),
    re.compile(r"\d+\s*pk\b", re.IGNORECASE),
    re.compile(r"\bmulti[- ]?pack\b", re.IGNORECASE),
    re.compile(r"\bvariety[- ]?pack\b", re.IGNORECASE),
    # "Xg/Npk" pattern (e.g. "2g/4pk", "2.5g/5pk") — preroll packs
    re.compile(r"\d+\.?\d*\s*g\s*/\s*\d+\s*pk\b", re.IGNORECASE),
]

# Brands whose products are ALWAYS packs (never singles)
_PACK_BRANDS = {"dogwalkers"}


# =====================================================================
# Concentrate subtype detection
# =====================================================================

# Order matters — check more specific patterns first (e.g. "hash rosin"
# before "rosin", "live resin" before generic "resin").
_CONCENTRATE_SUBTYPE_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\bhash[- ]?rosin\b", re.IGNORECASE), "hash_rosin"),
    (re.compile(r"\blive[- ]?rosin\b", re.IGNORECASE), "live_rosin"),
    (re.compile(r"\brosin\b", re.IGNORECASE), "rosin"),
    (re.compile(r"\blive[- ]?resin\b", re.IGNORECASE), "live_resin"),
    (re.compile(r"\bcured[- ]?resin\b", re.IGNORECASE), "cured_resin"),
    (re.compile(r"\bdiamonds?\b", re.IGNORECASE), "diamonds"),
    (re.compile(r"\bsauce\b", re.IGNORECASE), "sauce"),
    (re.compile(r"\bbadder\b", re.IGNORECASE), "badder"),
    (re.compile(r"\bbudder\b", re.IGNORECASE), "budder"),
    (re.compile(r"\bshatter\b", re.IGNORECASE), "shatter"),
    (re.compile(r"\bcrumble\b", re.IGNORECASE), "crumble"),
    (re.compile(r"\bwax\b", re.IGNORECASE), "wax"),
    (re.compile(r"\bsugar\b", re.IGNORECASE), "sugar"),
    (re.compile(r"\b(?:rso|rick\s+simpson)\b", re.IGNORECASE), "rso"),
    (re.compile(r"\bfsho\b", re.IGNORECASE), "fsho"),
]


def _classify_concentrate_subtype(name_lower: str) -> str | None:
    """Determine concentrate subtype from product name."""
    for pattern, subtype in _CONCENTRATE_SUBTYPE_PATTERNS:
        if pattern.search(name_lower):
            return subtype
    return None


# =====================================================================
# Edible subtype detection
# =====================================================================

_EDIBLE_SUBTYPE_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\bgumm(?:y|ies)\b", re.IGNORECASE), "gummy"),
    (re.compile(r"\bchocolate\b", re.IGNORECASE), "chocolate"),
    (re.compile(r"\bbeverage|drink|soda|lemonade|tea\b", re.IGNORECASE), "beverage"),
    (re.compile(r"\btincture\b", re.IGNORECASE), "tincture"),
    (re.compile(r"\bcapsule|softgel|tablet\b", re.IGNORECASE), "capsule"),
    (re.compile(r"\blozenge|mint|hard\s+candy\b", re.IGNORECASE), "lozenge"),
    (re.compile(r"\bbrownie|cookie|bar\b", re.IGNORECASE), "baked_good"),
    (re.compile(r"\bcaramel|chew|taffy\b", re.IGNORECASE), "chew"),
]


def _classify_edible_subtype(name_lower: str) -> str | None:
    """Determine edible subtype from product name."""
    for pattern, subtype in _EDIBLE_SUBTYPE_PATTERNS:
        if pattern.search(name_lower):
            return subtype
    return None


def classify_product(
    name: str,
    brand: str | None,
    category: str | None,
    weight_value: float | str | None = None,
) -> dict:
    """Classify a product for infused/pack/subtype status.

    Returns:
        {
            "is_infused": bool,
            "product_subtype": str | None,
                # Preroll: 'infused_preroll', 'preroll_pack'
                # Vape: 'disposable', 'cartridge', 'pod'
                # Concentrate: 'live_resin', 'cured_resin', 'budder', 'badder',
                #   'shatter', 'diamonds', 'sauce', 'rosin', 'hash_rosin',
                #   'live_rosin', 'crumble', 'wax', 'sugar', 'rso', 'fsho'
                # Edible: 'gummy', 'chocolate', 'beverage', 'tincture',
                #   'capsule', 'lozenge', 'baked_good', 'chew'
            "corrected_category": str | None,  # only set if category should change
        }
    """
    name_lower = (name or "").lower()
    brand_lower = (brand or "").lower()
    cat = (category or "").lower()

    is_infused = False
    subtype: str | None = None
    corrected_category: str | None = None

    # --- Infused detection ---
    if any(pattern.search(name_lower) for pattern in _INFUSED_INDICATORS):
        is_infused = True

    # Brand-specific infused lines
    if brand_lower in _INFUSED_BRAND_LINES:
        patterns = _INFUSED_BRAND_LINES[brand_lower]
        if any(p.search(name_lower) for p in patterns):
            is_infused = True

    if is_infused:
        subtype = "infused_preroll"
        # Correct category if misclassified as concentrate
        if cat == "concentrate":
            corrected_category = "preroll"
            logger.info(
                "[CLASSIFY] %r recategorized: concentrate → preroll (infused)",
                name[:60],
            )

    # --- Pack detection (only if NOT infused) ---
    # CRITICAL: Skip pack detection for edibles/gummies.  Edible products
    # like "Gummies 10pk" or "Edible 5-pack" are NOT preroll packs.
    _EDIBLE_INDICATORS = ("edible", "gummy", "gummies", "chocolate", "candy",
                          "brownie", "chew", "lozenge", "mint", "cookie",
                          "beverage", "drink", "bar", "caramel", "tincture",
                          "capsule", "tablet", "tea", "honey", "butter",
                          "multipack", "pieces", "softgel", "melatonin")
    # Non-cannabis accessories that should never be reclassified as prerolls
    _ACCESSORY_INDICATORS = ("screen", "screens", "papers", "rolling paper",
                             "tips", "filter", "grinder", "lighter", "tray",
                             "stash", "storage", "pipe", "bong", "rig",
                             "torch", "dab tool", "nail",
                             "hemp wrap", "hemp wraps", "wrapper")
    # Empty cones (RAW, Pop Cones, etc.) are rolling papers, not prerolls
    _CONE_ACCESSORY_BRANDS = ("raw", "pop cones", "elements", "ocb", "zig zag",
                              "zig-zag", "hemper", "king palm")
    is_edible_context = (
        cat in ("edible",)
        or any(kw in name_lower for kw in _EDIBLE_INDICATORS)
    )
    # Cone accessory: brand-based OR any "cone(s)" + pack pattern without
    # infused/thc indicators (infused cones ARE cannabis products).
    _is_cone_accessory = (
        "cone" in name_lower
        and not any(kw in name_lower for kw in ("infused", "thc", "live resin"))
        and (any(b in name_lower for b in _CONE_ACCESSORY_BRANDS)
             or bool(re.search(r'\d+\s*-?\s*pack\b|\d+\s*pk\b', name_lower)))
    )
    is_accessory = (
        any(kw in name_lower for kw in _ACCESSORY_INDICATORS)
        or _is_cone_accessory
    )
    is_concentrate_context = cat in ("concentrate", "vape")
    if not is_infused and not is_edible_context and not is_accessory and not is_concentrate_context:
        is_pack = any(p.search(name_lower) for p in _PACK_INDICATORS)
        is_pack_brand = brand_lower in _PACK_BRANDS

        if is_pack or is_pack_brand:
            subtype = "preroll_pack"
            if cat and "preroll" not in cat and "pre-roll" not in cat:
                corrected_category = "preroll"
                logger.info(
                    "[CLASSIFY] %r recategorized → preroll (pack)", name[:60],
                )

    # --- 1g flower → preroll reclassification ---
    # A "1g flower" product does not exist in cannabis retail — 1g is always
    # a preroll or infused preroll.  Some dispensaries (notably STIIIZY)
    # miscategorize prerolls as flower.  Correct the category here so the
    # deal card shows "Pre-Roll" instead of "Flower 1g".
    if cat == "flower" and weight_value is not None:
        try:
            wv = float(weight_value)
        except (ValueError, TypeError):
            wv = None
        if wv is not None and 0.5 <= wv <= 1.5:
            corrected_category = "preroll"
            if is_infused:
                subtype = "infused_preroll"
            logger.info(
                "[CLASSIFY] %r recategorized: flower %.1fg → preroll (no 1g flower exists)",
                (name or "")[:60], wv,
            )

    # --- Vape subtype detection ---
    if cat == "vape" and subtype is None:
        vape_sub = _classify_vape_subtype(name_lower, brand_lower)
        if vape_sub:
            subtype = vape_sub

    # --- Concentrate subtype detection ---
    if cat == "concentrate" and subtype is None:
        subtype = _classify_concentrate_subtype(name_lower)

    # --- Edible subtype detection ---
    if cat == "edible" and subtype is None:
        subtype = _classify_edible_subtype(name_lower)

    # --- Safety net: disposable vape indicators override wrong category ---
    # Products with "all in one", "AIO", "disposable", "ready to use" in the
    # name are vapes even if detect_category got it wrong (e.g. "flower"
    # because the mg weight or keyword wasn't matched correctly).
    if cat not in ("vape",) and subtype is None:
        if any(p.search(name_lower) for p in _VAPE_DISPOSABLE_INDICATORS):
            corrected_category = "vape"
            subtype = "disposable"
            logger.info(
                "[CLASSIFY] %r recategorized: %s → vape (disposable indicator)",
                name[:60], cat,
            )

    # --- Safety net: cartridge/cart/pod keywords override wrong category ---
    # Products with "cartridge", "cart", or "pod" in the name are vapes,
    # not flower.  E.g. "3 for $50 Trendi Cartridges" miscategorized as
    # flower because "3" matched flower weight patterns.
    if cat not in ("vape",) and subtype is None and corrected_category != "vape":
        if any(p.search(name_lower) for p in _VAPE_CARTRIDGE_INDICATORS):
            corrected_category = "vape"
            subtype = "cartridge"
            logger.info(
                "[CLASSIFY] %r recategorized: %s → vape (cartridge indicator)",
                name[:60], cat,
            )
        elif any(p.search(name_lower) for p in _VAPE_POD_INDICATORS):
            corrected_category = "vape"
            subtype = "pod"
            logger.info(
                "[CLASSIFY] %r recategorized: %s → vape (pod indicator)",
                name[:60], cat,
            )

    return {
        "is_infused": is_infused,
        "product_subtype": subtype,
        "corrected_category": corrected_category,
    }
