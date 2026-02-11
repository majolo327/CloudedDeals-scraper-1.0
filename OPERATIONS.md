# CloudedDeals Scraper — Operations Guide

*Last updated: Feb 2026 | Pre-seed stage*

---

## What This Is

A web scraper that visits 61 cannabis dispensary websites across Southern Nevada every morning, extracts their menus and pricing, detects deals worth showing users, scores them, and pushes the top 200 to our Supabase database. The frontend reads from that database.

It runs as a GitHub Actions cron job. No servers to maintain.

---

## Coverage

**61 active dispensaries** across 6 menu platforms:

| Platform | Sites | Status | Examples |
|----------|-------|--------|----------|
| **Dutchie** | 16 | Stable (daily cron) | Planet 13, Medizin, TD, Greenlight, The Grove, Mint, Jade, Sahara, Treehouse, SLV |
| **Curaleaf** | 6 | Stable (daily cron) | Curaleaf Western/Strip/NLV/Reef, Zen Leaf Flamingo/NLV |
| **Jane** | 19 | Stable (daily cron) | Oasis, Deep Roots, Cultivate, Thrive, Beyond/Hello, Exhale, Tree of Life, Sanctuary, The Source |
| **Rise** | 9 | New (manual trigger) | Rise x6, Cookies Strip, Cookies Flamingo, Rise Henderson |
| **Carrot** | 6 | New (manual trigger) | Wallflower, Inyo, Jenny's, Euphoria, Silver Sage, ShowGrow |
| **AIQ** | 5 | New (manual trigger) | Green NV, Pisos, Jardin, Nevada Made Casino Dr/Charleston |

Plus 2 inactive AIQ sites (Nevada Made Henderson/Warm Springs — returning 403s).

**Not covered:** Top Notch (Weedmaps — different ecosystem entirely).

---

## How It Runs

### Daily Automatic (Stable Group)
- **When:** 8:00 AM Pacific, every day
- **What runs:** Dutchie + Curaleaf + Jane = 41 dispensaries
- **Duration:** ~30-60 min depending on site response times
- **Where:** GitHub Actions (`.github/workflows/scrape.yml`)
- **Cost:** Free tier GitHub Actions minutes

### Manual Trigger (New Platforms or Full Run)
Go to GitHub repo > **Actions** tab > **Daily Scraper** > **Run workflow**:

| Input | Options | What it does |
|-------|---------|--------------|
| **Platform group** | `all` / `stable` / `new` | Which dispensaries to scrape |
| **Dry run** | true/false | Scrape but don't write to DB (for testing) |
| **Limited** | true/false | Only 1 site per platform (quick smoke test) |
| **Single site** | slug like `td-gibson` | Scrape just one site |

**Key rule:** Stable and New groups don't interfere with each other. Running "stable" won't delete yesterday's "new" data. They can even run simultaneously.

### Typical Morning Workflow
1. 8 AM — Stable cron fires automatically (Dutchie/Curaleaf/Jane)
2. ~9 AM — Check if it succeeded (Actions tab, green check)
3. When ready — Manually trigger "new" group (Rise/Carrot/AIQ)
4. Both groups' data coexists in the DB

---

## What Happens Under the Hood

```
For each dispensary:
  1. Open headless Chrome browser
  2. Navigate to menu page
  3. Dismiss age verification gate
  4. Wait for menu to load (JS-heavy SPAs)
  5. Paginate through all pages / click "Load More"
  6. Extract every product: name, brand, price, original price, weight, THC%
  7. Clean & validate (strip junk, fix weights, detect category)
  8. Score deals (discount %, brand premium, category weight)
  9. Upsert to products table in Supabase
  10. Select top 200 deals for the deals table
```

**Concurrency:** 4 sites scraped at once (shared browser, separate sessions).
**Retries:** Each site gets 2 retry attempts with 5s delay.
**Timeout:** 10 min max per site, 90 min max for entire run.

---

## Deal Scoring Rules

### What qualifies as a deal
- Minimum **15% discount** from original price (relaxed from 20%)
- Price between **$3 and $100** (raised from $80 for oz flower + concentrates)
- Maximum 85% discount (above = data error)
- Must have an original price to compare against
- **Weight-based category price caps** (see below)

### Category price caps (maximum sale price to qualify)

| Category | Cap |
|----------|-----|
| **Flower** | $25 (3.5g), $45 (7g), $65 (14g), $100 (28g) |
| **Concentrate** | $25 (0.5g), $45 (1g), $75 (2g) |
| **Vape** | $35 |
| **Edible** | $15 |
| **Pre-roll** | $10 single, $25 multi-pack |

### How deals are scored (0-100)
- **Base:** `(discount% - 15) * 2` — so 50% off = 70 points
- **Brand boost:** +8 for known brands (STIIIZY, Cookies, MPX, etc.)
- **Category boost:** Flower/Vape/Edible +8, Concentrate/Pre-roll +7
- **Price sweet-spot bonus:** +15 for deals under $20
- **THC bonus:** +10 if THC% > 25

### Top 200 selection
Stratified by category to ensure variety:
- Flower: 60 slots
- Vape: 50 slots
- Edible: 30 slots
- Concentrate: 30 slots
- Pre-roll: 20 slots
- Max 2 products per brand per category per dispensary (prevents one store dominating)

---

## Database Tables

| Table | Purpose | Key fields |
|-------|---------|------------|
| `dispensaries` | All 63 sites (61 active) | slug, name, url, platform, is_active |
| `products` | Every scraped product | dispensary_id, name, brand, category, sale_price, original_price, discount_percent, deal_score, is_active, scraped_at |
| `deals` | Top 200 qualifying deals | product_id, dispensary_id, deal_score |
| `scrape_runs` | Audit trail per run | status, platform_group, total_products, qualifying_deals, runtime_seconds |

**Data lifecycle:** Each morning, yesterday's products from the running group get marked `is_active=false`, then fresh data comes in as `is_active=true`. The frontend only shows active products.

---

## File Map (what lives where)

```
clouded-deals/scraper/
  main.py                    # Orchestrator — runs everything
  clouded_logic.py           # Product parsing & validation rules
  deal_detector.py           # Deal scoring & top-200 selection
  product_classifier.py      # Infused/pack detection
  parser.py                  # Price/weight/THC extraction
  config/dispensaries.py     # All 61 site configs + platform groups
  platforms/
    dutchie.py               # Dutchie scraper (iframe/JS embed)
    curaleaf.py              # Curaleaf + Zen Leaf scraper
    jane.py                  # Jane scraper (hybrid iframe/direct)
    rise.py                  # Rise/GTI scraper (Next.js SPA)
    carrot.py                # Carrot scraper (JS widget)
    aiq.py                   # Alpine IQ / Dispense scraper
  handlers/
    age_verification.py      # Universal age gate dismissal
    iframe.py                # Iframe & JS-embed detection
    pagination.py            # Page navigation (arrows, load-more)
  tests/                     # 583 unit tests (pure logic, no network)

.github/workflows/
  scrape.yml                 # Daily cron + manual dispatch
  recon.yml                  # Platform detection for new sites
  debug.yml                  # DB health check
```

---

## Environment Variables

Set as GitHub Actions secrets:

| Secret | What |
|--------|------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role key (full DB access) |

These are the only two secrets. Everything else is configured in code.

---

## Adding a New Dispensary

If the site uses an existing platform (Dutchie, Curaleaf, Jane, Rise, Carrot, AIQ):

1. Add entry to `config/dispensaries.py` in the appropriate platform section
2. Set `is_active: True`, provide the menu URL, pick a unique slug
3. Run tests: `pytest tests/` from `clouded-deals/scraper/`
4. Commit and push — it'll be picked up on the next scrape run

If the site uses a new platform: a new scraper needs to be built in `platforms/`.

---

## Promoting "New" to "Stable"

Once Rise/Carrot/AIQ scrapers prove reliable over a few weeks:

1. Edit `config/dispensaries.py` — move platform names from `"new"` to `"stable"` list:
   ```python
   PLATFORM_GROUPS = {
       "stable": ["dutchie", "curaleaf", "jane", "rise"],  # added rise
       "new": ["carrot", "aiq"],                            # removed rise
   }
   ```
2. Commit and push. The daily cron will now include Rise automatically.

---

## Monitoring & Debugging

### Check if today's scrape succeeded
GitHub repo > Actions tab > look for green check on "Daily Scraper"

### Check what was scraped
Query `scrape_runs` in Supabase:
```sql
SELECT * FROM scrape_runs ORDER BY started_at DESC LIMIT 5;
```

### Check product counts by dispensary
```sql
SELECT dispensary_id, count(*)
FROM products
WHERE is_active = true
GROUP BY dispensary_id
ORDER BY count DESC;
```

### A site is returning 0 products
1. Check the debug screenshots artifact in the failed Actions run
2. Common causes: site redesign, new age gate, platform migration
3. Quick fix: try the `single_site` manual dispatch to re-run just that site

### Recon a new or changed site
Actions > **Recon** workflow > Run with filter (e.g., site name)
This takes screenshots and detects what platform the site uses.

---

## Known Limitations & Edge Cases

- **SLV** has a double age gate and runs on Treez (not Dutchie) — classified as Dutchie direct as a best-effort. May need its own scraper if it breaks.
- **Nevada Made Henderson/Warm Springs** return HTTP 403 (bot-blocked). Marked inactive.
- **Top Notch** uses Weedmaps — completely different ecosystem, not implemented.
- **Cannabis sites block non-browser requests** — all scraping requires a real headless browser. No API shortcuts.
- **Product counts vary** — Rise loads ~720 products per location, Carrot only ~50-60. Green NV (AIQ) has 628.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Scraping | Python 3.11 + Playwright (headless Chromium) |
| Database | Supabase (PostgreSQL) |
| CI/CD | GitHub Actions |
| Frontend | Next.js 14 (separate repo concern) |
| Hosting | None needed — serverless via GitHub Actions |

**Dependencies** (3 total): `playwright`, `supabase`, `python-dotenv`

---

## Frontend Deal Display

### Two View Modes (Grid + Swipe)

Users toggle between modes via a small icon toggle next to the deal count header. Choice persists in localStorage (`clouded_view_mode`).

**Grid mode** (default): 12-card grid (2 cols mobile, 3 cols desktop). Each card has a heart button (save) and an X button (dismiss). Dismissing a card slides in the next from the shuffled deck. Progress bar appears after first dismiss.

**Swipe mode**: Tinder-style card stack. Top card is interactive — swipe right to save, left to pass, tap for details. Action buttons below the stack for non-swipe users. Same deck state as grid (dismissals sync between modes).

### Curated Shuffle Algorithm

Deals are NOT shown in raw database order. `curatedShuffle.ts` applies:

1. **Tier classification** by deal_score: Tier 1 (>=75, "steals"), Tier 2 (40-74, "solid"), Tier 3 (<40, "discovery")
2. **Target ratios**: 40% Tier 1, 45% Tier 2, 15% Tier 3
3. **Diversity constraints**: no back-to-back same brand, max 3 same category, max 2 same dispensary
4. **Seeded PRNG** (mulberry32): deterministic for the same user + date, fresh shuffle each day

When the user uses a custom sort (price, discount, distance), the shuffle is disabled and the deck preserves the sorted order.

### Deck System (`useDeck.ts`)

- **VISIBLE_COUNT = 12** for grid mode
- Dismissed deal IDs stored in localStorage (`clouded_dismissed_v1`), auto-resets daily
- `dismissDeal()` plays a 300ms animation then swaps (grid mode)
- `dismissImmediate()` swaps instantly (swipe mode — SwipeableCard handles its own animation)
- `remaining` exposes the full undismissed queue for the stack view
- `isComplete` triggers end-of-deck message when all deals reviewed

### Gamification Features

| Feature | File | How it works |
|---------|------|-------------|
| Daily streaks | `useStreak.ts` | Consecutive visit days, milestones at 3/7/14/30 |
| Milestone toasts | `page.tsx` | 1st save, 3rd save, 10th save, explorer, brand fan |
| Brand affinity | `useBrandAffinity.ts` | Tracks which brands users save most |
| Challenges | `useChallenges.ts` | "Save by category", "unique dispensaries", etc. |
| Personalization | `personalization.ts` | Scores deals 0-100 based on user preference model |

### FTUE (First-Time User Experience)

1. **Splash** — value prop + deal count
2. **Preferences** — pick favorite categories
3. **Location** — zip code or geolocation
4. **Coach marks** — 6-step overlay spotlighting: deal card, save button, view toggle, filters, search, closing message

Coach marks use `data-coach` attributes on elements for targeting. State stored in `clouded_coach_marks_seen`.

### Key Frontend localStorage Keys

| Key | Purpose | Reset |
|-----|---------|-------|
| `clouded_dismissed_v1` | Dismissed deal IDs | Daily |
| `clouded_saved_v1` | Saved deal IDs | Never |
| `clouded_view_mode` | Grid or stack preference | Never |
| `clouded_filters_v1` | Filter/sort state | Never |
| `clouded_streak` | Visit streak counter | Never |
| `clouded_ftue_completed` | FTUE done flag | Never |
| `clouded_coach_marks_seen` | Coach marks done flag | Never |

---

## Changelog

### Feb 10, 2026 — Concentrate Detection Overhaul + Major Platform Expansion

**Problem:** Morning scrape surfaced only 1 concentrate deal in the main feed, despite many being available in search. Concentrates were being misclassified or filtered out before reaching users.

**Root causes found and fixed:**

1. **Weight-based concentrate price caps** (`deal_detector.py`)
   - Old: flat $35 cap for all concentrates — excluded most real deals (live resin/diamonds commonly $40+)
   - New: $25 (0.5g), $45 (1g), $75 (2g) — matches actual LV dispensary pricing

2. **Bundle/offer text contaminating category detection** (`main.py`, `clouded_logic.py`)
   - Promo text like "3/$60 1g Carts & Wax" was triggering vape classification for concentrate products
   - Fix: category detection now runs on product name only; offer/bundle text is stripped before classification

3. **Brand names leaking from bundle text** (`main.py`)
   - Dutchie "Special Offers" listing multiple brands (e.g. "KYND Flower & HAZE Live Resin") could assign the wrong brand
   - Fix: brand detected from product name first (highest confidence), falls back to raw text with offer sections stripped

4. **Category detection order** (`clouded_logic.py`)
   - "Shatter," "budder," and other concentrate keywords were checked after vape keywords, causing misclassification
   - Fix: concentrate check now guards against vape keywords (cart, pod, disposable) — "Live Resin Cart 0.5g" = vape, "Live Resin 1g" = concentrate

**Other improvements shipped same day (74 commits):**

- Expanded from 27 to **61 active dispensaries** (added Rise, Carrot, AIQ platforms)
- Added **Tinder-style swipe mode** (grid/swipe toggle)
- Added **universal search** across all active products
- Added **dispensary alias map** + new brand entries (Cannalean, Cheeba Chews)
- Shifted scraper cron 1 hour earlier to hit 7:45-8:15 AM PT window
- Added Terms of Service and Privacy Policy pages
- Added anti-regression metrics system + CI health endpoint
- 583 unit tests passing (up from 421)

---

## What's Next

### Short-term (prove new platforms)
- [ ] Run "new" group manually for 1-2 weeks, check data quality
- [ ] Monitor Rise (9 sites), Carrot (6 sites), AIQ (5 sites) for failures
- [ ] Promote to stable once reliable
- [ ] Investigate SLV — may need Treez-specific scraper if Dutchie fallback fails

### Short-term (inner circle beta)
- [ ] Recruit 10-20 inner circle testers (cannabis-savvy, deal-conscious locals)
- [ ] Monitor analytics dashboard for engagement signals (save rate, return visits, deal clicks)
- [ ] Collect qualitative feedback via in-app feedback widget + direct conversations
- [ ] Track VIP waitlist signups via SMS banner

### Medium-term (coverage & quality)
- [ ] Nevada Made Henderson/Warm Springs — retry periodically, may come back online
- [ ] Top Notch (Weedmaps) — evaluate if worth building a 7th scraper
- [ ] Add more dispensaries as new ones open in the market
- [ ] Tune deal scoring weights based on user engagement data
- [x] Add `og:image` for social share previews (shipped Feb 10)

### Longer-term (scale)
- [ ] Expand beyond Southern Nevada (Reno, other states)
- [ ] Add price history tracking (track trends over time)
- [ ] Alert system for exceptional deals (Slack/email notification)
- [ ] Frontend search/filter improvements based on richer product data

---

## Q2 2026 Upgrade Plan (Target: April 1 Build Start)

*Planned during inner circle beta (Feb–Mar 2026). Build after 6-7 weeks of real user testing data.*

### Upgrade 1: LLM Classification Fallback (The Invisible Brain)

**Goal:** Replace 500+ lines of brittle regex with a cheap API call that classifies ambiguous products correctly — brand, category, weight, strain — without users ever knowing AI is involved.

**Why:** The scraper currently misclassifies or rejects ~15-20% of products daily (~200-300 deals). Users experience this as "not enough concentrate deals" or "where's [brand]?" The root cause is hardcoded rules that can't handle new brands, weird product names, or edge-case formatting.

**How it works:**

```
For each scraped product:
  1. Run existing regex classification (fast, free, works for ~80% of products)
  2. If regex returns confident result → use it (no API call)
  3. If regex fails or returns low confidence → send to Claude Haiku API:

     Prompt: "Classify this Las Vegas dispensary product. Return JSON.
              Name: {name}, Price: ${sale_price}, Original: ${original_price},
              Page category: {raw_category}, Dispensary: {dispensary_name}"

     Response: {"brand": "City Trees", "category": "concentrate",
                "weight": "1g", "strain": "Gary Peyton", "subtype": "badder"}

  4. Merge API result with regex result (API wins on conflicts)
  5. Cache results by product name hash (same product name = same classification)
```

**What this replaces:**

| Current (regex) | Problem | LLM fix |
|-----------------|---------|---------|
| 200+ hardcoded brand entries in `clouded_logic.py` | New brands not recognized (Solventless Labs, etc.) | Haiku knows brands from training data, no list maintenance |
| 15-step category keyword chain | "Live Resin Cart" vs "Live Resin 1g" edge cases | Understands product context, not just keywords |
| Weight inference from keywords only | "Pod" = 0.5g? "Disposable" = 0.3g or 1g? | Infers from product name + price + dispensary norms |
| Quality gate rejects unknown brands | House brands, new brands = rejected | Recognizes "Greenhouse Smalls" as house flower, "CT" as City Trees |
| Two inconsistent brand lists (`clouded_logic.py` + `parser.py`) | Maintenance debt, drift | Single source of truth (the LLM) |

**Architecture:**

```
clouded_logic.py (existing)
  ├── detect_brand()     → regex first, Haiku fallback
  ├── detect_category()  → regex first, Haiku fallback
  └── validate_weight()  → regex first, Haiku fallback

New file: llm_classifier.py
  ├── classify_product(name, price, raw_category, dispensary) → dict
  ├── _build_prompt(product_data) → str
  ├── _parse_response(raw_json) → ClassificationResult
  └── _cache_lookup(name_hash) → ClassificationResult | None
```

**Key implementation details:**

- **Model:** Claude Haiku (fastest, cheapest — ~$0.001 per call)
- **Fallback only:** Regex handles ~80% of products. LLM only called for the ~20% that regex can't confidently classify. Estimated ~2,400 API calls per morning scrape.
- **Cost:** ~$0.50-1.00/day, ~$15-30/month
- **Cache:** Hash product name → store classification result in Supabase. Same product name from same dispensary tomorrow = cache hit, no API call. Cache grows over time, API calls decrease.
- **Timeout/failure:** If Haiku API is down or slow (>3s), fall back to regex result. Never block the scrape.
- **No user-facing AI:** Zero UI changes. Users just see better deals.

**Confidence scoring (when to call the LLM):**

```python
# In clouded_logic.py, after regex classification:
confidence = 1.0
if brand is None: confidence -= 0.4        # Unknown brand
if category == 'other': confidence -= 0.3   # Fell through all rules
if weight is None and category in WEIGHT_REQUIRED: confidence -= 0.2
if price_seems_wrong(sale_price, category): confidence -= 0.1

if confidence < 0.7:
    llm_result = classify_product(name, price, raw_category, dispensary)
    # Merge: LLM wins on missing fields, regex wins if both present
```

**What to measure (proof it works):**

| Metric | Before LLM | Target after LLM |
|--------|-----------|-----------------|
| Products classified as "other" | ~5-10% | < 2% |
| Products rejected for "no brand" | ~5-10% | < 1% |
| Concentrate deals in Top 200 | 10-15 | 25-30 |
| Edible deals in Top 200 | 8-12 | 20-25 |
| Unique brands detected per scrape | ~80 | ~120+ |

**Files to modify:**

| File | Change |
|------|--------|
| `clouded_logic.py` | Add confidence scoring after regex, call LLM fallback |
| `deal_detector.py` | Relax quality gate — accept LLM-classified brands |
| `main.py` | Pass dispensary context to classification |
| **New:** `llm_classifier.py` | Haiku API client, prompt template, cache layer |
| `config/dispensaries.py` | No change |
| `.github/workflows/scrape.yml` | Add `ANTHROPIC_API_KEY` secret |

**Environment variables to add:**

| Secret | What |
|--------|------|
| `ANTHROPIC_API_KEY` | Claude API key for Haiku calls |

**Estimated build time:** 1-2 days

---

### Upgrade 2: Engagement Feedback Loop (Deals Get Better Every Week)

**Goal:** Track what users actually save, dismiss, click, and search for — then feed that signal back into deal scoring so the Top 200 self-improves weekly. No ML models, no training pipelines. Just SQL queries that adjust weights.

**Why:** Right now the scraper-to-user pipeline is one-way. The scraper doesn't know that STIIIZY gets saved 5x more than Remedy, or that your users skip preroll packs, or that Henderson users prefer different dispensaries. All scoring weights are hardcoded and never change.

**How it works:**

```
Weekly cron (Sunday night):
  1. Query: saves per brand (last 7 days) → brand_popularity table
  2. Query: saves per category → adjust Top 200 category targets
  3. Query: saves per dispensary → dispensary_trust_score
  4. Query: search terms with 0 results → surface unmet demand
  5. Write adjusted weights to a config table in Supabase
  6. Next morning's scrape reads from config table instead of hardcoded constants
```

**Three feedback signals:**

**Signal 1 — Brand heat (replaces static brand tiers)**

Current: `PREMIUM_BRANDS = ["STIIIZY", "Cookies", ...]` hardcoded, never changes.
After: Brand tier determined by actual user saves.

```sql
-- Materialized view: brand_popularity
SELECT
  brand,
  COUNT(*) as save_count_7d,
  COUNT(DISTINCT anon_id) as unique_savers,
  CASE
    WHEN COUNT(*) >= 20 THEN 'premium'    -- 20+ saves/week = premium
    WHEN COUNT(*) >= 5  THEN 'popular'    -- 5-19 saves/week = popular
    ELSE 'standard'
  END as tier
FROM analytics_events ae
JOIN products p ON ae.properties->>'deal_id' = p.id::text
WHERE ae.event_type = 'deal_saved'
  AND ae.created_at > NOW() - INTERVAL '7 days'
GROUP BY brand
ORDER BY save_count_7d DESC;
```

What changes in `deal_detector.py`:
```python
# Before (hardcoded):
BRAND_SCORE = {"premium": 20, "popular": 12, "standard": 5}

# After (reads from Supabase weekly):
brand_tiers = fetch_brand_popularity()  # Returns dict from materialized view
# STIIIZY: 47 saves → premium → 20pts
# City Trees: 12 saves → popular → 12pts
# New unknown brand: 0 saves → standard → 5pts
# Next week if unknown brand gets 8 saves → popular → 12pts (auto-promoted)
```

**Signal 2 — Category demand (replaces static Top 200 targets)**

Current: Flower always 60, Vape always 50, Concentrate always 30 — never adjusts.
After: Category slots proportional to user engagement.

```sql
-- Category save distribution
SELECT
  p.category,
  COUNT(*) as saves,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as pct
FROM analytics_events ae
JOIN products p ON ae.properties->>'deal_id' = p.id::text
WHERE ae.event_type = 'deal_saved'
  AND ae.created_at > NOW() - INTERVAL '14 days'
GROUP BY p.category;
```

Example output after 2 weeks of testing:
```
flower:      45% → 90 slots (was 60)
vape:        20% → 40 slots (was 50)
concentrate: 18% → 36 slots (was 30)
edible:      12% → 24 slots (was 30)
preroll:      5% → 10 slots (was 20)
```

Guard rails: No category below 10 slots, no category above 100. Prevents one category from completely dominating.

**Signal 3 — Dispensary trust (new scoring dimension)**

Current: All dispensaries scored equally.
After: Dispensaries with higher save rates get a small boost.

```sql
-- Dispensary engagement score
SELECT
  dispensary_id,
  COUNT(*) FILTER (WHERE event_type = 'deal_saved') as saves,
  COUNT(*) FILTER (WHERE event_type = 'get_deal_click') as clicks,
  ROUND(
    COUNT(*) FILTER (WHERE event_type = 'deal_saved') * 1.0 /
    NULLIF(COUNT(*) FILTER (WHERE event_type = 'deal_modal_open'), 0),
    3
  ) as save_rate
FROM analytics_events ae
JOIN products p ON ae.properties->>'deal_id' = p.id::text
WHERE ae.created_at > NOW() - INTERVAL '14 days'
GROUP BY dispensary_id
ORDER BY save_rate DESC;
```

What changes in `deal_detector.py`:
```python
# New: +0 to +5 dispensary trust bonus
# Top quartile dispensaries (highest save_rate): +5
# Second quartile: +3
# Third quartile: +1
# Bottom quartile: +0
```

**Bonus signal — Unmet demand (search misses)**

```sql
-- What are users searching for that returns 0 results?
SELECT
  properties->>'query' as search_term,
  COUNT(*) as search_count
FROM analytics_events
WHERE event_type = 'search_performed'
  AND (properties->>'result_count')::int = 0
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY search_term
ORDER BY search_count DESC
LIMIT 20;
```

This doesn't auto-fix anything — it tells you what brands/products users want that you're not surfacing. Manual review weekly. If "Solventless Labs" shows up 15 times with 0 results, you know to add it to the brand list (or let the LLM handle it if Upgrade 1 is live).

**Architecture:**

```
New file: feedback_loop.py
  ├── update_brand_popularity()     → writes to brand_popularity table
  ├── update_category_targets()     → writes to scoring_config table
  ├── update_dispensary_trust()     → writes to dispensary_trust table
  └── report_unmet_demand()         → writes to weekly_report table

Modified: deal_detector.py
  ├── load_scoring_config()         → reads from Supabase instead of constants
  ├── calculate_deal_score()        → uses dynamic brand tiers + dispensary trust
  └── select_top_deals()            → uses dynamic category targets

New workflow: .github/workflows/feedback.yml
  └── Runs Sunday 11 PM PT, before Monday morning scrape
```

**Supabase tables to add:**

| Table | Columns | Updated |
|-------|---------|---------|
| `brand_popularity` | brand, save_count_7d, unique_savers, tier | Weekly |
| `scoring_config` | category, target_slots, updated_at | Weekly |
| `dispensary_trust` | dispensary_id, save_rate, trust_tier, updated_at | Weekly |

**What to measure (proof it works):**

| Metric | Before feedback | Target after feedback |
|--------|----------------|---------------------|
| Day-1 return rate | Baseline from beta | +10-15% improvement |
| Saves per session | Baseline from beta | +20-30% improvement |
| "Nothing matches" filter results | Baseline | -50% reduction |
| Brand coverage (unique brands in Top 200) | ~40-50 | ~60-80 |

**Estimated build time:** 0.5-1 day (it's mostly SQL + a small Python script)

---

### Build Order (April 1 onwards)

| Week | What | Why this order |
|------|------|---------------|
| **Week 1 (Apr 1-4)** | Upgrade 2 — Feedback loop | Needs real data from 6 weeks of testing. Zero API cost. Immediate scoring improvement. |
| **Week 2 (Apr 7-11)** | Upgrade 1 — LLM classification | Feed loop tells us which brands/categories are being missed. LLM fixes them. |
| **Week 3 (Apr 14-18)** | Measure + tune | Compare Top 200 quality before/after. Adjust confidence threshold, brand tier cutoffs, category slot guard rails. |

**Total cost after both upgrades:** ~$15-30/month (Haiku API) + $0 (feedback loop is just SQL)

**Total user-facing changes:** Zero. No new buttons, no "AI" badge, no feature announcements. Deals just get noticeably better.

---

### Data We Need to Collect During Beta (Feb-Mar) for These Upgrades

The analytics system already tracks everything we need. Confirm these events are firing:

| Event | Used by | Already tracked? |
|-------|---------|-----------------|
| `deal_saved` with `deal_id` | Brand heat, category demand, dispensary trust | Yes (`analytics_events`) |
| `deal_dismissed` with `deal_id` | Negative signal (future use) | Yes |
| `deal_modal_open` with `deal_id` | Save rate denominator | Yes |
| `get_deal_click` with `deal_id` | Dispensary trust (click-through) | Yes |
| `search_performed` with `query` + `result_count` | Unmet demand | Yes |
| `filter_change` with categories/sort | Category preference signal | Yes |

No new instrumentation needed. Just run the beta, let users use the app naturally, and the data accumulates.
