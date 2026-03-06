#!/usr/bin/env python3
"""
clouded_logic.py - CLOUDED DEALS BUSINESS LOGIC MODULE
======================================================
All parsing, validation, category detection, weight fixes, brand DB,
dispensary configs, price caps, smart stop, and qualification rules.

This is the SINGLE SOURCE OF TRUTH for all business logic.
Import into any scraper version:
    from clouded_logic import CloudedLogic

CRITICAL FIXES INCLUDED:
  🔴 .35g bug: Category-first weight validation
     - .35g on a vape = 0.35g (valid small disposable)
     - .35g on flower = 3.5g (eighth, was showing as 0.35g)
  🔴 Consecutive empty resilience (v102 pattern, lost in v111+)
  🔴 Edible normalize: 82-118mg → 100mg, 180-220mg → 200mg
  🔴 Infused preroll detection before standard preroll filter
  🔴 Concentrate requires BOTH keyword AND weight match

Usage:
    logic = CloudedLogic()
    category = logic.detect_category(raw_text)
    weight = logic.validate_weight('0.35g', category)
    product = logic.parse_product(raw_text, 'TD-Gibson')
    qualifies = logic.is_qualifying(product)
"""

import re
from difflib import SequenceMatcher
from collections import defaultdict

# ============================================================================
# PRICE CAPS & GLOBAL RULES
# ============================================================================

PRICE_CAP_GLOBAL = 30

PRICE_CAPS = {
    'edible':          {'min': 3,  'max': 9},
    'preroll':         {'min': 2,  'max': 6},
    'vape':            {'min': 10, 'max': 25},
    'flower_3.5g':     {'min': 10, 'max': 22},
    'flower_7g':       {'min': 15, 'max': 35},
    'flower_14g':      {'min': 20, 'max': 50},
    'concentrate_1g':  {'min': 9,  'max': 25},
}

MIN_DISCOUNT = 20
MAX_DISCOUNT = 75
MIN_SAVINGS = 3
MAX_BRAND_GLOBAL = 2

# ============================================================================
# SMART STOP CONFIG (v102 proven pattern)
# ============================================================================

SMART_STOP_CONFIG = {
    'wyld_brand_names': ['wyld', 'WYLD', 'Wyld'],
    'min_pages_before_stop': 10,
    'min_products_before_stop': 100,
}

# Consecutive empty = resilience logic from v102
# DO NOT use break on first nav failure - use continue!
# Allow 5 consecutive failures before stopping (raised from 3 to avoid
# premature exits when Dutchie/Curaleaf DOMs render slowly between pages)
CONSECUTIVE_EMPTY_MAX = 5

# ============================================================================
# CATEGORY ABBREVIATIONS (for tweets)
# ============================================================================

CATEGORY_ABBREV = {
    'preroll': 'PR',
    'flower': 'F',
    'edible': 'E',
    'concentrate': 'W',
    'vape': 'V',
}

# ============================================================================
# INFUSED PREROLL KEYWORDS (filter separately from standard prerolls)
# ============================================================================

INFUSED_KEYWORDS = [
    'infused', '40s', "40's", 'diamond infused', 'kief roll',
    'hash infused', 'coated', 'caviar', 'moonrock', 'moon rock',
    'sunrock', 'sun rock', 'dusted',
]

# ============================================================================
# BRAND COMPARISON ROTATION
# ============================================================================

BRAND_COMPARISON_BRANDS = ['Rove', 'Stiiizy', 'Matrix', 'City Trees', 'Airo']

# ============================================================================
# COMPLETE BRAND DATABASE (200+)
# ============================================================================

BRANDS = sorted(set([
    # A
    'Advanced Vapor Devices', 'Aether Gardens', 'Airo', 'AiroPro', 'Alien Labs',
    'Almora', 'AMA', 'Avexia', 'Amp',
    # B
    'Backpack Boyz', 'Bad Batch', 'Bad Boy', 'BaM', 'Ballers', 'Bear Quartz',
    'Beboe', 'Bhang', 'Bic', 'Big Chief Extracts', 'Binske', 'BirthJays', 'Bits',
    'Blazer', 'Blazy Susan', 'Blink', 'BLUEBIRDS', 'BLVD', 'Bohemian Brothers',
    'Bonanza Cannabis', 'Boom Town', 'Bounti', 'Brass Knuckles', 'Bud Bandz',
    # C
    'Cali Traditional', 'Camino', 'Camo', 'CAMP', 'CANN', 'Cannafornia',
    'Cannabiotix', 'Cannabreezy', 'Cannalean', 'Cannavative', 'Cannavore',
    'Cannavore Confections', 'Caviar Gold', 'Cheeba Chews', 'Church',
    'Circle S Farms', 'City Trees', 'Claybourne Co.', 'CLEAR Brands', 'Clout King',
    'Connected', 'Cosmonaut', 'Cotton Mouth', 'Cresco', 'Crumbs',
    'Cultivate', 'Curaleaf',
    # D
    'Dabwoods', 'DADiRRi', 'Dazed!', 'Deep Roots', 'Desert Blaze',
    'Desert Bloom', 'DGF', 'Dimension Engineering LLC', 'Dime Industries', 'Dipper',
    'Doja', "Doctor Solomon's", 'Dogwalkers', 'Doinks', 'Dope Dope', 'Dosist',
    'Dr. Dabber', 'Dr. Zodiak', 'Dreamland', 'Dreamland Chocolates', 'Drink Loud',
    'Dzyne',
    # E
    'Edie Parker', 'Element', 'Ember Valley', 'Emperors Choice', 'Encore',
    'Encore Edibles', 'Entourage', 'EPC', 'Escape Pod', 'Essence', 'Exhale',
    'The Essence', 'Evergreen Organix', 'EVOL', 'Eyce',
    # F
    'Featured Farms', 'Fig Farms', 'Find.', 'Fleur', 'Flight Bites', 'Flora Vega',
    'FloraVega', 'Flower One', 'Fumeur', 'Fuze Extracts',
    # G
    'Garcia Hand Picked', 'GB Sciences', 'Ghost Town', 'Glass House', 'GLP',
    'Golden Savvy', 'Golden State Banana', 'Good Green', 'Good Tide',
    'Grandiflora', 'Grassroots', 'GRAV Labs', 'Green Life Productions',
    'Greenway LV', 'Greenway Medical', 'Groove', 'Grön', 'GTI',
    # H
    'HaHa Edibles', 'Hamilton Devices', 'Haze', 'Heavy Hitters', 'High Hemp',
    'High Roller', 'Highlights', 'Highly Edible', 'Hijinks', 'Hippies Peaces',
    'Hits Blunt', 'Houseplant', 'HSH', 'Huni Badger', 'Hustlers Ambition',
    "Hustler's Ambition", 'Huxton',
    # I
    'IGO', 'Incredibles', 'INDO',
    # J-K
    'JAMS', 'Jasper', 'Jeeter', 'Jungle Boys', 'Just Edibles',
    'KANHA', 'Kanji', 'Kannabis', 'Keef', 'Khalifa Kush', 'Khalifa Yellow',
    'Kingpen', 'Kiva', 'Kiva Lost Farm', 'Kushberry Farms', 'Kynd',
    # L
    'Later Days', 'LAVI', 'Leaf & Vine', 'Leaf and Vine', 'Lemonnade', 'LEVEL',
    'Lift Tickets', 'LIT', "Local's Only", 'Local Cannabis', 'Lost Farm',
    'Lowell', 'LP Exotics',
    # M
    'Matrix', 'MedMen', 'Medizin', 'Mellow Vibes', 'Mojave', 'Mojo', 'Moxie',
    'MPX', 'MUV', 'Mystic Timbers',
    # N-O
    "Nature's Chemistry", 'Neon Cactus', 'Nitro Dabs', 'NLVO',
    'Nordic Goddess', 'NuLeaf', 'Nuvaria',
    'Oasis', 'OCB Rolling Papers & Cones', 'Old Pal', 'OMG THC',
    # P
    'Pacific Stone', 'PACKS', 'Packwoods', 'PANNA Extracts', 'PAX',
    'Phat Panda', 'Phantom Farms', 'Pheno Exotics', 'Pis WMS', 'Planet 13',
    'Plug Play', 'PLUS', 'Poke a Bowl', 'Polaris', 'Presidential', 'Prime',
    'Prospectors', 'Provisions', 'Punch Edibles',
    # Q-R
    'Qualcan',
    'Raw Garden', 'Redwood', 'REEFORM', 'Reina', 'Remedy', 'Reserve', 'RNBW',
    'Robhots', 'Rove', 'Royalesque', 'Ruby Pearl Co.', 'Runtz', 'RYTHM',
    # S
    'Sauce Essentials', 'Savvy', 'SeCHe', 'SELECT', 'Shango', 'Sip',
    'Sin City', 'Smokiez Edibles', 'Smyle Labs', 'Special Blue',
    'Srene', 'StackHouse NV', 'State Flower', 'Stillwater', 'STIIIZY',
    'Stone Road', 'Storz & Bickel', 'Sundae Co.', 'Super Good', 'Superior',
    'SVC',
    # T
    'Tahoe Hydro', 'Taproots', 'Terra', 'THC Design', 'The Bank', 'The Clear',
    'The Grower Circle', 'The Lab', 'The Sanctuary', 'The Source', 'Thrive',
    'Toast', 'Toker Poker', 'Trendi', 'Trulieve', 'Tryke',
    'Tsunami Labs', 'Tumbleweed', 'Tumbleweedz', 'TWE', 'Twisted Hemp',
    'Tyson 2.0',
    # U-V
    "Uncle Arnie's", 'Uncle Arnies', 'Vada', 'Vapen', 'Verano', 'VERT Unlimited',
    'Vegas Valley Growers', 'Virtue', 'Vlasic Labs', 'Voon',
    # W-Z
    'Wana', 'Wonderbrett', 'Wyld', 'WYLD CBD', 'Your Highness',
    # &-prefixed
    '&Shine',
    # ── Michigan-native brands ──────────────────────────────────────
    'Lume', 'Skymint', 'Michigrown', 'Glorious Cannabis',
    'North Coast', 'Pleasantrees', 'Redbud Roots', 'Fluresh',
    'Common Citizen', "Freddy's Fuego", 'The Botanical Co',
    'Platinum Vape', 'MKX', 'MKX Oil Co', 'Light Sky Farms',
    'Puffin', 'Monster Xtracts', 'Stiizy MI',
    'Wana MI', 'High Supply', 'Gage Cannabis', 'HOD',
    'Cloud Cannabis', 'Puff Cannabis', 'JARS',
    # Michigan expansion — Feb 2026
    'Joyology', 'Pinnacle Emporium', 'Herbana', 'Nirvana Center',
    'Exclusive Cannabis', 'Breeze', 'High Profile',
    'Five Star Extracts', 'Pyramid', 'Humblebee', 'Redemption',
    'Drip', 'Choice Edibles', 'Detroit Edibles',
    'House of Dank', 'Viola', 'Church Cannabis',
    # ── Illinois-native brands ──────────────────────────────────────
    'Revolution', 'Aeriz', 'Bedford Grow', 'Cresco',
    'Good News', "Mindy's", "Mindy's Edibles", 'FloraCal',
    'PTS', 'Columbia Care', 'Ascend', 'Ozone', 'Simply Herb',
    'Nature\'s Grace', 'Rhythm', 'GTI', 'PharmaCann',
    'Shelby County', 'Justice Grown', 'Verano IL',
    'Beboe', 'Matter', 'Superflux',
    # ── Arizona-native brands ───────────────────────────────────────
    'Abundant Organics', 'Grow Sciences', 'Item 9 Labs',
    'Venom Extracts', 'Timeless', 'Timeless Vapes', 'Ponderosa',
    'Mohave Cannabis', 'Sonoran Roots', 'Tru Infusion',
    'Harvest', 'Trulieve', 'Sol Flower',
    'Nectar Farms', 'Canamo', 'Copperstate Farms',
    'Shango', 'Hana Meds', 'Nature Med',
    # ── Missouri-native brands ───────────────────────────────────────
    'Illicit Gardens', 'Illicit', 'Flora Farms', 'Vivid',
    'Sinse', 'Sinse Cannabis', 'Proper Cannabis', 'Proper',
    'Clovr', 'Good Day Farm', 'Elevate', 'Elevate Missouri',
    'HeadChange', 'Codes', 'C4', 'Ostara', 'BeLeaf',
    "Missouri's Own", 'Amaze Cannabis', 'Key Cannabis',
    'Greenlight', 'Star Buds', 'Vertical',
    'Local Cannabis', 'Peak', 'Canna Mojo', 'Honeybee',
    # Missouri expansion — Feb 2026
    'Swade', 'Fresh Green', "N'Bliss", 'From The Earth',
    'Old Route 66', 'Heya', 'Solhaus', 'Cloud Nine',
    'Heartland Labs', 'Good Day Farms', 'Robust',
    # ── New Jersey-native brands ─────────────────────────────────────
    'Kind Tree', 'Fernway', 'Ozone', 'Garden Greens',
    'Clade9', 'Jersey Canna', 'Sweet Spot',
    'The Botanist', 'TerrAscend', 'Prism',
    'Dogwalkers', 'Beboe', 'Encore',
    'Effin', 'Treeworks',
    # NJ expansion — Feb 2026
    'Breakwater', 'Garden State Canna', 'The Heirloom Collective',
    'Harmony', 'Apothecarium', 'Purple Leaf', 'Bloc NJ',
]), key=str.lower)

# Pre-compute lowercase brand set for fast lookup
BRANDS_LOWER = {b.lower(): b for b in BRANDS}


def load_approved_brands(db) -> int:
    """Load approved brands from the brand_candidates table and merge into runtime lookups.

    Call once at pipeline start. Approved brand candidates are added to
    BRANDS, BRANDS_LOWER, and _BRAND_PATTERNS so they receive proper brand
    detection and scoring without requiring code changes.

    Returns the number of new brands added.
    """
    try:
        result = (
            db.table("brand_candidates")
            .select("name, canonical_name")
            .eq("status", "approved")
            .execute()
        )
        rows = result.data or []
    except Exception:
        # Table may not exist yet — silently skip
        return 0

    added = 0
    for row in rows:
        # Use canonical_name if set, otherwise the discovered name
        name = row.get("canonical_name") or row.get("name", "")
        if not name:
            continue
        name_lower = name.lower()
        if name_lower not in BRANDS_LOWER:
            BRANDS_LOWER[name_lower] = name
            BRANDS.append(name)
            # Also add compiled regex pattern so detect_brand() works
            _BRAND_PATTERNS[name] = _brand_pattern(name)
            added += 1

    if added:
        import logging
        logging.getLogger(__name__).info(
            "Loaded %d approved brands from brand_candidates (total brands: %d)",
            added, len(BRANDS),
        )
    return added


# ============================================================================
# FUZZY BRAND MATCHING — catches misspellings and near-matches
# ============================================================================
# Uses stdlib SequenceMatcher (no new deps). Only applied as fallback when
# exact regex matching fails. Threshold: 0.85 similarity = match.

_FUZZY_THRESHOLD = 0.85  # minimum similarity ratio to consider a fuzzy match
_FUZZY_MIN_LENGTH = 4    # don't fuzzy-match very short strings (too noisy)


def fuzzy_brand_match(candidate: str, threshold: float = _FUZZY_THRESHOLD) -> tuple[str | None, float]:
    """Try to fuzzy-match a candidate string against the brand database.

    Returns (matched_brand, similarity_score) or (None, 0.0) if no match.
    Only considers candidates >= 4 chars to avoid false positives.
    """
    if not candidate or len(candidate) < _FUZZY_MIN_LENGTH:
        return None, 0.0

    candidate_lower = candidate.lower().strip()

    # Quick exact check first (already in BRANDS_LOWER)
    if candidate_lower in BRANDS_LOWER:
        return BRANDS_LOWER[candidate_lower], 1.0

    best_match = None
    best_score = 0.0

    for brand_lower, brand_canonical in BRANDS_LOWER.items():
        # Skip brands much shorter/longer than candidate (saves time)
        if abs(len(brand_lower) - len(candidate_lower)) > max(3, len(candidate_lower) * 0.4):
            continue
        score = SequenceMatcher(None, candidate_lower, brand_lower).ratio()
        if score > best_score and score >= threshold:
            best_score = score
            best_match = brand_canonical

    return best_match, best_score


# Pre-compile word-boundary regex for each brand (used in detect_brand)
# Brands starting with non-word chars (like "&Shine") need special handling
# since \b doesn't work before & — use (?:^|\s) instead.
def _brand_pattern(brand: str) -> re.Pattern:
    escaped = re.escape(brand)
    if brand and not brand[0].isalnum() and brand[0] != '_':
        return re.compile(r'(?:^|\s)' + escaped + r'\b', re.IGNORECASE)
    return re.compile(r'\b' + escaped + r'\b', re.IGNORECASE)

_BRAND_PATTERNS = {brand: _brand_pattern(brand) for brand in BRANDS}

# ============================================================================
# BRAND ALIASES — variation spellings that map to a canonical brand name
# ============================================================================
# When detect_brand() matches a brand from BRANDS, it checks BRAND_ALIASES
# to return the canonical name. This handles compound names like "AiroPro"
# (which needs its own \b pattern) mapping back to "Airo".

BRAND_ALIASES: dict[str, str] = {
    'AiroPro': 'Airo',
    'CLEAR Brands': 'The Clear',
    'Evergreen Organix': 'EGO',
    'GLP': 'Green Life Productions',
    "Local's Only": "Local's Only",   # canonical form with apostrophe
    'Leaf and Vine': 'Leaf & Vine',   # normalize ampersand form
    'MUV': 'MÜV',                     # normalize to umlaut form
    'The Essence': 'Essence',         # "by The Essence" → canonical "Essence"
    'Tumbleweed': 'Tumbleweedz',      # normalize spelling
    'WYLD CBD': 'Wyld',               # product line → parent brand
    # Multi-state brand aliases
    'MKX Oil Co': 'MKX',
    'Timeless Vapes': 'Timeless',
    "Mindy's Edibles": "Mindy's",
    'Stiizy MI': 'STIIIZY',
    'Verano IL': 'Verano',
    'Wana MI': 'Wana',
    # Missouri aliases
    'Sinse Cannabis': 'Sinse',
    'Proper Cannabis': 'Proper',
    'Elevate Missouri': 'Elevate',
    'Illicit Gardens': 'Illicit',
    # NJ aliases
    'Verano Reserve': 'Verano',
    'Full Tilt': 'Verano',
    # Michigan expansion aliases
    'House of Dank': 'HOD',
    'Five Star': 'Five Star Extracts',
    'Church Cannabis Company': 'Church Cannabis',
    'Good Day Farms': 'Good Day Farm',
    # NJ expansion aliases
    'The Apothecarium': 'Apothecarium',
    'Bloc': 'Bloc NJ',
    'Garden State': 'Garden State Canna',
    'Heirloom Collective': 'The Heirloom Collective',
}

# ============================================================================
# BRAND VARIATION PATTERNS — catch misspellings and alternate forms
# ============================================================================
# These don't appear in BRANDS but should resolve to a canonical brand.
# Compiled separately and checked as a fallback in detect_brand().

_BRAND_VARIATION_MAP: dict[str, str] = {
    'stiizy': 'STIIIZY',
    'stizy': 'STIIIZY',
    'stiiiizy': 'STIIIZY',
    'airo pro': 'Airo',
    'airo brands': 'Airo',
    'locals only': "Local's Only",
    'church cannabis': 'Church',
    'church cannabis company': 'Church',
    'flower by edie parker': 'Edie Parker',
    'wyld cbd': 'Wyld',
    'sip elixirs': 'Sip',
    'ego brands': 'Evergreen Organix',
    'presidential rx': 'Presidential',
    'mojo - more joy': 'Mojo',
    'bonanza': 'Bonanza Cannabis',
    'greenway': 'Greenway LV',
    'grav': 'GRAV Labs',
    'fuze': 'Fuze Extracts',
    'tsunami': 'Tsunami Labs',
    'pheno exotic': 'Pheno Exotics',
    'indo cannabis': 'INDO',
    'sauce': 'Sauce Essentials',
    'vlasic': 'Vlasic Labs',
    'müv': 'MÜV',
    # Multi-state brand variations
    'mkx oil': 'MKX',
    'mkx oil co': 'MKX',
    'platinum vapes': 'Platinum Vape',
    'plat vape': 'Platinum Vape',
    'cresco labs': 'Cresco',
    'high supply by cresco': 'High Supply',
    'good news by cresco': 'Good News',
    "mindy's by cresco": "Mindy's",
    "mindy's kitchen": "Mindy's",
    'gti': 'GTI',
    'green thumb': 'GTI',
    'green thumb industries': 'GTI',
    'rythm by gti': 'RYTHM',
    'rhythm': 'RYTHM',
    'bedford grow': 'Bedford Grow',
    'revolution cannabis': 'Revolution',
    'rev cannabis': 'Revolution',
    'aeriz cannabis': 'Aeriz',
    'pts cannabis': 'PTS',
    'item 9': 'Item 9 Labs',
    'item nine': 'Item 9 Labs',
    'item nine labs': 'Item 9 Labs',
    'grow sciences': 'Grow Sciences',
    'venom': 'Venom Extracts',
    'timeless vape': 'Timeless',
    'abundant': 'Abundant Organics',
    'sonoran': 'Sonoran Roots',
    'tru infusion': 'Tru Infusion',
    'tru|med': 'Tru Infusion',
    'copperstate': 'Copperstate Farms',
    'mohave': 'Mohave Cannabis',
    # Missouri variations
    'illicit gardens': 'Illicit',
    'flora farm': 'Flora Farms',
    'good day farms': 'Good Day Farm',
    'head change': 'HeadChange',
    'headchange cannabis': 'HeadChange',
    'sinse cannabis': 'Sinse',
    'proper cannabis': 'Proper',
    'amaze': 'Amaze Cannabis',
    'greenlight cannabis': 'Greenlight',
    'star bud': 'Star Buds',
    # Michigan expansion variations
    'house of dank': 'HOD',
    'hod cannabis': 'HOD',
    'five star extracts': 'Five Star Extracts',
    'five star': 'Five Star Extracts',
    'light sky': 'Light Sky Farms',
    'choice edibles': 'Choice Edibles',
    'detroit edible': 'Detroit Edibles',
    'monster xtracts': 'Monster Xtracts',
    'monster extracts': 'Monster Xtracts',
    'pinnacle': 'Pinnacle Emporium',
    'church cannabis co': 'Church Cannabis',
    'viola cannabis': 'Viola',
    # Missouri expansion variations
    'good day farms': 'Good Day Farm',
    'from the earth cannabis': 'From The Earth',
    'nbliss': "N'Bliss",
    'n bliss': "N'Bliss",
    'heartland': 'Heartland Labs',
    'heartland labs': 'Heartland Labs',
    'old route 66 cannabis': 'Old Route 66',
    'swade cannabis': 'Swade',
    # NJ expansion variations
    'breakwater treatment': 'Breakwater',
    'garden state canna': 'Garden State Canna',
    'heirloom collective': 'The Heirloom Collective',
    'harmony dispensary': 'Harmony',
    'apothecarium nj': 'Apothecarium',
    'purple leaf nj': 'Purple Leaf',
    # NJ variations
    'kind tree nj': 'Kind Tree',
    'terrascend': 'TerrAscend',
    'fernway vape': 'Fernway',
    'fernway vapes': 'Fernway',
    'garden green': 'Garden Greens',
    'jersey canna': 'Jersey Canna',
    'the botanist nj': 'The Botanist',
    'clade 9': 'Clade9',
    'effin\'': 'Effin',
    '& shine': '&Shine',
    'and shine': '&Shine',
    # "The Lab" brand — dispensaries sometimes list as just "Lab"
    'lab': 'The Lab',
    # Nevada abbreviation brands — menus use the abbreviation, not full name
    'alternative medicine association': 'AMA',
    'alternative medical association': 'AMA',
    'high sierra holistics': 'HSH',
}

def _variation_pattern(var: str) -> re.Pattern:
    """Compile a word-boundary pattern for a brand variation string.

    Variations starting with non-word characters (like '& shine') use
    ``(?:^|\\s)`` instead of ``\\b`` — same logic as ``_brand_pattern``.
    """
    escaped = re.escape(var)
    if var and not var[0].isalnum() and var[0] != '_':
        return re.compile(r'(?:^|\s)' + escaped + r'\b', re.IGNORECASE)
    return re.compile(r'\b' + escaped + r'\b', re.IGNORECASE)

_VARIATION_PATTERNS: list[tuple[re.Pattern, str]] = [
    (_variation_pattern(var), canonical)
    for var, canonical in sorted(_BRAND_VARIATION_MAP.items(), key=lambda x: len(x[0]), reverse=True)
]

# ============================================================================
# STRAIN NAMES THAT CONTAIN BRAND WORDS
# ============================================================================
# These are known cannabis strains whose names happen to contain a brand name.
# When a product name matches one of these strain patterns, the embedded brand
# word should NOT be detected as the brand.
#
# Format: regex pattern → the brand word(s) it should block
# ============================================================================

_STRAIN_BRAND_BLOCKERS = [
    # "Haze" is a brand, but these are strains:
    (re.compile(r'\b(?:ghost\s*train|super\s*(?:lemon|silver)|purple|amnesia|neville|blue|catpiss|dungeon|hawaiian|original|golden|x|double|single|citrus|lemon|lime|mango|strawberry|peach|tropical)\s+haze\b', re.IGNORECASE), 'Haze'),
    # Also block if "haze" follows known connectors in compound strain names
    (re.compile(r'\bhaze\s+(?:og|kush|berry|dawg|diesel|cake|cookies|dream|punch|wreck|star|pie|queen|king|widow|mac|zkittlez)\b', re.IGNORECASE), 'Haze'),

    # "Runtz" is a brand, but these are strains:
    (re.compile(r'\b(?:white|pink|gelatti|gelato|tropical|gruntz|rainbow|'
                r'grape|obama|gummy|blue|apple|peach|mango|banana|melon|'
                r'cherry|strawberry|lemon|orange|potato|candy)\s+runtz\b', re.IGNORECASE), 'Runtz'),

    # "Church" is a brand, but "The Church" is a strain
    (re.compile(r'\bthe\s+church\b', re.IGNORECASE), 'Church'),

    # "Element" — "5th Element" is a strain
    (re.compile(r'\b5th\s+element\b', re.IGNORECASE), 'Element'),

    # "SELECT" — "Seche Select" is a product line from SeCHe, not the SELECT brand
    (re.compile(r'\bseche\s+select\b', re.IGNORECASE), 'SELECT'),

    # "SELECT" — "select $20 eighths" is promotional copy, not the brand
    (re.compile(r'\bselect\s+\$\d+', re.IGNORECASE), 'SELECT'),
    (re.compile(r'\bselect\s+(?:eighths?|strains?|items?|products?)\b', re.IGNORECASE), 'SELECT'),

    # "Sauce Essentials" — "Live Sauce" / "Cured Sauce" are concentrate formats
    (re.compile(r'\b(?:live|cured|diamond)\s+sauce\b', re.IGNORECASE), 'Sauce Essentials'),

    # "PACKS" is a brand, but "Ice Packs", "Infused … Packs", "Variety Pack",
    # etc. are product-form descriptors.  Block PACKS detection when preceded
    # by these common context words.
    (re.compile(r'\b(?:ice|variety|infused\s+ice|infused)\s+packs?\b', re.IGNORECASE), 'PACKS'),

    # "PLUS" is a brand (edibles), but it's a common English word.
    # Block in promotional contexts: "plus tax", "plus free", etc.
    (re.compile(r'\bplus\s+(?:tax|free|more|extra|shipping|delivery)\b', re.IGNORECASE), 'PLUS'),

    # "Toast" is a brand, but "French Toast", "Cinnamon Toast" are strains.
    (re.compile(r'\b(?:french|cinnamon)\s+toast\b', re.IGNORECASE), 'Toast'),

    # "Terra" is a brand, but block in common compound terms
    (re.compile(r'\bterra\s+(?:cotta|firma)\b', re.IGNORECASE), 'Terra'),

    # "The Lab" is a brand, but "lab tested" / "lab results" are product attributes
    (re.compile(r'\blab\s+(?:tested|results?|reports?|analysis|verified)\b', re.IGNORECASE), 'The Lab'),
]

# ============================================================================
# DISPENSARY CONFIGURATIONS (ALL 27)
# ============================================================================

DISPENSARIES = {
    # ── TD Sites (Dutchie iframe - 45s wait after age gate) ──────────
    'gibson': {
        'url': 'https://thedispensarynv.com/shop-gibson/?dtche%5Bpath%5D=specials',
        'platform': 'td_iframe',
        'name': 'TD-Gibson',
        'link': 'https://bit.ly/3JN2i5g',
        'target_pages': list(range(1, 19)),
        'smart_stop': True,
        'expected': 500,
    },
    'eastern': {
        'url': 'https://thedispensarynv.com/shop-eastern/?dtche%5Bpath%5D=specials',
        'platform': 'td_iframe',
        'name': 'TD-Eastern',
        'link': 'https://bit.ly/3JRmkvm',
        'target_pages': list(range(1, 19)),
        'smart_stop': True,
        'expected': 444,
    },
    'decatur': {
        'url': 'https://thedispensarynv.com/shop-decatur/?dtche%5Bpath%5D=specials',
        'platform': 'td_iframe',
        'name': 'TD-Decatur',
        'link': 'https://bit.ly/4njh0PY',
        'target_pages': list(range(1, 19)),
        'smart_stop': True,
        'expected': 486,
    },

    # ── Direct Sites ─────────────────────────────────────────────────
    'planet13': {
        'url': 'https://planet13.com/stores/planet-13-dispensary/specials',
        'platform': 'direct',
        'name': 'Planet13',
        'link': 'https://bit.ly/3VH075H',
        'target_pages': list(range(1, 11)),
        'smart_stop': True,
        'expected': 728,
    },
    'medizin': {
        'url': 'https://planet13.com/stores/medizin-dispensary/specials',
        'platform': 'direct',
        'name': 'Medizin',
        'link': 'https://bit.ly/medizin',
        'target_pages': list(range(1, 7)),
        'smart_stop': False,
        'expected': 247,
    },

    # ── Other Dutchie Iframe Sites ───────────────────────────────────
    'greenlight_downtown': {
        'url': 'https://greenlightnv.com/?dtche%5Bpath%5D=specials',
        'platform': 'dutchie_iframe',
        'name': 'Greenlight Downtown',
        'link': 'https://bit.ly/greenlight-dtc',
        'target_pages': list(range(1, 6)),
        'smart_stop': False,
        'expected': 54,
    },
    'greenlight_paradise': {
        'url': 'https://greenlightnv.com/paradise/?dtche%5Bpath%5D=specials',
        'platform': 'dutchie_iframe',
        'name': 'Greenlight Paradise',
        'link': 'https://bit.ly/greenlight-par',
        'target_pages': list(range(1, 6)),
        'smart_stop': False,
        'expected': 227,
    },
    'the_grove': {
        'url': 'https://thegrovenv.com/?dtche%5Bpath%5D=specials',
        'platform': 'dutchie_iframe',
        'name': 'The Grove',
        'link': 'https://bit.ly/the-grove',
        'target_pages': list(range(1, 6)),
        'smart_stop': False,
        'expected': 130,
    },
    'mint_paradise': {
        'url': 'https://mintcannabis.com/paradise/?dtche%5Bpath%5D=specials',
        'platform': 'dutchie_iframe',
        'name': 'Mint Paradise',
        'link': 'https://bit.ly/mint-paradise',
        'target_pages': list(range(1, 6)),
        'smart_stop': False,
        'expected': 171,
    },
    'mint_rainbow': {
        'url': 'https://mintcannabis.com/rainbow/?dtche%5Bpath%5D=specials',
        'platform': 'dutchie_iframe',
        'name': 'Mint Rainbow',
        'link': 'https://bit.ly/mint-rainbow',
        'target_pages': list(range(1, 6)),
        'smart_stop': False,
        'expected': 152,
    },

    # ── Curaleaf Sites (state selection + age gate + 45s wait) ───────
    'curaleaf_western': {
        'url': 'https://curaleaf.com/shop/nevada/curaleaf-las-vegas-western/categories/specials',
        'platform': 'curaleaf',
        'name': 'Curaleaf Western',
        'link': 'https://bit.ly/curaleaf-west',
        'target_pages': list(range(1, 11)),
        'smart_stop': False,
        'expected': 228,
    },
    'curaleaf_north': {
        'url': 'https://curaleaf.com/shop/nevada/curaleaf-las-vegas-north/categories/specials',
        'platform': 'curaleaf',
        'name': 'Curaleaf North',
        'link': 'https://bit.ly/curaleaf-north',
        'target_pages': list(range(1, 11)),
        'smart_stop': False,
        'expected': 307,
    },
    'curaleaf_strip': {
        'url': 'https://curaleaf.com/shop/nevada/curaleaf-las-vegas-strip/categories/specials',
        'platform': 'curaleaf',
        'name': 'Curaleaf Strip',
        'link': 'https://bit.ly/curaleaf-strip',
        'target_pages': list(range(1, 11)),
        'smart_stop': False,
        'expected': 46,
    },
    'curaleaf_reef': {
        'url': 'https://curaleaf.com/shop/nevada/curaleaf-las-vegas-reef/categories/specials',
        'platform': 'curaleaf',
        'name': 'Curaleaf Reef',
        'link': 'https://bit.ly/curaleaf-reef',
        'target_pages': list(range(1, 11)),
        'smart_stop': False,
        'expected': 276,
    },

    # ── Jane Sites (scroll/load more - no page numbers) ─────────────
    'oasis': {
        'url': 'https://www.oaboratory.com/menu?category=specials',
        'platform': 'jane',
        'name': 'Oasis Cannabis',
        'link': 'https://bit.ly/oasis',
        'target_pages': [],
        'smart_stop': False,
        'expected': 60,
    },
    'deep_roots_cheyenne': {
        'url': 'https://www.deeprootsharvest.com/cheyenne',
        'platform': 'jane',
        'name': 'Deep Roots Cheyenne',
        'link': 'https://bit.ly/dr-chey',
        'target_pages': [],
        'smart_stop': False,
        'expected': 33,
    },
    'deep_roots_craig': {
        'url': 'https://www.deeprootsharvest.com/craig',
        'platform': 'jane',
        'name': 'Deep Roots Craig',
        'link': 'https://bit.ly/dr-craig',
        'target_pages': [],
        'smart_stop': False,
        'expected': 38,
    },
    'deep_roots_blue_diamond': {
        'url': 'https://www.deeprootsharvest.com/blue-diamond',
        'platform': 'jane',
        'name': 'Deep Roots Blue Diamond',
        'link': 'https://bit.ly/dr-bd',
        'target_pages': [],
        'smart_stop': False,
        'expected': 27,
    },
    'deep_roots_parkson': {
        'url': 'https://www.deeprootsharvest.com/parkson',
        'platform': 'jane',
        'name': 'Deep Roots Parkson',
        'link': 'https://bit.ly/dr-park',
        'target_pages': [],
        'smart_stop': False,
        'expected': 20,
    },
    'cultivate_spring': {
        'url': 'https://cultivatelv.com/spring/menu?category=specials',
        'platform': 'jane',
        'name': 'Cultivate Spring',
        'link': 'https://bit.ly/cult-spring',
        'target_pages': [],
        'smart_stop': False,
        'expected': 37,
    },
    'cultivate_durango': {
        'url': 'https://cultivatelv.com/durango/menu?category=specials',
        'platform': 'jane',
        'name': 'Cultivate Durango',
        'link': 'https://bit.ly/cult-dur',
        'target_pages': [],
        'smart_stop': False,
        'expected': 40,
    },
    'thrive_sahara': {
        'url': 'https://thrivecannabis.com/sahara/menu?category=specials',
        'platform': 'jane',
        'name': 'Thrive Sahara',
        'link': 'https://bit.ly/thrive-sah',
        'target_pages': [],
        'smart_stop': False,
        'expected': 12,
    },
    'thrive_cheyenne': {
        'url': 'https://thrivecannabis.com/cheyenne/menu?category=specials',
        'platform': 'jane',
        'name': 'Thrive Cheyenne',
        'link': 'https://bit.ly/thrive-chey',
        'target_pages': [],
        'smart_stop': False,
        'expected': 12,
    },
    'thrive_strip': {
        'url': 'https://thrivecannabis.com/strip/menu?category=specials',
        'platform': 'jane',
        'name': 'Thrive Strip',
        'link': 'https://bit.ly/thrive-strip',
        'target_pages': [],
        'smart_stop': False,
        'expected': 12,
    },
    'thrive_main': {
        'url': 'https://thrivecannabis.com/main/menu?category=specials',
        'platform': 'jane',
        'name': 'Thrive Main',
        'link': 'https://bit.ly/thrive-main',
        'target_pages': [],
        'smart_stop': False,
        'expected': 6,
    },
    'beyond_hello_sahara': {
        'url': 'https://beyondhello.com/sahara/menu?category=specials',
        'platform': 'jane',
        'name': 'Beyond Hello Sahara',
        'link': 'https://bit.ly/bh-sahara',
        'target_pages': [],
        'smart_stop': False,
        'expected': 24,
    },
    'beyond_hello_twain': {
        'url': 'https://beyondhello.com/twain/menu?category=specials',
        'platform': 'jane',
        'name': 'Beyond Hello Twain',
        'link': 'https://bit.ly/bh-twain',
        'target_pages': [],
        'smart_stop': False,
        'expected': 28,
    },
}

# ============================================================================
# WAIT TIMES (proven - DO NOT REDUCE)
# ============================================================================

WAIT_TIMES = {
    'td_sites': {
        'after_age': 45,       # CRITICAL - TD sites need full 45s
        'between_pages': 5,
        'initial': 6,
    },
    'dutchie_other': {
        'after_age': 10,
        'between_pages': 3,
        'initial': 5,
    },
    'jane': {
        'view_more': 2,
        'initial': 3,
        'scroll': 1.5,
    },
    'curaleaf': {
        'after_state': 5,
        'after_age': 30,       # Curaleaf also needs long wait
        'between_pages': 3,
    },
}

# ============================================================================
# PRODUCT CARD SELECTORS (for Playwright)
# ============================================================================

PRODUCT_SELECTORS = [
    '[data-testid*="product"]',
    '[style*="min-height: 100%"]',
    '[data-testid="product-card"]',
    '._box_qnw0i_1',
    'div[class*="product"]',
    'div[class*="card"]',
    'article',
]


# ============================================================================
# CORE LOGIC CLASS
# ============================================================================

class CloudedLogic:
    """All business logic for Clouded Deals scraper."""

    def __init__(self):
        self.stats = defaultdict(int)

    # ────────────────────────────────────────────────────────────────
    # CATEGORY DETECTION
    # ────────────────────────────────────────────────────────────────
    # ORDER MATTERS! Check in this exact sequence:
    #   1. Skip (RSO, tincture, topical, etc.)
    #   2. Drinks → edible
    #   3. Preroll
    #   4. Concentrate (requires BOTH keyword AND weight)
    #   5. Flower (by weight pattern 3.5/7/14/28g) — BEFORE vape!
    #   6. Vape (word-boundary match to avoid false positives)
    #   7. Flower (by keyword)
    #   8. Edible (gummies, chocolate, candy)
    #   9. Other (fallback)
    # ────────────────────────────────────────────────────────────────

    def detect_category(self, text):
        """Detect product category from raw text. Order is critical."""
        if not text:
            return 'other'
        t = text.lower()

        # 1. SKIP non-qualifying products
        skip_keywords = [
            'rso', 'tincture', 'topical', 'capsule', 'cbd only', 'merch',
            'balm', 'salve', 'ointment', 'lotion', 'transdermal', 'patch',
            'roll-on', 'roll on', 'liniment', 'suppository',
            'hemp wrap', 'hemp wraps',
        ]
        if any(s in t for s in skip_keywords):
            return 'skip'

        # Rolling-paper cones are accessories, not cannabis prerolls.
        # Match "cone" / "cones" only when NOT preceded by infused/thc
        # indicators (infused cones ARE cannabis products).
        if re.search(r'\bcones?\b', t) and not re.search(r'\b(infused|thc|live resin)\b', t):
            # Only skip if the name looks like a cone accessory
            # (has size like "1 1/4", brand like RAW/Elements, or "pack"/"pk")
            if (re.search(r'\b1\s*1/4\b|\b1\.25\b|\bking\s*size\b|\bslim\b', t)
                    or re.search(r'\b(raw|elements|ocb|zig.?zag|hemper|pop cones?)\b', t)
                    or re.search(r'\d+\s*-?\s*pack\b|\d+\s*pk\b', t)):
                return 'skip'

        # Topical cream detection: "cream" + CBD:THC ratio (e.g. "Cream 3:1")
        # This catches products like "Medizin Cream 3:1 (125mg)" which are
        # topical ointments, NOT flower/edible.  Plain "cream" alone is too
        # broad (Ice Cream Cake is a popular strain).
        if 'cream' in t and re.search(r'\bcream\b.*\d+:\d+', t):
            return 'skip'

        # 2. DRINKS → edible (check early, before preroll "shot" overlap)
        drink_keywords = ['drink', 'shot', 'elixir', 'mocktail', 'beverage',
                          'seltzer', 'sparkling', 'tonic', 'soda']
        if any(w in t for w in drink_keywords):
            return 'edible'

        # 3. PREROLL (check before concentrate - infused prerolls have resin keywords)
        preroll_keywords = ['preroll', 'pre-roll', 'joint', 'blunt', 'dogwalker']
        if any(w in t for w in preroll_keywords):
            return 'preroll'
        # "PR" / "PR's" / "PRs" is a common abbreviation for pre-rolls
        if re.search(r"\bpr'?s?\b", t, re.IGNORECASE):
            return 'preroll'
        # "Xg/Npk" pattern (e.g. "2g/4pk", "2.5g/5pk") = preroll pack
        if re.search(r'\d+\.?\d*\s*g\s*/\s*\d+\s*pk\b', t):
            return 'preroll'

        # 4. CONCENTRATE (requires keyword; weight strongly preferred but
        #    concentrate-only keywords like "badder" are unambiguous even
        #    without weight — the deal detector still validates weight later)
        # IMPORTANT: If the product also has vape keywords (cart, pod, etc.),
        # it's a vape — not a concentrate.  "Live Resin Cart 0.5g" = vape.
        concentrate_keywords = [
            'badder', 'batter', 'budder', 'shatter', 'wax', 'sauce',
            'diamonds', 'sugar', 'crumble', 'hash', 'rosin', 'dab',
            'terp sauce', 'thca', 'crystals', 'isolate', 'live resin',
            'cured resin', 'lr', 'cr', 'extract', 'nug run',
        ]
        # These keywords are unambiguously concentrates even without weight.
        # NOTE: "live resin" / "cured resin" are NOT here because they also
        # appear in vape names ("Live Resin Cart").
        _UNAMBIGUOUS_CONCENTRATE = {
            'badder', 'batter', 'budder', 'shatter', 'crumble', 'rosin',
            'diamonds', 'nug run',
        }
        vape_keywords_re = re.compile(r'\b(cart|cartridge|pod|disposable|vape|pen|all[- ]?in[- ]?one|aio|ready[- ]?to[- ]?use)\b')
        has_concentrate = any(kw in t for kw in concentrate_keywords)
        has_concentrate_weight = (
            any(w in t for w in ['.5g', '1g', '1.0g', '2g', '0.5g', '0.3g', '0.35g', '0.85g', '0.9g'])
            or bool(re.search(r'\b1/[248]\s*(?:oz)?\b', t))  # fractional oz
        )
        has_vape_keyword = bool(vape_keywords_re.search(t))
        if has_concentrate and not has_vape_keyword:
            if has_concentrate_weight or any(kw in t for kw in _UNAMBIGUOUS_CONCENTRATE):
                self.stats['concentrates_found'] += 1
                return 'concentrate'

        # 5. FLOWER by weight pattern (3.5g, 7g, 14g, 28g)
        # MOVED BEFORE VAPE: These weights are unambiguously flower.
        # No vape/cart is 7g, 14g, or 28g.  A 3.5g product is almost
        # certainly flower too.  This prevents false vape classification
        # when the raw text block contains stray vape keywords (e.g.
        # "pen" inside "Aspen", navigation text, etc.).
        # EXCEPTION: If the product has explicit vape keywords (cart,
        # cartridge, pod, disposable), it's a vape even at 3.5g.
        # Example: "Trendi Cartridges 3.5g" should be vape, not flower.
        if re.search(r'\b(3\.5|7|14|28)\s*g\b', t) and not has_vape_keyword:
            return 'flower'

        # 6. VAPE
        # Use word-boundary regex to prevent false positives from
        # substrings (e.g. "pen" matching "Aspen", "open", "expend").
        # IMPORTANT: all-in-one pattern must handle all variations
        # (hyphens, spaces, no separator) — same as the vape exclusion
        # in step 4.  Without this, "All In One 0.5g" falls through to
        # step 9 (weight-based inference) and gets classified as concentrate.
        edible_keywords = ['gummies', 'gummy', 'gummes', 'gummis',
                          'chocolate', 'candy', 'brownie',
                          'chews', 'chew', 'taffy', 'lozenge', 'lozenges',
                          'drops', 'tarts', 'bites', 'pieces', 'mints',
                          'caramel', 'truffles', 'truffle', 'syrup',
                          'pastille', 'pastilles', 'bonbon', 'bon bon']
        if re.search(r'\b(cart|cartridge|pod|disposable|vape|pen|all[- ]?in[- ]?one|aio|ready[- ]?to[- ]?use)\b', t):
            if not any(w in t for w in edible_keywords):
                return 'vape'

        # 7. FLOWER by keyword
        flower_keywords = ['flower', 'bud', 'eighth', 'quarter', 'half', 'ounce', 'smalls', 'popcorn', 'shake']
        if any(w in t for w in flower_keywords):
            return 'flower'

        # 8. EDIBLE — expanded keywords including common product formats
        if any(w in t for w in edible_keywords):
            return 'edible'
        # Word-boundary match for short/ambiguous edible words.
        # These words appear in strain names ("Thin Mint", "Honey Boo Boo")
        # so we require a mg weight to confirm it's truly an edible.
        if re.search(r'\b(?:bars?|mints?|chew|tabs?|tablets?|blocks?|cookies?|honey)\b', t):
            if re.search(r'\b\d+\s*mg\b', t):
                return 'edible'

        # 9. WEIGHT-BASED INFERENCE — last chance before "other"
        # Products with mg content (e.g. "100mg") are almost always edibles
        if re.search(r'\b\d+\s*mg\b', t):
            return 'edible'
        # Sub-gram weights without vape keywords → likely concentrate
        if re.search(r'\b0\.[5-9]\s*g\b', t) and not has_vape_keyword:
            return 'concentrate'

        # 10. Other
        return 'other'

    # ────────────────────────────────────────────────────────────────
    # WEIGHT VALIDATION (CONTEXT-AWARE)
    # ────────────────────────────────────────────────────────────────
    # 🔴 CRITICAL: Category MUST be detected FIRST, then passed here.
    #
    # THE .35g BUG:
    #   Regex captures ".35" as 0.35g from raw product text.
    #   - For VAPES: 0.35g IS valid (small disposable cart)
    #   - For FLOWER: 0.35g is WRONG → should be 3.5g (eighth)
    #   - For CONCENTRATE: 0.35g is WRONG → likely mislabeled
    #
    # THE FIX: Check category first, then interpret weight in context.
    # ────────────────────────────────────────────────────────────────

    def validate_weight(self, weight_str, category):
        """
        Context-aware weight validation.
        Returns normalized weight string ('3.5g', '100mg', etc.) or None if invalid.
        """
        if not weight_str:
            return None

        match = re.search(r'([\d.]+)\s*([gG]|[mM][gG])', str(weight_str))
        if not match:
            return None

        try:
            val = float(match.group(1))
        except ValueError:
            return None
        unit = match.group(2).lower()

        # ── PREROLL ──────────────────────────────────────────────
        if category == 'preroll':
            if unit == 'g' and val == 1.0:
                return '1g'
            return None  # Only 1g prerolls qualify

        # ── VAPE ─────────────────────────────────────────────────
        if category == 'vape':
            if unit == 'g':
                if val > 2.0:
                    return None
                # 0.3g, 0.35g, 0.5g, 0.85g, 1g are ALL valid vape weights
                if 0.3 <= val <= 2.0:
                    formatted = f"{val}g" if val != int(val) else f"{int(val)}g"
                    return formatted
            elif unit == 'mg' and 200 <= val <= 1000:
                return f"{int(val)}mg"
            return None

        # ── FLOWER ───────────────────────────────────────────────
        if category == 'flower':
            if unit == 'g':
                # 🔴 THE FIX: .35 in flower context → 3.5g (eighth)
                if val == 0.35:
                    return '3.5g'
                # Also catch other common decimal-point drops
                if val == 0.7:
                    return '7g'
                if val >= 0.5 and val <= 28:
                    formatted = f"{val}g" if val != int(val) else f"{int(val)}g"
                    return formatted
            return None

        # ── EDIBLE ───────────────────────────────────────────────
        if category == 'edible':
            if unit == 'mg':
                if val == 100:
                    return '100mg'
                if val == 200:
                    return '200mg'
                # Fuzzy ranges for slightly off values
                if 82 <= val <= 118:
                    return '100mg'
                if 180 <= val <= 220:
                    return '200mg'
            return None

        # ── CONCENTRATE ──────────────────────────────────────────
        if category == 'concentrate':
            if unit == 'g' and 0.5 <= val <= 2:
                formatted = f"{val}g" if val != int(val) else f"{int(val)}g"
                return formatted
            return None

        # ── FALLBACK ─────────────────────────────────────────────
        if unit == 'g' and 0.3 <= val <= 28:
            formatted = f"{val}g" if val != int(val) else f"{int(val)}g"
            return formatted
        if unit == 'mg' and val == 100:
            return '100mg'
        return None

    # ────────────────────────────────────────────────────────────────
    # NORMALIZE WEIGHT (for edibles - handles fuzzy mg values)
    # ────────────────────────────────────────────────────────────────

    def normalize_weight(self, weight_str):
        """Normalize weight string, especially for edibles with fuzzy mg values.

        This is called in the edible code path — only mg values are meaningful.
        Gram values (e.g. from oz→g volume conversion on beverages) are rejected.
        """
        if not weight_str:
            return weight_str
        w = str(weight_str)

        if 'mg' in w.lower():
            mg_match = re.search(r'([\d.]+)', w)
            if mg_match:
                try:
                    val = float(mg_match.group(1))
                except ValueError:
                    return None
                if 82 <= val <= 118:
                    return '100mg'
                if 180 <= val <= 220:
                    return '200mg'
                if val == 100:
                    return '100mg'
                if val == 200:
                    return '200mg'
                # Reject tiny single-dose edibles
                if val < 50:
                    return None
                return f"{int(val)}mg"

        # Non-mg values (e.g. "224.0g" from an 8oz beverage volume
        # conversion) are not valid edible weights — reject them.
        if 'g' in w.lower() and 'mg' not in w.lower():
            return None

        return weight_str

    # ────────────────────────────────────────────────────────────────
    # BRAND DETECTION (fuzzy match against 200+ brand DB)
    # ────────────────────────────────────────────────────────────────

    def detect_brand(self, text):
        """Detect brand from product text using word-boundary matching against brand DB.

        Improvements over simple substring matching:
        1. Uses \\b word-boundary regex — "Haze" won't match inside "Hazel",
           "Cake" won't match inside "Cupcake", "Raw" won't match "Strawberry"
        2. Checks against known strain names — "Wedding Cake" won't detect "Cake",
           "Ghost Train Haze" won't detect "Haze" brand
        3. Position-aware: brands found at the START of text get priority
        """
        if not text:
            return None
        text_lower = text.lower()
        if text_lower.startswith('none '):
            return None

        # Check which brands are blocked by known strain-name patterns
        blocked_brands = set()
        for pattern, brand_to_block in _STRAIN_BRAND_BLOCKERS:
            if pattern.search(text):
                blocked_brands.add(brand_to_block)

        found_brands = []
        for brand in BRANDS:
            if brand in blocked_brands:
                continue
            pat = _BRAND_PATTERNS[brand]
            m = pat.search(text)
            if m:
                # Score: longer brand name is better; brand at start gets bonus
                pos = m.start()
                start_bonus = 100 if pos < 3 else (50 if pos < 10 else 0)
                found_brands.append((brand, len(brand) + start_bonus))

        # Also check brand variation patterns (full names, misspellings).
        # These compete with exact brand matches using the same scoring
        # so that "Alternative Medical Association" (→ AMA, 35 chars)
        # outscores "Runtz" (5 chars) when both appear in the same text.
        seen_canonicals = {b for b, _ in found_brands}
        for var_pat, canonical in _VARIATION_PATTERNS:
            if canonical in blocked_brands or canonical in seen_canonicals:
                continue
            m = var_pat.search(text)
            if m:
                pos = m.start()
                start_bonus = 100 if pos < 3 else (50 if pos < 10 else 0)
                # Use the variation string length for scoring (longer = better)
                found_brands.append((canonical, len(m.group(0).strip()) + start_bonus))
                seen_canonicals.add(canonical)

        if not found_brands:
            # Fallback: fuzzy match the first segment of the product name
            # (before dash/pipe), which is often the brand name.
            candidate = re.split(r'\s*[-|–—]\s*', text, maxsplit=1)[0].strip()
            matched, score = fuzzy_brand_match(candidate)
            if matched and matched not in blocked_brands:
                return BRAND_ALIASES.get(matched, matched)
            return None

        # Return best match (longest + position-weighted), resolved through aliases
        found_brands.sort(key=lambda x: x[1], reverse=True)
        best = found_brands[0][0]
        return BRAND_ALIASES.get(best, best)

    # ────────────────────────────────────────────────────────────────
    # CLEAN PRODUCT TEXT
    # ────────────────────────────────────────────────────────────────

    def clean_product_text(self, raw_text):
        """Clean raw scraped text for parsing."""
        if not raw_text:
            return ''
        # Remove common junk
        text = re.sub(r'Add to (cart|bag)', '', raw_text, flags=re.IGNORECASE)
        text = re.sub(r'(Add|Remove)\s*$', '', text, flags=re.IGNORECASE)
        text = re.sub(r'(Indica|Sativa|Hybrid)\s*$', '', text, flags=re.IGNORECASE)
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    # ────────────────────────────────────────────────────────────────
    # CLEAN PRODUCT NAME (for tweet display)
    # ────────────────────────────────────────────────────────────────

    def clean_product_name(self, text, brand=None):
        """Clean product name for display in tweets. Remove brand prefix duplication."""
        if not text:
            return ''
        product = text

        # Remove brand name from start if duplicated
        if brand:
            product = re.sub(rf'^{re.escape(brand)}\s*[-:]?\s*', '', product, flags=re.IGNORECASE)

        # Remove trailing junk
        product = re.sub(r'(Indica|Sativa|Hybrid|Add to cart|Add to bag)', '', product, flags=re.IGNORECASE)

        # Strip marketing tier labels (e.g. STIIIZY "Black Label", "Gold Label")
        product = re.sub(r'\s*\|\s*(Black|Gold|Silver|Blue|White|Red|Green|Purple|Diamond|Platinum)\s+Label\b', '', product, flags=re.IGNORECASE)
        product = re.sub(r'\b(Black|Gold|Silver|Platinum|Diamond)\s+Label\b', '', product, flags=re.IGNORECASE)

        # Strip "Prepack", "Whole Flower", "Flower Prepack" — marketing fluff
        product = re.sub(r'\b(?:Flower\s+)?Prepack\b', '', product, flags=re.IGNORECASE)
        product = re.sub(r'\bWhole\s+Flower\b', '', product, flags=re.IGNORECASE)

        product = re.sub(r'\s+', ' ', product).strip()
        product = product.strip('.,;:-|')

        # Remove duplicate consecutive words
        product = self.remove_duplicate_words(product)

        # Truncate if too long
        if len(product) > 60:
            truncate_point = product[:55].rfind(' ')
            if truncate_point > 35:
                product = product[:truncate_point]
            else:
                product = product[:55]

        return product if len(product) >= 3 else text[:60]

    def remove_duplicate_words(self, text):
        """Remove consecutive duplicate words."""
        words = text.split()
        result = [words[0]] if words else []
        for w in words[1:]:
            if w.lower() != result[-1].lower():
                result.append(w)
        return ' '.join(result)

    # ────────────────────────────────────────────────────────────────
    # INFUSED PREROLL CHECK
    # ────────────────────────────────────────────────────────────────

    def is_infused_preroll(self, text):
        """Check if product is an infused preroll (filter separately)."""
        if not text:
            return False
        t = text.lower()
        return any(kw in t for kw in INFUSED_KEYWORDS)

    # ────────────────────────────────────────────────────────────────
    # WYLD SMART STOP CHECK
    # ────────────────────────────────────────────────────────────────

    def check_for_wyld_brand(self, products):
        """Check if any product is Wyld brand (signals end of specials)."""
        for product in products:
            brand = product.get('brand', '').lower()
            if brand in [w.lower() for w in SMART_STOP_CONFIG['wyld_brand_names']]:
                return True
        return False

    # ────────────────────────────────────────────────────────────────
    # FULL PRODUCT PARSER
    # ────────────────────────────────────────────────────────────────

    def parse_product(self, raw_text, dispensary_name):
        """
        Parse raw product text into structured product dict.
        Returns product dict or None if invalid/skip.
        """
        clean_text = self.clean_product_text(raw_text)
        if not clean_text or len(clean_text) < 5:
            return None

        # ── Step 1: Detect category FIRST (before weight!) ───────
        category = self.detect_category(clean_text)
        if category == 'skip':
            self.stats['skipped_products'] += 1
            return None

        # ── Step 2: Check for infused preroll ────────────────────
        # Tag infused prerolls instead of filtering them out.
        # They stay in the DB and are searchable, just excluded from Top 100
        # by the deal_detector hard filters.
        is_infused = self.is_infused_preroll(clean_text)
        if is_infused:
            self.stats['infused_prerolls_tagged'] += 1

        # ── Step 3: Extract and validate weight WITH category ────
        # Check fractional-oz patterns FIRST (1/8oz, 1/4oz, 1/2oz) to
        # prevent the numeric regex from incorrectly matching the
        # denominator (e.g. "8oz" from "1/8oz").
        _frac_oz_m = re.search(r'\b(1/[248])\s*(?:oz)?\b', clean_text, re.IGNORECASE)
        _FRAC_GRAMS = {"1/8": 3.5, "1/4": 7.0, "1/2": 14.0}
        weight = None
        raw_weight = None
        if _frac_oz_m and _frac_oz_m.group(1) in _FRAC_GRAMS:
            grams = _FRAC_GRAMS[_frac_oz_m.group(1)]
            raw_weight = f"{grams}g"
            weight = self.validate_weight(raw_weight, category)
        else:
            if category == 'edible':
                # Edibles use mg for THC potency.  oz is liquid volume
                # (e.g. "8oz" on a beverage), NOT weight — converting it
                # to grams produces a nonsensical value (224g) that can
                # leak through normalize_weight.  Only match mg here.
                weight_match = re.search(r'([\d.]+)\s*mg\b', clean_text, re.IGNORECASE)
            else:
                weight_match = re.search(r'([\d.]+)\s*(g|mg|oz)\b', clean_text, re.IGNORECASE)
            if weight_match:
                raw_weight = weight_match.group(0)
                # Convert oz to grams for validation (non-edible only)
                oz_m = re.match(r'([\d.]+)\s*oz\b', raw_weight, re.IGNORECASE)
                if oz_m:
                    try:
                        oz_val = float(oz_m.group(1))
                    except ValueError:
                        raw_weight = None
                    else:
                        raw_weight = f"{round(oz_val * 28, 1)}g"
                weight = self.validate_weight(raw_weight, category)

            # Special handling for edibles — only normalize when a weight
            # string was actually extracted to avoid UnboundLocalError.
            if category == 'edible' and raw_weight is not None:
                normalized = self.normalize_weight(raw_weight)
                if normalized is None:
                    self.stats['rejected_tiny_edibles'] += 1
                    return None
                weight = normalized

            # Preroll must be exactly 1g
            if category == 'preroll' and weight != '1g':
                self.stats['rejected_preroll_filter'] += 1
                return None

        # ── Step 4: Detect brand ─────────────────────────────────
        brand = self.detect_brand(clean_text)

        # ── Step 5: Extract prices ───────────────────────────────
        # CRITICAL: Extract "$X off" discount amounts first, then remove
        # them from the text so they're not mistaken for sale prices.
        off_match = re.search(
            r'\$(\d+\.?\d*)\s*(?:off|save|discount)\b', clean_text,
            flags=re.IGNORECASE,
        )
        off_amount = float(off_match.group(1)) if off_match else 0

        price_text = re.sub(
            r'\$\d+\.?\d*\s*(?:off|save|discount)\b', '', clean_text,
            flags=re.IGNORECASE,
        )
        prices = re.findall(r'\$(\d+\.?\d*)', price_text)
        prices = [float(p) for p in prices]
        prices.sort()

        deal_price = prices[0] if prices else None
        original_price = prices[-1] if len(prices) > 1 else None

        # If we found a "$X off" pattern and only one price remains,
        # compute the sale price: original - discount.
        if off_amount > 0 and deal_price and not original_price:
            original_price = deal_price
            deal_price = round(original_price - off_amount, 2)
            if deal_price <= 0:
                deal_price = original_price
                original_price = None

        # Calculate discount
        discount_percent = None
        savings = None
        if deal_price and original_price and original_price > deal_price:
            savings = original_price - deal_price
            discount_percent = round((savings / original_price) * 100)

        # Sanity check: if deal_price < $3 and we have an original, the
        # "price" is likely a discount amount that slipped through (e.g.
        # "$3 off" without the word "off" right after the number).
        if deal_price and deal_price < 3 and original_price and original_price > deal_price:
            inferred_sale = original_price - deal_price
            if inferred_sale > 3:
                savings = deal_price  # the small number was the discount
                deal_price = inferred_sale
                discount_percent = round((savings / original_price) * 100)

        # Also check for explicit % off in text
        if discount_percent is None:
            pct_match = re.search(r'(\d+)%\s*off', clean_text, re.IGNORECASE)
            if pct_match:
                discount_percent = int(pct_match.group(1))

        # ── Step 6: Extract THC ──────────────────────────────────
        thc_percent = None
        thc_mg = None
        if category == 'edible' and weight:
            mg_match = re.search(r'(\d+\.?\d*)\s*mg', weight, re.IGNORECASE)
            if mg_match:
                thc_mg = float(mg_match.group(1))
        else:
            thc_match = re.search(r'THC:\s*([\d.]+)%?', clean_text, re.IGNORECASE)
            if thc_match:
                thc_percent = float(thc_match.group(1))

        # ── Step 7: Extract strain type ──────────────────────────
        strain_type = None
        if '(I)' in clean_text or 'Indica' in clean_text:
            strain_type = 'Indica'
        elif '(S)' in clean_text or 'Sativa' in clean_text:
            strain_type = 'Sativa'
        elif '(H)' in clean_text or 'Hybrid' in clean_text:
            strain_type = 'Hybrid'

        # ── Build product dict ───────────────────────────────────
        product = {
            'raw_text': raw_text,
            'clean_text': clean_text,
            'category': category,
            'brand': brand,
            'weight': weight,
            'deal_price': deal_price,
            'original_price': original_price,
            'discount_percent': discount_percent,
            'savings': savings,
            'thc_percent': thc_percent,
            'thc_mg': thc_mg,
            'strain_type': strain_type,
            'dispensary': dispensary_name,
            'is_infused': is_infused,
            'product_name': self.clean_product_name(clean_text, brand),
        }

        self.stats[f'parsed_{category}'] += 1
        return product

    # ────────────────────────────────────────────────────────────────
    # DEAL QUALIFICATION
    # ────────────────────────────────────────────────────────────────

    def is_qualifying(self, product):
        """Check if product qualifies as a deal. Returns True/False."""
        if not product or not product.get('deal_price'):
            return False

        category = product.get('category')
        price = product['deal_price']
        weight = product.get('weight', '')

        # Global price cap
        if price > PRICE_CAP_GLOBAL:
            self.stats['rejected_over_global_cap'] += 1
            return False

        # Category-specific price caps
        if category == 'edible':
            caps = PRICE_CAPS['edible']
            if price < caps['min'] or price > caps['max']:
                self.stats['rejected_price_cap'] += 1
                return False
            # Only 100mg and 200mg qualify
            if weight and weight not in ['100mg', '200mg']:
                self.stats['rejected_tiny_edibles'] += 1
                return False

        elif category == 'preroll':
            caps = PRICE_CAPS['preroll']
            if price < caps['min'] or price > caps['max']:
                self.stats['rejected_price_cap'] += 1
                return False

        elif category == 'vape':
            caps = PRICE_CAPS['vape']
            if price < caps['min'] or price > caps['max']:
                self.stats['rejected_price_cap'] += 1
                return False

        elif category == 'flower':
            if weight and '3.5' in weight:
                caps = PRICE_CAPS['flower_3.5g']
            elif weight and '7' in weight and '14' not in weight:
                caps = PRICE_CAPS['flower_7g']
            elif weight and '14' in weight:
                caps = PRICE_CAPS['flower_14g']
            else:
                caps = PRICE_CAPS['flower_3.5g']  # Default to eighth

            if price < caps['min'] or price > caps['max']:
                self.stats['rejected_price_cap'] += 1
                return False

        elif category == 'concentrate':
            caps = PRICE_CAPS['concentrate_1g']
            if weight and '1g' not in weight:
                self.stats['rejected_weights'] += 1
                return False
            if price < caps['min'] or price > caps['max']:
                self.stats['rejected_price_cap'] += 1
                return False

        elif category == 'other':
            self.stats['rejected_other_category'] += 1
            return False

        # Discount check (if we have discount data)
        discount = product.get('discount_percent')
        if discount is not None:
            if discount < MIN_DISCOUNT:
                self.stats['rejected_low_discount'] += 1
                return False
            if discount > MAX_DISCOUNT:
                self.stats['rejected_high_discount'] += 1
                return False

        self.stats['qualified'] += 1
        return True

    # ────────────────────────────────────────────────────────────────
    # SCORING (for tweet selection)
    # ────────────────────────────────────────────────────────────────

    def score_deal(self, product):
        """Score a deal for ranking. Higher = better deal."""
        score = 0.0

        discount = product.get('discount_percent') or 0
        price = product.get('deal_price') or 30
        savings = product.get('savings') or 0

        # Discount weight: 67% of discount percentage (max 40 points)
        score += min(40, discount * 0.67)

        # Price bonus: lower prices score higher (max 30 points)
        score += max(0, 30 - price)

        # Savings bonus (max 20 points)
        score += min(20, savings)

        return round(score, 1)


# ============================================================================
# STANDALONE TEST
# ============================================================================

def run_tests():
    """Run validation tests on all business logic."""
    logic = CloudedLogic()
    passed = 0
    failed = 0

    print("=" * 70)
    print("CLOUDED LOGIC - VALIDATION TESTS")
    print("=" * 70)

    # ── Weight validation tests ──────────────────────────────────
    print("\n🔴 WEIGHT VALIDATION (the .35g fix):")
    weight_tests = [
        ('.35g',   'flower',      '3.5g',   '.35 in flower = 3.5g eighth'),
        ('0.35g',  'flower',      '3.5g',   '0.35g flower → 3.5g'),
        ('0.35g',  'vape',        '0.35g',  '0.35g IS valid for vape carts'),
        ('.5g',    'vape',        '0.5g',   'Standard half gram cart'),
        ('.5g',    'concentrate', '0.5g',   'Half gram wax/shatter'),
        ('3.5g',   'flower',      '3.5g',   'Standard eighth'),
        ('1g',     'preroll',     '1g',     'Standard preroll'),
        ('2g',     'preroll',     None,     '2g preroll = reject'),
        ('100mg',  'edible',      '100mg',  'Standard edible'),
        ('95mg',   'edible',      '100mg',  '~100mg edible (fuzzy)'),
        ('10mg',   'edible',      None,     'Too small, reject'),
        ('0.85g',  'vape',        '0.85g',  'Stiiizy pod size'),
        ('7g',     'flower',      '7g',     'Quarter ounce'),
        ('1g',     'concentrate', '1g',     'Standard concentrate'),
        ('1g',     'vape',        '1g',     'Full gram cart'),
    ]

    for input_w, cat, expected, note in weight_tests:
        result = logic.validate_weight(input_w, cat)
        ok = result == expected
        status = '✅' if ok else '❌'
        print(f"  {status} {input_w:8s} + {cat:12s} → {str(result):8s} (expected {str(expected):8s}) {note}")
        if ok:
            passed += 1
        else:
            failed += 1

    # ── Category detection tests ─────────────────────────────────
    print("\n📦 CATEGORY DETECTION:")
    category_tests = [
        ('AMA Gary Peyton Live Resin 1.0g',    'concentrate', 'Live resin + 1g'),
        ('Rove Skywalker OG Cart 0.5g',         'vape',        'Cart keyword'),
        ('Cookies Gary Payton 3.5g',             'flower',      'Weight pattern 3.5g'),
        ('Dogwalkers Indica 1g',                 'preroll',     'Dogwalker brand'),
        ('Kiva Camino Gummies 100mg',            'edible',      'Gummies keyword'),
        ('Bounti Disposable Vape 0.35g',         'vape',        'Disposable → vape'),
        ('CAMP Flower Smalls 3.5g',              'flower',      'Flower keyword + 3.5g'),
        ('City Trees Budder 1g',                 'concentrate', 'Budder keyword + 1g'),
        ('RSO Syringe 1g',                       'skip',        'RSO = filtered'),
        ('Drink Loud Pink Lemonade 100mg',       'edible',      'Drink → edible'),
        ('Diamond Infused Preroll 1g',           'preroll',     'Preroll keyword'),
        ('Select Essentials Pod 0.5g',           'vape',        'Pod → vape'),
    ]

    for input_text, expected_cat, note in category_tests:
        result = logic.detect_category(input_text)
        ok = result == expected_cat
        status = '✅' if ok else '❌'
        print(f"  {status} {expected_cat:12s} ← \"{input_text[:45]}...\" {note}")
        if ok:
            passed += 1
        else:
            failed += 1
            print(f"       GOT: {result}")

    # ── Brand detection tests ────────────────────────────────────
    print("\n🏷️  BRAND DETECTION:")
    brand_tests = [
        ('AMA Gary Peyton Live Resin 1.0g',    'AMA'),
        ('STIIIZY SIP Party Hurricane',         'STIIIZY'),
        ('City Trees Garlic Zoap 1g',           'City Trees'),
        ('Random Unknown Product 3.5g',          None),
    ]

    for input_text, expected_brand in brand_tests:
        result = logic.detect_brand(input_text)
        ok = result == expected_brand
        status = '✅' if ok else '❌'
        print(f"  {status} \"{input_text[:40]}...\" → {result} (expected {expected_brand})")
        if ok:
            passed += 1
        else:
            failed += 1

    # ── Summary ──────────────────────────────────────────────────
    total = passed + failed
    print(f"\n{'=' * 70}")
    print(f"RESULTS: {passed}/{total} passed ({failed} failed)")
    print(f"{'=' * 70}")

    if failed == 0:
        print("🎉 ALL TESTS PASSING - Logic is clean!")
    else:
        print(f"⚠️  {failed} FAILURES - Review above")

    return failed == 0


if __name__ == "__main__":
    run_tests()
