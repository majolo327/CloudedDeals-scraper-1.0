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

# Dollar amounts followed by "off" / "save" — these are discount labels, not prices.
_RE_DISCOUNT_LABEL = re.compile(
    r"\$\s*[\d]+(?:\.[\d]{1,2})?\s*(?:off|save|discount)\b",
    re.IGNORECASE,
)

# Bundle deal with inline tier price: "2/$55 $35" (qty/bundle_total tier_price)
_RE_BUNDLE_TIER = re.compile(
    r"(?P<qty>[2-9])\s*/\s*\$\s*(?P<total>[\d]+(?:\.[\d]{1,2})?)"
    r"\s+\$\s*(?P<tier>[\d]+(?:\.[\d]{1,2})?)",
)

# Bundle deal: "2 / $60" or "3/$60" (no inline tier price)
_RE_BUNDLE = re.compile(
    r"(?P<qty>[2-9])\s*/\s*\$\s*(?P<total>[\d]+(?:\.[\d]{1,2})?)",
)

# BOGO (buy one get one)
_RE_BOGO = re.compile(r"\bBOGO\b", re.IGNORECASE)


def extract_prices(text: str) -> dict[str, Any]:
    """Return ``original_price``, ``sale_price``, and ``discount_percent``.

    Handles bundle deals (``2/$60``), tier pricing (``2/$55 $35``), BOGO,
    explicit was/now, and plain multi-price lines.

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

    # Strategy 2 — Bundle with inline tier price: "2/$55 $35"
    # The tier price on the same line IS the sale price; bundle total is
    # treated as the original (regular) price.
    m = _RE_BUNDLE_TIER.search(text)
    if m:
        bundle_total = float(m.group("total"))
        tier_price = float(m.group("tier"))
        original = max(bundle_total, tier_price)
        sale = min(bundle_total, tier_price)
        result["original_price"] = original
        result["sale_price"] = sale
        result["discount_percent"] = _calc_discount(original, sale)
        return result

    # Strategy 3 — Bundle deal without tier: "N / $X" with separate unit price.
    # The unit price (standalone "$XX.00") is the original; per-unit bundle
    # price (total / qty) is the sale price.
    m = _RE_BUNDLE.search(text)
    if m:
        qty = int(m.group("qty"))
        bundle_total = float(m.group("total"))
        per_unit = round(bundle_total / qty, 2)

        # Find dollar amounts NOT inside the bundle match.
        bundle_start = m.start()
        bundle_end = m.end()
        unit_prices = [
            float(x.group("amt"))
            for x in _RE_DOLLAR.finditer(text)
            if not (bundle_start <= x.start() < bundle_end)
        ]

        if unit_prices:
            unit_price = unit_prices[-1]
            original = max(unit_price, per_unit)
            sale = min(unit_price, per_unit)
            result["original_price"] = original
            result["sale_price"] = sale
            result["discount_percent"] = _calc_discount(original, sale)
        else:
            result["sale_price"] = per_unit
        return result

    # Strategy 4 — BOGO: buy one get one free → 50% off.
    if _RE_BOGO.search(text):
        amounts = [float(x.group("amt")) for x in _RE_DOLLAR.finditer(text)]
        if amounts:
            unit_price = amounts[-1]
            result["original_price"] = unit_price
            result["sale_price"] = round(unit_price / 2, 2)
            result["discount_percent"] = 50.0
        return result

    # Strategy 5 — multiple dollar amounts (first = original, last = sale).
    # CRITICAL: Filter out dollar amounts that are part of discount labels
    # like "$8.00 off" — these are NOT prices.
    discount_label_spans = [
        (m.start(), m.end()) for m in _RE_DISCOUNT_LABEL.finditer(text)
    ]
    amounts = []
    for m in _RE_DOLLAR.finditer(text):
        # Skip this dollar amount if it falls inside a discount label
        in_discount = any(
            start <= m.start() < end for start, end in discount_label_spans
        )
        if not in_discount:
            amounts.append(float(m.group("amt")))

    if len(amounts) >= 2:
        # Prices: highest = original, lowest = sale (more robust than positional)
        original = max(amounts)
        sale = min(amounts)
        result["original_price"] = original
        result["sale_price"] = sale
        result["discount_percent"] = _calc_discount(original, sale)
    elif len(amounts) == 1:
        result["sale_price"] = amounts[0]

    return result


def _calc_discount(original: float, sale: float) -> float | None:
    if original <= 0:
        return None
    return round((1 - sale / original) * 100, 1)


def validate_prices(parsed: dict[str, Any]) -> dict[str, Any]:
    """Post-parse price sanity checks. Fixes common scraping errors.

    - Swaps original/sale when inverted
    - Detects discount amounts misread as sale prices
    - Flags suspiciously low prices
    """
    sale = parsed.get("sale_price")
    original = parsed.get("original_price")

    if not sale or sale <= 0:
        return parsed

    # Rule 1: If sale_price > original_price, they're swapped
    if original and original < sale:
        parsed["original_price"] = sale
        parsed["sale_price"] = original
        sale, original = original, sale
        parsed["discount_percent"] = _calc_discount(original, sale)

    # Rule 2: If original == sale, no real discount
    if original and original == sale:
        parsed["original_price"] = None
        parsed["discount_percent"] = None

    # Rule 3: If sale_price < $3 and we have an original, this might be
    # a discount amount that slipped through (e.g., "$3 off" parsed as "$3")
    if sale < 3 and original and original > sale:
        inferred_sale = original - sale
        if inferred_sale > 3:
            parsed["sale_price"] = inferred_sale
            parsed["discount_percent"] = _calc_discount(original, inferred_sale)

    return parsed


# =====================================================================
# 2. Weight extraction
# =====================================================================

# Matches: 3.5g, 0.5g, .5g, 100mg, 1oz, etc.
# CRITICAL: mg must appear before g in the alternation so that "850mg"
# is not partially matched as "85" + "0g".
# The qty group handles optional leading digit for ".5g" → 0.5
_RE_WEIGHT_METRIC = re.compile(
    r"(?P<qty>\d*\.?\d+)\s*(?P<unit>mg|g|oz)\b", re.IGNORECASE,
)

# Common fractional / shorthand names → grams.
_WEIGHT_ALIASES: dict[str, float] = {
    "1/8":     3.5,
    "eighth":  3.5,
    "quarter": 7.0,
    "half":    14.0,
}

# Fractional-oz patterns: "1/8", "1/8oz", "1/4oz", "1/2oz" (optional space
# before "oz").  MUST be checked BEFORE _RE_WEIGHT_METRIC because that regex
# would incorrectly match the denominator alone (e.g. "8oz" from "1/8oz").
_RE_FRAC_OZ = re.compile(r"\b(1/[248])\s*(?:oz)?\b", re.IGNORECASE)

_FRAC_TO_GRAMS: dict[str, float] = {
    "1/8": 3.5,
    "1/4": 7.0,
    "1/2": 14.0,
}


def extract_weight(text: str) -> dict[str, Any]:
    """Return ``weight_value`` and ``weight_unit`` parsed from *text*.

    >>> extract_weight("Blue Dream 3.5g")
    {'weight_value': 3.5, 'weight_unit': 'g'}
    >>> extract_weight("Premium Eighth")
    {'weight_value': 3.5, 'weight_unit': 'g'}
    >>> extract_weight("Rove 1/8oz")
    {'weight_value': 3.5, 'weight_unit': 'g'}
    """
    result: dict[str, Any] = {"weight_value": None, "weight_unit": None}

    # Fractional-oz patterns FIRST: "1/8", "1/8oz", "1/4oz", "1/2oz".
    # MUST check before _RE_WEIGHT_METRIC which incorrectly matches the
    # denominator as a standalone number (e.g. "8oz" from "1/8oz").
    frac_m = _RE_FRAC_OZ.search(text)
    if frac_m:
        frac = frac_m.group(1)
        grams = _FRAC_TO_GRAMS.get(frac)
        if grams is not None:
            result["weight_value"] = grams
            result["weight_unit"] = "g"
            return result

    # Explicit numeric weight (3.5g, 100mg, 1oz).
    m = _RE_WEIGHT_METRIC.search(text)
    if m:
        value = float(m.group("qty"))
        unit = m.group("unit").lower()

        # Convert oz to grams (e.g. "1oz" → 28g)
        if unit == "oz":
            value = round(value * 28, 1)
            unit = "g"

        # Sanity check: vapes/carts should not exceed 2 g. A value like
        # 5.0 g is almost certainly 0.5 g with a misplaced decimal.
        if unit == "g" and value > 2:
            lower_text = text.lower()
            if any(kw in lower_text for kw in (
                "vape", "cart", "cartridge", "pod", "disposable",
                "stiizy", "stiiizy", "pax", "510",
            )):
                value = value / 10

        result["weight_value"] = value
        result["weight_unit"] = unit
        return result

    # Named aliases ("eighth", "quarter", "half").
    lower = text.lower()
    for alias, grams in _WEIGHT_ALIASES.items():
        if alias == "1/8":
            continue  # already handled by _RE_FRAC_OZ above
        if re.search(rf"\b{alias}\b", lower):
            result["weight_value"] = grams
            result["weight_unit"] = "g"
            return result

    return result


# =====================================================================
# 3. Brand detection
# =====================================================================

KNOWN_BRANDS: list[str] = [
    # -- Premium Tier --
    "Cookies",
    "Runtz",
    "Connected",
    "Alien Labs",
    "Jungle Boys",
    "Packwoods",
    "Doja",
    "STIIIZY",
    "Raw Garden",
    "Heavy Hitters",
    "Kingpen",
    "Select",
    "Plug Play",
    "PAX",
    "Jeeter",
    "Backpack Boyz",
    "Wonderbrett",
    "Ember Valley",
    # -- Mid-Tier / Popular --
    "Kynd",
    "Verano",
    "MPX",
    "Tsunami",
    "Virtue",
    "Matrix",
    "Tahoe Hydro",
    "The Clear",
    "City Trees",
    "Trendi",
    "Qualcan",
    "NLVO",
    "Vapen",
    "SVC",
    "Crumbs",
    "Cannabiotix",
    "Rove",
    "Cresco",
    "Wyld",
    "Kiva",
    "Wana",
    "PLUS",
    # -- Value / Regional --
    "PANNA",
    "Reina",
    "Remedy",
    "Fuze",
    "Srene",
    "Aether Gardens",
    "Taproots",
    "DGF",
    "Polaris",
    "Mojave",
    "Vada",
    "SIP",
    "Exhale",
    "OLD PAL",
    # -- House / Dispensary Brands --
    "Planet 13",
    "The Sanctuary",
    "The Source",
    "Cultivate",
    "Essence",
    "Thrive",
    "Zen Leaf",
    "NuLeaf",
    "Oasis",
    # -- Additional well-known brands --
    "CAMP",
    "Fleur",
    "AMA",
    "Kannabis",
    "Binske",
    "Dzyne",
    "Fumeur",
    "Greenway Medical",
    "Highly Edible",
    "Huxton",
    "Mellow Vibes",
    "Nature's Chemistry",
    "State Flower",
    "TWE",
    "Incredibles",
    "Bhang",
    "CANN",
    "Camino",
    "Dosist",
    "Encore",
    "Grön",
    "Lost Farm",
    "MÜV",
    "Phat Panda",
    "Punch Edibles",
    "Robhots",
    "Stillwater",
    "Toast",
    "Almora",
    "Glass House",
    "Lowell",
    "Stone Road",
    "WYLD CBD",
    "Fig Farms",
    "Lemonnade",
    "Grandiflora",
    "Cannalean",
    "Cheeba Chews",
    "Curaleaf",
    "GTI",
    "IGO",
    "Leaf & Vine",
    "Local Cannabis",
    "Medizin",
    "MedMen",
    "Nuvaria",
    "Shango",
    "Terra",
    "Trulieve",
    "Tumbleweed",
    "Tyson 2.0",
    "Khalifa Kush",
    "Garcia Hand Picked",
    "Dr. Zodiak",
    "Presidential",
    # -- Added from dispensary menu audit (2026-02-09) --
    "&Shine",
    "AiroPro",
    "BaM",
    "Beboe",
    "CLEAR Brands",
    "Cosmonaut",
    "Evergreen Organix",
    "Flight Bites",
    "Ghost Town",
    "Grassroots",
    "Groove",
    "Highlights",
    "Hijinks",
    "Houseplant",
    "JAMS",
    "Just Edibles",
    "Keef",
    "Lift Tickets",
    "Local's Only",
    "Mojo",
    "Neon Cactus",
    "Nitro Dabs",
    "PACKS",
    "PANNA Extracts",
    "Prime",
    "Provisions",
    "Redwood",
    "Reserve",
    "RNBW",
    "RYTHM",
    "Sauce Essentials",
    "SeCHe",
    "Sip",
    "Smyle Labs",
    "Superior",
    "THC Design",
    "The Lab",
    "Tryke",
    "Tumbleweedz",
    "Voon",
    # -- Added from Gibson brand audit (2026-02-11) --
    "Ballers",
    "Bits",
    "Blink",
    "Bohemian Brothers",
    "Flower One",
    "GLP",
    "HSH",
    "INDO",
    "Kanji",
    "LEVEL",
    "LIT",
]

# Brand name variations for fuzzy matching — maps variant spellings
# to the canonical brand name used in KNOWN_BRANDS above.
BRAND_VARIATIONS: dict[str, list[str]] = {
    "MPX": ["M.P.X", "Melting Point Extracts", "Melting Point"],
    "Kynd": ["K.Y.N.D", "KYND Cannabis", "KYND"],
    "Cookies": ["Cookies SF", "Cookies Fam"],
    "Runtz": ["Runtz Brand", "Runtz OG"],
    "STIIIZY": ["Stiiizy", "STIIZY", "STIZY", "Stiizy"],
    "Airo": ["AiroPro", "Airo Pro", "Airo Brands"],
    "Local's Only": ["Locals Only", "LOCALS ONLY"],
    "Sip": ["Sip Elixirs"],
    "Presidential": ["Presidential RX"],
    "NLVO": ["N.L.V.O"],
    "OLD PAL": ["Old Pal", "OLDPAL"],
    "Tyson 2.0": ["Tyson", "Mike Tyson"],
    "Khalifa Kush": ["KK", "Wiz Khalifa"],
    "Cannabiotix": ["CBX", "C.B.X"],
    "GLP": ["Green Life Productions", "Green Life"],
    "Tumbleweed": ["Tumbleweed Extracts"],
    "Flower One": ["Flower 1", "FlowerOne"],
}

# Generic words that should NEVER be treated as a brand match even if they
# slip into KNOWN_BRANDS or match via fuzzy logic.  These are common
# product-type, strain-type, colour, and promo words that would cause
# false-positive brand detection on nearly every product listing.
NOT_BRANDS: set[str] = {
    # -- Promo / sale copy --
    "sale", "special", "deal",
    # -- Product types --
    "gummies", "flower", "vape", "infused", "preroll", "edible",
    "concentrate", "extract", "disposable", "tincture", "topical",
    # -- Strain types --
    "hybrid", "indica", "sativa", "cbd", "thc",
    # -- Colours (marketing tiers, not brands) --
    "black", "white", "blue", "green", "red", "gold", "silver",
    # -- Generic food / flavour words --
    "animal", "candy", "fruit", "berry", "cream", "sugar", "honey",
}

# Pre-compile a single pattern for speed (case-insensitive) with word boundaries
# to prevent false positives like "Raw" matching inside "Strawberry".
_RE_BRAND = re.compile(
    "|".join(r'\b' + re.escape(b) + r'\b' for b in sorted(KNOWN_BRANDS, key=len, reverse=True)),
    re.IGNORECASE,
)

# Build a flattened variation → canonical mapping and compile a pattern.
_VARIATION_TO_CANONICAL: dict[str, str] = {}
for _canon, _variants in BRAND_VARIATIONS.items():
    for _var in _variants:
        _VARIATION_TO_CANONICAL[_var.lower()] = _canon

_RE_VARIATION = re.compile(
    "|".join(
        r'\b' + re.escape(v) + r'\b'
        for v in sorted(_VARIATION_TO_CANONICAL.keys(), key=len, reverse=True)
    ),
    re.IGNORECASE,
) if _VARIATION_TO_CANONICAL else None


def detect_brand(text: str) -> str | None:
    """Return the first known brand found in *text*, or ``None``.

    Checks exact brand names first, then falls back to known
    brand-name variations (fuzzy matching).  Matches against
    ``NOT_BRANDS`` are silently discarded to prevent generic words
    (colours, product types, promo terms) from being treated as brands.

    >>> detect_brand("STIIIZY Premium Pod 1g")
    'STIIIZY'
    >>> detect_brand("no brand here")
    """
    # Strategy 1: exact match against canonical brand names.
    m = _RE_BRAND.search(text)
    if m:
        matched = m.group(0)
        # Reject matches that are generic / non-brand words
        if matched.lower() in NOT_BRANDS:
            pass  # fall through to variation check
        else:
            for brand in KNOWN_BRANDS:
                if brand.lower() == matched.lower():
                    return brand
            return matched

    # Strategy 2: check brand variations.
    if _RE_VARIATION is not None:
        m = _RE_VARIATION.search(text)
        if m:
            canonical = _VARIATION_TO_CANONICAL[m.group(0).lower()]
            if canonical.lower() not in NOT_BRANDS:
                return canonical

    return None


# =====================================================================
# 4. Category detection
# =====================================================================

CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "skip":        ["rso", "tincture", "topical", "capsule", "cbd only",
                    "merch", "balm", "salve", "ointment", "lotion",
                    "transdermal", "patch", "roll-on", "suppository"],
    "flower":      ["flower", "bud", "buds", "eighth", "quarter", "half oz",
                    "nug", "smalls", "shake", "popcorn"],
    "preroll":     ["pre-roll", "pre roll", "preroll", "joint", "blunt",
                    "infused roll", "pr's", "prs"],
    "concentrate": ["wax", "shatter", "live resin", "live rosin", "rosin",
                    "badder", "batter", "budder", "crumble", "sauce",
                    "diamond", "sugar", "concentrate", "dab", "hash",
                    "kief"],
    "vape":        ["cart", "cartridge", "pod", "disposable", "vape",
                    "510", "pen"],
    "edible":      ["gummy", "gummies", "chocolate", "beverage", "drink",
                    "edible", "chew", "lozenge", "mint", "cookie",
                    "brownie", "candy"],
}

# Build one compiled pattern per category using word boundaries to prevent
# false positives (e.g., "mint" matching inside "minting").
_CATEGORY_PATTERNS: dict[str, re.Pattern[str]] = {
    cat: re.compile(
        "|".join(r'\b' + re.escape(kw) + r'\b' for kw in kws),
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


def infer_category_from_weight(
    weight_value: float | None,
    weight_unit: str | None,
) -> str | None:
    """Fallback category inference when no keyword match is found.

    Uses the weight value and unit as a heuristic:
      - mg → edible (100mg gummies, etc.)
      - g ≥ 3.5 → flower (eighths and up)
      - g < 3.5 → concentrate (0.5g–1g dabs/wax)
      - no weight → vape (carts often omit weight in text)

    Returns ``None`` when there is insufficient data to guess.
    """
    if weight_unit == "mg":
        return "edible"
    if weight_unit == "g" and weight_value is not None:
        return "flower" if weight_value >= 3.5 else "concentrate"
    # No weight info at all — most likely a vape cart / pod
    if weight_value is None and weight_unit is None:
        return "vape"
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
    parsed = validate_prices(parsed)
    parsed.update(extract_weight(text))
    parsed.update(extract_cannabinoids(text))
    parsed["brand"] = detect_brand(text)

    # Category: keyword match first, weight-based fallback if no match.
    category = detect_category(text)
    if category is None:
        category = infer_category_from_weight(
            parsed.get("weight_value"),
            parsed.get("weight_unit"),
        )
    parsed["category"] = category

    return parsed
