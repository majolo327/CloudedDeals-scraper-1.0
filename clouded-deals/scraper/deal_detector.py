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
  4. **Similarity dedup** (``remove_similar_deals``) — prevents the same
     brand+category from flooding a single dispensary's slots.
  5. **Top-200 selection** (``select_top_deals``) — stratified pick with
     brand, dispensary, and category diversity constraints.

Only the ~200 deals returned by ``select_top_deals`` should have
``deal_score > 0`` and ``is_active = True`` in the database.
"""

from __future__ import annotations

import logging
import re
from collections import defaultdict
from itertools import cycle
from typing import Any

logger = logging.getLogger("deal_detector")

# =====================================================================
# Phase 1: Category price caps — maximum acceptable SALE price
# =====================================================================

CATEGORY_PRICE_CAPS: dict[str, dict[str, float] | float] = {
    "flower": {
        "3.5": 22,    # eighth — tightened from $25 ($22 is upper bound for deal-worthy eighths)
        "7": 40,      # quarter — tightened from $45
        "14": 55,     # half oz — tightened from $65 ($55 half oz is upper bound)
        "28": 100,    # full oz — relaxed from $79
    },
    "vape": 28,           # carts/pods — tightened from $35 ($24 .5g cart is already borderline)
    "edible": 14,         # gummies/chocolates — tightened from $15 ($15 edible is not a deal)
    "concentrate": {      # weight-based: live rosin can be pricier
        "0.5": 25,        # half gram
        "1": 45,          # gram — raised from flat $35
        "2": 75,          # 2g buckets
    },
    "preroll": 9,         # regular flower prerolls — tightened from $10 (should be $5-9)
    "infused_preroll": 15, # infused prerolls are premium products
    "preroll_pack": 25,   # preroll multi-packs — relaxed from $20
}

# Global hard-filter thresholds (apply to ALL categories)
HARD_FILTERS = {
    "min_discount_percent": 15,   # tightened from 12% — prevents non-deals from displacing steals
    "min_price": 3,               # below $3 = data error
    "max_price_absolute": 100,    # raised from $80 for oz flower + concentrates
    "max_discount_percent": 85,   # above 85% = fake/data error
    "require_original_price": True,
}

# Vape subtype price floors — minimum believable SALE price per subtype
# and weight tier.  Prices below these are almost certainly listing errors
# on the dispensary menu (e.g. $10 for a 1g disposable when the real market
# floor is $20-22).  Keyed by product_subtype → weight threshold → min price.
#
# Weight matching: ≤0.6g uses the "0.5" floor, >0.6g uses the "1" floor.
# Products without a detected weight use the conservative "0.5" floor.
VAPE_SUBTYPE_PRICE_FLOORS: dict[str, dict[str, float]] = {
    "disposable": {
        "0.5": 8,     # half-gram disposable min
        "1": 17,      # full-gram disposable min (real market floor $20-22)
    },
    "cartridge": {
        "0.5": 7,     # half-gram cart min
        "1": 14,      # full-gram cart min (real market floor ~$17)
    },
    "pod": {
        "0.5": 7,     # half-gram pod min
        "1": 14,      # full-gram pod min
    },
}

# Category-specific discount minimums — edibles and prerolls have real deals
# at lower discount percentages (e.g. $8 edible marked down from $10 = 20%,
# but a $9 edible from $10 = 10%).  These budget items are genuine deals
# that consumers want to see, not data errors.
CATEGORY_MIN_DISCOUNT: dict[str, float] = {
    "edible": 12,
    "preroll": 12,
}

# Maximum believable ORIGINAL price per category.  If the parsed original
# exceeds this, it's almost certainly garbage from bundle text leaking into
# the price parser (e.g. "3 for $50" inflating original to $120).
ORIGINAL_PRICE_CEILINGS: dict[str, float] = {
    "flower": 100,      # raised — oz flower can retail $90+
    "vape": 80,
    "edible": 50,       # raised — multi-dose edibles can be $40+
    "concentrate": 100,  # raised — live rosin can retail $80+
    "preroll": 30,       # raised — infused prerolls can retail $25
}

# =====================================================================
# Phase 2: Scoring constants
# =====================================================================

# Two-tier brand system: premium (hype/destination brands) and popular
# (solid brands consumers recognize and trust).
BRAND_TIERS: dict[str, dict[str, Any]] = {
    "premium": {
        "brands": {
            "stiiizy", "cookies", "raw garden", "kiva", "wyld",
            "connected", "alien labs", "jungle boys", "cannabiotix", "cbx",
            "jeeter", "packwoods", "runtz",
        },
        "points": 20,
    },
    "popular": {
        "brands": {
            "rove", "select", "heavy hitters", "trendi", "camp",
            "old pal", "pacific stone", "fleur", "virtue",
            "curaleaf", "matrix", "kynd", "city trees",
            "camino", "airopro", "bounti", "smokiez",
            "dixie", "sip", "mpx", "sublime",
            "wana", "incredibles", "verano", "grassroots",
            "rythm", "plug play", "pax", "kingpen",
            "doja", "wonderbrett", "ember valley", "backpack boyz",
            # Michigan-native popular brands
            "platinum vape", "mkx", "lume", "skymint",
            "element", "redbud roots", "pleasantrees",
            # Michigan expansion — Feb 2026
            "joyology", "pinnacle emporium", "herbana",
            "exclusive cannabis", "high profile", "five star extracts",
            "humblebee", "redemption", "drip", "viola",
            "house of dank", "hod", "church cannabis",
            "choice edibles", "detroit edibles", "nirvana center",
            # Illinois-native popular brands
            "revolution", "aeriz", "bedford grow", "cresco",
            "high supply", "good news", "matter", "superflux",
            "thrive", "essence", "cake", "&shine",
            "pts", "nature's grace", "encore edibles",
            "savvy", "reserve",
            # Arizona-native popular brands
            "abundant organics", "grow sciences", "item 9 labs",
            "timeless", "sonoran roots", "mohave cannabis",
            # Missouri-native popular brands
            "illicit", "flora farms", "vivid", "sinse",
            "proper", "clovr", "good day farm", "headchange",
            "elevate", "greenlight", "haze", "nature med",
            "vertical", "star buds", "bloc", "terrabis",
            "c4", "amaze cannabis", "keef", "robhots",
            # Missouri expansion — Feb 2026
            "swade", "fresh green", "n'bliss", "from the earth",
            "old route 66", "heya", "solhaus", "cloud nine",
            "heartland labs", "robust",
            # New Jersey-native popular brands
            "kind tree", "fernway", "ozone", "rythm",
            "garden greens", "the botanist", "clade9",
            "terrascend", "good green", "later days",
            "grön", "gron", "jams", "beboe", "avexia",
            "level", "bits",
            # NJ expansion — Feb 2026
            "breakwater", "garden state canna", "the heirloom collective",
            "harmony", "apothecarium", "purple leaf", "bloc nj",
            # Nevada dispensary house brands (boost when detected)
            "deep roots", "deep roots harvest",
            "state flower", "cultivation labs",
            "the sanctuary",
        },
        "points": 12,
    },
}

# Backwards-compat: flat set of all known brands (used by tests/imports)
PREMIUM_BRANDS: set[str] = {
    "STIIIZY", "Cookies", "Raw Garden", "Kiva", "Wyld",
    "Select", "Trendi", "CAMP", "Old Pal", "Pacific Stone",
    "Fleur", "Virtue", "Rove", "Heavy Hitters",
    "Runtz", "Connected", "Alien Labs", "Jungle Boys",
    "Packwoods", "Doja", "Kingpen", "Plug Play", "PAX",
    "Jeeter", "Backpack Boyz", "Wonderbrett", "Ember Valley",
    "RYTHM", "Wana", "Incredibles", "Verano", "Grassroots",
}

CATEGORY_BOOST: dict[str, int] = {
    "flower": 8,
    "vape": 8,
    "edible": 8,
    "concentrate": 7,
    "preroll": 7,
}

# =====================================================================
# Phase 3: Top-200 selection parameters
# =====================================================================

TARGET_DEAL_COUNT = 200

CATEGORY_TARGETS: dict[str, int] = {
    "flower": 60,
    "vape": 45,
    "edible": 30,
    "concentrate": 30,
    "preroll": 25,
    "other": 10,
}

# Minimum category floors — each category must fill at least this many
# slots before surplus is redistributed.  Prevents the feed from being
# dominated by a single category (e.g. all prerolls, no flower).
CATEGORY_MINIMUMS: dict[str, int] = {
    "flower": 12,
    "vape": 10,
    "edible": 8,
    "concentrate": 6,
    "preroll": 6,
    "other": 0,
}

MAX_SAME_BRAND_TOTAL = 5          # was 8 — tighter cap so one brand can't dominate the feed
MAX_SAME_DISPENSARY_TOTAL = 12
MAX_CONSECUTIVE_SAME_CATEGORY = 3
MAX_CONSECUTIVE_SAME_BRAND = 1        # no same-brand cards adjacent in the feed
MAX_SAME_BRAND_PER_DISPENSARY = 2  # similarity dedup
MAX_SAME_BRAND_PER_CATEGORY = 3    # cap per brand within a single category across all dispensaries
MAX_UNKNOWN_BRAND_TOTAL = 0        # no unknown brand deals — users want recognized brands only

# Backfill caps — used in round 2 when round 1 under-fills the target.
# More generous than the primary caps so the feed can fill, but still
# prevent a single brand/dispensary from taking over.
_BACKFILL_BRAND_TOTAL = 10
_BACKFILL_BRAND_PER_CATEGORY = 6
_BACKFILL_DISPENSARY_TOTAL = 18
_BACKFILL_UNKNOWN_BRAND_TOTAL = 0
_BACKFILL_THRESHOLD = 0.85  # trigger backfill when round 1 fills < 85% of target

# Dispensary minimum exposure — every dispensary with qualifying deals
# should appear at least this many times in the feed.  Ensures smaller
# shops get visibility alongside high-volume dispensaries.
MIN_DEALS_PER_DISPENSARY = 1

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


# Non-cannabis product keywords — reject from deal curation.
# These are accessories, apparel, and non-consumable items that sometimes
# appear on dispensary menus and slip through category detection.
_NON_CANNABIS_KEYWORDS = {
    "apparel", "clothing", "shirt", "t-shirt", "tshirt", "hoodie",
    "hat", "cap", "beanie", "socks", "merch", "merchandise",
    "accessory", "accessories", "grinder", "lighter", "tray",
    "rolling paper", "pipe", "bong", "stash", "bag", "backpack",
    "lanyard", "keychain", "pin", "sticker", "poster",
    "gift card", "gift certificate",
}


def _passes_price_cap(
    sale_price: float,
    category: str,
    weight_value: float | None,
) -> bool:
    """Check whether *sale_price* is within the category price cap.

    Extracted so it can be reused by both the full and loose filter paths.
    """
    caps = CATEGORY_PRICE_CAPS.get(category)
    if caps is None:
        return sale_price <= 50

    if isinstance(caps, dict):
        sorted_keys = sorted(caps.keys(), key=lambda k: float(k))
        if weight_value:
            weight_str = str(weight_value)
            if float(weight_value) == int(float(weight_value)):
                weight_str = str(int(float(weight_value)))
            cap = caps.get(weight_str)
            if cap is not None:
                return sale_price <= cap
            wv = float(weight_value)
            best_cap = caps[sorted_keys[0]]
            for k in sorted_keys:
                if float(k) <= wv:
                    best_cap = caps[k]
            return sale_price <= best_cap
        else:
            return sale_price <= caps[sorted_keys[0]]
    else:
        return sale_price <= caps


def passes_hard_filters(product: dict[str, Any]) -> bool:
    """Return ``False`` if the product should be completely excluded.

    Checks global price bounds, minimum discount, original price
    presence, category-specific price caps, and non-cannabis keywords.

    **Jane platform exception**: Jane sites do not display original
    prices — only the current/deal price is available.  For Jane
    products we use *loose* qualification: price cap + brand match
    only, skipping discount and original-price checks.

    Infused pre-rolls are now ALLOWED (they're popular products).
    Only preroll multi-packs remain excluded from curation.
    """
    # Exclude pre-roll packs from curation (they remain searchable).
    subtype = product.get("product_subtype")
    if subtype == "preroll_pack":
        return False

    # Exclude non-cannabis products (apparel, accessories, merch, etc.)
    name_lower = (product.get("name") or "").lower()
    raw_lower = (product.get("raw_text") or "").lower()
    for keyword in _NON_CANNABIS_KEYWORDS:
        if keyword in name_lower or keyword in raw_lower:
            return False

    sale_price = product.get("sale_price") or product.get("current_price") or 0
    original_price = product.get("original_price") or 0
    discount = product.get("discount_percent")
    category = product.get("category", "other")
    weight_value = product.get("weight_value")
    source_platform = product.get("source_platform", "")

    # --- Global price floor / ceiling (applies to ALL platforms) ---
    if not sale_price or sale_price < HARD_FILTERS["min_price"]:
        return False
    if sale_price > HARD_FILTERS["max_price_absolute"]:
        return False

    # --- Vape subtype price floors (catches listing errors) ---
    # A $10 1g disposable is almost certainly a mislisted price when the
    # real market floor is $20-22.  Reject vapes priced below believable
    # minimums for their subtype and weight.  Applies to ALL platforms.
    if category == "vape" and subtype in VAPE_SUBTYPE_PRICE_FLOORS:
        floors = VAPE_SUBTYPE_PRICE_FLOORS[subtype]
        try:
            wv = float(weight_value) if weight_value else 0
        except (ValueError, TypeError):
            wv = 0
        # ≤0.6g → half-gram floor; >0.6g → full-gram floor
        floor = floors.get("1", 0) if wv > 0.6 else floors.get("0.5", 0)
        if sale_price < floor:
            return False

    # ------------------------------------------------------------------
    # LOOSE QUALIFICATION — platforms without original price data
    # Jane, Carrot, and AIQ do NOT display original prices — only the
    # current/deal price.  We cannot calculate discount_percent, so we
    # skip the discount and original-price checks.  Qualification is
    # price cap only.  Brand is NOT required here — many of these sites
    # have unreliable brand extraction.  Products with recognized brands
    # score higher in Phase 2; brandless products get a lower score but
    # aren't excluded.
    # ------------------------------------------------------------------
    if source_platform in ("jane", "carrot", "aiq"):
        return _passes_price_cap(sale_price, category, weight_value)

    # --- Standard filters (non-Jane platforms) ---
    min_disc = CATEGORY_MIN_DISCOUNT.get(category, HARD_FILTERS["min_discount_percent"])
    if discount is None or discount < min_disc:
        return False
    if discount > HARD_FILTERS["max_discount_percent"]:
        return False  # fake discount / data error
    if HARD_FILTERS["require_original_price"]:
        if not original_price or original_price <= sale_price:
            return False

    # Reject products with unreasonably high original prices — almost always
    # a parsing artifact from bundle/promo text leaking into the price parser.
    orig_ceiling = ORIGINAL_PRICE_CEILINGS.get(category)
    if orig_ceiling and original_price > orig_ceiling:
        return False

    # --- Category-specific price caps ---
    # Preroll-specific: infused prerolls use a higher cap than regular flower
    # prerolls.  Regular 1g flower prerolls should be $5-9 (never $10-12),
    # but infused prerolls are premium products and legitimately cost more.
    if category == "preroll" and subtype == "infused_preroll":
        return sale_price <= CATEGORY_PRICE_CAPS.get("infused_preroll", 15)

    return _passes_price_cap(sale_price, category, weight_value)


def failed_by_price_cap(product: dict[str, Any]) -> bool:
    """Return ``True`` if the product would fail hard filters *specifically*
    due to the category price cap (not discount, not global bounds).

    Used for data enrichment metrics — tells us how many products per state
    are being rejected by NV-calibrated price caps, which signals when
    state-specific caps are needed.
    """
    sale_price = product.get("sale_price") or product.get("current_price") or 0
    category = product.get("category", "other")
    weight_value = product.get("weight_value")
    subtype = product.get("product_subtype")

    if not sale_price or sale_price < HARD_FILTERS["min_price"]:
        return False  # rejected by global floor, not price cap
    if sale_price > HARD_FILTERS["max_price_absolute"]:
        return False  # rejected by global ceiling, not price cap

    if category == "preroll" and subtype == "infused_preroll":
        return sale_price > CATEGORY_PRICE_CAPS.get("infused_preroll", 15)

    return not _passes_price_cap(sale_price, category, weight_value)


# =====================================================================
# Quality gate — reject incomplete / garbage deals
# =====================================================================

# Names that are just strain types, classifications, or category labels — not real products
_STRAIN_ONLY_NAMES = {
    "indica", "sativa", "hybrid", "cbd", "thc", "unknown",
    "flower", "vape", "edible", "concentrate", "preroll", "pre-roll",
    "cartridge", "cart", "badder", "shatter", "wax", "gummy", "gummies",
}

# Categories that should always have a detected weight
_WEIGHT_REQUIRED_CATEGORIES = {"flower", "concentrate", "vape"}

# Promotional / bundle text patterns — deals with these in the product
# name are not individual products with verifiable quality.  Catches
# items like "3 for $50 Trendi Cartridges" or "2/$40 Power Pack".
_PROMO_TEXT_RE = re.compile(
    r"\b\d+\s+for\s+\$\d+"           # "3 for $50"
    r"|\b\d+\s*/\s*\$\d+"            # "2/$40"
    r"|\bbuy\s+\d+\s+get\b"          # "buy 2 get 1"
    r"|\bbogo\b"                      # "BOGO"
    r"|\bmix\s*(?:and|&|n)\s*match\b" # "mix and match"
    r"|\bbundle\b",                   # "bundle"
    re.IGNORECASE,
)


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

    # Reject deals with no detected brand — "UNKNOWN" brand cards are
    # confusing to users and indicate a parsing problem.  We require a
    # brand on every displayed deal, ALL platforms including Jane.
    # Users want recognized brands only.
    if not brand:
        return False

    # Reject strain-type-only product names
    if name.strip().lower() in _STRAIN_ONLY_NAMES:
        return False

    # Reject very short names (likely garbage)
    if len(name.strip()) < 5:
        return False

    # Reject products where name == brand (redundant display)
    if brand and name.strip().lower() == brand.lower():
        return False

    # Reject products where name is a repeated word (e.g. "Badder Badder")
    name_words = name.strip().lower().split()
    if len(name_words) == 2 and name_words[0] == name_words[1]:
        return False

    # Reject bundle/promo text that slipped through scraper filters —
    # "3 for $50 Trendi Cartridges", "2/$40 Power Pack", etc.
    # These are not individual product deals with verifiable quality.
    if _PROMO_TEXT_RE.search(name):
        return False

    # Reject products with no weight in categories that need it
    if category in _WEIGHT_REQUIRED_CATEGORIES and not weight_value:
        return False

    # Reject edibles with tiny THC content — 9.5mg, 10mg single-dose items
    # are not real deals.  Standard dispensary edibles are 100mg+.
    if category == "edible" and weight_value:
        try:
            wv = float(weight_value)
            if wv < 50:
                return False
        except (ValueError, TypeError):
            pass

    return True


def _dispensary_deal_floor(product_count: int) -> int:
    """Minimum number of deals a dispensary should surface based on scraped product count.

    Scales with store size so every dispensary gets fair representation:
      10-49 products  → at least 1 deal
      50-149 products → at least 2 deals
      150+ products   → at least 3 deals
    Stores with <10 products get no guaranteed floor.
    """
    if product_count >= 150:
        return 3
    if product_count >= 50:
        return 2
    if product_count >= 10:
        return 1
    return 0


def passes_relaxed_quality_gate(product: dict[str, Any]) -> bool:
    """Lenient quality gate used only for dispensary minimum-floor backfill.

    Relaxes the strict gate by:
      - Allowing missing brand (small stores often have poor brand extraction)
      - Allowing missing weight (better to show a deal with "?" weight than nothing)
    Still rejects genuinely garbage data (strain-only names, tiny names).
    """
    name = product.get("name") or ""

    # Reject strain-type-only product names
    if name.strip().lower() in _STRAIN_ONLY_NAMES:
        return False

    # Reject very short names (likely garbage)
    if len(name.strip()) < 5:
        return False

    # Reject products where name == brand (redundant display)
    brand = product.get("brand")
    if brand and name.strip().lower() == brand.lower():
        return False

    # Reject repeated-word names
    name_words = name.strip().lower().split()
    if len(name_words) == 2 and name_words[0] == name_words[1]:
        return False

    # Reject tiny-dose edibles
    category = product.get("category", "other")
    weight_value = product.get("weight_value")
    if category == "edible" and weight_value:
        try:
            if float(weight_value) < 50:
                return False
        except (ValueError, TypeError):
            pass

    return True


# =====================================================================
# Phase 2: Deal Scoring (0-100)
# =====================================================================


def _score_unit_value(category: str, price: float, weight_value: float | None) -> int:
    """Score based on unit economics ($/g, $/100mg). Up to 15 points."""
    if not weight_value or weight_value <= 0 or not price or price <= 0:
        return 0

    if category == "flower":
        ppg = price / weight_value
        if ppg <= 3:
            return 15
        elif ppg <= 4.5:
            return 12
        elif ppg <= 6:
            return 8
        elif ppg <= 8:
            return 4
        return 0

    elif category == "edible":
        # weight_value is in mg THC
        per_100mg = (price / weight_value) * 100
        if per_100mg <= 5:
            return 15
        elif per_100mg <= 8:
            return 10
        elif per_100mg <= 12:
            return 5
        return 0

    elif category in ("vape", "concentrate"):
        ppg = price / weight_value
        if ppg <= 15:
            return 15
        elif ppg <= 22:
            return 10
        elif ppg <= 30:
            return 5
        return 0

    elif category == "preroll":
        # For prerolls, price IS the unit price (typically 1g singles)
        if price <= 4:
            return 15
        elif price <= 6:
            return 12
        elif price <= 8:
            return 8
        elif price <= 9:
            return 4
        return 0

    return 0


def _score_brand(brand: str) -> int:
    """Score brand recognition. Up to 20 points.

    Premium hype brands = 20, popular known brands = 12, any brand = 5.
    """
    if not brand:
        return 0

    brand_lower = brand.lower()
    for tier_data in BRAND_TIERS.values():
        if brand_lower in tier_data["brands"]:
            return tier_data["points"]
        # Word-boundary match for compound names (e.g. "Alien Labs Cannabis")
        if any(
            re.search(r"\b" + re.escape(b) + r"\b", brand_lower)
            for b in tier_data["brands"]
            if len(b) > 3
        ):
            return tier_data["points"]

    return 5  # any brand > no brand


def calculate_deal_score(product: dict[str, Any]) -> int:
    """Score a qualifying deal on a 0-100 scale.

    Only called after ``passes_hard_filters()`` returns ``True``.

    Components (max 100):
      1. Discount depth       — up to 35 pts
      2. Dollars saved         — up to 10 pts
      3. Brand recognition     — up to 20 pts
      4. Unit value            — up to 15 pts
      5. Category boost        — up to 8 pts
      6. Price attractiveness  — up to 12 pts
      7. Budget deal bonus     — up to 5 pts (prerolls/edibles ≤$11)
    """
    score = 0
    discount = product.get("discount_percent") or 0
    sale_price = product.get("sale_price") or product.get("current_price") or 0
    original_price = product.get("original_price") or 0
    category = product.get("category", "other")
    weight_value = product.get("weight_value")
    brand = product.get("brand") or ""

    source_platform = product.get("source_platform", "")

    # Cap discount at 80% for scoring purposes.  Hard filter already
    # rejects >85%, but values between 80-85% are almost always parsing
    # artifacts.  Prevents inflated scores from slipping into top 20.
    discount = min(discount, 80)

    # Platforms without original price / discount data (Jane, Carrot, AIQ).
    # Give them a flat baseline so they can compete with other platforms on
    # brand/value/category alone.  Non-loose platforms get up to 45 pts
    # (35 discount depth + 10 dollars saved); 15 roughly equals a 20%
    # discount — keeps these products visible without inflating the feed.
    if source_platform in ("jane", "carrot", "aiq"):
        score += 15  # baseline in lieu of discount depth + dollars saved
    else:
        # 1. DISCOUNT DEPTH (up to 35 points)
        if discount >= 50:
            score += 35
        elif discount >= 40:
            score += 28
        elif discount >= 30:
            score += 22
        elif discount >= 25:
            score += 17
        elif discount >= 20:
            score += 12
        elif discount >= 15:
            score += 7

        # 2. DOLLARS SAVED (up to 10 points)
        if original_price > 0 and original_price > sale_price:
            saved = original_price - sale_price
            score += min(10, int(saved / 2.5))

    # 3. BRAND RECOGNITION (up to 20 points)
    score += _score_brand(brand)

    # 4. UNIT VALUE (up to 15 points)
    score += _score_unit_value(category, sale_price, weight_value)

    # 5. CATEGORY BOOST (up to 8 points)
    score += CATEGORY_BOOST.get(category, 3)

    # 6. PRICE ATTRACTIVENESS (up to 15 points)
    # Consumers love the lowest-priced deals — prioritize genuine steals.
    # The $3-8 range gets the highest boost to ensure the cheapest real
    # deals float to the top instead of being outscored by mid-priced items.
    if 3 <= sale_price <= 8:
        score += 15
    elif 8 < sale_price <= 15:
        score += 12
    elif 15 < sale_price <= 25:
        score += 8
    elif 25 < sale_price <= 40:
        score += 4

    # 7. BUDGET DEAL BONUS (up to 5 points)
    # Prerolls and edibles at $11 or less are accessible price points that
    # consumers actively seek out.  Give them a scoring boost so more appear
    # in the feed instead of being outscored by higher-priced categories.
    if category in ("preroll", "edible") and sale_price <= 11:
        score += 5

    return min(100, score)


# =====================================================================
# Similarity dedup — prevent flooding from same brand at same dispensary
# =====================================================================


def _weight_tier(deal: dict[str, Any]) -> str:
    """Classify a deal into a weight tier for diversity bucketing.

    Products in the same category but different weight tiers (e.g. 3.5g
    flower vs 7g flower) should be spread across the feed rather than
    clustered together.
    """
    cat = deal.get("category", "other")
    wv = deal.get("weight_value")
    if wv is None:
        return f"{cat}_default"
    try:
        wv = float(wv)
    except (ValueError, TypeError):
        return f"{cat}_default"
    if cat == "flower":
        if wv <= 4:
            return "flower_eighth"
        if wv <= 8:
            return "flower_quarter"
        if wv <= 15:
            return "flower_half"
        return "flower_oz"
    if cat == "vape":
        # 0.6g threshold: industry-standard "half gram" carts are 0.5g but
        # some brands label at 0.55-0.6g; anything above is a full gram.
        if wv <= 0.6:
            return "vape_half"
        return "vape_full"
    if cat == "concentrate":
        if wv <= 0.6:
            return "conc_half"
        return "conc_full"
    return f"{cat}_default"


def _normalize_dedup_name(name: str, brand: str) -> str:
    """Normalize product name for dedup matching.

    Strips brand name, strain types, weight prefixes, punctuation, and
    whitespace so garbled variants match their clean counterparts.
    E.g. "CSF Cartridge Kobe Circle S Farms Indica-Hybrid" → "kobe"
    """
    import re
    n = (name or "").lower().strip()
    # Strip brand name from product name
    if brand:
        n = re.sub(r'\b' + re.escape(brand.lower()) + r'\b', '', n)
    # Strip strain types
    n = re.sub(r'\b(?:indica|sativa|hybrid|indica-hybrid|sativa-hybrid)\b', '', n)
    # Strip weight prefixes: "3.5g |", "1g |"
    n = re.sub(r'^\.?\d+\.?\d*\s*g\s*\|\s*', '', n)
    # Strip common product type words
    n = re.sub(r'\b(?:cartridge|cart|disposable|badder|pre-?roll|gummy|gummies)\b', '', n)
    # Strip all punctuation, collapse whitespace
    n = re.sub(r'[^a-z0-9\s]', '', n)
    n = re.sub(r'\s+', ' ', n).strip()
    return n


def remove_global_name_duplicates(
    deals: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Deduplicate identical brand+name products across ALL dispensaries.

    If "Baja Blast Disposable" from Hustler's Ambition is sold at three
    different dispensaries, only keep the one with the best deal score.

    Uses normalized name matching so garbled variants (with extra brand
    name, strain type, weight prefix) match their clean counterparts.
    """
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for deal in deals:
        brand = (deal.get("brand") or "").lower()
        cat = deal.get("category", "other")
        norm_name = _normalize_dedup_name(deal.get("name", ""), brand)
        key = f"{norm_name}|{brand}|{cat}"
        groups[key].append(deal)

    result: list[dict[str, Any]] = []
    for group in groups.values():
        group.sort(key=lambda d: d.get("deal_score", 0), reverse=True)
        result.append(group[0])

    return result


def remove_similar_deals(deals: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep at most MAX_SAME_BRAND_PER_DISPENSARY deals per
    brand+category from the same dispensary.

    Prevents "15 Stiiizy pods from Planet 13" dominating the feed.
    Keeps the highest-scored entries from each group.
    """
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for deal in deals:
        brand = (deal.get("brand") or "unknown").lower()
        cat = deal.get("category", "other")
        dispo = deal.get("dispensary_id") or ""
        key = f"{dispo}|{brand}|{cat}"
        groups[key].append(deal)

    result: list[dict[str, Any]] = []
    for group in groups.values():
        group.sort(key=lambda d: d.get("deal_score", 0), reverse=True)
        result.extend(group[:MAX_SAME_BRAND_PER_DISPENSARY])

    return result


def _chain_prefix(dispensary_id: str) -> str:
    """Extract the chain prefix from a dispensary slug.

    Examples:
        "curaleaf-western" → "curaleaf"
        "curaleaf-strip"   → "curaleaf"
        "deep-roots-craig" → "deep-roots"
        "td-gibson"        → "td"
        "planet-13"        → "planet-13"  (single location, no split)
    """
    if not dispensary_id:
        return ""
    parts = dispensary_id.split("-")
    # Use first segment as chain prefix; multi-word chains use first two
    # segments (e.g., "deep-roots-craig" → "deep-roots", "nevada-made-henderson" → "nevada-made").
    _MULTI_WORD_CHAINS = {"the", "nevada", "deep", "beyond", "tree"}
    if len(parts) >= 2 and parts[0] in _MULTI_WORD_CHAINS:
        return f"{parts[0]}-{parts[1]}"
    return parts[0]


def remove_cross_chain_duplicates(
    deals: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Deduplicate the same product across different locations of a chain.

    If "Cannavative Infused Tahoe OG" appears at both Curaleaf Western
    and Curaleaf Strip, keep only the highest-scored instance.  Products
    are considered the same when they share: chain prefix + normalized
    name + brand + category.
    """
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for deal in deals:
        chain = _chain_prefix(deal.get("dispensary_id") or "")
        name = (deal.get("name") or "").lower().strip()
        brand = (deal.get("brand") or "").lower()
        cat = deal.get("category", "other")
        key = f"{chain}|{name}|{brand}|{cat}"
        groups[key].append(deal)

    result: list[dict[str, Any]] = []
    for group in groups.values():
        group.sort(key=lambda d: d.get("deal_score", 0), reverse=True)
        result.append(group[0])  # keep only the best-scored instance

    return result


# =====================================================================
# Phase 3: Top-200 Selection with Variety
# =====================================================================


def _pick_from_pools(
    buckets: dict[str, list[dict[str, Any]]],
    category_slots: dict[str, int],
    brand_cap: int,
    brand_cat_cap: int,
    dispensary_cap: int,
    unknown_cap: int,
    already_picked: set[tuple] | None = None,
    brand_counts: dict[str, int] | None = None,
    brand_cat_counts: dict[str, int] | None = None,
    dispensary_counts: dict[str, int] | None = None,
) -> dict[str, list[dict[str, Any]]]:
    """Pick deals from category pools with brand/dispensary diversity.

    Extracted so the same 3-pass logic can be reused in both the primary
    diversity round and the backfill round with different cap values.

    ``already_picked`` is a set of (name, sale_price) keys for deals
    already selected in a previous round — they will be skipped.
    """
    if brand_counts is None:
        brand_counts = defaultdict(int)
    if brand_cat_counts is None:
        brand_cat_counts = defaultdict(int)
    if dispensary_counts is None:
        dispensary_counts = defaultdict(int)
    if already_picked is None:
        already_picked = set()

    category_picks: dict[str, list[dict[str, Any]]] = {}

    def _brand_key(deal: dict[str, Any]) -> str:
        b = deal.get("brand")
        return b if b else "_unknown"

    for cat, slots in category_slots.items():
        pool = buckets.get(cat, [])
        picks: list[dict[str, Any]] = []
        picked_set: set[int] = set()  # indices into pool

        def _try_pick(deal: dict[str, Any], idx: int) -> bool:
            deal_key = (deal.get("name", ""), deal.get("sale_price"))
            if deal_key in already_picked:
                return False
            brand = _brand_key(deal)
            disp_id = deal.get("dispensary_id") or ""
            bc_key = f"{brand}|{cat}"
            effective_cap = unknown_cap if brand == "_unknown" else brand_cap
            if brand_counts[brand] >= effective_cap:
                return False
            if brand_cat_counts[bc_key] >= brand_cat_cap:
                return False
            if dispensary_counts[disp_id] >= dispensary_cap:
                return False
            brand_counts[brand] += 1
            brand_cat_counts[bc_key] += 1
            dispensary_counts[disp_id] += 1
            picks.append(deal)
            picked_set.add(idx)
            already_picked.add(deal_key)
            return True

        # First pass: one deal per brand AND per weight tier.
        seen_brands: set[str] = set()
        seen_tiers: set[str] = set()
        for i, deal in enumerate(pool):
            if len(picks) >= slots:
                break
            brand = _brand_key(deal)
            tier = _weight_tier(deal)
            if brand in seen_brands:
                continue
            if tier in seen_tiers:
                continue
            if _try_pick(deal, i):
                seen_brands.add(brand)
                seen_tiers.add(tier)

        # Second pass: one per brand (allow repeat weight tiers)
        if len(picks) < slots:
            for i, deal in enumerate(pool):
                if len(picks) >= slots:
                    break
                if i in picked_set:
                    continue
                brand = _brand_key(deal)
                if brand in seen_brands:
                    continue
                if _try_pick(deal, i):
                    seen_brands.add(brand)

        # Third pass: fill remaining slots (allow repeat brands)
        if len(picks) < slots:
            for i, deal in enumerate(pool):
                if len(picks) >= slots:
                    break
                if i in picked_set:
                    continue
                _try_pick(deal, i)

        category_picks[cat] = picks

    return category_picks


def select_top_deals(
    scored_deals: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Select the best ~200 deals with category, brand, and dispensary diversity.

    Uses a two-round approach:
      Round 1 — tight diversity caps for a high-variety core selection.
      Round 2 (backfill) — if round 1 filled < 85% of target, relax caps
        and pick additional deals to fill empty slots.

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

    # Sort each category bucket: lowest-price steals first (top 3 per
    # category), then by deal_score for the rest.  This ensures the
    # absolute cheapest deals in each category get priority slots,
    # giving users the "steals" they want to see at the top.
    _PRICE_PRIORITY_SLOTS = 3
    for cat in buckets:
        pool = buckets[cat]
        # Sort by price ascending to find cheapest deals
        pool.sort(key=lambda d: d.get("sale_price") or d.get("current_price") or 999)
        price_leaders = pool[:_PRICE_PRIORITY_SLOTS]
        rest = pool[_PRICE_PRIORITY_SLOTS:]
        # Sort rest by deal_score descending
        rest.sort(key=lambda d: d.get("deal_score", 0), reverse=True)
        # Reassemble: price leaders first, then score-ranked
        buckets[cat] = price_leaders + rest

    # ------------------------------------------------------------------
    # Step 2: Calculate category slot allocation
    # ------------------------------------------------------------------
    total_available = sum(len(v) for v in buckets.values())
    target = min(TARGET_DEAL_COUNT, total_available)

    category_slots: dict[str, int] = {}
    remaining_slots = target
    for cat, cat_target in CATEGORY_TARGETS.items():
        pool_size = len(buckets.get(cat, []))
        slots = min(cat_target, pool_size)
        category_slots[cat] = slots
        remaining_slots -= slots

    # Redistribute surplus slots to underfilled categories first, then
    # overflow to categories with abundant supply.  "other" is hard-capped
    # at its target to prevent it from absorbing slots that real categories
    # (vape, edible, concentrate) could use.
    if remaining_slots > 0:
        # Priority 1: underfilled real categories (below their target)
        for cat in sorted(buckets.keys(), key=lambda c: CATEGORY_TARGETS.get(c, 0), reverse=True):
            if cat == "other":
                continue  # don't overflow into "other" — keep it tight
            pool_size = len(buckets.get(cat, []))
            current = category_slots.get(cat, 0)
            cat_target = CATEGORY_TARGETS.get(cat, 10)
            max_for_cat = int(cat_target * 1.5)
            can_add = min(pool_size - current, max_for_cat - current)
            if can_add > 0:
                add = min(can_add, remaining_slots)
                category_slots[cat] = current + add
                remaining_slots -= add
            if remaining_slots <= 0:
                break
        # Priority 2: overflow into any category (including "other") if still slots left
        if remaining_slots > 0:
            for cat in sorted(buckets.keys(), key=lambda c: len(buckets[c]), reverse=True):
                pool_size = len(buckets.get(cat, []))
                current = category_slots.get(cat, 0)
                cat_target = CATEGORY_TARGETS.get(cat, 10)
                max_for_cat = int(cat_target * 1.5) if cat != "other" else cat_target
                can_add = min(pool_size - current, max_for_cat - current)
                if can_add > 0:
                    add = min(can_add, remaining_slots)
                    category_slots[cat] = current + add
                    remaining_slots -= add
                if remaining_slots <= 0:
                    break

    # ------------------------------------------------------------------
    # Step 2a: Round 1 — tight diversity caps
    # ------------------------------------------------------------------
    brand_counts: dict[str, int] = defaultdict(int)
    brand_cat_counts: dict[str, int] = defaultdict(int)
    dispensary_counts: dict[str, int] = defaultdict(int)
    already_picked: set[tuple] = set()

    category_picks = _pick_from_pools(
        buckets, category_slots,
        brand_cap=MAX_SAME_BRAND_TOTAL,
        brand_cat_cap=MAX_SAME_BRAND_PER_CATEGORY,
        dispensary_cap=MAX_SAME_DISPENSARY_TOTAL,
        unknown_cap=MAX_UNKNOWN_BRAND_TOTAL,
        already_picked=already_picked,
        brand_counts=brand_counts,
        brand_cat_counts=brand_cat_counts,
        dispensary_counts=dispensary_counts,
    )

    round1_total = sum(len(v) for v in category_picks.values())

    # ------------------------------------------------------------------
    # Step 2b: Round 2 (backfill) — relaxed caps if under-filled
    # ------------------------------------------------------------------
    if round1_total < target * _BACKFILL_THRESHOLD:
        # Calculate remaining slots per category
        backfill_slots: dict[str, int] = {}
        for cat in category_slots:
            filled = len(category_picks.get(cat, []))
            remaining = category_slots[cat] - filled
            # Also allow categories to exceed their original slot allocation
            # up to 2x target if the pool has supply
            pool_remaining = len(buckets.get(cat, [])) - filled
            backfill_slots[cat] = min(remaining + 5, pool_remaining)

        backfill_picks = _pick_from_pools(
            buckets, backfill_slots,
            brand_cap=_BACKFILL_BRAND_TOTAL,
            brand_cat_cap=_BACKFILL_BRAND_PER_CATEGORY,
            dispensary_cap=_BACKFILL_DISPENSARY_TOTAL,
            unknown_cap=_BACKFILL_UNKNOWN_BRAND_TOTAL,
            already_picked=already_picked,
            brand_counts=brand_counts,
            brand_cat_counts=brand_cat_counts,
            dispensary_counts=dispensary_counts,
        )

        # Merge backfill into category_picks
        for cat, picks in backfill_picks.items():
            if picks:
                category_picks.setdefault(cat, []).extend(picks)

        round2_total = sum(len(v) for v in category_picks.values())
        logger.info(
            "Backfill: %d → %d deals (round 1 was %.0f%% of %d target)",
            round1_total, round2_total, round1_total / target * 100, target,
        )

    # ------------------------------------------------------------------
    # Step 3: Interleave categories for feed variety
    # ------------------------------------------------------------------
    result: list[dict[str, Any]] = []
    cat_order = sorted(
        category_picks.keys(),
        key=lambda c: CATEGORY_TARGETS.get(c, 0),
        reverse=True,
    )
    cat_iters: dict[str, list[dict[str, Any]]] = {
        cat: list(category_picks[cat]) for cat in cat_order
    }
    cat_cycle = cycle(cat_order)
    last_cats: list[str] = []
    last_brands: list[str] = []

    while len(result) < target:
        tried = 0
        placed = False
        while tried < len(cat_order):
            cat = next(cat_cycle)
            tried += 1

            if (
                len(last_cats) >= MAX_CONSECUTIVE_SAME_CATEGORY
                and all(c == cat for c in last_cats[-MAX_CONSECUTIVE_SAME_CATEGORY:])
            ):
                continue

            if cat_iters.get(cat):
                deal = cat_iters[cat][0]
                deal_brand = deal.get("brand") or ""

                if (
                    deal_brand
                    and len(last_brands) >= MAX_CONSECUTIVE_SAME_BRAND
                    and all(b == deal_brand for b in last_brands[-MAX_CONSECUTIVE_SAME_BRAND:])
                ):
                    swapped = False
                    for j in range(1, len(cat_iters[cat])):
                        alt = cat_iters[cat][j]
                        alt_brand = alt.get("brand") or ""
                        if alt_brand != deal_brand:
                            cat_iters[cat][0], cat_iters[cat][j] = (
                                cat_iters[cat][j],
                                cat_iters[cat][0],
                            )
                            deal = cat_iters[cat][0]
                            deal_brand = alt_brand
                            swapped = True
                            break
                    if not swapped:
                        continue

                cat_iters[cat].pop(0)
                result.append(deal)
                last_cats.append(cat)
                last_brands.append(deal_brand)
                placed = True
                break

        if not placed:
            for cat in cat_order:
                while cat_iters.get(cat):
                    result.append(cat_iters[cat].pop(0))
                    if len(result) >= target:
                        break
                if len(result) >= target:
                    break
            break

    # ------------------------------------------------------------------
    # Step 4: Dispensary minimum exposure guarantee
    # ------------------------------------------------------------------
    # Every dispensary that has qualifying deals should appear at least
    # MIN_DEALS_PER_DISPENSARY times.  This ensures smaller shops get
    # visibility instead of being completely squeezed out by high-volume
    # dispensaries with many qualifying products.
    result_disp_ids = {deal.get("dispensary_id") or "" for deal in result}
    all_disp_pools: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for deal in scored_deals:
        disp_id = deal.get("dispensary_id") or ""
        all_disp_pools[disp_id].append(deal)

    missing_disps = [
        disp_id for disp_id in all_disp_pools
        if disp_id and disp_id not in result_disp_ids
    ]
    if missing_disps:
        result_keys = {
            (d.get("name", ""), d.get("sale_price")) for d in result
        }
        # Track brand counts in the current result to respect caps
        disp_min_brand_counts: dict[str, int] = defaultdict(int)
        for deal in result:
            b = (deal.get("brand") or "").lower()
            if b:
                disp_min_brand_counts[b] += 1
        added = 0
        for disp_id in missing_disps:
            pool = all_disp_pools[disp_id]
            pool.sort(key=lambda d: d.get("deal_score", 0), reverse=True)
            count = 0
            for deal in pool:
                if count >= MIN_DEALS_PER_DISPENSARY:
                    break
                deal_key = (deal.get("name", ""), deal.get("sale_price"))
                brand_lower = (deal.get("brand") or "").lower()
                # Only add if it has a brand and doesn't exceed brand cap
                if (
                    deal_key not in result_keys
                    and deal.get("brand")
                    and disp_min_brand_counts[brand_lower] < _BACKFILL_BRAND_TOTAL
                ):
                    result.append(deal)
                    result_keys.add(deal_key)
                    disp_min_brand_counts[brand_lower] += 1
                    count += 1
                    added += 1
        if added > 0:
            logger.info(
                "Dispensary minimum: added %d deals from %d under-represented dispensaries",
                added, len(missing_disps),
            )

    # ------------------------------------------------------------------
    # Step 5: Dispensary cap enforcement (uses backfill cap if active)
    # ------------------------------------------------------------------
    effective_disp_cap = (
        _BACKFILL_DISPENSARY_TOTAL
        if round1_total < target * _BACKFILL_THRESHOLD
        else MAX_SAME_DISPENSARY_TOTAL
    )
    final_disp_counts: dict[str, int] = defaultdict(int)
    for deal in result:
        disp_id = deal.get("dispensary_id") or ""
        final_disp_counts[disp_id] += 1

    over_cap = [
        disp_id for disp_id, count in final_disp_counts.items()
        if count > effective_disp_cap
    ]
    if over_cap:
        for disp_id in over_cap:
            disp_deals = [
                (i, d) for i, d in enumerate(result)
                if (d.get("dispensary_id") or "") == disp_id
            ]
            disp_deals.sort(key=lambda x: x[1].get("deal_score", 0))
            excess = len(disp_deals) - effective_disp_cap
            remove_indices = {idx for idx, _ in disp_deals[:excess]}
            result = [d for i, d in enumerate(result) if i not in remove_indices]

    return result[:TARGET_DEAL_COUNT]


# =====================================================================
# Main pipeline entry point
# =====================================================================


def detect_deals(
    products: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Full pipeline: filter -> score -> dedup -> select top 200.

    Returns only the curated top deals with ``deal_score`` set.
    All other products should get ``deal_score = 0``.

    Also stores reporting data on the module for the scrape report
    (accessible via ``get_last_report_data()``).
    """
    global _last_report_data

    # Step 0: Correct 1g flower → preroll (no 1g flower exists in retail;
    # it's always a preroll or infused preroll that was miscategorized).
    for product in products:
        if (
            product.get("category") == "flower"
            and product.get("weight_value")
        ):
            try:
                wv = float(product["weight_value"])
            except (ValueError, TypeError):
                wv = None
            if wv is not None and 0.5 <= wv <= 1.5:
                product["category"] = "preroll"

    # Step 1: Hard filter (with price-cap rejection counting)
    # Step 1: Hard filter
    qualifying: list[dict[str, Any]] = []
    price_cap_rejects = 0
    for product in products:
        if passes_hard_filters(product):
            qualifying.append(product)
        elif failed_by_price_cap(product):
            price_cap_rejects += 1

    logger.info(
        "Hard filter: %d/%d products passed (%d rejected by price cap)",
        len(qualifying), len(products), price_cap_rejects,
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
    strict_passed = [d for d in scored if passes_quality_gate(d)]
    strict_rejected = [d for d in scored if not passes_quality_gate(d)]
    quality_rejected = quality_before - len(strict_passed)
    if quality_rejected > 0:
        logger.info(
            "Quality gate: %d/%d deals rejected (incomplete data)",
            quality_rejected, quality_before,
        )

    # Step 3b: Dispensary minimum floor — if the strict quality gate
    # killed too many deals, backfill from quality-gate rejects using
    # a relaxed gate.  This ensures every store with real products gets
    # fair representation instead of showing 0 deals due to missing
    # metadata (no weight, no brand, etc.).
    floor = _dispensary_deal_floor(len(products))
    if floor > 0 and len(strict_passed) < floor and strict_rejected:
        relaxed_backfill = [
            d for d in strict_rejected
            if passes_relaxed_quality_gate(d)
        ]
        # Sort by deal_score descending — best rejects first
        relaxed_backfill.sort(key=lambda d: d["deal_score"], reverse=True)
        needed = floor - len(strict_passed)
        backfilled = relaxed_backfill[:needed]
        if backfilled:
            logger.info(
                "Dispensary floor: backfilled %d deals (floor=%d, had %d, "
                "%d products scraped)",
                len(backfilled), floor, len(strict_passed), len(products),
            )
            strict_passed.extend(backfilled)

    scored = strict_passed

    # Step 4: Similarity dedup — max 3 per brand+category per dispensary
    dedup_before = len(scored)
    scored = remove_similar_deals(scored)
    dedup_removed = dedup_before - len(scored)
    if dedup_removed > 0:
        logger.info(
            "Similarity dedup: %d/%d deals removed (same brand+cat+dispo)",
            dedup_removed, dedup_before,
        )
    # Step 4b: Cross-chain dedup — same product at different locations of
    # a chain (e.g., Curaleaf Western vs Strip) keeps only the best one.
    chain_before = len(scored)
    scored = remove_cross_chain_duplicates(scored)
    chain_removed = chain_before - len(scored)
    if chain_removed > 0:
        logger.info(
            "Cross-chain dedup: %d/%d deals removed (same product across chain locations)",
            chain_removed, chain_before,
        )

    # Step 4c: Global name dedup — same brand+name product sold at
    # different dispensary chains keeps only the best-scored instance.
    global_before = len(scored)
    scored = remove_global_name_duplicates(scored)
    global_removed = global_before - len(scored)
    if global_removed > 0:
        logger.info(
            "Global name dedup: %d/%d deals removed (same product across dispensaries)",
            global_removed, global_before,
        )

    # Re-sort after dedup
    scored.sort(key=lambda d: d["deal_score"], reverse=True)

    # Step 5: Select top ~200 with diversity
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
        "price_cap_rejects": price_cap_rejects,
    }

    return top_deals


# Module-level storage for the last run's report data
_last_report_data: dict[str, Any] = {}


def get_last_report_data() -> dict[str, Any]:
    """Return the report data from the most recent ``detect_deals`` call."""
    return _last_report_data
