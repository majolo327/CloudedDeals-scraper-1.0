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
| **Curaleaf** | 4 | Stable (daily cron) | Curaleaf Western/Strip/NLV/Reef |
| **Jane** | 19 | Stable (daily cron) | Oasis, Deep Roots, Cultivate, Thrive, Beyond/Hello, Exhale, Tree of Life, Sanctuary, The Source |
| **Rise** | 9 | **Disabled** (Cloudflare Turnstile) | Rise x6, Cookies Strip, Cookies Flamingo, Rise Henderson |
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
    curaleaf.py              # Curaleaf scraper
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

- **Rise (Green Thumb Industries) — disabled Feb 12, 2026.** GTI deployed Cloudflare Turnstile bot protection on their menu domain (`cdn-bong.risecannabis.com`), blocking headless browser access. All 9 Rise sites were disabled in `dispensaries.py:464-467`. Before Cloudflare, our `rise.py` scraper worked reliably — it handled the Next.js SPA hydration, extracted ~500-700 products per location, and was contributing ~4,500+ products per run. **Proven working strategies** before the block: Playwright `wait_until: "networkidle"` for SPA hydration, `networkidle` polling for dynamic content, JS-based product card extraction from hydrated React DOM. **Plan:** Revisit Rise after PMF + traction (2-3 months). Options at that point include residential proxy rotation, browser fingerprint evasion, or direct API integration if GTI opens one.
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

### Feb 12, 2026 — NOT_BRANDS Filter, Jane Loose Qualification, Enhanced Scrape Report

**Improvements to brand detection, category inference, Jane deal handling, and operator visibility.**

1. **NOT_BRANDS exclusion filter** (`parser.py`)
   - Added 30-word blocklist (colours, product types, strain types, promo terms) that are silently rejected from brand matching
   - Prevents false positives if generic words ever slip into KNOWN_BRANDS or fuzzy-match via variations

2. **Category keyword expansion** (`parser.py`)
   - Added `buds`, `popcorn` to flower; `pen` to vape
   - Added `infer_category_from_weight()` fallback when no keyword matches: mg→edible, g≥3.5→flower, g<3.5→concentrate, no weight→vape

3. **Jane loose deal qualification** (`deal_detector.py`, `jane.py`, `main.py`)
   - Jane sites do NOT display original prices — only the current/deal price
   - Standard hard filters (require 15% discount + original price) were rejecting ALL Jane products
   - Fix: Jane products now use loose qualification — price cap + known brand only, skipping discount checks
   - Jane deals get a flat 15-point scoring baseline (in lieu of discount depth) so they compete fairly
   - `source_platform` field now propagated through the full scrape pipeline

4. **Deep Roots hybrid_strategy flag** (`config/dispensaries.py`)
   - All 4 Deep Roots locations marked with `hybrid_strategy: True` for DOM-specific handling

5. **STRIP_DISPENSARIES constant** (`config/dispensaries.py`)
   - 11 Strip-area dispensary slugs tracked with `is_strip_dispensary()` helper — ready for frontend tourist/local filtering

6. **Age gate selector expansion** (`handlers/age_verification.py`)
   - Added `"I'm over 21"` variant for both button and link elements

7. **Enhanced scrape summary report** (`main.py`)
   - New `_log_scrape_summary()` prints a comprehensive plain-language report at end of each run
   - Per-dispensary breakdown: top deal per category, product count, deal count, zero-deal reasons
   - Brand leaderboard: which brands produced the most deals
   - Category distribution with slot fill rates
   - Top 5 cut deals that almost made it (helps tune scoring)
   - Sites with zero deals get explicit reasons (e.g., "0 products scraped", "all failed hard filters", "no brand detected")
   - Report piped to `$GITHUB_STEP_SUMMARY` in GitHub Actions for at-a-glance review

---

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

## What's Next — Full Roadmap

Everything below is sequenced deliberately. Each phase depends on the one before it. Don't skip ahead.

---

### Phase A: Prove It Works for Real People (Now — Next 4-6 Weeks)

This is the only thing that matters right now. Multi-state expansion, B2B, and ML work all mean nothing if Vegas users don't come back daily.

#### A1. Stabilize all 63 dispensaries on daily cron
- [ ] Run "new" group (Carrot/AIQ) manually for 1-2 weeks, check data quality
- [x] Rise (9 sites) — **disabled Feb 12, 2026** due to Cloudflare Turnstile. Revisit after PMF + traction (2-3 months)
- [ ] Monitor Carrot (6 sites), AIQ (5 sites) for failures
- [ ] Promote to stable once reliable — move platform names into `PLATFORM_GROUPS["stable"]`
- [ ] Investigate SLV — may need Treez-specific scraper if Dutchie fallback fails
- [ ] Nevada Made Henderson/Warm Springs — retry periodically, may come back online

More coverage in Vegas = better product = better retention. This is the cheapest win available.

#### A2. Get 15-25 inner circle testers actually using it daily
- [ ] Recruit cannabis-savvy locals who already shop deals — budtenders, daily consumers, r/vegastrees deal hunters, cannabis Twitter/X. People who currently check 3-4 dispensary sites every morning
- [ ] Give them the app. Don't explain it. If they need an explanation, the UX has a problem
- [ ] Collect qualitative feedback via in-app feedback widget + direct conversations
- [ ] Track VIP waitlist signups via SMS banner

#### A3. Track 3 numbers and nothing else
- [ ] **D1 → D7 retention**: Do people come back? If less than 30% return by day 7, the product has a problem
- [ ] **Save rate**: What % of users save at least 1 deal per session? If under 20%, the deals aren't resonating
- [ ] **Session frequency**: Are deal hunters checking daily? That's the core behavior we need

#### A4. Fix what testers say is broken — not what we think needs improving
- [ ] Testers will say the deals aren't good enough, or the categories are wrong, or they can't find their dispensary. Listen to that feedback. Don't build ML or expand to Michigan. Fix the core loop first
- [x] Add `og:image` for social share previews (shipped Feb 10)

**Phase A exit criteria:** 15+ active testers, 30%+ D7 retention, users sharing the app organically.

#### A5. Post-Beta Feature Releases (April — after hundreds of testers + data)
These features are fully built in the backend and ready to surface. Hold for post-PMF marketing push — release as "new features" once we have traction and are actively growing.

**Price History / Price Trends (Backend 100% / Frontend 0%)**
- Migration 025 creates `price_history` with daily price snapshots per product per dispensary
- Scraper already writes to it every run — data is accumulating silently
- Frontend has zero queries to this table today
- **When to release:** Once we have 30-60 days of price data and active users who would benefit from trend context
- **What to build:** "Price dropped" badges on deal cards, historical price chart in DealModal, "lowest we've seen" indicators, price trend arrows
- `lib/socialProof.ts` already has badge functions like `getSocialProofBadges()` scaffolded but never called — wire them up when ready

**Social Proof / Save Counts (Backend 100% / Frontend ~10%)**
- API already fetches `deal_save_counts` and maps them to `deal.save_count` on every page load
- `lib/socialProof.ts` has a complete system built: `getSaveCountText()`, `formatSaveCount()`, badges like "25 shoppers grabbed this", "trending" indicators
- None of it is rendered — the data is fetched, the functions exist, but no component calls them
- DealCard and DealModal both ignore `save_count`
- **When to release:** Once we have enough daily active users that save counts are meaningful (50+ DAU). Showing "2 people saved this" is worse than showing nothing — wait until numbers create real FOMO
- **What to build:** Social proof badges on DealCard (hot deal / trending), save count in DealModal, possibly "X people saved this today" as a feed-level signal

---

### Phase B: Prove the Value Prop with Data (Weeks 4-10)

Start this once testers are retained and engaged. Still Vegas-only.

#### B1. Track what people actually save and click
- [ ] Log every save, dismiss, search, filter action with anonymous user ID + timestamp
- [ ] This tells us which brands, categories, price points, and dispensaries our users care about
- [ ] This dataset is the foundation for scoring model tuning AND the future B2B pitch deck

#### B2. Tune deal scoring with real engagement data
- [ ] Overlay actual save/click rates onto deal scores to validate the scoring model
- [ ] A deal that scores 90 but nobody saves is a bad deal — the model is wrong
- [ ] A deal that scores 40 but everyone saves means the model is missing something
- [ ] Adjust brand boosts, category weights, and price sweet-spot thresholds based on real behavior

#### B3. Start price history tracking
- [ ] Log daily prices per product per dispensary (no UI needed — just collect the data in a `price_history` table)
- [ ] After 30 days of history: trend data for improving deal detection, showing brands/dispensaries their own pricing patterns, and training ML models later
- [ ] Schema: `(dispensary_id, product_name, brand, category, price, scraped_date)`

**Phase B exit criteria:** Engagement data flowing, scoring model tuned to user behavior, 30+ days of price history logged.

---

### Phase C: Multi-State Expansion (Weeks 8-16)

Only start once Vegas retention is solid (30%+ D7, growing user base, organic sharing). Full market research is complete — see `docs/research-michigan-illinois.md` and `docs/research-batch2-markets.md`.

#### C1. Michigan first (easiest expansion)
- [ ] Add `state` field to dispensaries table + DB migration
- [ ] Add state-specific price caps to `clouded_logic.py` (MI prices are 40-60% cheaper than NV)
- [ ] Add ~35-40 Michigan-native brands to brand DB (Platinum Vape, MKX, Lume, Skymint, Element, Michigrown, Redbud Roots, etc.)
- [ ] Wave 1: Detroit metro Dutchie sites (Lume, Skymint, JARS, Cloud Cannabis) — ~80 locations with existing `dutchie.py`
- [ ] Wave 2: Herbana, Joyology, High Profile, Pleasantrees, Pinnacle — ~30 locations
- [ ] Wave 3: Curaleaf MI — with existing `curaleaf.py`
- [ ] Wave 4: Jane independents (Nirvana Center, etc.) — ~50+ locations
- [ ] Target: ~170 MI dispensaries scraped with zero new scraper development

Why Michigan first: lowest US prices = deal-obsessed consumers, Dutchie dominant = our best scraper, 350+ addressable dispensaries Day 1, no aggressive bot protection.

#### C2. Illinois second (higher complexity, MSO-heavy)
- [ ] Add IL-specific price caps (IL is 30-50% MORE expensive than NV — current caps would filter out most products)
- [ ] Add ~30-40 IL brands (Revolution, Aeriz, Bedford Grow, Cresco sub-brands: High Supply, Mindy's, Good News)
- [ ] Map MSO brand families: Cresco→High Supply/Mindy's/Good News, GTI→Rhythm/Dogwalkers/Beboe, Verano→Encore/Avexia, Ascend→Ozone/Simply Herb
- [ ] Wave 1: Rise IL (10-12 locations) — existing `rise.py` works
- [ ] Wave 2: Curaleaf IL — with existing scrapers
- [ ] Wave 3: Ascend, Nature's Care, EarthMed, Cannabist (Dutchie) — ~20 locations
- [ ] Wave 4: Beyond/Hello, Verilife, Consume, Thrive IL (Jane) — ~15 locations
- [ ] Wave 5: Remaining Dutchie + Jane independents — ~30+ locations
- [ ] **Sunnyside scraper** (Cresco's 12-15 IL locations) — proprietary React SPA, needs `platforms/sunnyside.py`. This is IL's #1 MSO and the single largest platform gap
- [ ] Target: ~105 IL dispensaries (90 with existing scrapers + 15 with new Sunnyside scraper)

Why Illinois second: high prices = strong deal-seeking behavior, MSO-dominated = reusable patterns, but less price variance = harder to find item-level deals. Many IL dispensaries run store-wide daily specials rather than item-level markdowns — deal detection needs to adapt.

#### C3. Don't touch AZ/MO/NJ until MI+IL are stable and growing
- [ ] Research is complete and waiting in `docs/research-batch2-markets.md`
- [ ] When ready: Arizona first (87% platform overlap, same prices as NV, 170+ dispensaries)
- [ ] Then Missouri (fastest-growing market, 84% overlap, zero deal-aggregator competitors)
- [ ] Then New Jersey (NYC metro 20M+ pop, MSO-heavy = highest scraper reuse)

**Phase C exit criteria:** MI + IL scraping stable on daily cron, 250+ dispensaries across 3 states, brand DB covering all markets.

---

### Phase D: Build the B2B Foundation (Months 4-8)

Consumer product must be working first. B2B only cares about your audience size and engagement.

#### D1. Brand analytics dashboard (internal first)
- [ ] Use scrape data + user engagement data to build brand-level insights
- [ ] Example metrics: "STIIIZY carts at 30% off get 4x the save rate of full-price listings." "Cookies flower under $35 gets saved within 2 minutes of posting."
- [ ] Track per brand: average discount offered across dispensaries, frequency of deals, user save rate, dispensary coverage
- [ ] Build this for ourselves first to validate the insights are real and actionable

#### D2. Dispensary performance reporting
- [ ] "Your dispensary ranked #14 out of 63 in Las Vegas for deal engagement this week."
- [ ] "Your top-performing deal was X. Users saved it Y times."
- [ ] "You're underpriced on concentrates vs market average — consider featuring them."
- [ ] This is the pitch to dispensaries: "We send deal-hungry customers to your store. Here's the proof."

#### D3. Price history + market intelligence
- [ ] Surface 30/60/90-day price trends per product per dispensary per state
- [ ] Cross-dispensary price comparison: "This STIIIZY pod is $25 at TD Gibson but $35 at Planet 13 right now"
- [ ] Category-level market snapshots: "Average flower eighth price dropped 8% across Las Vegas this month"
- [ ] This data is extremely valuable to brands and dispensaries and does not exist anywhere else at this granularity

**Phase D exit criteria:** Internal brand dashboard operational, dispensary reporting prototype, 90+ days of price history data.

---

### Phase E: Initiate Revenue (Months 6-10)

Three revenue tiers, activated in order based on audience size and data depth.

#### Tier 1 — Dispensary Leads (free → paid)
- [ ] Track referral traffic: clicks on "Get Directions", menu link clicks, deal card → dispensary website
- [ ] Show dispensaries the referral data for free initially to build relationship
- [ ] Once referral volume is meaningful (50+ clicks/week to a dispensary), introduce premium placement or featured dispensary status
- [ ] Pricing model: free tier (standard listing) vs paid tier ($200-500/month for featured placement, priority in shuffle, branded dispensary card)

#### Tier 2 — Brand Intelligence (data product)
- [ ] Brands have zero cross-dispensary visibility into how their products perform at retail vs competitors
- [ ] Our scrape data shows: pricing, discount frequency, availability across dispensaries, and (with user data) consumer engagement per brand per market
- [ ] Package as SaaS dashboard: per-brand pricing analytics, competitive benchmarking, deal performance, market share estimates
- [ ] Pricing model: $500-2,000/month per brand depending on markets covered
- [ ] Target customers: brand marketing teams, sales reps, category managers

#### Tier 3 — Market Intelligence for MSOs (enterprise)
- [ ] Multi-state operators (Curaleaf, GTI, Cresco, Verano) want: "How are my stores pricing vs competitors in each market?" "Which of my brands are being discounted most?" "What's the deal landscape in Detroit vs Chicago?"
- [ ] We build this data passively through multi-state scraping. Package as quarterly market reports or live dashboard
- [ ] Pricing model: $5,000-20,000/month per MSO depending on scope
- [ ] Target customers: MSO strategy teams, pricing analysts, state-level operations leads

**Revenue activation criteria:** 5,000+ monthly active users across 2+ states, 90+ days of multi-state data, brand dashboard operational.

---

### Phase F: ML/LLM Layer (Months 6-12)

Only makes sense once multi-state scraping is producing real volume. Full technical spec in `docs/research-cross-market-synthesis.md`.

#### F1. Product description normalization (LLM)
- [ ] 50,000+ product texts per day across 6 states creates natural training corpus
- [ ] Input: raw menu text ("STIIIZY - Blue Dream - Live Resin Pod - 1g - $45 $32")
- [ ] Output: structured JSON `{brand, strain, category, subcategory, weight, original_price, sale_price}`
- [ ] Replaces regex-heavy parsing with LLM-powered extraction — more accurate, handles edge cases better, adapts to new formats automatically

#### F2. Personalized deal scoring
- [ ] User X saves concentrate deals at Curaleaf. User Y saves budget flower under $20. Scoring model becomes per-user
- [ ] Collaborative filtering: "Users who saved this deal also saved these"
- [ ] This is the moat — Weedmaps and Leafly can't do this because they don't track deal engagement at the individual level

#### F3. Price prediction + deal alerts
- [ ] "STIIIZY Live Resin Cart has been dropping in price at TD Gibson for 3 weeks. Likely to hit $25 this weekend."
- [ ] "Planet 13 runs 30% off concentrates every other Tuesday — next one predicted for Feb 18."
- [ ] This is the feature that makes consumers addicted AND that brands/dispensaries would pay to suppress or promote
- [ ] Requires 90+ days of price history data across multiple dispensaries

#### F4. Brand detection + category classification model
- [ ] Cross-state brand name variations create robust training data for fuzzy matching
- [ ] Strain-vs-brand disambiguation gets richer with multi-market context
- [ ] Subcategory granularity (live resin vs cured resin vs rosin vs hash rosin) improves with more data
- [ ] State-specific terminology handling (IL "FSHO", MI "cured badder")

**Phase F exit criteria:** LLM normalization pipeline in production, personalized scoring A/B tested, price prediction model trained on 90+ days of multi-state data.

---

### Phase G: Platform Domination + Scale (Months 10-18)

#### G1. Expand to all researched markets
- [ ] Arizona (87% platform overlap, tourist market like NV)
- [ ] Missouri (fastest-growing, zero competitors)
- [ ] New Jersey (NYC metro 20M+ population)
- [ ] Evaluate: Colorado (fragmented but huge), Ohio (maturing), Maryland (DC metro)
- [ ] Target: 1,200+ dispensaries across 6+ states

#### G2. Weedmaps embed scraper
- [ ] Single biggest platform gap across all expansion markets (~165 dispensaries)
- [ ] Unlocks Puff Cannabis (MI), Sticky Saguaro (AZ), Clovr (MO), and hundreds of independents
- [ ] Combined with Sunnyside scraper: raises total national coverage from 68% to ~78% of all licensed dispensaries

#### G3. Consumer network effects
- [ ] Users create accounts, save preferences, build deal history
- [ ] Social features: share deals with friends, see what's trending in your city
- [ ] Push notifications for deal alerts on saved brands/dispensaries
- [ ] The more users, the better the personalization, the stickier the product

#### G4. B2B network effects
- [ ] More dispensaries covered = more data = better brand intelligence = more brand customers
- [ ] Brand customers want presence in more markets = pressure to expand coverage = more dispensaries covered
- [ ] Dispensaries want featured placement because users trust the platform = more dispensary customers
- [ ] Flywheel: consumer audience drives B2B revenue, B2B revenue funds expansion, expansion grows consumer audience

---

### Summary — The Whole Picture in One Table

| Phase | When | Focus | Key Metric |
|-------|------|-------|------------|
| **A** | Now — Week 6 | Prove Vegas users love it | 30%+ D7 retention, 15+ active testers |
| **B** | Weeks 4-10 | Data-driven scoring + price history | Engagement data flowing, scoring tuned |
| **C** | Weeks 8-16 | MI + IL expansion | 250+ dispensaries, 3 states stable |
| **D** | Months 4-8 | Brand + dispensary analytics (internal) | Dashboard operational, 90 days data |
| **E** | Months 6-10 | First revenue | Paying brand or dispensary customers |
| **F** | Months 6-12 | ML/LLM layer | Personalized scoring, price prediction |
| **G** | Months 10-18 | Platform domination | 1,200+ dispensaries, 6+ states, B2B flywheel |

The bottom line: get 20 people addicted to checking CloudedDeals every morning before their dispensary run. That's the only KPI that matters right now. Everything else is amplified by having a product that retains users. Without retention, we're scaling infrastructure nobody uses. With retention, every piece of tech we've built becomes a force multiplier.

---

### Research Documents (completed Feb 2026)

Multi-state expansion groundwork is complete and ready when Phase C begins:

| Document | Contents |
|----------|----------|
| `docs/research-michigan-illinois.md` | MI (1,000+ dispensaries, 55-65% platform overlap, 35-40 new brands) + IL (230 dispensaries, 65-75% overlap, 30-40 new brands). Platform audit of 20+ chains per state, brand ecosystem by category, state-specific price caps, technical feasibility, data model changes, rollout order |
| `docs/research-batch2-markets.md` | Scored 8 candidates → selected AZ (43/50), MO (38/50), NJ (38/50). Per-market: dispensary lists, platform audits, brand maps, scrapeability. Combined platform coverage matrix across all 5 new states |
| `docs/research-cross-market-synthesis.md` | 130-160 net-new brands with aliases + strain blockers. Master platform coverage (1,823 licensed dispensaries → ~1,280 scrapeable). Data normalization challenges for ML. Multi-state schema migration plan. LLM training data opportunities |
