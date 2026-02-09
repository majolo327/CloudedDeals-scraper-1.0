# Power User Search Audit Report

**Date:** 2026-02-09
**Zip Code:** 89102 (Las Vegas - central)
**Test Suite:** 82 unit tests covering 12 search scenarios

---

## Executive Summary

**Could not execute live database queries** — no Supabase credentials are available in this environment (no `.env` file, no env vars). Instead, this audit:

1. Verified all search/filter/scoring **logic** via 82 unit tests (all passing)
2. Wrote **corrected SQL queries** adapted to the actual schema (`scripts/power-user-search-test.sql`)
3. Discovered **9 bugs/gaps** in the original test plan vs actual schema
4. Found **5 real issues** in the search/scoring system
5. Verified all 338 existing tests + 82 new tests pass (420 total)

---

## Critical Schema Mismatches

The original test queries assumed a flat `deals` table. The actual schema is normalized:

| Test Assumed | Actual Schema |
|---|---|
| `deals.price` | `products.sale_price` |
| `deals.dispensary_name` | `dispensaries.name` (via JOIN on `products.dispensary_id`) |
| `deals.dispensary_address` | `dispensaries.address` |
| `deals.discount_label` | `products.discount_percent` |
| `deals.quantity` | `products.weight_value` + `products.weight_unit` |
| `deals.strain` | **DOES NOT EXIST** |
| `deals.score` | `products.deal_score` |
| `scraped_at::date = CURRENT_DATE` | `products.is_active = true` (old products are deactivated) |

Corrected queries are in `scripts/power-user-search-test.sql`.

---

## Test Results by Scenario

### Test 1: Brand Search — "Matrix Rippers"

| Check | Status | Notes |
|---|---|---|
| Matrix in brand DB | PASS | `BRANDS` list in `clouded_logic.py:138` |
| Brand detection works | PASS | `detect_brand("Matrix Rippers 1g Disposable")` returns `"Matrix"` |
| Word-boundary prevents false positives | PASS | `\bMatrix\b` regex compiled correctly |
| Scoring correct | PASS | Matrix is NOT premium (8 pts, not 20) — correct for a local brand |

**Result: Working.** Matrix brand searches will work. Products show in extended search (ILIKE `%matrix%`) and brand is correctly detected for scoring.

---

### Test 2: Brand Search — "Airo Pods" / "AiroPods"

| Check | Status | Notes |
|---|---|---|
| Airo in brand DB | PASS | `BRANDS` list includes "Airo" |
| "Airo Pod" detected | PASS | `\bAiro\b` matches "Airo Pod" |
| "AiroPro" detected | **FAIL** | `\bAiro\b` does NOT match "AiroPro" — no word boundary between "Airo" and "Pro" |
| Frontend search finds them | PASS | ILIKE `%airo%` catches "AiroPro" at the server level |

**Bug Found:** Products named "AiroPro" won't have brand detection in the scraper. The brand field will be empty/null for AiroPro products, meaning:
- They won't get the brand bonus in scoring (lose 8 points)
- They won't appear in "Browse by Brand" under Airo
- Frontend search still works via ILIKE substring matching

**Fix:** Add "AiroPro" as a brand variant in `clouded_logic.py`, or modify the brand regex for Airo to use `\bAiro(?:Pro)?\b`.

---

### Test 3: Premium Brand — "Stiiizy"

| Check | Status | Notes |
|---|---|---|
| STIIIZY is premium | PASS | In `PREMIUM_BRANDS` set |
| Brand detected | PASS | Case-insensitive: "stiiizy" -> "STIIIZY" |
| Gets 20-pt premium bonus | PASS | Verified via `calculate_deal_score()` |
| Misspelling "stiizy" (2 i's) | **PARTIAL** | Brand detection uses exact `\bSTIIIZY\b` — 2-i misspelling NOT handled in scraper |
| Score reaches 85+ (steal) | PASS | With 50%+ off: score = 95 |
| Passes hard filters at $22 | PASS | Vape cap is $25 |
| $26 vape correctly filtered | PASS | Over $25 cap → rejected |

**Known Gap:** The scraper's brand regex is exact-match (`\bSTIIIZY\b`), so products listed as "STIIZY" (2 i's) won't get brand detection. The frontend SQL query uses `stii+zy` regex which handles this. There may be a discrepancy where the product is found in search but has no brand association.

---

### Test 4: Local Brand — "Local's Only" Wax

| Check | Status | Notes |
|---|---|---|
| In brand DB | **FAIL** | Neither "Local's Only" nor "Locals Only" is in `BRANDS` list |
| Search still works | PARTIAL | ILIKE `%local%only%` won't work — search uses `%locals only%` which requires exact substring |
| Apostrophe handling | N/A | Brand not recognized regardless |

**Bug Found:** "Local's Only" is a real Las Vegas concentrate brand not in the brand database. Products from this brand will:
- Have no brand detected (null brand field)
- Get 0 brand bonus in scoring
- Not appear in Browse by Brand
- Only findable via product name search if the scraper preserves the full name

**Fix:** Add `"Local's Only"` and `"Locals Only"` to `BRANDS` in `clouded_logic.py`.

---

### Test 5: Quantity Filter — "7g flower" / "14g deals"

| Check | Status | Notes |
|---|---|---|
| Schema uses weight_value/weight_unit | CORRECT | Not `quantity` as tests assumed |
| 7g at $25 passes hard filter | PASS | Quarter max is $30 |
| 14g at $35 passes hard filter | PASS | Half oz max is $40 |
| 14g over $40 rejected | PASS | Correctly enforced |
| Price-per-gram calculation | PASS | $25/7g = $3.57/g |

**Note:** The frontend has no dedicated "quantity" or "size" filter. Users can't directly search "7g deals." They'd have to search a brand name and visually scan weights. Weight-based search would need product name regex matching (e.g., `name ~* '7g|quarter'`).

**Missing Feature:** No weight/size filter UI component exists. The `weight_value` field IS populated by the scraper, so the data is available for filtering.

---

### Test 6: Distance Filter — Vapes within 5 miles

| Check | Status | Notes |
|---|---|---|
| Lat/long in DB schema | YES | `dispensaries.latitude` / `dispensaries.longitude` columns exist (migration 015) |
| Lat/long populated in scraper config | **NO** | `scraper/config/dispensaries.py` has no coordinates |
| Lat/long in frontend data | YES | All 27 scraped dispensaries have hardcoded coords in `frontend/src/data/dispensaries.ts` |
| Planet 13 within 5mi of 89102 | PASS | 3.4 miles (verified via haversine) |
| Medizin in "nearby" range | PASS | ~9.5 miles from 89102 |
| Haversine math correct | PASS | Verified against known distances |

**Architecture Finding:** Distance calculation happens entirely client-side:
1. Frontend has hardcoded lat/lng for all 27 scraped dispensaries
2. User's zip code is geocoded to lat/lng via browser geolocation or zip lookup
3. `getDistanceMiles()` computes haversine distance in JavaScript
4. Filtering/sorting by distance is done in `useUniversalFilters.ts`

**The DB `dispensaries` table has lat/lng columns but they may not be populated.** The frontend doesn't rely on them — it uses its own hardcoded coordinates. The SQL distance queries in the test script would only work if the DB columns are populated.

| Dispensary | Distance from 89102 | Zone |
|---|---|---|
| Greenlight Downtown | 1.7 mi | near |
| Greenlight Paradise | 2.9 mi | near |
| Curaleaf Strip | 2.0 mi | near |
| Planet 13 | 3.4 mi | near |
| Oasis | 3.1 mi | near |
| Thrive Main | 1.8 mi | near |
| Beyond/Hello Twain | 4.8 mi | near |
| The Grove | 6.7 mi | nearby |
| Medizin | 9.5 mi | nearby |
| Deep Roots Cheyenne | 10.1 mi | across_town |

---

### Test 7: City Trees Disposable

| Check | Status | Notes |
|---|---|---|
| City Trees in brand DB | PASS | Present in `BRANDS` list |
| Brand detected | PASS | `detect_brand("City Trees Disposable 0.5g")` returns `"City Trees"` |
| Not premium | CORRECT | Gets 8-pt known brand bonus |
| $18 vape passes hard filter | PASS | Under $25 cap |

**Result: Working.** City Trees disposable searches function correctly.

---

### Test 8: Multi-Brand Search — "Sip AND Wyld edibles"

| Check | Status | Notes |
|---|---|---|
| Wyld in brand DB | PASS | Present and is **premium** (20 pts) |
| Sip in brand DB | **FAIL** | "Sip" is NOT in the brand database |
| Wyld edible scoring | PASS | 42% off + premium + edible boost = 79 (fire badge) |
| Multi-brand filter | **NO UI** | Frontend doesn't support multi-brand selection |

**Bugs Found:**
1. "Sip" brand (cannabis-infused drinks) missing from brand database
2. No multi-brand filter UI exists — users can only filter by one brand at a time
3. The frontend search box works with OR logic (searching "sip" or "wyld" individually) but not simultaneously

**Fix:** Add `"Sip"` to `BRANDS` in `clouded_logic.py`. Consider adding multi-brand filter chips in the filter sheet.

---

### Test 9: Strain Search — "Tangie"

| Check | Status | Notes |
|---|---|---|
| Strain field exists | **NO** | No `strain` column in `products` table |
| Product name search works | YES | ILIKE `%tangie%` finds products with strain in name |
| Word-boundary excludes "Tangerine" | PASS | `\btangie\b` does not match "Tangerine Dream" |
| Strain extraction in scraper | **NO** | Scraper doesn't extract/store strain data |

**Data Gap:** No strain data is captured. Users searching for specific strains rely entirely on the strain name appearing in the product name. Products listed as "OG Kush Cart" will be findable, but if a dispensary lists it as "Premium Cart 0.5g" without the strain, it's invisible.

**Fix:** Add a `strain` column to `products` and implement strain extraction in the scraper's `clouded_logic.py` parser.

---

### Test 10: Dispensary Search — "Rise Nellis"

| Check | Status | Notes |
|---|---|---|
| Rise dispensaries scraped | **NO** | All 7 Rise locations are listed-only |
| Rise in frontend dispensary data | YES | Listed at `dispensaries.ts:111-117` |
| Word-boundary prevents "Rise" matching "Sunrise" | PASS | `\brise\b` is correct |

**Expected Result: 0 deals found.** Rise dispensaries are CCB-licensed but not yet integrated into the scraper. They appear in the Browse view with a "no deals today" message and a CTA to check their menu.

**Fix:** Add Rise dispensaries to the scraper config. Rise has 7 Las Vegas locations — this would be a significant coverage expansion.

---

### Test 11: Tourist Search — "The Strip"

| Check | Status | Notes |
|---|---|---|
| Strip dispensaries identified | PASS | 7 scraped strip-area locations |
| Planet 13 prominent | PASS | Largest dispensary in the world |
| Las Vegas Blvd address regex | PASS | Matches Curaleaf Strip address |
| "Tourist Friendly" tag | **NO** | No tagging system for tourist dispensaries |

**Strip-Area Scraped Dispensaries:**
- Planet 13 (2548 W Desert Inn Rd) — technically near-Strip
- The Grove (4647 University Center Dr) — near UNLV/Strip
- Curaleaf - The Strip (1736 S Las Vegas Blvd)
- Oasis Cannabis (1800 Industrial Rd)
- Thrive - Sammy Davis Jr (2975 Sammy Davis Jr Dr)
- Beyond/Hello - Twain (430 E Twain Ave)
- Cultivate - Spring Mountain (3615 Spring Mountain Rd)

**Not Scraped but Listed (Strip-area):**
- Cookies Strip (2307 S Las Vegas Blvd)
- Sahara Wellness (420 E Sahara Ave)
- Jardin (2900 E Desert Inn Rd)

**UX Suggestion:** Add a "Near The Strip" zone filter or tag for tourists.

---

### Test 12: Data Quality

**Cannot run against live database** — no credentials available. However, the schema and scoring logic analysis reveals:

| Metric | Assessment |
|---|---|
| Total active dispensaries | 27 scraped + ~45 listed-only = ~72 total |
| Dispensaries with geo data | 27/27 scraped have frontend coords; DB columns may be empty |
| Brand database size | 200+ brands in `clouded_logic.py` |
| Premium brands | 24 (get 20-pt scoring bonus) |
| Category support | 5 (flower, vape, edible, concentrate, preroll) + skip categories |
| Scoring range | 0-100 with steal/fire/solid badge thresholds |
| Curated target | 200 deals with diversity constraints |
| Max per dispensary | 30 deals |
| Max per brand | 5 deals in curated feed |

---

## What's Working

1. **Word-boundary brand matching** — `\b` regex prevents "rove" matching "The Grove"
2. **Premium brand scoring** — STIIIZY, Cookies, Wyld, etc. get correct 20-pt bonus
3. **Category price caps** — Vapes capped at $25, edibles at $9, enforced in hard filters
4. **Junk keyword filtering** — Batteries, grinders, pipes, bongs correctly filtered client-side
5. **Strain-brand blockers** — "Wedding Cake" doesn't detect Cake brand, "Girl Scout Cookies" doesn't detect Cookies brand
6. **Distance calculation** — Haversine math verified correct; 27 dispensaries have coordinates
7. **Diversity constraints** — Brand/dispensary/category caps prevent feed dominance
8. **Quality gate** — Short names, strain-only names, missing weight correctly rejected
9. **Extended search deduplication** — Curated deals not duplicated in "Also Found on Sale"

---

## What's Broken

1. **"AiroPro" brand detection fails** — `\bAiro\b` has word boundary after "Airo" that fails when "Pro" follows. Products named "AiroPro" get no brand detection. (File: `clouded_logic.py:165`)

2. **"Rolling Papers" (plural) not filtered** — Frontend junk regex uses `rolling\s+paper` (singular) with `\b` at end. "Rolling Papers" doesn't match because "s" follows "paper" with no boundary. (File: `api.ts:434`)

3. **STIIIZY misspelling gap** — Brand regex is exact `\bSTIIIZY\b`. Products listed with 2 i's ("STIIZY") or 4 i's won't get brand detection. Frontend SQL uses `stii+zy` which handles this, creating a server/scraper discrepancy.

4. **Dispensary lat/lng in DB possibly empty** — The `dispensaries` table has latitude/longitude columns (migration 015) but the scraper config has no coordinates. Frontend uses hardcoded coords in `dispensaries.ts` and ignores DB values.

---

## What Needs Building

| Feature | Impact | Effort |
|---|---|---|
| **Strain field extraction** | High — users search by strain constantly | Medium (add column + parser logic) |
| **Multi-brand filter UI** | Medium — power users want to compare brands | Low (filter chip component) |
| **Weight/size filter** | Medium — "show me quarters" is a common request | Low (data exists, need UI) |
| **"Near The Strip" zone filter** | Medium — tourist UX improvement | Low (zone data exists in frontend) |
| **Rise dispensary scraping** | High — 7 locations = major coverage gap | Medium (need to identify platform) |
| **Missing brands** | Low-Medium — Sip, Local's Only, others | Very Low (add to BRANDS list) |
| **STIIIZY misspelling tolerance** | Low — most products spell it correctly | Very Low (regex tweak) |
| **AiroPro brand variant** | Low-Medium — depends on product naming | Very Low (add brand variant) |

---

## Data Quality Score (Estimated)

| Metric | Value | Notes |
|---|---|---|
| **Dispensaries scraped** | 27/106 | 25% of CCB-licensed dispensaries |
| **Dispensaries with geo data** | 27/27 (frontend) | 100% of scraped; DB may differ |
| **Brands in database** | 200+ | Comprehensive for Nevada market |
| **Premium brands** | 24 | Major national + regional brands |
| **Categories supported** | 5 | flower, vape, edible, concentrate, preroll |
| **Strain data** | 0% | No strain field exists |
| **Products with brand detected** | ~70-80% (est.) | Based on brand DB coverage |
| **Junk filtering** | 95%+ | Comprehensive keyword list |

---

## Priority Fixes (Ranked by User Impact)

### 1. Add missing brands: Sip, Local's Only, AiroPro variant
- **Impact:** Users searching these brands get no results or wrong results
- **Effort:** 5 minutes — add to `BRANDS` list in `clouded_logic.py`
- **File:** `clouded_logic.py:100-159`

### 2. Fix "rolling papers" plural in junk filter
- **Impact:** Rolling papers showing up as search results
- **Effort:** 1 minute — change `rolling\s+paper` to `rolling\s+papers?`
- **File:** `api.ts:434`

### 3. Add weight/size filter to UI
- **Impact:** Power users want to filter by 3.5g, 7g, 14g, 28g
- **Effort:** Small — data exists in `weight_value`, need filter UI component
- **Files:** `useUniversalFilters.ts`, `FilterSheet.tsx`

### 4. Scrape Rise dispensaries (7 locations)
- **Impact:** Major coverage gap — Rise is one of the biggest chains in Vegas
- **Effort:** Medium — need to identify their platform and add to scraper config
- **Files:** `config/dispensaries.py`, platform scraper

### 5. Add strain extraction to scraper
- **Impact:** Strain search is one of the most common user queries
- **Effort:** Medium — add column migration + parser logic
- **Files:** New migration, `clouded_logic.py`, `parser.py`

---

## Test Artifacts

| File | Description |
|---|---|
| `scripts/power-user-search-test.sql` | Corrected SQL queries for all 12 tests (actual schema) |
| `scraper/tests/test_power_user_search.py` | 82 unit tests covering all 12 scenarios |

**Test Results:** 420 tests pass (338 original + 82 new), 0 failures.
