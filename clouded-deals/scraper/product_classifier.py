"""
Product classification for infused pre-rolls and pre-roll packs.

Rules:
  - Infused pre-rolls: categorized as 'preroll', badge "Infused Pre-Roll",
    excluded from Top 100 but searchable everywhere.
  - Pre-roll packs: categorized as 'preroll', badge "Pre-Roll Pack",
    excluded from Top 100 but searchable everywhere.
  - Regular pre-rolls: categorized as 'preroll', badge "Pre-Roll",
    included in Top 100.
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

    return {
        "is_infused": is_infused,
        "product_subtype": subtype,
        "corrected_category": corrected_category,
    }
