"""
Product classification: subtypes for prerolls and vapes.

Preroll subtypes:
  - infused_preroll: excluded from Top 100 but searchable
  - preroll_pack: excluded from Top 100 but searchable
  - (regular prerolls have subtype=None)

Vape subtypes (displayed on deal cards):
  - disposable: self-contained device, discarded after use (0.3-1g)
  - cartridge: threaded 510 cart, requires battery (0.5-1g)
  - pod: proprietary pod system (STIIIZY, PAX, Plug Play)
  - (fallback: None if subtype can't be determined)
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
]

_VAPE_CARTRIDGE_INDICATORS = [
    re.compile(r"\bcart(?:ridge)?\b", re.IGNORECASE),
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


def classify_product(
    name: str,
    brand: str | None,
    category: str | None,
) -> dict:
    """Classify a product for infused/pack status.

    Returns:
        {
            "is_infused": bool,
            "product_subtype": str | None,  # 'infused_preroll', 'preroll_pack', or None
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
                          "capsule", "tablet", "tea", "honey", "butter")
    is_edible_context = (
        cat in ("edible",)
        or any(kw in name_lower for kw in _EDIBLE_INDICATORS)
    )
    if not is_infused and not is_edible_context:
        is_pack = any(p.search(name_lower) for p in _PACK_INDICATORS)
        is_pack_brand = brand_lower in _PACK_BRANDS

        if is_pack or is_pack_brand:
            subtype = "preroll_pack"
            if cat and "preroll" not in cat and "pre-roll" not in cat:
                corrected_category = "preroll"
                logger.info(
                    "[CLASSIFY] %r recategorized → preroll (pack)", name[:60],
                )

    # --- Vape subtype detection ---
    if cat == "vape" and subtype is None:
        vape_sub = _classify_vape_subtype(name_lower, brand_lower)
        if vape_sub:
            subtype = vape_sub

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

    return {
        "is_infused": is_infused,
        "product_subtype": subtype,
        "corrected_category": corrected_category,
    }
