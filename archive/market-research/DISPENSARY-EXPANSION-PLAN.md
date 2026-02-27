# Dispensary Expansion Plan: MI + NJ + MO

**Date:** 2026-02-16
**Goal:** 30-70% coverage increase across Michigan, New Jersey, Missouri
**Target additions:** MI (+300-400), NJ (+90-145), MO (+30-60)

---

## 1. Executive Summary

We currently scrape **179 dispensaries** across these three states. This plan
increases that to **~600-780 dispensaries** — a 3-4x expansion — while solving
the architectural bottleneck that makes Michigan's current 114-site scrape
unreliable (5.3% yield in Test 1).

**The core challenge:** Michigan alone will grow to 400-500+ sites. At our
current Dutchie concurrency of 3 and a 600s per-site timeout, that's
130-170 sequential waves hitting dutchie.com from one runner. This will:
- Exceed the 120-minute workflow timeout
- Trigger Dutchie's WAF rate limiting (already happening at 111 sites)
- Produce cascading timeouts as the runner runs out of time

**The solution:** Split Michigan into two sub-regions that run as independent
cron jobs on separate GHA runners, 4 hours apart to avoid Dutchie WAF overlap.

---

## 2. Current State vs. Target

| State | Current Sites | Addressable (Dutchie/Jane/Curaleaf) | Target After Expansion | Coverage % |
|-------|:---:|:---:|:---:|:---:|
| **Michigan** | 114 | 530-640 | 400-500 | 63-95% |
| **New Jersey** | 34 | 130-180 | 125-175 | 70-95% |
| **Missouri** | 31 | 170-190 | 60-90 | 32-47% |
| **TOTAL** | **179** | **830-1,010** | **585-765** | **58-76%** |

---

## 3. Michigan Splitting Strategy

### 3.1 Why Split Is Required

| Metric | Current (114 sites) | After Expansion (~450 sites) |
|--------|:---:|:---:|
| Dutchie waves (at concurrency=3) | 37 | ~150 |
| Estimated runtime | ~50 min | ~180 min |
| GHA timeout | 120 min | **EXCEEDS** |
| Dutchie rate-limit risk | HIGH | **CERTAIN** |

At 450 sites, a single `michigan` region is mathematically guaranteed to
fail: 150 waves x ~60s average = 150 min, exceeding the 120-min timeout
before counting retries or slow sites.

### 3.2 Sub-Region Architecture

Split Michigan into two geographic sub-regions:

```
michigan-east  — Detroit metro, Ann Arbor, Flint, Lansing, Saginaw,
                  and all dispensaries east of US-127 corridor
                  (~60% of sites = 270-300 dispensaries)

michigan-west  — Grand Rapids, Kalamazoo, Traverse City, Muskegon,
                  Battle Creek, and all dispensaries west of US-127
                  (~40% of sites = 180-200 dispensaries)
```

**Why geographic, not arbitrary:**
- Maintainable: new dispensaries naturally slot into east/west by city
- Debuggable: failures cluster by region (e.g. "all Grand Rapids sites down")
- Balanced: Detroit metro is dense but western MI has spread-out chains
- Extensible: if Michigan grows further, split east into detroit-metro + east-rural

### 3.3 Implementation: Sub-Region in Config

Each Michigan dispensary gets a `region` value of either `michigan-east` or
`michigan-west` instead of the current `michigan`.

```python
# Before:
{"name": "JARS Detroit", "slug": "jars-detroit", "platform": "dutchie",
 "region": "michigan", ...}

# After:
{"name": "JARS Detroit", "slug": "jars-detroit", "platform": "dutchie",
 "region": "michigan-east", ...}
```

The scraper's `_get_active_dispensaries()` already filters by exact region
match (line 1226: `d.get("region") == REGION`), so each sub-region
runs independently with zero code changes to main.py.

### 3.4 Cron Schedule for Michigan Sub-Regions

**Key constraint:** Separate the two batches by 4+ hours so Dutchie's WAF
doesn't see them as a single sustained scrape from GitHub's IP range.

```yaml
# Current (single michigan):
- cron: "30 13 * * *"   # michigan — 8:30 AM EST (114 sites, ~50 min)

# Proposed (two sub-regions):
- cron: "30 13 * * *"   # michigan-east — 8:30 AM EST  (~270-300 sites, ~70 min)
- cron: "30 17 * * *"   # michigan-west — 12:30 PM EST (~180-200 sites, ~50 min)
```

**Why 30 17 for michigan-west:**
- 4 hours after michigan-east → WAF cooldown
- After Missouri (17:00 UTC finishes ~17:20) → no resource overlap concerns
- Data is still same-day fresh (12:30 PM EST = morning menus are loaded)
- Current 17:30 UTC slot is empty (Missouri at 17:00, nothing until next day)

### 3.5 Michigan East/West City Mapping

**michigan-east** (US-127 and east):
- Detroit metro (Dearborn, Ferndale, Hazel Park, Hamtramck, Eastpointe, Roseville,
  Warren, Sterling Heights, Shelby Twp, Mt Clemens, River Rouge, Inkster, etc.)
- Ann Arbor / Ypsilanti / Saline
- Lansing / East Lansing / Mason
- Flint / Burton / Grand Blanc
- Saginaw / Bay City / Midland
- Monroe / Adrian / Jackson
- Port Huron / Lapeer

**michigan-west** (west of US-127):
- Grand Rapids / Wyoming / Kentwood / Walker
- Kalamazoo / Portage / Battle Creek
- Muskegon / Holland / Grand Haven
- Traverse City / Petoskey / Cadillac
- Mt Pleasant / Big Rapids
- Niles / Benton Harbor / St Joseph
- Marquette / Escanaba (UP)
- Ludington / Manistee

---

## 4. Per-State Expansion Plan

### 4.1 Michigan (+300-400 new dispensaries)

**Current:** 114 sites (111 Dutchie, 3 Curaleaf)
**Target:** 400-500 sites
**Platform mix after expansion:** ~350-400 Dutchie, ~50-80 Jane, ~8 Curaleaf, ~20-30 AIQ

#### Critical: Fix Test 1 Bugs FIRST

Before adding a single new site, these bugs from MICHIGAN_TEST1_ANALYSIS.md
must be fixed — they caused 95% failure rate:

| Bug | Fix | Impact |
|-----|-----|--------|
| **Curaleaf hardcodes "Nevada" in age gate** | Extract state from URL `/shop/{state}/` | +3 sites, +150-300 products |
| **Dutchie embed_type mismatch** | Auto-detect: `dutchie.com/dispensary/` = direct | +60-80 sites, saves 55% timeout budget |
| **No domain-level rate limiting** | Add 2-5s random delay between dutchie.com requests | +20-40 sites (prevents WAF) |
| **Zen Leaf platform mismatch** | Update platform flag | +1 site |

**Expected yield after bug fixes: 60-75%** (up from 5.3%)

#### Research Phase: Finding 300-400 New MI Dispensaries

**Method 1 — Dutchie directory scrape:**
- Dutchie has a public dispensary directory at dutchie.com/dispensaries
- Filter by Michigan → extract all dispensary URLs
- Cross-reference against our existing 111 Dutchie slugs
- Expected yield: +200-280 new Dutchie sites

**Method 2 — Jane directory:**
- iheartjane.com/stores filtered by Michigan
- Expected yield: +50-80 new Jane sites

**Method 3 — Curaleaf/GTI/Cresco location pages:**
- MSO "find a store" pages for MI locations
- Curaleaf: curaleaf.com/shop/michigan → ~5-8 locations
- (Rise disabled but track for future)

**Method 4 — State license registry cross-reference:**
- Michigan CRA (Cannabis Regulatory Agency) publishes active licenses
- Cross-reference licensed retailers with Dutchie/Jane to find missed sites
- Expected yield: +30-50 additional sites we missed in Methods 1-2

**Method 5 — AIQ / Carrot discovery:**
- Check for Alpine IQ and Carrot widget usage on MI dispensary websites
- Expected yield: +10-30 sites

#### New Brands to Add (Michigan-native)

The brand detection system needs these MI-native brands added to
`clouded_logic.py` for accurate deal scoring:

**Premium tier (+20 boost):** Lume, Skymint, Puff Cannabis, House of Dank
**Popular tier (+12 boost):** Platinum Vape, MKX Oil Co, Redbud Roots,
Element, North Coast, Herbana, Light Sky Farms, Redemption, Humblebee,
Five Star Extracts, Glorious Cannabis Co, Monster Xtracts, Viola, Michigrown

---

### 4.2 New Jersey (+90-145 new dispensaries)

**Current:** 34 sites (29 Dutchie, 3 Curaleaf, 2 Rise → now 0 Rise)
**Target:** 125-175 sites
**Platform mix after expansion:** ~80-100 Dutchie, ~20-40 Jane, ~8-15 Curaleaf, ~5-10 AIQ

#### Why NJ Is Bigger Than Our Research Suggested

Our initial research (docs/research-batch2-markets.md) estimated ~130-150
licensed dispensaries with ~67 on our platforms. However:
- NJ has aggressively expanded licenses throughout 2025-2026
- Many new conditional licenses have converted to operational
- The micro-license class has added 50-100+ small dispensaries
- Current actual count is likely **200-300 operational dispensaries**
- Dutchie/Jane adoption among new licensees is high (~60-70%)

#### Research Phase: Finding 90-145 New NJ Dispensaries

**Method 1 — Dutchie directory (NJ filter):**
- Expected: +40-60 new Dutchie sites (many new small dispensaries)

**Method 2 — Jane directory (NJ filter):**
- Expected: +20-40 new Jane sites

**Method 3 — NJ CRC license list cross-reference:**
- NJ Cannabis Regulatory Commission publishes active retail licenses
- Cross-reference against platform directories
- Expected: +15-25 additional discovered sites

**Method 4 — MSO location pages:**
- Curaleaf NJ locations: ~8-12 (we have 3)
- Zen Leaf / Verano NJ: ~3-5
- TerrAscend NJ (Apothecarium): ~5-8
- Ascend NJ: ~5-8

**Method 5 — AIQ / Carrot discovery:**
- Expected: +5-10 sites

#### NJ Cron Schedule

Current NJ schedule is fine — no splitting needed at 125-175 sites:

```yaml
- cron: "30 12 * * *"   # new-jersey — 7:30 AM EST (125-175 sites, ~50 min)
```

Stays under 120-min timeout with margin. May need to bump timeout-minutes
to 150 if it gets close (or increase Dutchie concurrency from 3→4 for NJ).

#### New Brands (NJ-native)

**Premium:** Kind Tree, Breakwater, Garden State Canna
**Popular:** The Heirloom Collective, Verano, TerrAscend, Cannabist,
Harmony, The Apothecarium, Columbia Care, Zen Leaf

---

### 4.3 Missouri (+30-60 new dispensaries)

**Current:** 31 sites (31 Dutchie, 0 Jane, 0 Curaleaf)
**Target:** 60-90 sites
**Platform mix after expansion:** ~50-70 Dutchie, ~10-20 Jane

#### Why Conservative for Now

Missouri's TAM is ~176 on our platforms, but:
- The market is still young (legalized Feb 2023, rec sales July 2023)
- Many dispensaries are still onboarding to ecommerce platforms
- Dutchie adoption is growing rapidly (new sites weekly)
- Start with +30-60 now, reassess in 30 days for the remaining ~90

#### Research Phase: Finding 30-60 New MO Dispensaries

**Method 1 — Dutchie directory (MO filter):**
- Expected: +20-40 new Dutchie sites

**Method 2 — Jane directory (MO filter):**
- Expected: +10-20 new Jane sites (currently 0 Jane in our config)

**Method 3 — MO DHSS license list:**
- Missouri Dept of Health publishes active dispensary licenses
- Cross-reference with platform directories
- Expected: +5-10 additional discovered sites

#### MO Cron Schedule

No changes needed — stays under 120 min:

```yaml
- cron: "0 17 * * *"    # missouri — 11:00 AM CST (60-90 sites, ~30 min)
```

#### New Brands (MO-native)

**Premium:** Proper Cannabis, Flora Farms, Sinse
**Popular:** BeLeaf, Ostara, Heartland Labs, Good Day Farms, Illicit Gardens,
Vivid, C4, Robust, Clovr

---

## 5. Technical Changes Required

### 5.1 Config: dispensaries.py

| Change | Scope | Lines Affected |
|--------|-------|----------------|
| Split existing MI dispensaries into `michigan-east` / `michigan-west` | 114 entries | region field |
| Add ~300-400 new MI dispensaries | New entries | ~300-400 new dict entries |
| Add ~90-145 new NJ dispensaries | New entries | ~90-145 new dict entries |
| Add ~30-60 new MO dispensaries | New entries | ~30-60 new dict entries |
| Add `michigan-east` and `michigan-west` to region options | 2 lines | workflow_dispatch inputs |

### 5.2 Workflow: scrape.yml

```yaml
# ── Cron additions ──
- cron: "30 17 * * *"   # michigan-west — 12:30 PM EST (~180-200 sites, ~50 min)

# ── Region determination additions ──
elif [ "${{ github.event.schedule }}" = "30 17 * * *" ]; then
  echo "value=michigan-west" >> $GITHUB_OUTPUT
# Change existing michigan entry:
elif [ "${{ github.event.schedule }}" = "30 13 * * *" ]; then
  echo "value=michigan-east" >> $GITHUB_OUTPUT

# ── workflow_dispatch region dropdown additions ──
- michigan-east
- michigan-west
# Remove the old 'michigan' option

# ── run-name mapping (update stale cron times) ──
# Fix ALL mappings to match actual cron times
```

### 5.3 Code: clouded_logic.py — Brand Additions

Add ~60-80 new brand entries across three states to the brand detection
system. These are critical for deal scoring — without them, products from
MI/NJ/MO native brands score 0 on the brand boost, pushing them below
the deal threshold.

### 5.4 Code: main.py — Rate Limiting (Michigan-specific)

Add per-domain request spacing to prevent Dutchie WAF blocks:

```python
# Between dispatching sites to the same domain, add a small random delay
# to prevent burst patterns that trigger WAF rate limiting.
# Only needed when a single region has 100+ sites on one platform.
DOMAIN_DELAY_SEC = float(os.getenv("DOMAIN_DELAY_SEC", "2"))
```

This is the fix for Bug #3 from MICHIGAN_TEST1_ANALYSIS.md and becomes
critical at 200-300 Dutchie sites per sub-region.

### 5.5 Fix: Curaleaf Age Gate (Multi-State)

The Curaleaf scraper hardcodes "Nevada" in age gate selection. Must be
parameterized to extract the state from the dispensary URL:

```
/shop/massachusetts/ → select "Massachusetts"
/shop/michigan/      → select "Michigan"
/shop/new-jersey/    → select "New Jersey"
/shop/missouri/      → select "Missouri"
```

---

## 6. Updated Full Cron Schedule

```
UTC   Local              Region              Sites (projected)  Est Runtime
────  ─────────────────  ──────────────────  ─────────────────  ───────────
11:00  6:00 AM EST       pennsylvania         16                ~15 min
11:30  6:30 AM EST       massachusetts        17                ~15 min
12:00  7:00 AM EST       new-york             18                ~15 min
12:30  7:30 AM EST       new-jersey          125-175            ~50 min
13:00  8:00 AM EST       ohio                 22                ~15 min
13:30  8:30 AM EST       michigan-east       270-300            ~70 min
14:30  7:30 AM MST       arizona              52                ~30 min
15:00  9:00 AM CST       illinois             88                ~40 min
15:30  8:30 AM MST       colorado             17                ~15 min
16:05  8:05 AM PST       southern-nv          63                ~35 min
17:00 11:00 AM CST       missouri             60-90             ~30 min
17:30 12:30 PM EST       michigan-west       180-200            ~50 min
```

**Total daily scrape: ~900-1,060 dispensaries across 12 region slots**

---

## 7. Risk Mitigation

### 7.1 Dutchie WAF Rate Limiting

**Risk:** 270-300 Dutchie sites from one runner may trigger WAF.
**Mitigation:**
- Add 2-5s random inter-request delay per domain
- 4-hour gap between michigan-east and michigan-west
- Monitor first 3 runs; tune delay if >15% sites timeout

### 7.2 GHA Timeout (120 min)

**Risk:** Large sub-regions exceed 120-min job timeout.
**Mitigation:**
- michigan-east at 300 sites: ~100 waves × 45s avg = ~75 min (within margin)
- If tight, reduce per-site timeout from 600s to 400s for known-good direct
  Dutchie sites (they don't need iframe detection time)
- Emergency valve: bump timeout-minutes to 150 for michigan-east/west only

### 7.3 Data Quality at Scale

**Risk:** Adding 400+ new sites may include defunct/empty dispensaries.
**Mitigation:**
- Phase the rollout (see Section 8)
- After first full run, audit 0-product sites and mark `is_active: False`
- Add a config field `verified: True/False` to track which sites have been
  manually validated

### 7.4 Deal Scoring Without Brand Data

**Risk:** MI/NJ/MO native brands not in brand list → deals score low → miss
genuine deals.
**Mitigation:**
- Add all native brands identified in research docs BEFORE expansion
- Review first run's "top 5 cut deals" to find brands we missed

---

## 8. Implementation Phases

### Phase 1: Foundation (Do First — Before Any Expansion)
1. Remove Rise from stable group (**DONE**)
2. Fix Curaleaf age gate multi-state bug
3. Fix Dutchie embed_type auto-detection for direct URLs
4. Add domain-level rate limiting (2-5s inter-request delay)
5. Add MI/NJ/MO native brands to clouded_logic.py
6. Split existing 114 MI dispensaries into east/west regions
7. Update workflow with michigan-east/michigan-west cron + region mapping

### Phase 2: Michigan Expansion (Research + Add Sites)
1. Scrape Dutchie directory for all MI dispensaries
2. Scrape Jane directory for all MI dispensaries
3. Check MSO location pages (Curaleaf, Zen Leaf) for MI
4. Cross-reference MI CRA license list
5. Add all new sites to config (tagged michigan-east or michigan-west)
6. Run michigan-east test batch (manual dispatch, limited mode)
7. Run michigan-west test batch
8. Audit results, deactivate dead sites
9. Enable daily cron for both sub-regions

### Phase 3: NJ Expansion
1. Scrape Dutchie/Jane directories for all NJ dispensaries
2. Check MSO location pages for NJ
3. Cross-reference NJ CRC license list
4. Add new sites to config (region: new-jersey)
5. Test run, audit, enable daily cron

### Phase 4: MO Expansion
1. Scrape Dutchie/Jane directories for all MO dispensaries
2. Cross-reference MO DHSS license list
3. Add new sites to config (region: missouri)
4. Test run, audit, enable daily cron

### Phase 5: Validation & Tuning
1. Run all expanded regions for 3 consecutive days
2. Analyze yield rates per sub-region
3. Deactivate chronically-0-product sites
4. Tune rate limiting delay if needed
5. Verify deal scoring with native brands

---

## 9. Success Criteria

| Metric | Current | Target | Measurement |
|--------|:---:|:---:|---|
| MI dispensaries scraped | 114 | 400-500 | dispensary config count |
| MI yield rate | 5.3% | >60% | products > 0 / total sites |
| NJ dispensaries scraped | 34 | 125-175 | dispensary config count |
| MO dispensaries scraped | 31 | 60-90 | dispensary config count |
| Total daily products | ~2,000 est | ~15,000-25,000 | scrape_summary.txt |
| MI runtime (per sub-region) | 50 min | <90 min | GHA job duration |
| 0-product failure rate | ~40% | <15% | scrape_summary analysis |
| MI/NJ/MO native brand coverage | ~20% | >80% | brand detection audit |

---

## 10. ML Training Data Impact

This expansion directly feeds the ML kickoff criteria from OPERATIONS.md Phase F:

| ML Prerequisite | Current | After Expansion |
|-----------------|---------|-----------------|
| Daily product observations | ~5,000-10,000 est | ~30,000-50,000 |
| States with stable scraping | 1 (NV) | 4+ (NV, MI, NJ, MO) |
| Price history depth | ~2 weeks | Continues accumulating |
| Brand variation corpus | ~200 brands | ~350+ brands |
| **50K daily products threshold** | **Not met** | **Approaching/Met** |

With ~900-1,060 dispensaries scraping daily at an average of 30-50 products
per site, we'll produce **27,000-53,000 product observations/day** — hitting
the LLM training corpus threshold for Phase F1 (Product Description
Normalization).

Combined with the price history clock (needs 90+ days), the expansion
means **ML training could begin as early as mid-May 2026** — assuming
scrapes stabilize within 2 weeks and run consistently from there.
