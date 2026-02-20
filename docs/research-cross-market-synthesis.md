# Cross-Market Synthesis: ML/LLM Data Preparation

*Compiled: Feb 2026 | Updated: Feb 17, 2026 | CloudedDeals Multi-State Expansion — Phase 7*

---

## Executive Summary

This document synthesizes findings from all expansion markets into actionable data architecture requirements for ML/LLM training pipelines. Key deliverables: master brand database expansion plan, platform coverage matrix, data normalization challenges, and recommended schema changes.

**Scale context (updated Feb 17, 2026):**
- ~~Current: 63 dispensaries, 1 state (NV), 200+ brands, 6 platforms~~
- ~~After expansion: ~1,200+ dispensaries, 6 states, 400+ brands, 8+ platforms~~
- **Actual current state: 1,143 active dispensaries, 11 states, 200+ brands, 5 active platforms (Rise disabled), 24 daily cron jobs**
- **Consumer-facing product: Southern NV only (63 dispensaries)**
- **Backend data collection: 10 additional states running daily scrapes silently**

---

## 0. Phase Re-Assessment: Backend Already Scaled

*Added Feb 17, 2026 — Review of original Phase D/E plan against actual infrastructure*

The original phased plan (Phases D-E, months 4-12) was written assuming backend
multi-state scraping was future work that would gate ML/LLM and B2B efforts.
That assumption is now outdated. Here is what has actually shipped vs. what the
plan expected.

### 0.1 What's Already Built (Ahead of Schedule)

| Original Plan Item | Status | Evidence |
|---|---|---|
| Multi-state scraper infrastructure | **DONE** | 11 states, not the planned 6 |
| ~1,200 dispensary configs | **DONE** | 1,143 active / 1,192 total in `config/dispensaries.py` |
| Platform coverage (Dutchie, Jane, Curaleaf, Carrot, AIQ) | **DONE** | 5 platforms active, Rise disabled (Cloudflare) |
| Staggered cron scheduling by timezone | **DONE** | 24 cron jobs in `scrape.yml`, EST→PST stagger |
| State-partitioned dispensary config | **DONE** | `get_dispensaries_by_region()` with 11 region values |
| Region column + CHECK constraint on dispensaries | **DONE** | Migrations 013 + 035 |
| Multi-region daily_metrics | **DONE** | Migration 035, keyed on `(run_date, region)` |
| Top-deals view across all states | **DONE** | `top_100_curated` view rebuilt without NV hardcode |
| Brand DB with 200+ brands + aliases + state variations | **DONE** | `clouded_logic.py` lines 101-344 |
| Deal scoring pipeline (0-100, Top 200 selection) | **DONE** | `deal_detector.py`, 1,382 lines |
| Product parser with weight/price/brand extraction | **DONE** | `parser.py`, 749 lines |
| Price history tracking | **DONE** | Migration 025 |
| Deal observation history | **DONE** | Migration 026-027 |

### 0.2 What's Still Missing (From the Original Plan)

| Original Plan Item | Status | Notes |
|---|---|---|
| `state` column on `products` table | **NOT DONE** | Products inherit state from dispensary join, no direct column |
| `state_scoring_config` table | **NOT DONE** | Scoring uses same NV-calibrated params for all states |
| `state_price_caps` table | **NOT DONE** | Price caps in `clouded_logic.py` are NV-calibrated, not state-aware |
| `brand_state_presence` table | **NOT DONE** | Brand tiers are flat, not state-differentiated |
| `thc_min` / `thc_max` fields | **NOT DONE** | Single THC value only |
| `subcategory` field on products | **NOT DONE** | Subcategory detection exists in code, not persisted |
| `tax_inclusive` flag | **NOT DONE** | No state tax normalization |
| Sunnyside scraper | **NOT DONE** | Would cover ~15 IL Cresco locations |
| Weedmaps embed scraper | **NOT DONE** | Would add ~165 dispensaries across MI/AZ/MO/NJ |
| LLM product normalization pipeline | **NOT DONE** | All classification is rule-based regex |
| State-aware deal scoring model | **NOT DONE** | Same thresholds applied everywhere |
| Consumer-facing multi-state product | **NOT DONE** | Only Vegas is live to users |

### 0.3 What This Means for the Phase Plan

The original Phase D (B2B Foundation, months 4-8) and Phase E (ML/LLM Layer,
months 6-12) were sequenced after infrastructure buildout. Since infrastructure
is done, the gating question changes:

**Old gate:** "Do we have enough data?" — Yes. 1,143 menus, 11 states,
50K+ products/day flowing into the DB.

**New gate:** "Do we have enough *users* to prove the data has value?" — Not yet.
The consumer product is live in Vegas only, and the KPI is 20 daily-active
deal-checkers, not 50K scraped products.

### 0.4 Revised Phase Sequencing

**Phase C' (Weeks 1-6, NOW): Prove Vegas Retention**

This remains the top priority. No amount of backend scale matters without user
retention. The 50K+ daily products are an asset only if users engage with the
200 curated deals surfaced from them.

Concrete targets:
- 20 daily-active users checking deals before their dispensary run
- Measurable save/share actions on surfaced deals
- Signal on which categories/brands/price points drive engagement

**Phase D' (Concurrent with C', lightweight): Passive Data Enrichment**

Because the scraping pipeline is already running at scale, certain data
enrichment work can happen in the background without distracting from
consumer product focus:

1. **Start logging unmatched brands per state** — The scraper already runs;
   add counters for products where brand detection returns `null`. This
   tells you exactly which net-new brands from Section 1.2 are most
   urgent to add. Zero user-facing impact, pure data quality.

2. **State-relative price distribution snapshots** — Once a week, dump
   `(state, category, weight, percentile_25, median, percentile_75)` from
   the existing products table. This builds the `PRICE_DISTRIBUTIONS`
   lookup the state-aware scoring model needs (Section 3.1) without
   writing any new scraper code.

3. **Subcategory tagging dry run** — The `product_classifier.py` already
   detects infused prerolls, pod vs cart, etc. Start writing the
   subcategory to a new column or log file. Validates the classifier
   against 11-state data before it matters for the consumer product.

4. **Cross-state brand pricing snapshots** — Track how the same brand
   (STIIIZY, Cookies, Cresco) prices identically across states.
   This becomes the first B2B insight ("STIIIZY pods cost $25 in MI vs
   $55 in NJ") and validates whether the data is clean enough for brand
   dashboards.

**Phase E' (After Retention Proven, ~Month 3+): State-Aware Scoring**

Only after Vegas retention is validated should engineering effort shift to:

1. **State-specific price caps** — The NV-calibrated caps ($25 flower eighth,
   $28 vape cart) are wrong for IL ($45-65 flower eighths) and MI ($15-30).
   When you're ready to surface deals in a second city, this is the first
   blocker.

2. **`state_scoring_config` table** — Different min discount thresholds per
   state (IL/NJ at 10% vs NV/MI at 15%) directly affect deal quality.

3. **Multi-state consumer rollout** — Pick the second city based on
   data quality metrics: brand detection rate >80%, deal qualification rate
   5-15%, platform success rate >90%. Michigan (196 dispensaries, Dutchie-
   dominant, price-competitive market) is the likely candidate.

**Phase F' (After Multi-State Consumer Launch): ML/LLM + B2B**

The original plan correctly identified that ML and B2B are amplified by user
retention. With the backend already scaled, the revised triggers are:

- **ML trigger:** Multi-state consumer product live in 2+ markets with
  measurable engagement. The 50K+ daily product texts become LLM training
  data when you have user engagement signals (saves, clicks, shares) to
  label "good deal" vs "noise."

- **B2B trigger:** 1,000+ weekly active users across 2+ states. At that
  point "STIIIZY carts at 30% off get 4x the save rate" is a real insight
  backed by real user behavior, not just scrape data.

### 0.5 Revised Implementation Priority Roadmap

| Priority | Task | Original Phase | Revised Phase | Gated By |
|---|---|---|---|---|
| **P0** | Vegas user retention (20 DAU) | C | C' (NOW) | Nothing — do this first |
| **P1** | Log unmatched brands per state per run | D | D' (concurrent) | Nothing — add counters |
| **P1** | Weekly price distribution snapshots | E | D' (concurrent) | Nothing — SQL query |
| **P1** | Subcategory dry-run logging | E | D' (concurrent) | Nothing — classifier exists |
| **P1** | Cross-state brand price comparison data | D | D' (concurrent) | Nothing — data exists |
| **P2** | State-specific price caps for IL/MI | E | E' (month 3+) | Vegas retention proven |
| **P2** | `state_scoring_config` table + migration | E | E' (month 3+) | Vegas retention proven |
| **P2** | Second city consumer launch (likely MI) | D | E' (month 3+) | State-aware scoring |
| **P2** | 130+ net-new brands bulk add | D | E' (month 3+) | Second city selection |
| **P3** | Sunnyside scraper (IL Cresco) | D | E' (month 3+) | IL consumer launch decision |
| **P3** | Weedmaps scraper (+165 dispensaries) | D | F' (month 6+) | Multi-state live |
| **P3** | LLM product normalization pipeline | E | F' (month 6+) | Engagement-labeled training data |
| **P3** | Brand analytics dashboard (internal) | D | F' (month 6+) | Cross-state + engagement data |
| **P4** | Dispensary performance reporting | D | F' (month 6+) | 1K+ WAU across 2+ states |
| **P4** | Personalized deal scoring (per-user) | E | F' (month 6+) | Enough save/click history |
| **P4** | Brand visibility / sponsored placement | D | F' (month 8+) | Proven audience |

### 0.6 The Data Advantage You Already Have

The fact that 11 states are silently collecting data creates a compounding
advantage that most competitors don't have, even if no user ever sees it today:

1. **Price history depth** — By the time you launch in Michigan, you'll have
   months of daily price data for 196 dispensaries. Day-one deal scoring in MI
   will be calibrated against real historical distributions, not guesses.

2. **Brand detection tuning** — Every day the scraper runs, you can measure
   how many products get `brand = null` per state. When you're ready to add
   the 130+ net-new brands, you'll know exactly which ones matter most
   (highest null-match volume).

3. **Platform reliability baselines** — Months of scrape_runs data per
   platform per state tells you which platform+state combos are flaky before
   you ever surface those deals to users.

4. **Seasonal patterns** — Cannabis pricing has clear seasonal cycles (4/20,
   holidays, harvest gluts). Collecting through multiple cycles before
   launching ML means your models won't be fooled by one-time events.

5. **Schema migration safety** — When you need `state_scoring_config` or
   `subcategory` columns, you'll have months of backfill data to validate
   migrations against rather than deploying blind.

**Bottom line:** The backend is not idle infrastructure — it's a moat-building
data flywheel. Every day it runs is another day of training data, price history,
and platform reliability signal that competitors would need months to replicate.
The only thing that unlocks its value is user retention in Vegas.

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
- **Scale:** ~50,000+ product texts per day across ~~6~~ 11 states (already flowing as of Feb 2026)

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

*Updated Feb 17, 2026 with current status annotations*

| Priority | Task | Dependencies | Status |
|---|---|---|---|
| **P0** | State field on dispensaries table + migration | None | **DONE** (migration 013 + 035) |
| **P0** | ~~State-specific price caps in clouded_logic.py~~ | None | **NOT DONE** — deferred to Phase E' |
| **P0** | Region field expansion (metro areas) | State field | **DONE** (11 regions in CHECK constraint) |
| **P1** | MI dispensary configs (196 dispensaries) | P0 schema | **DONE** (all waves shipped) |
| **P1** | IL dispensary configs (165 dispensaries) | P0 schema | **DONE** (all waves shipped) |
| **P1** | ~~Brand DB expansion (~130 new brands + aliases)~~ | None | **PARTIAL** — state-specific lists in doc, not all integrated into clouded_logic.py |
| **P1** | ~~State-aware deal scoring~~ | P0 price caps | **NOT DONE** — deferred to Phase E' |
| **P2** | MI all waves (196 total dispensaries) | P1 Wave 1 stable | **DONE** |
| **P2** | IL all waves (165 total dispensaries) | P1 Wave 1 stable | **DONE** |
| **P2** | ~~Sunnyside scraper (IL Cresco)~~ | P0 schema | **NOT DONE** — deferred to Phase E' |
| **P2** | AZ dispensary configs (99 dispensaries) | P0 schema | **DONE** |
| **P2** | OH dispensary configs (78 dispensaries) | P0 schema | **DONE** (unplanned — added) |
| **P2** | CO dispensary configs (133 dispensaries) | P0 schema | **DONE** (unplanned — added) |
| **P2** | NY dispensary configs (74 dispensaries) | P0 schema | **DONE** (unplanned — added) |
| **P2** | MA dispensary configs (111 dispensaries) | P0 schema | **DONE** (unplanned — added) |
| **P3** | MO dispensary configs (89 dispensaries) | P0 schema | **DONE** |
| **P3** | NJ dispensary configs (102 dispensaries) | P0 schema | **DONE** |
| **P3** | PA dispensary configs (43 dispensaries) | P0 schema | **DONE** (unplanned — added) |
| **P3** | ~~Weedmaps embed scraper~~ | Platform research | **NOT DONE** — deferred to Phase F' |
| **P3** | ~~THC range parsing + thc_min/thc_max fields~~ | Schema migration | **NOT DONE** |
| **P4** | ~~Subcategory detection persistence~~ | Category classifier update | **NOT DONE** — classifier exists, no DB persistence |
| **P4** | ~~Tax-inclusive price normalization~~ | State tax rate config | **NOT DONE** |
| **P4** | ~~LLM product normalization pipeline~~ | Training data from scrapes | **NOT DONE** — deferred to Phase F' |

**Summary:** 13 of 18 original tasks are DONE. 5 additional states (OH, CO, NY, MA, PA) were added beyond the original 6-state plan. The remaining work is scoring calibration and ML — both gated by consumer retention, not infrastructure.

---

## 7. Key Metrics to Track During Expansion

*Updated Feb 17, 2026 — split into "track now" vs "track later"*

### 7.1 Track Now (Data Collection Phase — No User-Facing Changes Required)

| Metric | Target | How to Measure | Why |
|---|---|---|---|
| **Platform success rate per state** | >90% per scrape run | `scrape_runs` table: success_count / total_count per region | Identifies flaky platform+state combos before consumer launch |
| **Brand detection rate per state** | >80% of products have brand assigned | Count `brand IS NULL` / total per region | Tells you which states need brand DB additions first |
| **Deal qualification rate per state** | 5-15% of products qualify as deals | Count deals / total products per region | <5% means price caps are too tight for that state; >15% means too loose |
| **Price cap hit rate per state** | <5% of products filtered by caps | Log cap-rejection reasons in deal_detector | NV caps applied to IL will reject everything — this proves it |
| **New brand discovery rate** | Decreasing over time per state | Track unknown brand names per run | Plateau = brand DB is sufficiently complete for that state |
| **Dispensary coverage per state** | >60% of licensed dispensaries | Active dispensaries / known licensed count | Already exceeded in AZ (87%), MO (84%); gap in MI (~55%) |

### 7.2 Track After Consumer Launch in State (Requires User Engagement Data)

| Metric | Target | Why |
|---|---|---|
| **Daily active users per state** | 20+ per launched market | Core retention signal |
| **Deal save rate by brand/category** | Identify top-performing combos | Feeds personalized scoring model |
| **Cross-state brand price spread** | Track by brand+category+weight | B2B insight for brand dashboards |
| **Deal engagement velocity** | Time from deal posted to first save | Measures deal quality and user urgency |
| **Category preference distribution** | Per-state breakdown | Informs state-specific deal curation |

---

*End of Cross-Market ML/LLM Synthesis*
