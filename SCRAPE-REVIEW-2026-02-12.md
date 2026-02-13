# Scrape Review — Feb 12, 2026

## Headline Numbers

| Metric             | Today   | Target  | Gap     |
|--------------------|---------|---------|---------|
| Sites OK           | 36/44   | 44/44   | 82%     |
| Products scraped   | 5,951   | ~8,000+ | -25%    |
| Deals selected     | 136     | 200     | **-32%**|
| Flower             | 55/60   |         | -8%     |
| Vape               | 41/50   |         | -18%    |
| Edible             | 9/30    |         | **-70%**|
| Concentrate        | 14/30   |         | **-53%**|
| Preroll            | 5/20    |         | **-75%**|
| Runtime            | 62.4min | <30min  | 2x slow |
| Cut deals (unused) | 191     | —       | Waste   |

---

## P0 — Ship-Blocking / Data Is Wrong

### P0.1: Diversity caps prevent reaching 200 deals (136 today)
327 deals pass quality gate but only 136 get selected. 64 empty slots.
`MAX_SAME_BRAND_TOTAL = 5` is the biggest blocker — STIIIZY alone has 19
qualifying deals, 14 get cut. Top cut deal scored **100 pts** (Wyld gummies
at TD-Decatur).

**Fix options:**
- (a) Dynamic caps: if total selected < TARGET × 0.85, relax
  `MAX_SAME_BRAND_TOTAL` to 8 and `MAX_SAME_DISPENSARY_TOTAL` to 15
- (b) Two-pass selection: fill to target first (relaxed caps), then trim if
  over-represented
- Recommended: option (a) — simplest, keeps diversity when supply is high

**Files:** `deal_detector.py:149-155`, `deal_detector.py:629-877`

### P0.2: ~~Zen Leaf~~ — REMOVED
Zen Leaf removed from scraper entirely. Unique menu structure (1g/3.5g/5g/7g
flowers all on one page) makes parsing unreliable, and low volume doesn't
justify the effort. 1,700 products scraped with 0 deals = not worth it.

### P0.3: Product name pollution (THC/promo text leaking)
Several product names contain THC content data and promotional text:
- `"Dreamberry 100mg THC: 101.52 mg\nLocal Love!"`
- `"Huckleberry 100mg Gummies THC: 108.8 mg"`
- `"Watermelon Lemonade Gummies THC: 101.7 mg\n2 For $3"`
- `"Kushberry - - Hippie Mints (SH)"`

These display directly on deal cards and look unprofessional.

**Fix:** Add post-parse name cleanup: strip `THC: \d+\.?\d* mg`, `CBD: ...`,
promotional lines (`Local Love!`, `2 For $X`), double dashes, strain type
codes `(SH)/(I)/(S)/(H)`.

**Files:** `parser.py` or `clouded_logic.py` (product name normalization)

---

## P1 — High-Impact Site Failures

### P1.1: Planet 13 — timeout (no embed_type hint)
Planet 13 is the #1 Vegas dispensary (tourist + local). No `embed_type` hint
means it tries iframe detection (45s) before JS embed (60s), burning 105s
before finding content. Likely times out in the smart-wait phase.

**Fix:** Add `"embed_type": "js_embed"` or `"embed_type": "iframe"` to Planet 13
config after manual investigation of which embed type the site actually uses.

**File:** `config/dispensaries.py:132-139`

### P1.2: SLV — config mismatch (says "direct", site uses iframe)
Logs show: "Last-resort: single iframe found — frame URL: goshango.com".
Config says `embed_type: "direct"` which skips iframe detection entirely.

**Fix:** Change `embed_type` from `"direct"` to remove it (auto-detect) or
set to `"iframe"`.

**File:** `config/dispensaries.py:539-549`

### P1.3: Mint Paradise — timeout (no embed_type hint)
URL contains `dtche%5Bpath%5D=specials` proving it's a Dutchie JS embed, but
config has no `embed_type` hint.

**Fix:** Add `"embed_type": "js_embed"` to config.

**File:** `config/dispensaries.py:172-179`

---

## P2 — Moderate-Impact Site Failures

### P2.1: Oasis Cannabis — Jane selector mismatch
Strip-location dispensary. Jane scraper's 13 product selectors don't match
Oasis's DOM structure. Needs manual DOM investigation.

**Fix:** Visit site, identify correct product container selectors, add to
Jane scraper's `_PRODUCT_SELECTORS`.

**Files:** `platforms/jane.py`, `config/dispensaries.py:287-294`

### P2.2: Beyond/Hello Sahara — Jane selector mismatch
Same issue as Oasis. Beyond/Hello Twain works (24 products) but Sahara
completely fails.

**Fix:** Same approach — DOM investigation for Sahara-specific selectors.

### P2.3: Nevada Made Laughlin — timeout (no embed_type hint)
Recently switched from AIQ to Dutchie. No `embed_type` hint.

**Fix:** Add `embed_type` hint based on what works for other Nevada Made
locations (Charleston/Henderson/Warm Springs all succeed — check their config).

**File:** `config/dispensaries.py:637-644`

---

## P3 — Category Fill Rate

### P3.1: Edibles severely underfilled (9/30 = 30%)
Only 2 dispensaries produced edible deals. The top CUT edible scored 100 pts
(Wyld at TD-Decatur) but was cut because the dispensary hit its 10-deal cap.
5 more cut edibles scored 84-90.

**Fix:** Three-pronged:
1. Fix P0.1 (dynamic caps) — immediately recovers 5+ edible deals from cut list
2. Verify edible category classification — some edibles may be misclassified as
   "other" (13 "other" deals is suspiciously high)
3. Consider lowering edible price cap from $15 to $18 for multi-dose products

### P3.2: Prerolls severely underfilled (5/20 = 25%)
Mostly a supply issue — few dispensaries run preroll specials. But 2 cut prerolls
scored 70-85 pts (STIIIZY Orange Crush at 85, Runtz at 70).

**Fix:**
1. Fix P0.1 recovers some prerolls
2. Consider including preroll packs again (currently excluded) with a higher
   price cap ($35 for packs)
3. Review preroll price cap ($10) — infused prerolls retail $15-20, so $10
   cap may be too tight

### P3.3: Concentrates underfilled (14/30 = 47%)
Curaleaf dominates concentrates but brand cap (5 total) limits them.
City Trees concentrates (84pts) cut because TD-Decatur hit dispensary cap.

**Fix:** P0.1 dynamic caps will recover 3-5 concentrate deals.

---

## P4 — Silent Failures (0 Products, No Error)

### P4.1: Greenlight Downtown + Paradise — 0 products
Dutchie sites with no `embed_type` hint. Likely timing out during embed
detection cascade.

**Fix:** Add `embed_type` hints to both. Investigate if their specials pages
actually have products or are just empty.

### P4.2: Jade Desert Inn — 0 products
Same issue — no `embed_type` hint. Sky Pointe location (same chain) works
with 25 products.

**Fix:** Mirror Sky Pointe config approach.

### P4.3: TD Eastern + TD Gibson — 0 products
These HAVE `embed_type: "js_embed"` hints, so the issue isn't detection.
Likely their specials pages are genuinely empty today, or the age gate
wasn't dismissed.

**Fix:** Verify manually. If empty specials pages, consider scraping main
menu instead and relying on price comparison to find deals.

### P4.4: The Grove, Exhale, The Source — 0 products
Three different issues: Grove is Dutchie (no hint), Exhale/Source are Jane
(may be down or DOM changed).

**Fix:** Investigate each individually. Lower priority since they're
historically unreliable.

---

## P5 — Jane Brand Detection Gaps

### P5.1: Beyond/Hello Twain — 24 products, 0 deals (no brands)
Jane loose qualification requires brand detection. All 24 products have no
brand, so all fail immediately.

### P5.2: Deep Roots Harvest — 4 locations, 15 products each, 0 deals
Same issue: `hybrid_strategy: True` flag suggests custom DOM, but brand
extraction doesn't work for it.

### P5.3: The Sanctuary — 25 products, 0 deals (no brands)
Same pattern — products scraped but brand not extracted.

**Fix for all P5:** Improve Jane brand extraction. Options:
- Parse brand from product name using the 200+ brand database in
  `clouded_logic.py`
- Add Jane-specific brand extraction selectors per DOM variant
- Fall back to name-based brand matching when DOM extraction fails

**Files:** `platforms/jane.py` (extraction), `clouded_logic.py` (brand DB)

---

## P6 — Data Quality / Display

### P6.1: 0% discount deals showing in feed
`"Sip — Citrus Spark [52ml] | $10 (was $10, 0% off)"` and
`"Cookies — Headband | $8 (was $8, 0% off)"` — these pass through Jane loose
qualification which skips discount checks.

**Fix:** Add a minimum price attractiveness check for Jane products: if
`sale_price >= original_price`, reject (when original price is available).
Or add a flag in the display layer to suppress "0% off" badge.

### P6.2: "Other" category over-filled (13 vs 10 target)
13 deals classified as "other" while real categories are underfilled.
Some may be misclassified edibles, concentrates, or vapes.

**Fix:** Audit the 13 "other" deals. Common miscategorizations:
- Tinctures → should be "edible"
- Topicals → may be "other" legitimately
- RSO syringes → should be "concentrate"
- Beverages → should be "edible"

**Files:** `product_classifier.py`

### P6.3: Truncated/junk product names in display
`"Mini Motivator Infused Confidential Kush Minis (3-"` — truncated
`"Kushberry - - Hippie Mints (SH)"` — double dash, strain code

**Fix:** Name cleanup pass (overlaps with P0.3).

---

## P7 — Performance

### P7.1: Runtime 62.4 min (target: <30 min)
Primary cause: 8 sites failing after 2 attempts × 600s timeout = 9,600s of
wasted time. Each failure burns 1,200s (2 × 600s).

**Fix:**
1. Fix the 8 failing sites (P1/P2) — eliminates wasted timeout cycles
2. Add `embed_type` hints to all unhinted Dutchie sites — saves 45-60s per
   site on the detection cascade
3. Consider reducing `SITE_TIMEOUT_SEC` from 600 to 300 for the second
   attempt (if first attempt times out, second is unlikely to succeed with
   the same timeout)

### P7.2: Unhinted Dutchie sites waste time on detection cascade
planet13, medizin, greenlight-downtown, greenlight-paradise, the-grove,
treehouse, jade-desert-inn, jade-sky-pointe, mint-paradise, mint-rainbow,
nevada-made-casino-dr — 11 Dutchie sites without `embed_type` hints.

**Fix:** Audit each and add correct `embed_type` to config.

---

## P8 — Tree of Life (Low-Impact New Sites)

### P8.1: Tree of Life Jones + Centennial — Jane selector mismatch
Phase 1 additions that have never successfully scraped. Low-priority because
they're single-location dispensaries with limited product range.

**Fix:** DOM investigation + add correct selectors.

---

## P9 — Strategic / Future

### P9.1: Rise platform — 9 sites blocked by Cloudflare Turnstile
Rise + Cookies = 9 dispensaries (~6,500 products historically) completely
offline. No short-term fix available for Cloudflare bot protection.

**Options:**
- Monitor for API endpoints or data feeds
- Explore residential proxy + browser fingerprinting (complex)
- Check if Rise has a mobile app with an API that can be reverse-engineered
- Wait for Rise to change their tech stack

### P9.2: Scoring fairness — Jane baseline (15pts) may be too low
Jane products get a flat 15pt baseline in lieu of discount depth + dollars
saved (max 45pts). This means the theoretical max for a Jane product is ~70
vs ~100 for Dutchie/Curaleaf. Jane deals are systematically under-ranked.

**Fix:** Consider raising Jane baseline to 20-25 or applying a multiplier
to compensate.

### P9.3: Carrot + AIQ platforms not in daily cron
6 Carrot + 3 AIQ sites run on "new" platform group (manual trigger only).
These could add 30-50 deals to help fill category gaps.

**Fix:** Move to "stable" group after validating reliability over 5+
consecutive manual runs.

---

## Summary: Quick Wins vs Deep Fixes

### Quick wins (config changes, no code):
- P1.1: Add embed_type to planet13
- P1.2: Fix SLV embed_type
- P1.3: Add embed_type to mint-paradise
- P2.3: Add embed_type to nevada-made-casino-dr
- P4.1-P4.2: Add embed_type to Greenlight, Jade
- P7.2: Audit and hint all Dutchie sites

### Code changes needed:
- P0.1: Dynamic diversity caps in deal_detector.py
- ~~P0.2: Zen Leaf — REMOVED from scraper~~
- P0.3: Product name cleanup in parser.py
- P3.1-P3.3: Category rebalancing in deal_detector.py
- P5.1-P5.3: Jane brand detection in jane.py
- P6.1: 0% discount filtering

### Requires investigation:
- P2.1: Oasis DOM analysis
- P2.2: Beyond/Hello Sahara DOM analysis
- P4.3: TD Eastern/Gibson empty specials
- P6.2: "Other" category audit
- P8.1: Tree of Life DOM analysis
