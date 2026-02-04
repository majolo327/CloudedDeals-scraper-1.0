"""
Product text parser for scraped dispensary data.

Takes the raw ``{"name": ..., "raw_text": ..., "price": ...}`` dicts
produced by the platform scrapers and enriches them with structured
fields: pricing, weight, brand, category, and cannabinoid percentages.

All functions are pure (no I/O) and operate on plain strings so they
are easy to unit-test independently of Playwright.
"""

from __future__ import annotations

import re
from typing import Any

# =====================================================================
# 1. Price extraction
# =====================================================================

# "was $45.00 now $30.00" / "Was $45 Now $30"
_RE_WAS_NOW = re.compile(
    r"was\s+\$\s*(?P<original>[\d]+(?:\.[\d]{1,2})?)"
    r"\s+now\s+\$\s*(?P<sale>[\d]+(?:\.[\d]{1,2})?)",
    re.IGNORECASE,
)

# Any standalone "$XX.XX" token.
_RE_DOLLAR = re.compile(r"\$\s*(?P<amt>[\d]+(?:\.[\d]{1,2})?)")


def extract_prices(text: str) -> dict[str, Any]:
    """Return ``original_price``, ``sale_price``, and ``discount_percent``.

    >>> extract_prices("was $50.00 now $35.00")
    {'original_price': 50.0, 'sale_price': 35.0, 'discount_percent': 30.0}
    >>> extract_prices("$25")
    {'original_price': None, 'sale_price': 25.0, 'discount_percent': None}
    """
    result: dict[str, Any] = {
        "original_price": None,
        "sale_price": None,
        "discount_percent": None,
    }

    # Strategy 1 — explicit "was / now" wording.
    m = _RE_WAS_NOW.search(text)
    if m:
        result["original_price"] = float(m.group("original"))
        result["sale_price"] = float(m.group("sale"))
        result["discount_percent"] = _calc_discount(
            result["original_price"], result["sale_price"]
        )
        return result

    # Strategy 2 — multiple dollar amounts (first = original, last = sale).
    amounts = [float(x.group("amt")) for x in _RE_DOLLAR.finditer(text)]
    if len(amounts) >= 2:
        result["original_price"] = amounts[0]
        result["sale_price"] = amounts[-1]
        result["discount_percent"] = _calc_discount(amounts[0], amounts[-1])
    elif len(amounts) == 1:
        result["sale_price"] = amounts[0]

    return result


def _calc_discount(original: float, sale: float) -> float | None:
    if original <= 0:
        return None
    return round((1 - sale / original) * 100, 1)


# =====================================================================
# 2. Weight extraction
# =====================================================================

# Matches: 3.5g, 100mg, 1oz, etc.
_RE_WEIGHT_METRIC = re.compile(
    r"(?P<qty>[\d]+(?:\.[\d]+)?)\s*(?P<unit>g|mg|oz)\b", re.IGNORECASE,
)

# Common fractional / shorthand names → grams.
_WEIGHT_ALIASES: dict[str, float] = {
    "1/8":     3.5,
    "eighth":  3.5,
    "quarter": 7.0,
    "half":    14.0,
}

_RE_FRACTION = re.compile(r"\b1/8\b")


def extract_weight(text: str) -> dict[str, Any]:
    """Return ``weight_value`` and ``weight_unit`` parsed from *text*.

    >>> extract_weight("Blue Dream 3.5g")
    {'weight_value': 3.5, 'weight_unit': 'g'}
    >>> extract_weight("Premium Eighth")
    {'weight_value': 3.5, 'weight_unit': 'g'}
    """
    result: dict[str, Any] = {"weight_value": None, "weight_unit": None}

    # Explicit numeric weight (3.5g, 100mg, 1oz).
    m = _RE_WEIGHT_METRIC.search(text)
    if m:
        result["weight_value"] = float(m.group("qty"))
        result["weight_unit"] = m.group("unit").lower()
        return result

    # Fractional "1/8".
    if _RE_FRACTION.search(text):
        result["weight_value"] = 3.5
        result["weight_unit"] = "g"
        return result

    # Named aliases.
    lower = text.lower()
    for alias, grams in _WEIGHT_ALIASES.items():
        if alias == "1/8":
            continue  # already handled above
        if re.search(rf"\b{alias}\b", lower):
            result["weight_value"] = grams
            result["weight_unit"] = "g"
            return result

    return result


# =====================================================================
# 3. Brand detection
# =====================================================================

KNOWN_BRANDS: list[str] = [
    "STIIIZY",
    "Cookies",
    "Wyld",
    "CAMP",
    "OLD PAL",
    "Select",
    "Raw Garden",
    "Kiva",
    "PLUS",
    "Wana",
    "Heavy Hitters",
    "Rove",
    "Fleur",
    "Trendi",
    "AMA",
    "Aether Gardens",
    "Binske",
    "City Trees",
    "Dzyne",
    "Fumeur",
    "Greenway Medical",
    "Highly Edible",
    "Huxton",
    "Kynd",
    "Matrix",
    "Mellow Vibes",
    "MPX",
    "Nature's Chemistry",
    "Qualcan",
    "Remedy",
    "State Flower",
    "TWE",
    "Verano",
    "Virtue",
]

# Pre-compile a single pattern for speed (case-insensitive).
_RE_BRAND = re.compile(
    "|".join(re.escape(b) for b in sorted(KNOWN_BRANDS, key=len, reverse=True)),
    re.IGNORECASE,
)


def detect_brand(text: str) -> str | None:
    """Return the first known brand found in *text*, or ``None``.

    >>> detect_brand("STIIIZY Premium Pod 1g")
    'STIIIZY'
    >>> detect_brand("no brand here")
    """
    m = _RE_BRAND.search(text)
    if m:
        matched = m.group(0)
        # Normalise to the canonical casing from KNOWN_BRANDS.
        for brand in KNOWN_BRANDS:
            if brand.lower() == matched.lower():
                return brand
        return matched
    return None


# =====================================================================
# 4. Category detection
# =====================================================================

CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "flower":      ["flower", "bud", "eighth", "quarter", "half oz",
                    "nug", "smalls", "shake"],
    "preroll":     ["pre-roll", "pre roll", "preroll", "joint", "blunt",
                    "infused roll"],
    "vape":        ["cart", "cartridge", "pod", "disposable", "vape",
                    "510"],
    "edible":      ["gummy", "gummies", "chocolate", "beverage", "drink",
                    "edible", "chew", "lozenge", "mint", "cookie",
                    "brownie", "candy"],
    "concentrate": ["wax", "shatter", "live resin", "live rosin", "rosin",
                    "badder", "batter", "budder", "crumble", "sauce",
                    "diamond", "sugar", "concentrate", "dab", "hash",
                    "kief"],
}

# Build one compiled pattern per category.
_CATEGORY_PATTERNS: dict[str, re.Pattern[str]] = {
    cat: re.compile(
        "|".join(re.escape(kw) for kw in kws),
        re.IGNORECASE,
    )
    for cat, kws in CATEGORY_KEYWORDS.items()
}


def detect_category(text: str) -> str | None:
    """Return the product category, or ``None`` if unrecognised.

    >>> detect_category("Blue Dream Flower 3.5g")
    'flower'
    >>> detect_category("Live Resin Batter 1g")
    'concentrate'
    """
    for category, pattern in _CATEGORY_PATTERNS.items():
        if pattern.search(text):
            return category
    return None


# =====================================================================
# 5. THC / CBD extraction
# =====================================================================

# "25.4% THC", "THC: 25.4%", "THC 25.4%"
_RE_THC = re.compile(
    r"(?:(?P<pct1>[\d]+(?:\.[\d]+)?)\s*%\s*THC)"
    r"|(?:THC\s*:?\s*(?P<pct2>[\d]+(?:\.[\d]+)?)\s*%)",
    re.IGNORECASE,
)

_RE_CBD = re.compile(
    r"(?:(?P<pct1>[\d]+(?:\.[\d]+)?)\s*%\s*CBD)"
    r"|(?:CBD\s*:?\s*(?P<pct2>[\d]+(?:\.[\d]+)?)\s*%)",
    re.IGNORECASE,
)


def extract_cannabinoids(text: str) -> dict[str, float | None]:
    """Return ``thc_percent`` and ``cbd_percent`` from *text*.

    >>> extract_cannabinoids("THC: 28.5% CBD: 0.1%")
    {'thc_percent': 28.5, 'cbd_percent': 0.1}
    >>> extract_cannabinoids("no info")
    {'thc_percent': None, 'cbd_percent': None}
    """
    result: dict[str, float | None] = {"thc_percent": None, "cbd_percent": None}

    m = _RE_THC.search(text)
    if m:
        raw = m.group("pct1") or m.group("pct2")
        result["thc_percent"] = float(raw)

    m = _RE_CBD.search(text)
    if m:
        raw = m.group("pct1") or m.group("pct2")
        result["cbd_percent"] = float(raw)

    return result


# =====================================================================
# Unified parse entry-point
# =====================================================================


def parse_product(raw: dict[str, Any]) -> dict[str, Any]:
    """Enrich a raw product dict from any platform scraper.

    Expects at least ``name`` and ``raw_text`` keys.  Returns a new dict
    with all original keys plus the parsed fields.
    """
    text = f"{raw.get('name', '')} {raw.get('raw_text', '')} {raw.get('price', '')}"

    parsed = {**raw}
    parsed.update(extract_prices(text))
    parsed.update(extract_weight(text))
    parsed.update(extract_cannabinoids(text))
    parsed["brand"] = detect_brand(text)
    parsed["category"] = detect_category(text)

    return parsed
