# Cross-Market Synthesis: ML/LLM Data Preparation

*Compiled: Feb 2026 | CloudedDeals Multi-State Expansion — Phase 7*

---

## Executive Summary

This document synthesizes findings from all 5 expansion markets (Michigan, Illinois, Arizona, Missouri, New Jersey) into actionable data architecture requirements for ML/LLM training pipelines. Key deliverables: master brand database expansion plan, platform coverage matrix, data normalization challenges, and recommended schema changes.

**Scale context:**
- Current: 63 dispensaries, 1 state (NV), 200+ brands, 6 platforms
- After expansion: ~1,200+ dispensaries, 6 states, 400+ brands, 8+ platforms

---

## 1. Master Brand Database Expansion Plan

### 1.1 Current NV Brand Database

| Metric | Count |
|---|---|
| Canonical brands (BRANDS list) | 203 |
| Brand aliases (BRAND_ALIASES) | 4 |
| Variation patterns (_BRAND_VARIATION_MAP) | 21 |
| Strain brand blockers | 6 patterns |
| Frontend-only brands (not in clouded_logic) | ~170 |
| **Total tracked brands** | ~370+ |

### 1.2 Net-New Brands by State

| State | Net-New Brands | Overlap with NV DB | Top New Brands |
|---|---|---|---|
| **Michigan** | ~35-40 | ~20 | Platinum Vape, MKX, Lume, Skymint, Element (expand), Michigrown, Redbud Roots |
| **Illinois** | ~30-40 | ~16 | Revolution, Aeriz, Bedford Grow, Cresco/High Supply, Mindy's, Ozone, FSHO |
| **Arizona** | ~20-25 | ~40+ | Abundant Organics, Grow Sciences, Item 9, Venom Extracts, Timeless, Tru|Med |
| **Missouri** | ~30-35 | ~10 | Proper Cannabis, Sinse, BeLeaf, Flora Farms, Good Day Farms, Head Change |
| **New Jersey** | ~15-20 | ~30+ | Kind Tree, Breakwater, Garden State Canna, The Heirloom Collective |
| **TOTAL** | **~130-160** | — | — |

### 1.3 Brand Canonical Entries Needed

```python
# ============================================================================
# NET-NEW BRANDS — MULTI-STATE EXPANSION (Phase 1 + Batch 2)
# ============================================================================

BRANDS_MI = [
    # Michigan-native brands
    'Platinum Vape', 'MKX Oil Co', 'Lume', 'Skymint',
    'Michigrown', 'Glorious Cannabis Co', 'Redbud Roots',
    'Fluresh', 'Common Citizen', 'Freddy\'s Fuego',
    'The Botanical Co', 'Light Sky Farms', 'Five Star Extracts',
    'Pyramid', 'North Coast', 'Humblebee', 'Redemption',
    'Drip', 'Choice Edibles', 'Detroit Edibles', 'Monster Xtracts',
    'Puff Cannabis', 'Cloud Cannabis', 'House of Dank',
    'JARS', 'Joyology', 'Pinnacle',
    'High Profile', 'Breeze', 'Pleasantrees',
]

BRANDS_IL = [
    # Illinois-native + MSO sub-brands
    'Revolution', 'Aeriz', 'Bedford Grow', 'PTS',
    'High Supply', 'Mindy\'s', 'Good News', 'Wonder',
    'Shelby County', 'Justice Grown', 'Ozone', 'Simply Herb',
    'Matter', 'Seed & Strain', 'Classix',
    '1906',  # functional edibles
    'FloraCal',  # Cresco premium line
]

BRANDS_AZ = [
    # Arizona-native brands
    'Abundant Organics', 'Grow Sciences', 'Tru Med',
    'Item 9 Labs', 'Venom Extracts', 'Timeless Vapes',
    'Ponderosa', 'Mohave Cannabis', 'Canamo',
    'Sonoran Roots', 'Copperstate Farms',
]

BRANDS_MO = [
    # Missouri-native brands
    'Proper Cannabis', 'Sinse', 'BeLeaf', 'Ostara',
    'Flora Farms', 'Heartland Labs', 'Good Day Farms',
    'Clovr', 'Vivid', 'Solhaus', 'Head Change',
    'From The Earth', 'Heya',
]

BRANDS_NJ = [
    # New Jersey-native brands
    'Kind Tree', 'Breakwater', 'Garden State Canna',
    'The Heirloom Collective', 'Harmony',
]
```

### 1.4 New Aliases Needed

```python
BRAND_ALIASES_EXPANSION = {
    # Michigan
    'mkx': 'MKX Oil Co',
    'mkx oil': 'MKX Oil Co',
    'plat vape': 'Platinum Vape',
    'platinum': 'Platinum Vape',  # context-dependent
    'redbud': 'Redbud Roots',
    'light sky': 'Light Sky Farms',
    'five star': 'Five Star Extracts',

    # Illinois
    'rev': 'Revolution',  # common abbreviation
    'bedford': 'Bedford Grow',
    'cresco llr': 'Cresco',  # Liquid Live Resin = Cresco brand
    'high supply': 'High Supply',  # Cresco value line
    'mindys': "Mindy's",
    "mindy's edibles": "Mindy's",
    'fsho': 'Aeriz',  # Full Spectrum Hash Oil = Aeriz product
    'ozone reserve': 'Ozone',

    # Arizona
    'item 9': 'Item 9 Labs',
    'item nine': 'Item 9 Labs',
    'grow sci': 'Grow Sciences',
    'trumed': 'Tru Med',
    'tru|med': 'Tru Med',
    'timeless': 'Timeless Vapes',

    # Missouri
    'proper': 'Proper Cannabis',
    'good day': 'Good Day Farms',
    'flora': 'Flora Farms',

    # New Jersey
    'kind tree terrascend': 'Kind Tree',
}
```

### 1.5 New Strain Brand Blockers

```python
# Additional strain-vs-brand conflicts for new markets
_STRAIN_BRAND_BLOCKERS_EXPANSION = [
    # "Platinum" — strain name vs Platinum Vape brand
    (re.compile(r'\b(?:platinum\s+(?:og|kush|cookies|gsc|girl|scout|garlic|jack|purple|bubba|gelato))\b', re.IGNORECASE), 'Platinum Vape'),

    # "Revolution" — unlikely strain name but guard against
    # "French Revolution", "Velvet Revolution" compound strains
    (re.compile(r'\b(?:french|velvet|green|quiet)\s+revolution\b', re.IGNORECASE), 'Revolution'),

    # "Harmony" — dispensary name AND potential strain
    (re.compile(r'\bharmony\s+(?:dispensary|nj|menu|store)\b', re.IGNORECASE), 'Harmony'),
]
```

---

## 2. Master Platform Coverage Summary

### 2.1 Total Addressable Market (TAM)

| State | Licensed Dispensaries | Dutchie | Jane | Curaleaf | Rise | Other Supported | Unsupported | **Total Scrapeable** | **Coverage %** |
|---|---|---|---|---|---|---|---|---|---|
| **NV** | 63 | 20 | 19 | 6 | 9 | 9 (Carrot+AIQ) | 0 | **63** | 100% |
| **MI** | ~1,000+ | ~350-400 | ~150-200 | ~8 | 0 | ~20-30 (AIQ) | ~300+ | **~530-640** | ~55-65% |
| **IL** | ~230 | ~50-70 | ~40-60 | ~15 | ~15-18 | ~0 | ~60-80 | **~130-170** | ~65-75% |
| **AZ** | ~180 | ~120 | ~30 | ~10 | ~4 | ~0 | ~16 | **~164** | ~87% |
| **MO** | ~210 | ~130 | ~40 | ~3 | ~3 | ~0 | ~34 | **~176** | ~84% |
| **NJ** | ~140 | ~35 | ~20 | ~8 | ~4 | ~0 | ~73 | **~67** | ~75% |
| **TOTAL** | **~1,823** | **~705-825** | **~299-369** | **~50** | **~35-38** | **~29-39** | **~483+** | **~1,130-1,280** | **~68%** |

### 2.2 Platform Gap Analysis

| Unsupported Platform | States Affected | Est. Dispensaries | New Scraper Effort | Priority |
|---|---|---|---|---|
| **Weedmaps Embed** | MI, AZ, MO, NJ | ~165 | Medium (API-based, well-documented embed) | **P2** |
| **Sunnyside (Cresco)** | IL only | ~15 | Medium (React SPA, single operator) | **P1** |
| **Leafly Embed** | MI, IL, AZ | ~50 | Medium (similar to Weedmaps pattern) | **P3** |
| **Meadow POS** | MI | ~30-40 | Low-Medium (simpler SPA) | **P3** |
| **Custom/Proprietary** | All | ~100+ | High (per-site work) | **P4** |

### 2.3 If We Build 2 New Scrapers

Adding **Sunnyside + Weedmaps** scrapers would:
- Add ~180 more dispensaries
- Raise total coverage to **~1,310-1,460** (~78% of all licensed dispensaries)
- Cover IL's #1 MSO (Cresco/Sunnyside)
- Cover MI's biggest platform gap (Weedmaps-first operators like Puff Cannabis)

---

## 3. Data Normalization Challenges for ML Training

### 3.1 Price Variance by State

| Category | NV Range | MI Range | IL Range | AZ Range | MO Range | NJ Range |
|---|---|---|---|---|---|---|
| Flower 3.5g | $25-45 | **$15-30** | **$45-65** | $25-50 | $20-40 | $45-60 |
| Vape Cart 1g | $30-50 | **$20-40** | **$45-70** | $30-50 | $20-40 | $40-55 |
| Edible 100mg | $10-20 | **$8-15** | **$20-35** | $12-22 | $15-25 | $25-40 |
| Concentrate 1g | $25-45 | **$15-35** | **$45-70** | $25-50 | $20-40 | $40-60 |

**ML implication:** Price-based features must be **state-normalized**. A $30 flower eighth is a steal in IL but overpriced in MI. Raw price values are not comparable across states without normalization.

**Recommended approach:**
```python
# State-relative price scoring
def normalize_price(price, category, weight, state):
    """Convert absolute price to percentile within state/category/weight."""
    state_distribution = PRICE_DISTRIBUTIONS[state][category][weight]
    return percentile_rank(price, state_distribution)
```

### 3.2 Category Naming Inconsistencies

| NV Category | MI Variations | IL Variations | AZ Variations | Normalization Rule |
|---|---|---|---|---|
| `flower` | flower, buds, cannabis flower | flower, cannabis | flower, bud | Canonical: `flower` |
| `preroll` | preroll, pre-roll, joint, blunt | preroll, pre-roll, joint | preroll, pre-roll | Canonical: `preroll` |
| `vape` | vape, cartridge, cart, pod, disposable | vape, cart, pod | vape, cartridge | Canonical: `vape` |
| `edible` | edible, gummy, gummies, chocolate, beverage, drink | edible, gummy, chocolate | edible, gummy | Canonical: `edible` |
| `concentrate` | concentrate, wax, shatter, budder, live resin, rosin, diamond, sauce | concentrate, wax, budder, sugar, sauce, FSHO, live resin | concentrate, wax | Canonical: `concentrate` |
| — | **topical** (more prominent MI) | **tincture** (FSHO/RSO prominent IL) | — | New categories or subcategories |

**ML implication:** Category detection model needs to be trained on multi-state product name patterns. IL's "FSHO" (Full Spectrum Hash Oil) doesn't exist in NV vocabulary. MI's "topical" category is more prominent than NV.

**Recommended additions:**
```python
# Subcategory expansion for ML features
SUBCATEGORIES = {
    'concentrate': ['live_resin', 'cured_resin', 'budder', 'shatter', 'diamonds',
                    'sauce', 'rosin', 'hash_rosin', 'fsho', 'rso', 'badder'],
    'vape': ['cart_510', 'pod', 'disposable', 'all_in_one'],
    'edible': ['gummy', 'chocolate', 'beverage', 'capsule', 'tincture', 'lozenge'],
    'preroll': ['single', 'multipack', 'infused', 'blunt'],
    'flower': ['eighth', 'quarter', 'half', 'ounce', 'gram', 'smalls', 'shake'],
}
```

### 3.3 THC% Reporting Differences

| Format | Example | States | Parsing Rule |
|---|---|---|---|
| Exact value | `27.3%` | NV (primary), MI, AZ | Direct parse |
| Range | `25-29%` | IL (common), MI (some) | Take midpoint: `27%` |
| Total THC | `THC: 27.3%` | All | Standard label parse |
| THCa + Delta-9 | `THCa: 30.1%, D9: 0.8%` | MI (some) | Sum for total: `30.9%` |
| Missing | No THC displayed | All (some operators) | `null` — don't filter |

**ML implication:** THC% feature needs to handle ranges, compound values, and missing data. Recommend storing both `thc_min` and `thc_max` fields, with a computed `thc_midpoint`.

### 3.4 Weight Format Differences

| Format | Example | States | Parsing Rule |
|---|---|---|---|
| Standard grams | `3.5g`, `1g`, `0.5g` | All | Direct parse |
| Fraction display | `1/8 oz`, `1/4 oz` | MI (some indie sites) | Map: 1/8=3.5g, 1/4=7g, 1/2=14g, 1oz=28g |
| Pack notation | `5pk`, `10pk`, `3-pack` | All | Extract count for per-unit pricing |
| Milligrams (edibles) | `100mg`, `200mg`, `500mg` | All | Direct parse; normalize to mg |
| Combined | `1g / 10 pieces` | IL edibles | Parse both weight and count |

**ML implication:** Weight parser already handles most formats. Need to add fraction-of-ounce parsing for MI market.

### 3.5 Deal Detection Differences

| Aspect | NV | MI | IL | AZ | MO | NJ |
|---|---|---|---|---|---|---|
| **Was/Now pricing** | Very common | Very common | Less common | Common | Common | Moderate |
| **% off display** | Common | Common | Rare | Common | Common | Moderate |
| **Daily specials** | Item-level | Item-level | **Store-wide %** | Item-level | Item-level | Store-wide |
| **BOGO** | Common | Very common | Rare | Common | Common | Moderate |
| **Bundle deals** | Common | Common | Rare | Common | Common | Moderate |

**ML implication:** IL and NJ have more store-wide discount patterns (e.g., "20% off all flower today") rather than item-level markdowns. The deal detection model needs to handle:
1. Item-level was/now (existing NV pattern)
2. Store-wide percentage banners (new IL/NJ pattern)
3. Day-of-week rotating specials (common in MI/MO)

---

## 4. Recommended Multi-State Schema Changes

### 4.1 Database Schema Additions

```sql
-- Migration: Add multi-state support

-- 1. Add state column to dispensaries
ALTER TABLE dispensaries ADD COLUMN state TEXT NOT NULL DEFAULT 'NV';
ALTER TABLE dispensaries ADD COLUMN metro_region TEXT;  -- e.g., 'detroit-metro', 'chicago', 'phoenix'

-- 2. State-specific scoring parameters
CREATE TABLE state_scoring_config (
    state TEXT PRIMARY KEY,
    min_discount NUMERIC DEFAULT 15,
    max_discount NUMERIC DEFAULT 85,
    min_price NUMERIC DEFAULT 3,
    max_price NUMERIC DEFAULT 100,
    brand_boost_premium NUMERIC DEFAULT 20,
    brand_boost_popular NUMERIC DEFAULT 12,
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO state_scoring_config (state, min_discount, max_discount, min_price, max_price) VALUES
('NV', 15, 85, 3, 100),
('MI', 15, 85, 2, 80),     -- MI: lower prices
('IL', 10, 85, 5, 150),    -- IL: higher prices, lower discount threshold
('AZ', 15, 85, 3, 100),    -- AZ: similar to NV
('MO', 15, 85, 3, 90),     -- MO: moderate prices
('NJ', 10, 85, 5, 150);    -- NJ: similar to IL

-- 3. State-specific price caps
CREATE TABLE state_price_caps (
    state TEXT,
    category TEXT,
    weight_tier TEXT,  -- e.g., '3.5g', '7g', '1g', 'single', 'pack'
    min_cap NUMERIC,
    max_cap NUMERIC,
    PRIMARY KEY (state, category, weight_tier)
);

-- 4. Brand-state association
CREATE TABLE brand_state_presence (
    brand_canonical TEXT,
    state TEXT,
    is_native BOOLEAN DEFAULT false,  -- brand originated in this state
    market_share_tier TEXT,  -- 'dominant', 'established', 'emerging', 'niche'
    PRIMARY KEY (brand_canonical, state)
);

-- 5. Products table additions
ALTER TABLE products ADD COLUMN state TEXT;
ALTER TABLE products ADD COLUMN metro_region TEXT;
ALTER TABLE products ADD COLUMN thc_min NUMERIC;
ALTER TABLE products ADD COLUMN thc_max NUMERIC;
ALTER TABLE products ADD COLUMN tax_inclusive BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN subcategory TEXT;  -- e.g., 'live_resin', 'gummy', 'infused'

-- 6. Index for multi-state queries
CREATE INDEX idx_products_state ON products(state) WHERE is_active = true;
CREATE INDEX idx_dispensaries_state ON dispensaries(state) WHERE is_active = true;
CREATE INDEX idx_products_state_category ON products(state, category) WHERE is_active = true;
```

### 4.2 Scoring Model Adjustments

```python
# State-aware deal scoring
class MultiStateDealDetector:
    def __init__(self, state: str):
        self.config = STATE_SCORING_CONFIG[state]
        self.price_caps = STATE_PRICE_CAPS[state]

    def score_deal(self, product) -> int:
        """Score 0-100 using state-specific parameters."""
        base = (product.discount_percent - self.config.min_discount) * 2

        # Brand boost — check if brand is premium in THIS state
        brand_boost = self._brand_boost(product.brand, product.state)

        # Category boost — same across states
        category_boost = CATEGORY_BOOSTS.get(product.category, 5)

        # Price sweet-spot — state-relative
        price_pct = self._state_relative_price_percentile(product)
        sweet_spot = 15 if price_pct < 0.3 else 0  # bottom 30% of state prices

        return min(100, base + brand_boost + category_boost + sweet_spot)
```

### 4.3 Config Architecture Change

```python
# config/dispensaries.py evolution

# Phase 1 (current): Flat list, NV-only
DISPENSARIES = [
    {"name": "TD Gibson", "slug": "td-gibson", "platform": "dutchie", ...}
]

# Phase 2 (multi-state): State-partitioned
DISPENSARIES_BY_STATE = {
    "NV": [...],  # existing 63 sites
    "MI": [...],  # new MI sites
    "IL": [...],  # new IL sites
    "AZ": [...],  # new AZ sites
    "MO": [...],  # new MO sites
    "NJ": [...],  # new NJ sites
}

# Platform groups become state-aware
PLATFORM_GROUPS = {
    "NV": {"stable": ["dutchie", "curaleaf", "jane"], "new": ["rise", "carrot", "aiq"]},
    "MI": {"stable": ["dutchie", "jane"], "new": ["curaleaf"]},
    "IL": {"stable": ["dutchie", "jane", "curaleaf", "rise"], "new": ["sunnyside"]},
    "AZ": {"stable": ["dutchie", "jane", "curaleaf", "rise"], "new": []},
    "MO": {"stable": ["dutchie", "jane"], "new": ["curaleaf", "rise"]},
    "NJ": {"stable": ["dutchie", "jane", "curaleaf", "rise"], "new": []},
}
```

---

## 5. LLM Training Data Opportunities

### 5.1 Product Description Normalization
Multi-state scraping creates a natural training corpus for product normalization:
- **Input:** Raw menu text ("STIIIZY - Blue Dream - Live Resin Pod - 1g - $45 $32")
- **Output:** Structured JSON `{brand: "STIIIZY", strain: "Blue Dream", category: "vape", subcategory: "pod", weight: "1g", original_price: 45, sale_price: 32}`
- **Scale:** ~50,000+ product texts per day across 6 states

### 5.2 Brand Detection Training
- Cross-state brand name variations create robust training data for fuzzy matching
- Strain-vs-brand disambiguation becomes richer with more market context
- MSO brand family relationships (Cresco → High Supply, Mindy's, Good News) are natural knowledge graph entries

### 5.3 Deal Quality Prediction
- Multi-state pricing data enables relative deal quality assessment ("Is this a good deal for IL?")
- Historical pricing trends per brand/category/state = price prediction models
- Cross-state brand pricing arbitrage detection ("STIIIZY pod costs $25 in MI vs $55 in NJ")

### 5.4 Category Classification
- Multi-state product names expand category classifier training set
- State-specific terminology (IL "FSHO", MI "cured badder") increases model robustness
- Subcategory granularity (live resin vs cured resin vs rosin) improves with more data

---

## 6. Implementation Priority Roadmap

| Priority | Task | Dependencies | Est. Effort |
|---|---|---|---|
| **P0** | State field on dispensaries table + migration | None | Small |
| **P0** | State-specific price caps in clouded_logic.py | None | Small |
| **P0** | Region field expansion (metro areas) | State field | Small |
| **P1** | MI dispensary configs (Wave 1: Dutchie — Lume, Skymint, JARS, Cloud) | P0 schema | Medium |
| **P1** | IL dispensary configs (Wave 1: Rise — 12 locations) | P0 schema | Medium |
| **P1** | Brand DB expansion (~130 new brands + aliases) | None | Medium |
| **P1** | State-aware deal scoring | P0 price caps | Medium |
| **P2** | MI Wave 2-4 (Herbana, Joyology, Jane independents) | P1 Wave 1 stable | Medium |
| **P2** | IL Wave 2-5 (Zen Leaf, Ascend, Beyond/Hello, Dutchie independents) | P1 Wave 1 stable | Medium |
| **P2** | Sunnyside scraper (IL Cresco) | P0 schema | Large |
| **P2** | AZ dispensary configs (Wave 1: Harvest/Trulieve, Sol Flower, Curaleaf) | P0 schema | Medium |
| **P3** | MO dispensary configs | P0 schema | Medium |
| **P3** | NJ dispensary configs | P0 schema | Medium |
| **P3** | Weedmaps embed scraper | Platform research | Large |
| **P3** | THC range parsing + thc_min/thc_max fields | Schema migration | Small |
| **P4** | Subcategory detection (live_resin, gummy, pod, etc.) | Category classifier update | Medium |
| **P4** | Tax-inclusive price normalization | State tax rate config | Medium |
| **P4** | LLM product normalization pipeline | Training data from scrapes | Large |

---

## 7. Key Metrics to Track During Expansion

| Metric | Target | Why |
|---|---|---|
| **Dispensary coverage per state** | >60% of licensed dispensaries | Market representativeness |
| **Platform success rate per state** | >90% per scrape run | Scraper reliability |
| **Brand detection rate per state** | >80% of products have brand assigned | Data quality for ML |
| **Deal qualification rate per state** | 5-15% of products qualify | Scoring calibration |
| **Price cap hit rate per state** | <5% of products filtered by caps | Cap calibration |
| **New brand discovery rate** | Track unmatched brands per run | Brand DB completeness |
| **Cross-state brand coverage** | >90% of national brands detected | Brand model quality |

---

*End of Cross-Market ML/LLM Synthesis*
