# Michigan Scraper Test 1 — Root Cause Analysis

## Executive Summary

Test 1 scraped 114 Michigan dispensaries in 41 minutes but yielded only **112 products and 33 deals** — a **5.3% site yield rate** (6 of 113 sites returned any products). Four root-cause bugs were identified, three of which are code-level fixes.

| Metric | Actual | Target | Gap |
|--------|--------|--------|-----|
| Sites with products | 6/113 (5.3%) | 68+/113 (60%+) | -55% |
| Total products | 112 | 1,000+ | -89% |
| Deals selected | 33 | 150-200 | -84% |
| Categories at minimum | 1/5 | 5/5 | 4 under |

---

## Bug #1: Curaleaf Age Gate Hardcodes "Nevada" (CRITICAL)

**File:** `platforms/curaleaf.py:249`
**Impact:** 100% failure rate for all 3 Curaleaf/Zen Leaf Michigan sites (0 products each)

The `_handle_curaleaf_age_gate()` method hardcodes "Nevada" for state selection:

```python
# curaleaf.py line 249
await locator.select_option(label="Nevada")
# ...
nv_option = self.page.locator('text="Nevada"').first   # line 254
nv_option = self.page.locator('text="NV"').first        # line 260
```

Michigan Curaleaf sites (`/shop/michigan/curaleaf-mi-kalamazoo`) redirect to an age gate that requires selecting **Michigan** from a state dropdown. The scraper selects "Nevada", causing the age gate to redirect to a Nevada store page (or fail entirely), resulting in 0 products for all Michigan Curaleaf sites.

**Affected sites:**
- Curaleaf MI Kalamazoo — `curaleaf.com/shop/michigan/curaleaf-mi-kalamazoo`
- Curaleaf MI Bangor — `curaleaf.com/shop/michigan/curaleaf-mi-bangor`
- Zen Leaf Buchanan MI — `zenleafdispensaries.com/locations/buchanan/menu/recreational`

**Fix:** Extract the state from the URL path (`/shop/{state}/...`) or add a `state` field to dispensary configs. The URL pattern is consistent: all Curaleaf Michigan URLs contain `/shop/michigan/`.

```python
# Proposed fix in _handle_curaleaf_age_gate():
state = self._infer_state_from_url()  # parse /shop/{state}/ from URL
await locator.select_option(label=state.title())  # "Michigan", "Nevada", etc.
```

---

## Bug #2: Dutchie embed_type Mismatch for Direct URLs (CRITICAL)

**File:** `config/dispensaries.py:69` (PLATFORM_DEFAULTS) and all Michigan dutchie entries
**Impact:** ~270 seconds wasted per site on iframe detection that can never succeed; contributes to timeout cascade and leaves insufficient budget for actual product extraction

All 111 Michigan Dutchie sites use **direct** `dutchie.com/dispensary/{slug}` URLs. These are Dutchie's own React SPA pages where products render directly in the page DOM — **there is no iframe**. But `PLATFORM_DEFAULTS["dutchie"]["embed_type"]` is `"iframe"`, causing the following detection cascade for every site:

```
1. Try 6 iframe selectors × 45s timeout each = 270s max
2. Try JS embed detection (60s timeout)            = 60s max
3. Try direct page detection (15s timeout)          = 15s max
                                              Total: ~345s wasted
```

With a 600s per-site timeout, this burns **55% of the budget** before the correct detection method ("direct") is even attempted. Combined with navigation, age gate, and smart-wait, there's barely enough time for one attempt — let alone the reload+retry cycle.

**Why this wasn't caught:** The scraper was originally built for Nevada, where Dutchie sites use dispensary-hosted pages (e.g., `thedispensarynv.com/menu`) that embed Dutchie via iframes. Michigan sites were added with the same default but use a fundamentally different URL pattern.

**Evidence:** The 6 sites that DID return products are likely the ones where:
1. The age gate succeeded quickly
2. The page loaded products fast enough for the smart-wait to detect them
3. The full iframe+JS embed timeout cascade completed within the 600s budget
4. Direct page detection found the cards in time

**Fix options (recommended: Option A):**

**A) Auto-detect in `find_dutchie_content()`:** If the page URL host is `dutchie.com`, skip iframe detection and go straight to direct:
```python
if urlparse(page.url).netloc in ("dutchie.com", "www.dutchie.com"):
    embed_type_hint = "direct"  # override — dutchie.com pages are SPAs
```

**B) Per-site override:** Add `"embed_type": "direct"` to each Michigan dispensary config entry (111 entries).

**C) Batch override in `_get_active_dispensaries()`:** Auto-set embed_type for dutchie.com URLs:
```python
for d in active:
    if d["platform"] == "dutchie" and "dutchie.com/dispensary/" in d["url"]:
        d.setdefault("embed_type", "direct")
```

---

## Bug #3: No Domain-Level Rate Limiting (HIGH)

**Impact:** Dutchie.com likely rate-limits or blocks the scraper after N requests from the same IP, causing the remaining sites to get blank/error pages

All 111 Michigan Dutchie sites hit the same domain: `dutchie.com`. The scraper has per-platform concurrency (3 for dutchie) but no inter-request delay or domain-level throttling. This means:

- 111 sites / 3 concurrent = **37 sequential waves** to the same domain
- Each wave starts 3 new browser contexts simultaneously to `dutchie.com`
- All requests come from the same IP (GitHub Actions runner)
- No randomization of request timing, user agent, or session cookies

Dutchie's WAF/bot detection likely identifies this pattern and starts returning blank or error pages after the first few successful requests. This explains why only 6 of 111 sites returned products — the first few requests succeed before rate limiting kicks in.

**Evidence:** The 6 successful sites span 3 different chains (King of Budz, Lume, Skymint), so the failure isn't chain-specific. The scrape completed in 41 minutes (not 6+ hours), meaning most sites completed quickly (got blank pages fast) rather than timing out.

**Fix:**
1. Add 2-5s random delay between requests to the same domain
2. Consider using `dutchie.com/embedded-menu/{slug}/specials` URLs as fallbacks (these may have different rate limiting)
3. Rotate User-Agent strings per session
4. For production scale, consider proxy rotation

---

## Bug #4: Zen Leaf Platform Mismatch (LOW)

**File:** `config/dispensaries.py:845`
**Impact:** Zen Leaf Buchanan gets the wrong scraper entirely

Zen Leaf Buchanan (`zenleafdispensaries.com`) is tagged `platform: "curaleaf"` but uses Verano's custom website, not Curaleaf's. The Curaleaf scraper's redirect-based age gate handler expects `curaleaf.com/age-gate?returnurl=...` — Zen Leaf's site has an entirely different structure.

**Fix:** Either create a separate scraper for Zen Leaf sites, or tag it as a different platform (e.g., `"verano"` or `"zenleaf"`). At minimum, the Curaleaf scraper needs to handle non-curaleaf.com domains gracefully.

---

## Structural Observations

### Silent Failure Pattern

105 of 113 "successful" sites returned 0 products but were logged as `"site may be down or blocked"`. This message masks the actual failure mode:
- It could be rate limiting (Bot #3)
- It could be iframe detection timeout (Bug #2)
- It could be age gate failure
- It could be the site genuinely being down

The summary should differentiate between these cases. The debug screenshot infrastructure exists (`save_debug_info`) but the summary generation doesn't surface the failure reason.

### Category Distribution Crisis

Only vapes met their minimum (13/12). All other categories are critically under:

| Category | Actual | Minimum | Target | Status |
|----------|--------|---------|--------|--------|
| flower | 5 | 15 | 60 | UNDER MIN |
| vape | 13 | 12 | 50 | Met minimum |
| edible | 5 | 8 | 30 | UNDER MIN |
| concentrate | 4 | 8 | 30 | UNDER MIN |
| preroll | 4 | 5 | 20 | UNDER MIN |

This is a direct consequence of only 6 sites returning products — there simply isn't enough inventory to fill category quotas.

### Brand Concentration

Only 6 brands appeared across all 33 deals. Lume dominated with 17 deals across 4 stores. With functioning scraping, Michigan's brand diversity should be much higher (Michigan has 100+ cannabis brands across its dispensary market).

---

## Recommended Fix Priority

| Priority | Bug | Effort | Expected Impact |
|----------|-----|--------|-----------------|
| P0 | #1 Curaleaf Nevada hardcode | Small (1 function) | +3 sites, +150-300 products |
| P0 | #2 Dutchie embed_type | Small (1 line or config) | +60-80 sites, +1000+ products |
| P1 | #3 Domain rate limiting | Medium (add delays) | +20-40 additional sites |
| P2 | #4 Zen Leaf platform | Small (config change) | +1 site |

Fixing bugs #1 and #2 alone should bring the yield rate from 5% to 60%+.

---

## Test Coverage

Diagnostic tests are in `tests/test_michigan_diagnostic.py` (22 tests):

- **17 pass** — confirming bugs exist in the current code
- **5 intentionally fail** — documenting the broken state; will pass once bugs are fixed

Run: `python -m pytest tests/test_michigan_diagnostic.py -v`

The 5 failing tests serve as regression gates:
1. `test_iframe_detection_timeout_budget` — iframe cascade wastes 55% of site timeout (>30% budget)
2. `test_dutchie_concurrent_cap_vs_site_count` — 37 waves to same domain exceeds 20-wave limit
3. `test_yield_rate_is_unacceptable` — 5.3% yield rate below 60% target
4. `test_category_minimums_met` — 4 of 5 categories under minimum
5. `test_dutchie_direct_urls_should_use_direct_embed_type` — embed_type is "iframe" not "direct"
