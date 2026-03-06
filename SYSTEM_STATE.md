# SYSTEM_STATE.md — System Snapshot

> **Generated:** March 6, 2026 — Pre-marketing-push baseline
>
> **Purpose:** Read-only audit of the entire system at ~100 active users. If
> something breaks at 500 users, diff against this document to identify what
> changed.

---

## Table of Contents

1. [Active Scrapers](#1-active-scrapers)
2. [Scoring Algorithm (0–100 Points)](#2-scoring-algorithm-0100-points)
3. [Supabase Database Schema](#3-supabase-database-schema)
4. [Environment Variables](#4-environment-variables)
5. [Deployment Configuration](#5-deployment-configuration)

---

## 1. Active Scrapers

### 1.1 Platform Summary

| Platform | Sites | Concurrency Cap | Status | Key Challenge |
|----------|-------|-----------------|--------|---------------|
| **Dutchie** | ~1,260 | 3 | Active | iframe/JS-embed detection, category tabs, pagination |
| **Jane** | ~696 | 4 | Active | Hybrid iframe/direct, "View More" load-more, no original prices |
| **Curaleaf** | ~122 | 4 | Active | React SPA, redirect-based age gate, overlay dismissal |
| **Carrot** | 5 | 3 | Active | SPA or WordPress embed, lazy-load scroll |
| **AIQ** | 2 | 3 | Active | Dispense React SPA, Load More buttons |
| **Rise** | 37 | — | **DISABLED** | 100% Cloudflare Turnstile blocked (all sites disabled) |

**Total active:** ~2,085 scraped daily | **Total disabled:** 37 (Rise)
**Grand total configured:** ~2,122

### 1.2 Coverage by Region

| Region | Sites | Platforms | Shards | Status |
|--------|-------|-----------|--------|--------|
| Southern NV | 53 | Dutchie, Curaleaf, Jane, Carrot, AIQ | 1 | **Production** (consumer-facing) |
| Northern NV | ~40 | Dutchie, Curaleaf, Jane, Carrot, AIQ | 1 | **Production** (consumer-facing) |
| Michigan | ~446 | Dutchie, Jane, Curaleaf | 6 | Data collection only |
| Missouri | ~261 | Dutchie, Jane | 4 | Data collection only |
| Ohio | ~247 | Dutchie, Jane, Curaleaf | 4 | Data collection only |
| New Jersey | ~232 | Dutchie, Jane, Curaleaf | 4 | Data collection only |
| Colorado | ~200 | Dutchie, Jane | 3 | Data collection only |
| Massachusetts | ~184 | Dutchie, Jane | 2 | Data collection only |
| Illinois | ~166 | Dutchie, Jane, Curaleaf, Rise (disabled) | 3 | Data collection only |
| Arizona | ~127 | Dutchie, Curaleaf | 2 | Data collection only |
| New York | ~73 | Dutchie, Jane | 2 | Data collection only |
| Pennsylvania | ~43 | Dutchie, Jane, Curaleaf | 1 | Data collection only |

### 1.3 Anti-Bot Stack (7 Layers)

| Layer | Technique | Source |
|-------|-----------|--------|
| 1 | **playwright-stealth** | Patches navigator props, WebGL fingerprinting |
| 2 | **Rotated User-Agents** | Chrome 133–134 pool, one per browser context |
| 3 | **Randomized viewports** | 4 base resolutions (1920×1080, 1366×768, 1440×900, 1536×864) ± jitter (±16px W, ±8px H) |
| 4 | **Region-mapped timezones** | Each context gets timezone matching dispensary location (e.g. `michigan` → `America/Detroit`) |
| 5 | **Rotated locale** | `en-US` variant pool per context |
| 6 | **JS stealth init script** | Overrides webdriver detection, fake plugins |
| 7 | **Real Chrome channel** | Branded Chrome (not Chromium) for TLS fingerprint |

**Additional:** 0–180s random startup jitter on scheduled cron runs.

### 1.4 Scraper Architecture

```
main.py orchestrator
  → Load dispensary configs from config/dispensaries.py
  → Filter by REGION / PLATFORM_GROUP
  → Launch browser pool (shared Chrome contexts, SCRAPE_CONCURRENCY=6 default)
  → For each dispensary:
      → Route to platform scraper (Dutchie/Jane/Curaleaf/Carrot/AIQ)
      → Dismiss age gate (handlers/age_verification.py)
      → Extract products (platform-specific)
      → Parse raw text → structured fields (parser.py)
      → Detect category, validate weight (clouded_logic.py)
      → Classify subtypes (product_classifier.py)
  → Score all products (deal_detector.py)
      → Hard filters → scoring → quality gate → dedup → top-200
  → Upsert products + deals to Supabase
  → Collect metrics (metrics_collector.py) → daily_metrics table
```

### 1.5 Key Source Files

| File | Location | Purpose |
|------|----------|---------|
| `main.py` | `clouded-deals/scraper/` | Entry point — orchestrates scraping |
| `clouded_logic.py` | `clouded-deals/scraper/` | Single source of truth: category detection, weight validation, brand DB (264 brands), price caps |
| `deal_detector.py` | `clouded-deals/scraper/` | Hard filters → scoring → quality gate → dedup → top-200 selection |
| `product_classifier.py` | `clouded-deals/scraper/` | Subtype enrichment: infused, pack, vape/concentrate subtypes |
| `parser.py` | `clouded-deals/scraper/` | Raw text → prices, weight, brand, THC/CBD |
| `metrics_collector.py` | `clouded-deals/scraper/` | Daily pipeline metrics → Supabase |
| `enrichment_snapshots.py` | `clouded-deals/scraper/` | Weekly price distributions, cross-state brand pricing |
| `platforms/base.py` | `clouded-deals/scraper/` | BaseScraper — browser lifecycle, anti-bot, debug |
| `platforms/dutchie.py` | `clouded-deals/scraper/` | Dutchie scraper |
| `platforms/jane.py` | `clouded-deals/scraper/` | Jane scraper |
| `platforms/curaleaf.py` | `clouded-deals/scraper/` | Curaleaf scraper |
| `platforms/carrot.py` | `clouded-deals/scraper/` | Carrot scraper |
| `platforms/aiq.py` | `clouded-deals/scraper/` | AIQ scraper |
| `platforms/rise.py` | `clouded-deals/scraper/` | Rise scraper (ALL DISABLED) |
| `handlers/age_verification.py` | `clouded-deals/scraper/` | Universal age-gate dismissal |
| `handlers/iframe.py` | `clouded-deals/scraper/` | Dutchie content detection cascade |
| `handlers/pagination.py` | `clouded-deals/scraper/` | Platform-specific pagination |
| `config/dispensaries.py` | `clouded-deals/scraper/` | ~2,122 dispensary configs, UA pool, viewport pool, region→timezone map |

---

## 2. Scoring Algorithm (0–100 Points)

**Source:** `clouded-deals/scraper/deal_detector.py`

### 2.1 Pipeline Overview

```
Products → Hard Filters (pass/fail)
         → Scoring (0–100)
         → Quality Gate (reject garbage)
         → Similarity Dedup (per-dispensary)
         → Global Name Dedup (cross-dispensary)
         → Top-200 Selection (stratified by category)
         → Badge Assignment (STEAL/FIRE/SOLID)
```

### 2.2 Phase 1: Hard Filters (`passes_hard_filters`)

Products that fail any hard filter get `deal_score = 0` and are never shown.

#### Global Thresholds

| Filter | Value | Notes |
|--------|-------|-------|
| Minimum sale price | $3.00 | Below = data error |
| Maximum sale price | $100.00 | Above = data error (raised from $80 for oz flower) |
| Minimum discount | 15% | Tightened from 12%; edibles/prerolls use 12% |
| Maximum discount | 85% | Above = fake/data error |
| Require original price | Yes | Must have `original_price > sale_price` (Dutchie/Curaleaf only) |

#### Category Price Caps (NV Base)

| Category | Cap | Notes |
|----------|-----|-------|
| Flower 3.5g | $22 | Eighth — tightened from $25 |
| Flower 7g | $40 | Quarter — tightened from $45 |
| Flower 14g | $55 | Half oz — tightened from $65 |
| Flower 28g | $100 | Full oz — relaxed from $79 |
| Vape (generic) | $25 | Fallback for carts/pods without subtype |
| Edible | $15 | 100mg standard — tightened from $18 |
| Concentrate 0.5g | $18 | Tightened from $25 |
| Concentrate 1g | $25 | Tightened from $45 |
| Concentrate 2g | $50 | Tightened from $75 |
| Preroll | $9 | Regular flower prerolls |
| Infused preroll | $15 | Premium products |
| Preroll pack | $20 | Multi-packs — tightened from $25 |

#### Vape Subtype Price Floors (Minimum Believable Sale Price)

| Subtype | ≤0.6g | >0.6g |
|---------|-------|-------|
| Disposable | $8 | $17 |
| Cartridge | $7 | $14 |
| Pod | $7 | $14 |

#### Vape Subtype Price Caps (Maximum Sale Price)

| Subtype | ≤0.6g | >0.6g |
|---------|-------|-------|
| Disposable | $25 | $35 |
| Cartridge | $25 | $35 |
| Pod | $25 | $35 |

#### Original Price Ceilings (Reject Above)

| Category | Ceiling |
|----------|---------|
| Flower | $100 |
| Vape | $80 |
| Edible | $50 |
| Concentrate | $100 |
| Preroll | $30 |
| Preroll pack | $50 |

#### State-Specific Price Cap Overrides

10 regions have overrides that replace the NV base caps. Sharded region names
(e.g. `michigan-2`) are normalized to the base state name.

| State | Flower 3.5g | Vape | Edible | Conc 1g | Preroll | Notes |
|-------|-------------|------|--------|---------|---------|-------|
| **NV (base)** | $22 | $25 | $15 | $25 | $9 | Las Vegas / Southern NV |
| **Northern NV** | $20 | $23 | $12 | $23 | $9 | Reno/Sparks — slightly lower |
| **Michigan** | $15 | $22 | $12 | $35 | $7 | Ultra-competitive market |
| **Colorado** | $18 | $25 | $14 | $40 | $8 | Mature competitive market |
| **Missouri** | $25 | $30 | $16 | $48 | $10 | Maturing market |
| **Arizona** | $25 | $30 | $16 | $48 | $10 | Competitive but not MI-cheap |
| **Illinois** | $30 | $35 | $18 | $55 | $11 | High-tax market |
| **Ohio** | $30 | $35 | $18 | $55 | $11 | Newer rec market |
| **New Jersey** | $35 | $40 | $20 | $60 | $12 | High-tax, limited-license |
| **Massachusetts** | $32 | $38 | $18 | $58 | $12 | High-tax like NJ/IL |

#### Loose Qualification (Jane / Carrot / AIQ)

These platforms do NOT display original prices. Hard filters skip discount and
original-price checks. Qualification is price cap only with a **1.3× multiplier**
(e.g. $22 eighth cap → $28.60 effective cap).

#### Budget Bypasses

- **Budget edibles/prerolls** (≤$10): require only >0% discount (not 12/15%)
- **Budget disposables** (≤$25): skip discount AND original_price checks entirely; price cap is the sole gate

#### Non-Cannabis Keyword Filter

Products containing these keywords in name or raw_text are rejected: apparel,
clothing, shirt, t-shirt, hoodie, hat, cap, beanie, socks, merch, grinder,
lighter, tray, rolling paper, pipe, bong, gift card, vape battery, pen battery
(33 keywords total).

### 2.3 Phase 2: Scoring (`calculate_deal_score`)

Scored on a 0–100 scale. Components can sum above 100 but are **capped at 100**.

#### Component 1: Discount Depth (up to 35 pts)

| Discount % | Points |
|-----------|--------|
| ≥50% | 35 |
| ≥40% | 28 |
| ≥30% | 22 |
| ≥25% | 17 |
| ≥20% | 12 |
| ≥15% | 7 |

*Jane/Carrot/AIQ exception:* These platforms receive a flat 15 pts baseline
instead of discount depth + dollars saved (since they lack original prices).

#### Component 2: Dollars Saved (up to 10 pts)

`min(10, floor((original_price - sale_price) / 2.5))`

Only scored when `original_price > sale_price`.

#### Component 3: Brand Recognition (up to 20 pts)

| Tier | Points | Brands |
|------|--------|--------|
| Premium | 20 | STIIIZY, Cookies, Raw Garden, Kiva, Wyld, Connected, Alien Labs, Jungle Boys, Cannabiotix/CBX, Jeeter, Packwoods, Runtz (13 brands) |
| Popular | 12 | Rove, Select, Heavy Hitters, Trendi, CAMP, Old Pal, + ~150 more state-specific brands (see BRAND_TIERS in source) |
| Any brand | 5 | Any detected brand not in tiers above |
| No brand | 0 | Missing brand |

Brand matching uses lowercase exact match + prefix match with word-boundary validation.

#### Component 4: Unit Value (up to 15 pts)

**Flower** ($/g):

| $/g | Points |
|-----|--------|
| ≤$3/g | 15 |
| ≤$4.50/g | 12 |
| ≤$6/g | 8 |
| ≤$8/g | 4 |

**Edible** ($/100mg THC):

| $/100mg | Points |
|---------|--------|
| ≤$5 | 15 |
| ≤$8 | 10 |
| ≤$12 | 5 |

**Vape / Concentrate** ($/g):

| $/g | Points |
|-----|--------|
| ≤$15/g | 15 |
| ≤$22/g | 10 |
| ≤$30/g | 5 |

**Preroll** (by price):

| Price | Points |
|-------|--------|
| ≤$4 | 15 |
| ≤$6 | 12 |
| ≤$8 | 8 |
| ≤$9 | 4 |

#### Component 5: Category Boost (up to 8 pts)

| Category | Points |
|----------|--------|
| Flower | 8 |
| Vape | 8 |
| Edible | 8 |
| Concentrate | 7 |
| Preroll | 7 |
| Other | 3 |

#### Component 6: Price Attractiveness (up to 15 pts)

| Sale Price | Points |
|-----------|--------|
| $3–8 | 15 |
| $8–15 | 12 |
| $15–25 | 8 |
| $25–40 | 4 |

#### Component 7: Budget Deal Bonus (up to 5 pts)

Prerolls and edibles at ≤$11 get +5 pts to help accessible products surface.

#### Component 8: Disposable Boost (up to 12 pts)

Vape products with `product_subtype == "disposable"` get +12 pts. Compensates
for inventory underrepresentation (~25% of NV users are disposable-exclusive).

#### Theoretical Maximum: 120 pts (capped at 100)

| Component | Max |
|-----------|-----|
| Discount Depth | 35 |
| Dollars Saved | 10 |
| Brand Recognition | 20 |
| Unit Value | 15 |
| Category Boost | 8 |
| Price Attractiveness | 15 |
| Budget Deal Bonus | 5 |
| Disposable Boost | 12 |
| **Total** | **120** |
| **Capped at** | **100** |

### 2.4 Phase 3: Quality Gate (`passes_quality_gate`)

Applied AFTER scoring. Rejects deals with incomplete/garbage data.

| Check | Criteria | Exemption |
|-------|----------|-----------|
| Brand required | Must have detected brand | None |
| Minimum name length | ≥5 characters | None |
| No strain-only names | Rejects "indica", "sativa", "hybrid", etc. | None |
| Name ≠ brand | Product name must differ from brand | None |
| No repeated-word names | Rejects "Badder Badder" | None |
| No promo text | Rejects "3 for $50", "BOGO", "bundle", etc. | None |
| Weight required | flower/concentrate/vape must have weight | Disposable vapes exempt |
| Edible THC minimum | weight_value ≥ 50mg | None |

**Relaxed quality gate** (`passes_relaxed_quality_gate`): Used only for
dispensary minimum-floor backfill. Allows missing brand and missing weight.

### 2.5 Phase 4: Badge Thresholds

| Badge | Score Range | Display |
|-------|-------------|---------|
| **STEAL** | ≥85 | Best deals |
| **FIRE** | 70–84 | Great deals |
| **SOLID** | 50–69 | Good deals |
| *(none)* | <50 | Still shown if selected |

### 2.6 Phase 5: Top-200 Selection (`select_top_deals`)

#### Category Targets

| Category | Target Slots |
|----------|-------------|
| Flower | 58 |
| Disposable (vape) | 30 |
| Edible | 29 |
| Concentrate | 29 |
| Preroll | 24 |
| Vape (cart/pod) | 21 |
| Other | 9 |
| **Total** | **200** |

#### Category Minimums (Floors)

| Category | Minimum |
|----------|---------|
| Flower | 12 |
| Disposable | 15 |
| Edible | 8 |
| Vape (cart/pod) | 6 |
| Concentrate | 6 |
| Preroll | 6 |
| Other | 0 |

#### Diversity Constraints

| Constraint | Value |
|-----------|-------|
| Max same brand (total feed) | 5 |
| Max same dispensary (total feed) | 12 |
| Max same brand per category | 3 |
| Max same brand per dispensary (dedup) | 2 |
| Max consecutive same category | 3 |
| Max consecutive same brand | 1 |
| Max unknown brand deals | 0 |
| Max disposables per chain | 4 |
| Min deals per dispensary | 2 |

#### Backfill (Round 2)

Triggered when round 1 fills <85% of target. Uses relaxed caps:

| Constraint | Backfill Value |
|-----------|---------------|
| Brand total | 10 |
| Brand per category | 6 |
| Dispensary total | 18 |
| Unknown brand total | 0 |

#### Guaranteed Exposure

Every dispensary with ≥1 product that yields 0 normal deals gets its best
product force-picked with `deal_score` capped at 25.

---

## 3. Supabase Database Schema

**43 migrations** (001–043). PostgreSQL hosted on Supabase.

### 3.1 Core Tables

#### `dispensaries`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | TEXT | PK | Slug, e.g. "td-gibson" |
| name | TEXT | NOT NULL | |
| url | TEXT | NOT NULL | |
| platform | TEXT | NOT NULL | dutchie / curaleaf / jane / carrot / aiq / rise |
| address | TEXT | | |
| city | TEXT | DEFAULT 'Las Vegas' | |
| state | TEXT | DEFAULT 'NV' | |
| region | TEXT | NOT NULL DEFAULT 'southern-nv' | Added 013; CHECK constraint expanded in 035 |
| latitude | NUMERIC(10,7) | | Added 015 |
| longitude | NUMERIC(10,7) | | Added 015 |
| is_active | BOOLEAN | NOT NULL DEFAULT TRUE | |
| config | JSONB | DEFAULT '{}' | Per-site scraper overrides |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Auto-updated via trigger |

**RLS:** Public read. Service-role write.
**Indexes:** `idx_dispensaries_platform` (platform WHERE is_active), `idx_dispensaries_region` (region WHERE is_active)
**Written by:** Scraper (main.py upsert), manual config
**Trigger:** `trg_dispensaries_updated_at` — auto-updates `updated_at`

#### `products`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK (gen_random_uuid) | |
| dispensary_id | TEXT | FK → dispensaries(id) CASCADE | |
| name | TEXT | NOT NULL | |
| brand | TEXT | | Detected by clouded_logic.py |
| category | TEXT | CHECK: flower/preroll/vape/edible/concentrate/other/NULL | |
| original_price | NUMERIC(10,2) | CHECK > 0 when present | |
| sale_price | NUMERIC(10,2) | CHECK > 0 when present | |
| discount_percent | NUMERIC(5,1) | CHECK 0–100 | |
| weight_value | NUMERIC(10,2) | | In grams (flower/vape/conc) or mg (edibles) |
| weight_unit | TEXT | | g / mg / oz |
| thc_percent | NUMERIC(5,2) | | |
| cbd_percent | NUMERIC(5,2) | | |
| raw_text | TEXT | | Original scraped text |
| is_active | BOOLEAN | NOT NULL DEFAULT TRUE | Added 011 |
| deal_score | INTEGER | CHECK 0–100 | Added 011 |
| product_url | TEXT | | Added 011 |
| is_infused | BOOLEAN | NOT NULL DEFAULT FALSE | Added 018 |
| product_subtype | TEXT | | Added 018; e.g. infused_preroll, preroll_pack, disposable |
| strain_type | TEXT | | Added 023; Indica/Sativa/Hybrid |
| scraped_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**Unique constraint:** `(dispensary_id, name, weight_value, sale_price)` — fixed in 012 (was scraped_at)
**RLS:** Public read. Service-role write.
**Indexes:** dispensary_id, scraped_at DESC, category, brand, discount_percent DESC, name trigram (GIN), brand trigram (GIN), subtype, infused
**Written by:** Scraper (main.py upsert after each dispensary)

#### `deals`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| product_id | UUID | FK → products(id) CASCADE | |
| dispensary_id | TEXT | FK → dispensaries(id) CASCADE | |
| deal_score | NUMERIC(5,1) | NOT NULL DEFAULT 0 | |
| is_posted | BOOLEAN | NOT NULL DEFAULT FALSE | Tweet status |
| posted_at | TIMESTAMPTZ | | |
| tweet_id | TEXT | | Twitter/X status ID |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**RLS:** Public read. Service-role write.
**Indexes:** unposted (score DESC where not posted), dispensary, product, score DESC
**Written by:** Scraper (main.py after deal selection)

#### `scrape_runs`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| started_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| completed_at | TIMESTAMPTZ | | |
| status | TEXT | NOT NULL DEFAULT 'running' | running / completed / failed / completed_with_errors |
| total_products | INTEGER | DEFAULT 0 | |
| qualifying_deals | INTEGER | DEFAULT 0 | |
| sites_scraped | JSONB | DEFAULT '[]' | Array of dispensary slugs |
| sites_failed | JSONB | DEFAULT '[]' | Array of {slug, error} |
| runtime_seconds | NUMERIC | | Added 011 |
| region | TEXT | NOT NULL DEFAULT 'southern-nv' | Added 025 |
| platform_group | TEXT | NOT NULL DEFAULT 'all' | Added 028 |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**RLS:** Public read. Service-role write.
**Indexes:** started_at DESC, status, region+started_at, platform_group+started_at
**Written by:** Scraper (main.py — created at start, updated at completion)

### 3.2 User Tables

#### `user_sessions`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| user_id | TEXT | NOT NULL UNIQUE | Anonymous localStorage UUID |
| zip_code | TEXT | | |
| first_seen | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| last_seen | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| acquisition_source | TEXT | | Added 037; UTM source |
| acquisition_medium | TEXT | | Added 037 |
| acquisition_campaign | TEXT | | Added 037 |

**RLS:** Enabled. Anon insert, service read, authenticated read.
**Written by:** Frontend (on first visit)

#### `user_events`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| user_id | TEXT | NOT NULL | |
| event_type | TEXT | NOT NULL | |
| deal_id | UUID | FK → products(id) SET NULL | Added FK in 031 |
| metadata | JSONB | | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**RLS:** Enabled. Rate-limited anon insert (500/day per user_id).
**Retention:** Deleted after 180 days (function `run_data_retention`).
**Written by:** Frontend

#### `user_saved_deals`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| user_id | TEXT | NOT NULL | |
| deal_id | UUID | NOT NULL, FK → products(id) CASCADE | FK added 031 |
| saved_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**Unique:** `(user_id, deal_id)`
**RLS:** Rate-limited anon insert (100/day), service read.
**Written by:** Frontend (user save action)

#### `user_dismissed_deals`

Same structure as user_saved_deals. Rate limit: 500/day per user_id.
**Written by:** Frontend (user dismiss/swipe action)

#### `user_challenges`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| anonymous_id | TEXT | NOT NULL | |
| challenge_id | TEXT | NOT NULL | |
| progress | INTEGER | DEFAULT 0 | |
| is_completed | BOOLEAN | DEFAULT FALSE | |
| completed_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Unique:** `(anonymous_id, challenge_id)`
**RLS:** Anon insert/update/read, service read.
**Written by:** Frontend (gamification system)

#### `user_contacts`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| anon_id | TEXT | | |
| phone | VARCHAR(20) | | At least one of phone/email required |
| email | VARCHAR(255) | | |
| source | VARCHAR(50) | NOT NULL | 'saved_deals_banner', 'out_of_market', 'share_link' |
| saved_deals_count | INT | | |
| zip_entered | VARCHAR(10) | | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**RLS:** Anon insert, service read.
**Written by:** Frontend (contact capture forms)

### 3.3 Analytics Tables

#### `analytics_events`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| user_id | UUID | FK → auth.users(id) | Optional — populated after account creation |
| anon_id | TEXT | | Client-generated UUID |
| event_name | TEXT | NOT NULL | |
| properties | JSONB | DEFAULT '{}' | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

**RLS:** Rate-limited anon insert (500/day per anon_id), service+authenticated read.
**Indexes:** anon_id, user_id, event_name, created_at, anon+created composite, event+created+anon composite
**Retention:** Deleted after 180 days.
**Written by:** Frontend (all user interactions)

#### `daily_metrics`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| run_date | DATE | NOT NULL DEFAULT CURRENT_DATE | |
| scrape_run_id | UUID | | |
| region | TEXT | | Added 035 |
| total_products | INT | DEFAULT 0 | |
| qualifying_deals | INT | DEFAULT 0 | |
| flower_count | INT | DEFAULT 0 | |
| vape_count | INT | DEFAULT 0 | |
| edible_count | INT | DEFAULT 0 | |
| concentrate_count | INT | DEFAULT 0 | |
| preroll_count | INT | DEFAULT 0 | |
| unique_brands | INT | DEFAULT 0 | |
| unique_dispensaries | INT | DEFAULT 0 | |
| brand_null_count | INT | DEFAULT 0 | Added 036 |
| brand_detection_rate | NUMERIC(5,1) | DEFAULT 0 | Added 036 |
| price_cap_reject_count | INT | DEFAULT 0 | Added 036 |
| price_cap_reject_rate | NUMERIC(5,1) | DEFAULT 0 | Added 036 |

**Unique:** `(run_date, region)` — re-keyed in 035
**Written by:** Scraper (metrics_collector.py post-scrape)

#### `enrichment_snapshots`

Added in migration 036. Stores weekly price distributions and cross-state
brand pricing for state-aware scoring and B2B insights.

**Written by:** Scraper (enrichment_snapshots.py)

### 3.4 History Tables

#### `price_history`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| product_id | UUID | FK → products(id) CASCADE | |
| dispensary_id | TEXT | FK → dispensaries(id) CASCADE | |
| sale_price | NUMERIC(10,2) | | |
| original_price | NUMERIC(10,2) | | |
| discount_percent | NUMERIC(5,1) | | |
| observed_date | DATE | | |

**Unique:** `(product_id, observed_date)` — upsert on conflict
**Written by:** Scraper (main.py post-scrape)

#### `deal_history`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| product_id | UUID | FK → products(id) CASCADE | |
| dispensary_id | TEXT | FK → dispensaries(id) CASCADE | |
| deal_score | INTEGER | NOT NULL DEFAULT 0 | |
| sale_price | NUMERIC(10,2) | | |
| original_price | NUMERIC(10,2) | | |
| discount_percent | NUMERIC(5,1) | | |
| name | TEXT | | Denormalized |
| brand | TEXT | | Denormalized |
| category | TEXT | | Denormalized |
| times_seen | INTEGER | DEFAULT 1 | Incremented via RPC |
| first_seen | TIMESTAMPTZ | | |
| last_seen | TIMESTAMPTZ | | |

**Unique:** `(product_id, dispensary_id)`
**Written by:** Scraper via RPC `upsert_deal_observations` (migration 027)

### 3.5 Other Tables

#### `waitlist`

Email + zip code capture for non-Vegas visitors.
**RLS:** Anon insert, service read.
**Written by:** Frontend (waitlist signup form)

#### `sms_waitlist`

Phone number capture for SMS deal alert interest.
**Unique:** phone number
**RLS:** Anon insert, service read.
**Written by:** Frontend (SMS signup CTA)

#### `zip_interest_log`

Out-of-area demand tracking: zip code, state, cannabis legality status.
**RLS:** Anon insert, service read.
**Written by:** Frontend (RegionOverlay component)

#### `shared_saves`

Shareable snapshots of saved deals (short URLs). Expire at midnight PT.
**RLS:** Public read, anon insert/update.
**Written by:** Frontend (share feature)

#### `deal_reports`

User-reported issues: wrong price, expired deal, wrong product.
**Unique daily:** `(deal_id, anon_id, report_type, report_date)` — spam prevention
**RLS:** Anon insert, service read/update.
**Written by:** Frontend (report modal)

#### `migration_log`

Tracks which migrations have been applied.
**Written by:** Migration runner

### 3.6 Views

#### `deal_save_counts` (Materialized View)

```sql
SELECT deal_id, COUNT(DISTINCT user_id) AS save_count
FROM user_saved_deals GROUP BY deal_id;
```

Replaced regular VIEW in migration 034. Requires `REFRESH MATERIALIZED VIEW CONCURRENTLY`.
**Grants:** SELECT to anon, authenticated, service_role.

### 3.7 Database Functions (RPCs)

| Function | Migration | Purpose | Called By |
|----------|-----------|---------|-----------|
| `update_updated_at()` | 001 | Trigger: auto-update dispensaries.updated_at | Trigger |
| `run_data_retention()` | 033 | Delete old user_events (180d), analytics_events (180d), shared_saves (expired), scrape_runs (90d) | Manual / pg_cron |
| `upsert_deal_observations(JSONB)` | 027 | Atomic deal_history upsert with times_seen increment | Scraper |
| `get_region_unique_products(INT)` | 037 | Per-region product/deal counts in time window | Admin dashboard |
| `get_region_coverage(INT)` | 037 | Per-region dispensary coverage stats | Admin dashboard |
| `get_kpi_summary()` | 038 | DAU, WAU, MAU, save rate, total users | Admin dashboard |
| `get_retention_kpis(INT)` | 039 | 7d/30d retention %, weekly cohort breakdown | Admin dashboard |
| `get_dashboard_growth(INT)` | 041/042/043 | Single-scan growth metrics | Admin dashboard |
| `get_dashboard_engagement(INT)` | 041/042/043 | Save rate, activation, events/session | Admin dashboard |
| `get_dashboard_retention(INT)` | 041/042/043 | Retention rates and cohort data | Admin dashboard |
| `get_dashboard_pipeline(INT)` | 041/042/043 | Scraper success rates, deal counts | Admin dashboard |

All dashboard functions use `SET statement_timeout = '30s'` and `SECURITY DEFINER`.

### 3.8 Extensions

- `pgcrypto` — `gen_random_uuid()` (migration 001)
- `pg_trgm` — Trigram indexes for fuzzy search (migration 032)

### 3.9 Data Integrity Constraints (Migration 030)

| Table | Constraint | Rule |
|-------|-----------|------|
| products | chk_products_category | flower/preroll/vape/edible/concentrate/other/NULL |
| products | chk_products_deal_score | 0–100 |
| products | chk_products_sale_price | > 0 when present |
| products | chk_products_original_price | > 0 when present |
| products | chk_products_discount | 0–100 |
| dispensaries | chk_dispensaries_region | Enumerated list of all 12 regions (expanded in 035) |

### 3.10 Foreign Keys (Migration 031)

| Source | Target | On Delete |
|--------|--------|-----------|
| deal_reports.deal_id | products(id) | CASCADE |
| user_saved_deals.deal_id | products(id) | CASCADE |
| user_dismissed_deals.deal_id | products(id) | CASCADE |
| user_events.deal_id | products(id) | SET NULL |

### 3.11 Rate Limit Policies (Migration 035)

| Table | Limit | Scope |
|-------|-------|-------|
| analytics_events | 500/day | per anon_id |
| user_events | 500/day | per user_id |
| user_saved_deals | 100/day | per user_id |
| user_dismissed_deals | 500/day | per user_id |
| deal_reports | 20/day | per anon_id |

---

## 4. Environment Variables

### 4.1 Scraper (.env)

| Variable | Required | Purpose |
|----------|----------|---------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Service-role key (bypasses RLS) |

### 4.2 Scraper Runtime (set by workflow or CLI)

| Variable | Default | Purpose |
|----------|---------|---------|
| `DRY_RUN` | false | Scrape only, skip DB writes |
| `LIMIT_DISPENSARIES` | false | Test with 1 site per platform |
| `PLATFORM_GROUP` | all | Filter: stable / new / all |
| `REGION` | *(all)* | Filter by region: southern-nv, michigan-1, etc. |
| `SINGLE_SITE` | *(none)* | Scrape one dispensary by slug |
| `FORCE_RUN` | false | Ignore idempotency check (skip recent-run detection) |
| `SCRAPE_CONCURRENCY` | 6 | Total browser contexts |

### 4.3 Frontend (.env.local)

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public Supabase URL (exposed to browser) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key (RLS-enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only service key (bypasses RLS) |
| `TWITTER_API_KEY` | Yes | Twitter/X OAuth 1.0a consumer key |
| `TWITTER_API_SECRET` | Yes | Twitter/X OAuth 1.0a consumer secret |
| `TWITTER_ACCESS_TOKEN` | Yes | Twitter/X user access token |
| `TWITTER_ACCESS_SECRET` | Yes | Twitter/X user access secret |
| `ADMIN_API_KEY` | Yes | API key for protected /api/admin endpoints |
| `ADMIN_PIN` | Yes | PIN for admin dashboard access |

### 4.4 GitHub Actions Secrets

| Secret | Used By | Purpose |
|--------|---------|---------|
| `SUPABASE_URL` | scrape.yml, ci.yml | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | scrape.yml | Service-role key for writes |
| `ADMIN_API_KEY` | tweet-deals.yml | Auth for /api/auto-post |
| `TWITTER_API_KEY` | tweet-deals.yml | Twitter OAuth (via frontend API) |
| `TWITTER_API_SECRET` | tweet-deals.yml | Twitter OAuth |
| `TWITTER_ACCESS_TOKEN` | tweet-deals.yml | Twitter OAuth |
| `TWITTER_ACCESS_SECRET` | tweet-deals.yml | Twitter OAuth |

### 4.5 Build-Time Variables

| Variable | Used By | Purpose |
|----------|---------|---------|
| `NODE_VERSION=22` | netlify.toml | Node.js version for Netlify builds |

---

## 5. Deployment Configuration

### 5.1 Netlify (Frontend)

**Source:** `clouded-deals/frontend/netlify.toml`

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Publish directory | `.next` |
| Node version | 22 |
| Ignore builds | `exit 1` (always build) |
| Function timeout | 26s (extended from 10s for Twitter API + Supabase) |
| Function bundler | esbuild |
| Plugin | `@netlify/plugin-nextjs` |

#### Security Headers (all routes)

| Header | Value |
|--------|-------|
| X-Frame-Options | DENY |
| X-Content-Type-Options | nosniff |
| X-XSS-Protection | 1; mode=block |
| Referrer-Policy | strict-origin-when-cross-origin |
| Permissions-Policy | camera=(), microphone=(), geolocation=(self) |
| Strict-Transport-Security | max-age=31536000; includeSubDomains |
| Content-Security-Policy | default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://www.google-analytics.com; frame-ancestors 'none' |

### 5.2 Edge Middleware Rate Limits

**Source:** `clouded-deals/frontend/src/middleware.ts`

| Endpoint | Window | Max Requests |
|----------|--------|-------------|
| `/api/search` | 60s | 20 |
| `/api/health` | 60s | 30 |
| `/api/admin` | 60s | 20 |
| `/api/deals` | 60s | 10 |

Implementation: In-memory sliding-window counter (Map). Resets on redeploy.
Cleanup: stale entries purged every 5 minutes (entries >120s old).

### 5.3 GitHub Actions Workflows

#### `scrape.yml` — Daily Scraper (33 Cron Jobs)

| Region | Shards | Schedule (UTC) | Local Time |
|--------|--------|---------------|------------|
| New York | 2 | 12:00, 12:02 | 8:00–8:02 AM EDT |
| New Jersey | 4 | 13:00, 13:02, 13:04, 13:06 | 9:00–9:06 AM EDT |
| Ohio | 4 | 14:00, 14:02, 14:04, 14:06 | 10:00–10:06 AM EDT |
| **Southern NV** ★ | 1 | 15:30 | 8:30 AM PDT |
| **Northern NV** | 1 | 15:32 | 8:32 AM PDT |
| Michigan | 6 | 16:00–16:10 (2m offset) | 12:00–12:10 PM EDT |
| Illinois | 3 | 17:00, 17:02, 17:04 | 12:00–12:04 PM CDT |
| Arizona | 2 | 19:00, 19:02 | 12:00–12:02 PM MST |
| Colorado | 3 | 19:04, 19:06, 19:08 | 1:04–1:08 PM MDT |
| Missouri | 4 | 20:00, 20:02, 20:04, 20:06 | 3:00–3:06 PM CDT |
| Pennsylvania | 1 | 21:00 | 5:00 PM EDT |
| Massachusetts | 2 | 22:00, 22:02 | 6:00–6:02 PM EDT |

**Timeout:** 120 minutes per job
**Trigger:** Daily cron + manual (`workflow_dispatch`)
**All times DST-adjusted as of March 8, 2026**

#### `ci.yml` — Scraper Tests

| Setting | Value |
|---------|-------|
| Trigger | PRs touching `scraper/**`, pushes to main |
| Python | 3.11 |
| Command | `python -m pytest tests/ -v --tb=short -m "not live" --ignore=tests/test_platform_recon.py` |
| Timeout | 10 minutes |

#### `ci-frontend.yml` — Frontend Tests

| Setting | Value |
|---------|-------|
| Trigger | PRs touching `frontend/**`, pushes to main |
| Node | 22 |
| Commands | lint + build + vitest |
| Timeout | 5 minutes |

#### `tweet-deals.yml` — Auto-Post to Twitter

| Setting | Value |
|---------|-------|
| Schedule | 4× daily (8 cron slots) |
| Method | Calls `/api/auto-post` on the deployed frontend |
| Timeout | 5 minutes |

#### Manual Workflows

| Workflow | Purpose | Timeout |
|----------|---------|---------|
| `recon.yml` | Platform detection recon across sites | 30 min |
| `site-diagnostics.yml` | Deep site health analysis | 90 min |
| `debug.yml` | Database diagnostic dump | 5 min |
| `diagnose-disposables.yml` | Vape classification diagnostic | 5 min |

### 5.4 Frontend Stack

| Dependency | Version |
|-----------|---------|
| Next.js | 14.2.35 (App Router) |
| React | 18 |
| TypeScript | 5 |
| Tailwind CSS | 3.4.1 |
| @supabase/supabase-js | ^2.94.0 |
| @supabase/ssr | ^0.8.0 |
| lucide-react | Icons |
| react-spring | Animations |
| @use-gesture/react | Gestures |

### 5.5 Beta Lock Status (Since Feb 22, 2026)

- No new sites, no new scrapers
- Surgical fixes only
- Anti-bot and reliability improvements permitted
- Data collection continues across all 11 states

---

*End of system snapshot. This document is read-only and should not be modified
directly — regenerate from source if an update is needed.*
