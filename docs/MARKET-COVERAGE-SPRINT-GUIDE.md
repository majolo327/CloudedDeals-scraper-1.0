# CloudedDeals Market Coverage Sprint Guide

*Generated: Feb 17, 2026 | For next-session paste + CEO sprint planning*

---

## NEW SESSION CONTEXT (Paste This)

You are working on CloudedDeals-scraper-1.0, a cannabis dispensary deal scraper that runs daily via GitHub Actions across 11 US states. The scraper uses Playwright headless Chrome to visit dispensary websites, extract menus/pricing, detect deals, and push the top 200 to Supabase. The frontend is Next.js 14.

**Architecture:** Python Playwright scraper -> Supabase PostgreSQL -> Next.js 14 frontend

**Key files:**
- `clouded-deals/scraper/config/dispensaries.py` — 2,537 lines, all 1,192 sites across 11 states
- `clouded-deals/scraper/main.py` — 91KB orchestrator
- `clouded-deals/scraper/platforms/` — dutchie.py (920 lines), jane.py (376), curaleaf.py (539), aiq.py (714), carrot.py (587), rise.py (388, DISABLED)
- `clouded-deals/scraper/deal_detector.py` — 53KB scoring engine
- `clouded-deals/scraper/clouded_logic.py` — 72KB business logic, 200+ brand aliases
- `.github/workflows/scrape.yml` — 24 cron jobs, all 11 states run daily

**6 platforms supported:** Dutchie (853 sites, 71%), Jane (182, 15%), Curaleaf (113, 10%), Carrot (5), AIQ (2), Rise (37 — ALL DISABLED, Cloudflare blocked)

**Production state:** Southern Nevada (consumer-facing). All other 10 states are data-collection only.

**Current task:** Research and gather URLs for Dutchie and Jane sites we're NOT yet scraping, to increase TAM coverage in our weakest states. NO CODE CHANGES — research only, document URLs and site metadata for future sprints.

**Existing research docs:**
- `docs/research-michigan-illinois.md` — MI+IL market research (Phase 1)
- `docs/research-batch2-markets.md` — AZ, MO, NJ market research (Phase 2)
- `docs/research-cross-market-synthesis.md` — Cross-market ML/data synthesis

---

## CEO-READY: 11-STATE COVERAGE SCORECARD

### Master Table — Current Coverage vs Total Addressable Market (TAM)

| State | TAM (Licensed Disp.) | Sites Configured | Active Sites | Dutchie | Jane | Curaleaf | TAM Coverage | Dutchie+Jane Gap | Sprint Priority |
|---|---|---|---|---|---|---|---|---|---|
| **S. Nevada** (PROD) | ~103 | 66 | 53 | 21 | 20 | 9 | **51%** | Low | Maintain |
| **Michigan** | ~1,000+ | 200 | 196 | 195 | 0 | 1 | **~20%** | **MASSIVE Jane gap (150-200 addressable)** | HIGH |
| **Illinois** | ~230 | 178 | 165 | 98 | 54 | 16 | **72%** | Moderate (20-30 more Jane possible) | MEDIUM |
| **Colorado** | ~800+ | 133 | 133 | 100 | 33 | 0 | **~17%** | **MASSIVE (500+ Dutchie/Jane unscraped)** | HIGH |
| **Massachusetts** | ~416 | 113 | 111 | 93 | 12 | 6 | **27%** | **Large Jane gap (50-80 addressable)** | HIGH |
| **New Jersey** | ~150 | 106 | 102 | 78 | 18 | 7 | **68%** | Moderate (10-20 more possible) | MEDIUM |
| **Arizona** | ~180 | 99 | 99 | 74 | 3 | 22 | **55%** | **Large Jane gap (25-30 addressable)** | MEDIUM |
| **Missouri** | ~210 | 89 | 89 | 89 | 0 | 0 | **42%** | **Large (40+ Jane, 40+ Dutchie unscraped)** | HIGH |
| **Ohio** | ~190 | 83 | 78 | 46 | 23 | 9 | **41%** | Moderate (20-30 more Dutchie/Jane) | MEDIUM |
| **New York** | ~588 | 76 | 74 | 49 | 19 | 6 | **13%** | **MASSIVE (300+ new sites possible)** | LOW (market immature) |
| **Pennsylvania** | ~191 | 49 | 43 | 10 | 0 | 33 | **23%** | **MASSIVE (60+ Dutchie, 30+ Jane)** | MEDIUM |
| **TOTALS** | **~4,158+** | **1,192** | **1,143** | **853** | **182** | **113** | **~27%** | | |

### TAM Coverage Ranking (Worst to Best)

| Rank | State | TAM Coverage | Why It's Low | Sprint ROI |
|---|---|---|---|---|
| 1 | **New York** | ~13% (74/588) | Market exploded in 2025 (261->588 dispensaries), our config is stale | LOW — many sites use custom/unknown platforms |
| 2 | **Colorado** | ~17% (133/800+) | Extremely fragmented market, hundreds of independents | HIGH — strong Dutchie/Jane adoption |
| 3 | **Michigan** | ~20% (196/1000+) | Massive market, zero Jane sites configured | HIGH — 150-200 Jane sites addressable |
| 4 | **Pennsylvania** | ~23% (43/191) | Medical-only, Curaleaf-heavy, zero Jane sites | MEDIUM — may go rec in 2026 |
| 5 | **Massachusetts** | ~27% (111/416) | Under-explored, only 12 Jane sites | HIGH — mature market, good platform overlap |
| 6 | **Ohio** | ~41% (78/190) | Newer rec market, platform adoption still shifting | MEDIUM — growing fast |
| 7 | **Missouri** | ~42% (89/210) | Zero Jane sites, only Dutchie configured | HIGH — fast-growing, Dutchie+Jane dominant |
| 8 | **S. Nevada** | ~51% (53/103) | 9 Rise sites blocked, some inactive | Maintain — production state |
| 9 | **Arizona** | ~55% (99/180) | Only 3 Jane sites despite ~30 addressable | MEDIUM — easy Jane additions |
| 10 | **New Jersey** | ~68% (102/150) | Good coverage, some Jane gaps | LOW — near ceiling |
| 11 | **Illinois** | ~72% (165/230) | Best non-NV coverage, Rise gap (10 sites) | LOW — near ceiling |

---

## RECOMMENDED: 3 STATES FOR NEXT RESEARCH SPRINT

Based on the intersection of **lowest TAM coverage** + **highest Dutchie/Jane gap** + **market maturity** + **research ROI**:

### 1. COLORADO (Priority: HIGH)

**Why:** ~17% TAM coverage with 800+ licensed dispensaries. Strong Dutchie/Jane adoption statewide. Mature market ($1.13B annual sales). Currently have 133 sites (100 Dutchie, 33 Jane) but hundreds more are addressable.

**Research tasks:**
- Pull Colorado MED licensed facilities list from https://med.colorado.gov/licensee-information-and-lookup-tool/licensed-facilities
- Audit top 50 uncovered Denver/Boulder/Fort Collins dispensaries for platform (Dutchie/Jane/other)
- Identify all Dutchie-powered sites not in our config (estimated 150-200+)
- Identify all Jane/iheartjane sites not in our config (estimated 50-80+)
- Document URLs, embed types, and chain affiliations for each
- Map regional density: Denver Metro (250+), Boulder (40+), Colorado Springs (opt-out but surrounding areas active), Fort Collins (20+), Pueblo (15+)

**Expected yield:** 200-300 new Dutchie/Jane URLs -> coverage from 17% to 40-50%

**Current config gaps:**
- 100 Dutchie sites configured — but CO has ~300-400 Dutchie dispensaries
- 33 Jane sites configured — but CO has ~80-120 Jane dispensaries
- 0 Curaleaf/Rise sites — Rise blocked anyway; Curaleaf has minimal CO presence
- Major chains NOT covered: Native Roots (25+ locations), The Green Solution (15+), Lightshade (8+), Terrapin Care Station (5+), LivWell (multiple)

---

### 2. MICHIGAN (Priority: HIGH)

**Why:** ~20% TAM coverage with 1,000+ licensed dispensaries. Zero Jane sites configured despite 150-200 addressable Jane dispensaries. Largest single-platform gap in the entire operation.

**Research tasks:**
- Audit Michigan Jane/iheartjane dispensaries (estimated 150-200 sites)
- Focus on Detroit Metro (250+ dispensaries total, many on Jane)
- Cross-reference with existing 195 Dutchie sites to avoid duplicates
- Identify Dutchie sites we're missing (estimated 150-200 more beyond our 195)
- Document URLs, embed types for all new finds
- Map regional density: Detroit Metro, Ann Arbor, Grand Rapids, Kalamazoo, Traverse City, Lansing

**Expected yield:** 150-200 new Jane URLs + 100-150 new Dutchie URLs -> coverage from 20% to 40-50%

**Current config gaps:**
- 195 Dutchie sites — but MI has 350-400 Dutchie dispensaries total
- **0 Jane sites** — MI has 150-200 Jane dispensaries (BIGGEST GAP)
- Key Jane chains to research: Nirvana Center MI, various Detroit independents, Ann Arbor shops
- Key missing Dutchie chains: Puff Cannabis (13 locations, mixed Dutchie/Weedmaps), House of Dank (8+), additional independents

---

### 3. MASSACHUSETTS (Priority: HIGH)

**Why:** ~27% TAM coverage with 416 licensed dispensaries. Only 12 Jane sites configured despite strong Jane adoption. Mature market ($1.65B annual sales in 2025). Good platform overlap with existing scrapers.

**Research tasks:**
- Pull MA Cannabis Control Commission retailer list
- Audit top 50 uncovered dispensaries for platform identification
- Identify all Jane/iheartjane sites not in our config (estimated 50-80)
- Identify additional Dutchie sites not in config (estimated 100-150)
- Document URLs, embed types, chain affiliations
- Map regional density: Boston Metro (100+), Western MA (40+), Cape Cod/Islands (15+), Central MA (30+), South Shore (20+)

**Expected yield:** 100-200 new Dutchie/Jane URLs -> coverage from 27% to 50-60%

**Current config gaps:**
- 93 Dutchie sites — but MA has ~200-250 Dutchie dispensaries
- 12 Jane sites — but MA has ~50-80 Jane dispensaries
- 6 Curaleaf sites — adequate
- Major chains NOT covered: NETA (5+ locations), Theory Wellness (5+), Berkshire Roots, The Botanist MA, CommCan, Happy Valley

---

## STATES NOT RECOMMENDED FOR THIS SPRINT (and why)

| State | Why Defer |
|---|---|
| **New York** | Market exploded (588 dispensaries) but many use custom/unknown platforms. Platform audit needed before URL gathering. Illicit market still dominant. Low scrapeability. |
| **Pennsylvania** | Medical-only. May go recreational in 2026 — revisit then. Currently 33/43 active sites are Curaleaf which already works. |
| **Ohio** | Newer rec market (Aug 2024). 190 dispensaries with active legislative changes (SB 56). Platform adoption still shifting. Revisit in 6 months. |
| **Arizona** | 55% covered, only 3 Jane sites — easy win but smaller absolute gap (~25-30 new Jane URLs). Can be a quick side task, not a full sprint. |
| **New Jersey** | 68% covered. Near ceiling for supported platforms. Remaining gap is mostly custom/proprietary sites. |
| **Illinois** | 72% covered. Best non-NV coverage. Main gap is Rise (blocked) and Sunnyside (needs new scraper). No new URLs to add without new platform support. |
| **Missouri** | 42% covered with zero Jane sites. Strong candidate but smaller total market (210 dispensaries) vs CO/MI/MA. Could be Sprint 2. |

---

## DUTCHIE + JANE GAP DETAIL BY STATE

### Where We Have the Most Dutchie Sites Left to Scrape

| State | Dutchie Configured | Dutchie Estimated TAM | Gap | Priority |
|---|---|---|---|---|
| **Colorado** | 100 | ~300-400 | **200-300** | SPRINT 1 |
| **Michigan** | 195 | ~350-400 | **155-205** | SPRINT 1 |
| **Massachusetts** | 93 | ~200-250 | **107-157** | SPRINT 1 |
| **New York** | 49 | ~150-200 | **101-151** | Defer (platform uncertainty) |
| **Missouri** | 89 | ~130 | **41** | Sprint 2 |
| **Pennsylvania** | 10 | ~40-60 | **30-50** | Defer (medical-only) |
| **Ohio** | 46 | ~70-90 | **24-44** | Sprint 2 |
| **Arizona** | 74 | ~120 | **46** | Quick win |
| **New Jersey** | 78 | ~85-90 | **7-12** | Near ceiling |
| **Illinois** | 98 | ~100-110 | **2-12** | Near ceiling |
| **S. Nevada** | 21 | ~25-30 | **4-9** | Maintain |

### Where We Have the Most Jane Sites Left to Scrape

| State | Jane Configured | Jane Estimated TAM | Gap | Priority |
|---|---|---|---|---|
| **Michigan** | **0** | ~150-200 | **150-200** | SPRINT 1 (CRITICAL) |
| **Massachusetts** | 12 | ~60-80 | **48-68** | SPRINT 1 |
| **Colorado** | 33 | ~80-120 | **47-87** | SPRINT 1 |
| **Pennsylvania** | **0** | ~30-40 | **30-40** | Defer (medical-only) |
| **Arizona** | 3 | ~30 | **27** | Quick win |
| **Missouri** | **0** | ~40 | **40** | Sprint 2 |
| **Ohio** | 23 | ~40-50 | **17-27** | Sprint 2 |
| **New York** | 19 | ~50-80 | **31-61** | Defer (platform uncertainty) |
| **New Jersey** | 18 | ~25-30 | **7-12** | Near ceiling |
| **Illinois** | 54 | ~55-65 | **1-11** | Near ceiling |
| **S. Nevada** | 20 | ~20-22 | **0-2** | Maintain |

---

## OPERATIONAL HEALTH SNAPSHOT (Known Issues)

| State | OK Rate | Top Issue | Products/Run | Deals/Run |
|---|---|---|---|---|
| **S. Nevada** | ~82% | 8 silent failures, Rise blocked (9 sites) | ~5,951 | 136 |
| **Arizona** | ~90% | Dutchie Cloudflare (~19 sites), Curaleaf Youngtown URL bug | ~4,562 | 149 |
| **Michigan** | ~5% | **CRITICAL** — Curaleaf hardcodes NV, Dutchie embed_type mismatch, WAF rate limiting | ~112 | 33 |
| **Illinois** | ~65-75% (est.) | Rise blocked (10 sites), some Dutchie timeouts | Collecting | Collecting |
| **New Jersey** | ~82% | Dutchie timeouts | ~2,751 | 85 |
| **Ohio** | ~32% | Dutchie cascade fail | ~61 | 7 |
| **New York** | ~83% | Curaleaf age gate mapping broken | ~421 | 9 |
| **Colorado** | Collecting | New state, baseline TBD | Collecting | Collecting |
| **Missouri** | Collecting | New state, baseline TBD | Collecting | Collecting |
| **Massachusetts** | Collecting | New state, baseline TBD | Collecting | Collecting |
| **Pennsylvania** | Collecting | New state, baseline TBD | Collecting | Collecting |

---

## RESEARCH METHODOLOGY FOR NEW URLS

When researching new Dutchie/Jane URLs for a state, follow this process:

### Step 1: Get the State License List
- Pull the official dispensary license list from the state regulator
- This gives you the TAM ceiling — every legal dispensary in the state

### Step 2: Cross-Reference with Our Config
- Compare against `config/dispensaries.py` for that region
- Identify all licensed dispensaries NOT in our config

### Step 3: Platform Identification
For each uncovered dispensary:
1. Visit the dispensary's website
2. Check if the menu page loads a Dutchie embed (look for `dutchie.com` in iframes/scripts)
3. Check if it loads a Jane/iheartjane embed (look for `iheartjane.com` in iframes/scripts)
4. Check if it redirects to `curaleaf.com` or `zenleafdispensaries.com`
5. Note the platform and embed type (iframe, js_embed, direct)

### Step 4: Document Each New Site
For each new Dutchie/Jane site found, record:
```
name: "Dispensary Name"
slug: "dispensary-slug"
platform: "dutchie" | "jane"
url: "https://..."
embed_type: "iframe" | "js_embed" | "direct" | "hybrid"
region: "state-name"
chain: "Parent Chain Name" (if applicable)
notes: "Any special notes"
```

### Step 5: Organize by Chain
Group findings by chain (e.g., "Native Roots — 25 locations, all Dutchie JS embed") for efficient batch addition.

---

## MARKET SIZE CONTEXT (for investor/CEO framing)

| Metric | Value | Source |
|---|---|---|
| US Legal Cannabis Market (2025) | ~$30B+ | Industry reports |
| Total Licensed US Dispensaries | ~15,000+ | State regulators |
| Our 11-State TAM | ~4,158 dispensaries | State license data |
| Currently Configured | 1,192 sites (1,143 active) | dispensaries.py |
| **Current TAM Coverage** | **~27%** | Configured/TAM |
| Supported Platform Coverage | ~65-75% of all dispensaries | Platform audits |
| **Theoretical Max (existing scrapers)** | **~2,700-3,100 sites** | TAM x platform overlap |
| **Gap to Theoretical Max** | **~1,600-2,000 sites** | Max - Current |

### Revenue Potential by State (Annual Cannabis Sales)

| State | 2025 Revenue | Growth Trend | Deal-Seeking Index |
|---|---|---|---|
| **Michigan** | ~$3.0B | Stable (price compression) | HIGH (lowest US prices) |
| **Illinois** | ~$2.0B | Moderate growth | HIGH (highest US prices + taxes) |
| **Colorado** | ~$1.1B | Declining (mature/saturated) | MEDIUM (competitive, existing deal platforms) |
| **Massachusetts** | ~$1.65B | Record high | HIGH (high prices, limited competition) |
| **New York** | ~$1.7B | Rapid growth | MEDIUM (market still forming) |
| **Arizona** | ~$1.8B | Stable | HIGH (tourist market) |
| **New Jersey** | ~$1.0B | Growing | HIGH (NYC metro spillover) |
| **Missouri** | ~$1.5B | Fastest US growth | HIGH (price-conscious consumers) |
| **Ohio** | ~$1.1B | Rapid growth (first full year rec) | HIGH (new rec market) |
| **Pennsylvania** | ~$2.5B (medical) | Stable (awaiting rec) | MEDIUM (medical-only limits deal seeking) |
| **Nevada** | ~$0.8B | Stable | HIGH (tourist-driven, production state) |

---

*End of Market Coverage Sprint Guide*
