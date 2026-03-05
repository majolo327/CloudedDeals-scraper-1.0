# CloudedDeals Scraper — Operations Guide

*Last updated: Feb 26, 2026 | Pre-seed stage | Locked Beta*

---

## What This Is

A web scraper that visits cannabis dispensary websites every morning, extracts their menus and pricing, detects deals worth showing users, scores them, and pushes the top 200 to our Supabase database. The frontend reads from that database.

It runs as GitHub Actions cron jobs. No servers to maintain.

**Multi-state data collection (Feb 2026):** We now scrape across 11 states — Nevada (production/consumer-facing), plus MI, IL, AZ, MO, NJ, OH, CO, NY, MA, PA for data collection and ML training purposes. New-state data is collected but NOT displayed on the consumer frontend. This gives us millions of data points for B2B value, brand intelligence, and ML model training before we ever launch in those markets.

---

## Coverage

**~2,072 active dispensaries** across 11 states (12 regions) and 6 menu platforms:

### Nevada (Production — Consumer-Facing) — 63 dispensaries

| Platform | Sites | Status | Examples |
|----------|-------|--------|----------|
| **Dutchie** | 16 | Stable (daily cron) | Planet 13, Medizin, TD, Greenlight, The Grove, Mint, Jade, Sahara, Treehouse, SLV |
| **Curaleaf** | 4 | Stable (daily cron) | Curaleaf Western/Strip/NLV/Reef |
| **Jane** | 19 | Stable (daily cron) | Oasis, Deep Roots, Cultivate, Thrive, Beyond/Hello, Exhale, Tree of Life, Sanctuary, The Source |
| **Rise** | 9 | **Disabled** (Cloudflare Turnstile) | Rise x6, Cookies Strip, Cookies Flamingo, Rise Henderson |
| **Carrot** | 6 | Stable (daily cron) | Wallflower, Inyo, Jenny's, Euphoria, Silver Sage, ShowGrow |
| **AIQ** | 5 | Stable (daily cron) | Green NV, Pisos, Jardin, Nevada Made Casino Dr/Charleston |

Plus 2 inactive AIQ sites (Nevada Made Henderson/Warm Springs — returning 403s).

**Not covered:** Top Notch (Weedmaps — different ecosystem entirely).

### Michigan (Data Collection — NOT Consumer-Facing) — 114 dispensaries

| Platform | Sites | Chains |
|----------|-------|--------|
| **Dutchie** | 111 | Lume (37), Skymint (11), JARS (12), Cloud Cannabis (8), Joyology (9), High Profile (6), Pinnacle (5), Pleasantrees (5), Herbana (3), Detroit independents (11), Lansing/Flint (4) |
| **Curaleaf** | 3 | Curaleaf MI (2), Zen Leaf Buchanan (1) |

### Illinois (Data Collection — NOT Consumer-Facing) — 88 dispensaries

| Platform | Sites | Chains |
|----------|-------|--------|
| **Rise** | 10 | Rise Mundelein, Niles, Naperville, Lake in the Hills, Effingham, Canton, Quincy, Joliet, Charleston, Joliet Rock Creek |
| **Curaleaf** | 14 | Curaleaf IL (5), Zen Leaf IL (9) |
| **Dutchie** | 35 | Ascend (10), Windy City (5), Thrive IL (5), Mission (3), Maribis (2), Curaleaf-Dutchie (5), Planet 13 IL, Village (2), Lux Leaf, Share |
| **Jane** | 29 | Beyond/Hello (5), Verilife (8), Consume (6), nuEra (5), EarthMed (3), Hatch (2) |

### Arizona (Data Collection — NOT Consumer-Facing) — 52 dispensaries

| Platform | Sites | Chains |
|----------|-------|--------|
| **Dutchie** | 44 | Trulieve/Harvest (12), Sol Flower (6), The Mint (4), Nature's Medicines (3), Nirvana (4), Ponderosa (7), Cookies, TruMed, Noble Herb, Earth's Healing, Tucson Saints, Story AZ, Curaleaf-Dutchie (2) |
| **Curaleaf** | 8 | Curaleaf AZ (4), Zen Leaf AZ (4) |

### Missouri (Data Collection — NOT Consumer-Facing) — 31 dispensaries

| Platform | Sites | Chains |
|----------|-------|--------|
| **Dutchie** | 31 | Key Missouri (9), Greenlight (10), From The Earth (3), Green Releaf (3), Terrabis (1), Bloc MO (2), Star Buds, Nature Med, Rock Port |

**Market context:** $1.53B in 2025 sales (5th largest adult-use market nationally). 214 licensed dispensaries. Top brands: Illicit, Flora Farms, Vivid, Sinse, Proper, Clovr, Good Day Farm.

### New Jersey (Data Collection — NOT Consumer-Facing) — 34 dispensaries

| Platform | Sites | Chains |
|----------|-------|--------|
| **Dutchie** | 29 | Ascend (3), Curaleaf NJ (5, migrated to Dutchie!), AYR/GSD (3), MPX NJ (4), Sweetspot (3), Bloc NJ (3), Cookies Harrison, independents (7) |
| **Rise** | 2 | Rise Bloomfield, Rise Paterson |
| **Curaleaf** | 3 | Zen Leaf Elizabeth, Lawrence, Neptune |

**Market context:** $1B+ in 2024 sales. 190+ licensed dispensaries. NYC metro 20M+ pop. Key insight: Curaleaf NJ migrated to Dutchie — scrapes via dutchie.py. Top brands: Rythm (GTI), Kind Tree (TerrAscend), Verano, Ozone (Ascend), Cookies, Fernway.

---

## How It Runs

### Daily Automatic (Staggered by Region)
Each region runs on its own cron schedule, spaced by **local time zone**. DST-adjusted as of Feb 26 (spring-forward Mar 8, 2026):

| Region | Cron (UTC) | Local Time | Timezone | Dispensaries |
|--------|-----------|------------|----------|--------------|
| **southern-nv** | 15:00 | 8:00 AM PDT | Pacific (UTC-7) | 53 |
| **northern-nv** | 15:30 | 8:30 AM PDT | Pacific (UTC-7) | 40 |
| **arizona** | 19:00 | 12:00 PM MST | Arizona (UTC-7, no DST) | 127 |
| **colorado** | 19:04–19:08 | 1:04 PM MDT | Mountain (UTC-6) | 200 |
| **illinois** | 18:30 | 1:30 PM CDT | Central (UTC-5) | 166 |
| **missouri** | 20:00 | 3:00 PM CDT | Central (UTC-5) | 261 |
| **michigan** | 21:00 | 5:00 PM EDT | Eastern (UTC-4) | 446 |
| **new-jersey** | 22:00 | 6:00 PM EDT | Eastern (UTC-4) | 232 |
| **ohio** | 22:30 | 6:30 PM EDT | Eastern (UTC-4) | 247 |
| **new-york** | 23:00 | 7:00 PM EDT | Eastern (UTC-4) | 73 |
| **massachusetts** | 23:30 | 7:30 PM EDT | Eastern (UTC-4) | 184 |
| **pennsylvania** | 00:00 | 8:00 PM EDT | Eastern (UTC-4) | 43 |

- **Where:** GitHub Actions (`.github/workflows/scrape.yml`)
- **Duration:** ~30-60 min per region
- **Isolation:** Each region runs independently — failures don't affect other states
- **Concurrency:** Each region has its own concurrency group so runs never queue behind other states

### Manual Trigger
Go to GitHub repo > **Actions** tab > **Daily Scraper** > **Run workflow**:

| Input | Options | What it does |
|-------|---------|--------------|
| **Platform group** | `all` / `stable` / `new` | Which platforms to scrape |
| **Region** | `all` / `southern-nv` / `michigan` / `illinois` / `arizona` / `missouri` / `new-jersey` | Which state to scrape |
| **Dry run** | true/false | Scrape but don't write to DB (for testing) |
| **Limited** | true/false | Only 1 site per platform (quick smoke test) |
| **Single site** | slug like `td-gibson` | Scrape just one site |

### Typical Daily Workflow (DST-adjusted)
1. 8:00 AM PDT — Nevada (southern + northern) crons fire (93 dispensaries)
2. 12:00 PM MST — Arizona cron fires (127 dispensaries)
3. 1:00 PM CDT — Illinois + Colorado crons fire (366 dispensaries)
4. 3:00 PM CDT — Missouri cron fires (261 dispensaries)
5. 5:00 PM EDT — Michigan cron fires (446 dispensaries)
6. 6:00–8:00 PM EDT — NJ, OH, NY, MA, PA crons fire (779 dispensaries)
7. ~9 PM EDT / ~6 PM PDT — All 12 regions complete, check Actions tab for green checks

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
| **Edible** | $18 (state-specific caps: NJ $20, OH $18) |
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
| `dispensaries` | All ~2,122 sites across 11 states | slug, name, url, platform, region, is_active |
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
  config/dispensaries.py     # All ~2,122 site configs + platform groups
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
  tests/                     # 690 unit tests (pure logic, no network)

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

**Environment variables (set in workflow, not secrets):**

| Variable | Options | What it does |
|----------|---------|--------------|
| `PLATFORM_GROUP` | `all` / `stable` / `new` | Which platforms to include |
| `REGION` | `all` / `southern-nv` / `northern-nv` / `michigan` / `illinois` / `arizona` / `missouri` / `new-jersey` / `ohio` / `colorado` / `new-york` / `massachusetts` / `pennsylvania` | Which region to scrape |
| `DRY_RUN` | `true` / `false` | Skip DB writes |
| `FORCE_RUN` | `true` / `false` | Skip idempotency check |
| `LIMIT_DISPENSARIES` | `true` / `false` | 1 site per platform |
| `SINGLE_SITE` | slug | Scrape just one site |

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

### Gamification Features — REMOVED (Feb 14 bloat cut)

All gamification features were removed during the beta bloat cut (3,101 lines deleted):
- ~~Daily streaks~~ — deleted
- ~~Milestone toasts~~ — deleted (basic save/error toasts remain)
- ~~Brand affinity~~ — deleted
- ~~Challenges~~ — deleted
- ~~Personalization~~ — deleted (was dead code, never connected)

### FTUE (First-Time User Experience)

1. **Splash** — value prop + deal count
2. ~~**Preferences**~~ — removed (selections had zero effect on feed)
3. **Location** — zip code or geolocation
4. ~~**Coach marks**~~ — removed (6-step overlay was over-engineered)

### Key Frontend localStorage Keys

| Key | Purpose | Reset |
|-----|---------|-------|
| `clouded_dismissed_v1` | Dismissed deal IDs | Daily |
| `clouded_saved_v1` | Saved deal IDs | Never |
| `clouded_view_mode` | Grid or stack preference | Never |
| `clouded_filters_v1` | Filter/sort state | Never |
| `clouded_ftue_completed` | FTUE done flag | Never |

---

## Changelog

### Feb 14, 2026 — UX Audit, Deal Reporting, Operational Cleanup

**Three-pass audit of the entire frontend codebase — declutter, accessibility, and deal accuracy tooling.**

1. **UI Declutter Pass**
   - ChallengeBar collapsed from full-width card to slim inline progress bar (~1/3 vertical space)
   - StickyStatsBar reduced from h-12 to h-11, tighter chip spacing
   - Filter button restyled from blocky bg-slate-800 to rounded-full chip matching category pills
   - DealsPage header/deck progress compacted to slim inline rows
   - Browse page: tap brand goes directly to filtered deals (was expand → dropdown → second tap)
   - Browse page: dispensary buttons (Menu, Deals) shown inline (was hidden behind expand/collapse)
   - Removed Premium/Local/Established tier tags from BrowsePage and SearchPage

2. **Deal Reporting Feature** (`ReportDealModal.tsx`, migration `029_deal_reports.sql`)
   - Users and founder can flag deals with specific issue types: wrong_price, deal_gone, wrong_product, other
   - Optional message field for details (e.g. "actual price is $25")
   - Writes to `deal_reports` table in Supabase with spam prevention (unique per user/deal/type/day)
   - Admin summary view `deal_report_summary` groups reports by deal for daily review
   - Flag button added to DealModal action row
   - `onAccuracyFeedback` callback wired up in page.tsx (was previously disconnected)
   - Toast notification on successful report

3. **Accessibility & Touch Target Pass**
   - All interactive elements across 8+ components now meet 44px minimum touch targets (Apple HIG / WCAG)
   - Added aria-labels to all buttons missing them (save, dismiss, share, flag, location, feedback)
   - Removed dead code: unused ShareModal import/state/render in DealCard

4. **Centralized localStorage Keys** (`lib/storageKeys.ts`)
   - All 12 localStorage keys moved to constants file to prevent typos and enable audit

---

### Feb 12, 2026 — NOT_BRANDS Filter, Jane Loose Qualification, Enhanced Scrape Report

**Improvements to brand detection, category inference, Jane deal handling, and operator visibility.**

1. **NOT_BRANDS exclusion filter** (`parser.py`)
   - Added 30-word blocklist (colours, product types, strain types, promo terms) that are silently rejected from brand matching
   - Prevents false positives if generic words ever slip into KNOWN_BRANDS or fuzzy-match via variations

2. **Category keyword expansion** (`parser.py`)
   - Added `buds`, `popcorn` to flower; `pen` to vape
   - Added `infer_category_from_weight()` fallback when no keyword matches: mg→edible, g≥3.5→flower, g<3.5→concentrate, no weight→vape
   - *Note (Feb 26): Both `detect_category()` and `infer_category_from_weight()` later deleted from parser.py — category detection consolidated to `clouded_logic.py` only.*

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

## Daily Deal Review — Founder Workflow

Flag deals from the app (tap any deal → Flag button). Reports go to the `deal_reports` table. Review them daily.

### Check flagged deals (Supabase SQL Editor)

```sql
-- Today's reports — what got flagged today
SELECT product_name, dispensary_name, brand_name, deal_price,
       report_type, report_message, created_at
FROM deal_reports
WHERE report_date = CURRENT_DATE
ORDER BY created_at DESC;
```

```sql
-- Summary view — unreviewed reports grouped by deal (highest report count first)
SELECT * FROM deal_report_summary;
```

```sql
-- All unreviewed reports with full detail
SELECT product_name, dispensary_name, brand_name, deal_price,
       report_type, report_message, anon_id, created_at
FROM deal_reports
WHERE reviewed = FALSE
ORDER BY created_at DESC;
```

### Mark reports as reviewed

```sql
-- Mark all reports for a specific deal as reviewed
UPDATE deal_reports
SET reviewed = TRUE, reviewed_at = NOW()
WHERE deal_id = 'INSERT-DEAL-UUID-HERE';
```

```sql
-- Mark ALL unreviewed reports as reviewed (daily clear)
UPDATE deal_reports
SET reviewed = TRUE, reviewed_at = NOW()
WHERE reviewed = FALSE;
```

### What to learn from flagged deals

When you see recurring flags, ask Claude to investigate. Paste the flagged deals and ask:

> "Here are today's flagged deals from CloudedDeals. For each one, tell me:
> 1. Is this a scraper bug (wrong price extraction, wrong category, stale data)?
> 2. Is this a scoring bug (deal shouldn't have qualified)?
> 3. Is this a site issue (deal expired between scrape and user visit)?
> 4. What specific scraper/scoring change would prevent this in the future?"

**Common patterns and what they mean:**

| Flag pattern | Likely cause | Fix |
|---|---|---|
| `wrong_price` on one dispensary | Price selector changed on their site | Debug that platform scraper, check extraction selectors |
| `deal_gone` across many dispensaries | Scrape ran too early, deals changed mid-day | Consider running scraper closer to dispensary open time |
| `deal_gone` on one dispensary only | That dispensary updates menu frequently | Mark as volatile, scrape 2x/day if needed |
| `wrong_product` — wrong category | Category inference missed a keyword | Add keyword to `clouded_logic.py` category detection |
| `wrong_product` — wrong brand | Brand name extracted from promo text | Check `parser.py` brand extraction order |
| `wrong_price` + message "actual price is $X" | Original price vs sale price confusion | Check platform scraper's price field mapping |

### Improving deal accuracy over time

1. **Weekly:** Review `deal_report_summary` — are any dispensaries or brands repeatedly flagged?
2. **Monthly:** Run the scraper in dry-run mode (`limited: true`) and spot-check 10 deals against live dispensary sites
3. **After fixing a scraper bug:** Re-run the affected dispensary with `single_site` dispatch and verify the fix

---

## Engineering Priorities — Operational Readiness

These are the tactical engineering tasks that make the product production-grade. They sit alongside the strategic roadmap below. Do them as you go — most are 1-2 day efforts, not multi-week projects.

### 1. Deal Accuracy Feedback Loop ✅ SHIPPED (Feb 14, 2026)
- [x] `ReportDealModal` — users flag wrong_price, deal_gone, wrong_product, other
- [x] `deal_reports` Supabase table with RLS + spam prevention (unique per user/deal/type/day)
- [x] `deal_report_summary` admin view — groups by deal_id for daily review
- [x] Flag button in DealModal, toast confirmation on submit
- [ ] **TODO:** Run migration `029_deal_reports.sql` on production Supabase
- [ ] **TODO:** Add deal_reports widget to admin dashboard (`/admin`) — table of today's reports with resolve button
- [ ] **TODO:** Auto-suppress deals with 3+ reports (add `is_flagged` column to deals, check in frontend query)
- [ ] **TODO:** Daily Slack/email digest of flagged deals (Supabase Edge Function or cron)

### 2. Analytics Dashboard Audit
- [x] Admin dashboard exists and is functional — pulls from Supabase `analytics_events`, `user_sessions`, `user_events`
- [x] 30+ event types tracked, session tracking, retention cohorts all operational
- [ ] **TODO:** Add funnel visualization: landing → FTUE complete → first save → return visit → share
- [ ] **TODO:** Add deal report metrics to admin dashboard (reports/day, top reported deals, resolution rate)
- [ ] **TODO:** Track "Get This Deal" click-through → dispensary website as conversion event
- [ ] **TODO:** Add per-dispensary engagement breakdown (which dispensaries generate most saves/clicks)

### 3. Error Monitoring ✅ SHIPPED (Feb 26, 2026)
- [x] `@sentry/nextjs` added to frontend — client, server, and edge runtime configs
- [x] `sentry-sdk` added to Python scraper — init in main.py with region/environment tags
- [x] ErrorBoundary, error.tsx, and global-error.tsx all report to Sentry
- [x] CSP updated to allow `*.sentry.io` connections
- [x] GitHub Actions `scrape.yml` passes `SENTRY_SCRAPER_DSN` secret
- [ ] **TODO:** Set up Slack alerts for error rate spikes (Sentry → Slack integration)
- [ ] **TODO:** Add Sentry alert rules for zero-product scrape runs

### 4. Performance / Lighthouse Pass
- [ ] Run Lighthouse CI on every deploy — target 90+ on Performance, Accessibility, SEO
- [ ] Audit bundle size — tree-shake unused lucide icons, lazy-load modals (DealModal, ShareModal, ReportDealModal)
- [ ] Add `loading="lazy"` to any images if/when product images are added
- [ ] Verify Core Web Vitals (LCP, FID, CLS) are green in Search Console
- [ ] Consider ISR (Incremental Static Regeneration) for deal pages if traffic justifies it

### 5. SEO Pages
- [ ] `/dispensary/[slug]` — individual dispensary page with today's deals, address, hours, map
- [ ] `/brand/[slug]` — brand page with current deals across all dispensaries
- [ ] `/deals/[category]` — category landing pages (flower deals, vape deals, etc.)
- [ ] Proper `<title>`, `<meta description>`, structured data (Product schema) on all pages
- [ ] Sitemap.xml generated from active dispensaries + brands
- [ ] Goal: organic traffic from "las vegas dispensary deals", "[brand] deals near me"

### 6. SMS / Push Notification Pipeline
- [x] SMS waitlist banner exists and collects phone numbers
- [ ] **TODO:** Build daily deal digest — top 5 deals summary via SMS (Twilio or similar)
- [ ] **TODO:** Price drop alerts — "STIIIZY cart you saved dropped to $25 at Medizin"
- [ ] **TODO:** PWA push notifications as alternative to SMS (free, no per-message cost)
- [ ] **TODO:** Frequency control — users choose daily, 3x/week, or deal-triggered only

### 7. Auth & Persistence
- [ ] Currently: all user data (saves, dismissals, preferences) lives in localStorage — lost on device change or clear
- [ ] Add optional Supabase Auth (magic link or Google OAuth) — zero-friction, no password
- [ ] Sync saves, preferences, and streak data to server when logged in
- [ ] Merge anonymous session data into account on first login
- [ ] Unlock cross-device experience and long-term retention tracking
- [ ] Don't gate any features behind auth — it's purely an enhancement

### 8. PWA (Progressive Web App)
- [ ] Add `manifest.json` with app name, icons, theme colors
- [ ] Add service worker for offline shell + cache-first for static assets
- [ ] "Add to Home Screen" prompt after 2nd visit (browser-native, not custom modal)
- [ ] Offline fallback page: "You're offline — here are your saved deals"
- [ ] Goal: feel like a native app without App Store friction

### 9. Technical Debt Tracker
- [ ] `storageKeys.ts` created but not yet adopted everywhere — migrate remaining hardcoded key strings
- [ ] `lib/socialProof.ts` fully built but never called — wire up when DAU justifies it (50+ DAU)
- [ ] `price_history` table accumulating data silently — surface in frontend when 30-60 days of data exists
- [ ] Rise scraper disabled (Cloudflare Turnstile) — revisit after PMF + traction
- [ ] SLV double age gate may break if Treez changes — monitor
- [ ] Gamification features (streaks, challenges, milestones) may need tuning based on user feedback

### 10. Security & Abuse Prevention

**Current state (Feb 16, 2026):** Solid foundation in place. Three hardening items shipped today, remaining items sequenced by priority.

#### Shipped

- [x] **Per-IP rate limiting** on all API routes via Next.js edge middleware (sliding window, in-memory Map)
  - `/api/search`: 20 req/60s (most abusable — arbitrary user queries)
  - `/api/health`: 30 req/60s (public monitoring, returns status only — no business metrics)
  - `/api/admin`: 20 req/60s (defense-in-depth behind PIN gate)
  - `/api/deals`: 10 req/60s (cron-only endpoints)
- [x] **Health endpoint hardened** — `/api/health` stripped to return only `{status, database, timestamp}`. Full pipeline metrics (deal counts, categories, brands, scores) moved to `/admin/health` behind PIN gate. Competitors can no longer poll business intelligence from the public endpoint
- [x] **Search routed through API** — `searchExtendedDeals()` now calls `/api/search` server-side instead of querying Supabase directly from the browser. Rate-limited at 20 searches/min per IP. Prevents bots from enumerating the product catalog
- [x] **Anonymous insert caps** (migration `035_anonymous_insert_rate_limits.sql`) — RLS policies cap daily inserts per anon_id:
  - `analytics_events`: 500/day
  - `user_events`: 500/day
  - `user_saved_deals`: 100/day
  - `user_dismissed_deals`: 500/day
  - `deal_reports`: 20/day
- [x] **Admin PIN gate** — 6-digit PIN with constant-time comparison, 5-attempt server-side lockout (15 min), protects all `/admin/*` routes
- [x] **Bearer token auth** on deal posting endpoints (`ADMIN_API_KEY`)
- [x] **Supabase RLS** on all tables — anon reads, service-role writes, user-scoped data
- [x] **Security headers** — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`
- [x] **SQL injection prevention** — `escapeLike()` for search, parameterized queries throughout
- [x] **Twitter OAuth 1.0a** — HMAC-SHA1 signing, nonce generation, credentials never in logs

#### Before Public Beta (Priority: HIGH)

- [ ] **Run migration `035_anonymous_insert_rate_limits.sql`** on production Supabase
- [ ] **CSRF protection on admin endpoints** — add `X-Requested-With: XMLHttpRequest` header validation to `/api/admin/verify-pin` and `/api/deals/post`. A malicious site could trigger requests if admin session is active
- [ ] **Security event logging** — log rate limit hits, failed PIN attempts, and suspicious patterns to Sentry or similar. Currently no audit trail for security events
- [ ] **Content Security Policy (CSP)** — add CSP header via middleware to reduce XSS surface area

#### Post-Beta (Priority: MEDIUM — first 30 days)

- [ ] **Persistent rate limiting (Upstash Redis)** — current in-memory Map resets on every deploy. Attackers could brute-force during deployment windows. Upstash free tier ($0) provides persistent Redis-backed rate limiting
- [ ] **Dependency security scanning** — add `npm audit --audit-level=high` and `pip audit` to CI workflows. Currently no automated vulnerability scanning
- [ ] **Admin PIN rotation** — document quarterly PIN rotation process. Currently a static env var with no expiry
- [ ] **Rate limit the main data endpoints** — `fetchDeals()` and `fetchDispensaries()` query Supabase directly from the browser. Consider routing through API endpoints with rate limiting, or adding Supabase's built-in rate limiting (pg_net) if available

#### Future (Priority: LOW — when scaling)

- [ ] **Cloudflare Bot Management** — when traffic justifies it, add bot detection and challenge pages
- [ ] **Proper OAuth for admin** — replace PIN gate with Google OAuth or Supabase Auth magic links for multi-admin support
- [ ] **API key management** — rotate keys automatically, support multiple keys for different services (cron, admin, monitoring)
- [ ] **Database request signing** — verify that API requests to Supabase are coming from our frontend, not spoofed
- [ ] **Disable Supabase SQL Playground** — in production settings, ensure the public SQL editor is not accessible

---

## Legal

- **Incorporation:** Clouded Inc. is registered in Delaware. Privacy Policy and Terms of Service updated Feb 2026 — old domains (useclouded.com, onclouded.com) and physical address removed, contact email standardized to hello@cloudeddeals.com.
- **TODO:** Register as a foreign entity in Nevada (operating in NV but incorporated in DE). Needs lawyer review.
- **TODO:** Lawyer review of Privacy Policy and Terms of Service for compliance.

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

---

### Future Feature: Price Index / Price Comparison Grid

**Status:** Concept only — not built. Requires higher data confidence first.

**The idea:** A "Prices" tab showing the lowest price at each dispensary location for 7 specific product buckets:

| Bucket | What it matches |
|--------|----------------|
| 3.5g Flower (eighth) | Flower products ~3.5g |
| 7g Flower (quarter) | Flower products ~7g |
| 14g Flower (half oz) | Flower products ~14g |
| Disposable Vape (0.8-1g) | Vapes with disposable subtype |
| 100mg Edible | Edibles ~100mg |
| 1g Concentrate | Concentrates ~1g |
| Preroll | Regular single prerolls (no infused, no packs) |

When multiple brands tie at the lowest price, show all of them so users see their options.

**Why not now:**
- Data quality and confidence in scraped prices is not high enough yet. Weight parsing, category detection, and product classification still have gaps that would make a price index misleading.
- Need reliable weight extraction across all 6 platforms before a price-per-weight comparison is trustworthy.
- Infused preroll vs. regular preroll classification needs to be airtight — a $25 infused preroll shouldn't show as a $25 "preroll" next to $5 regular ones.
- Disposable vape detection depends on `product_subtype` which isn't always populated.

**Prerequisites before building:**
- [ ] Weight extraction accuracy >95% across all platforms (currently estimated ~85%)
- [ ] Product subtype classification coverage >90% for vapes and prerolls
- [ ] Price validation layer that catches obvious scraping errors (e.g. $0.50 eighths, $500 prerolls)
- [ ] Enough historical data to distinguish real prices from data errors with confidence
- [ ] Rise/GTI scraping restored (9 dispensaries missing = incomplete comparison)

**Technical approach (when ready):**
- `fetchAllProducts()` API: query all active products (not just deal-scored ones), limit 5000
- `priceComparison.ts` utility: classify products into buckets by category + weight range, find min price per dispensary per bucket, collect all brands tied at the min
- `PriceComparisonPage.tsx` component: responsive table (desktop) / card grid (mobile), sortable by any column, expandable brand lists for ties
- Column headers show the overall best price across all dispensaries

---

## Addendum: Feb 13–21, 2026 — Sprint to Locked Beta

*152 commits in 8 days. CTO summary below. System is now in LOCKED BETA mode.*

---

### Current State (Feb 21, 2026)

| Metric | Before (Feb 13) | After (Feb 21) |
|--------|-----------------|-----------------|
| **Active dispensaries** | 63 (NV only) | **~2,072 across 11 states** |
| **States** | 1 (NV production) | **11** (NV, MI, IL, AZ, MO, NJ, OH, CO, NY, MA, PA) |
| **Platforms** | 6 (Rise disabled) | 6 (Rise still disabled — Cloudflare) |
| **Daily cron jobs** | 1 | **24 region-sharded jobs** |
| **Jane sites** | 19 (NV only) | **~531** |
| **Dutchie sites** | 18 (NV only) | **~846** |
| **Curaleaf sites** | 4 (NV only) | **~109** |
| **Frontend bloat** | ~3,100 lines gamification | **Cut to zero** |
| **Admin dashboard** | 7 tabs | **4 tabs** (Dashboard, Scraper, Analytics, Settings) |
| **Security** | No rate limiting | **Full rate limiting, RLS caps, hardened health endpoint** |

---

### What Was Fixed — Scraper (Last 8 Days)

#### Category Coverage Gap (Feb 21) — THE BIG ONE
- **Problem:** All Dutchie sites using `?dtche[path]=specials` URLs (TD stores, Greenlight, The Grove, Mint, Jade, Vegas Treehouse — 12+ sites) only scraped specials. If specials returned even 1 product, the base menu was never scraped. Most categories (Flower, Vape, Edibles, Concentrates, Pre-Rolls) were empty.
- **Fix:** `dutchie.py` now always scrapes the base menu after specials. In-memory dedup prevents duplicates. TD fallback URLs changed from `/specials` to full menu.
- **Files:** `platforms/dutchie.py`, `config/dispensaries.py`

#### Scraper Regression Fix (Feb 21)
- Iframe cascade timeout was burning 105s on sites without iframes
- Shadow DOM extraction added for Dutchie embeds behind shadow roots
- `about:blank` iframe fallback for sites that load empty iframes before injecting content
- **Files:** `platforms/dutchie.py`, `handlers/iframe.py`

#### Age Gate Before JS Removal (Feb 18)
- **Problem:** 17 of 18 Dutchie sites failing because overlay-removal JS ran before the age gate was clicked, destroying the gate button
- **Fix:** Always click age gate first, then run JS overlay removal
- **Files:** `handlers/age_verification.py`, `platforms/dutchie.py`

#### Dutchie Timeout Overhaul (Feb 17)
- Site timeout reduced 600s → 300s (faster failure recovery)
- Retry timeout reduced 300s → 180s
- Smart-wait increased 60s → 90s (content-based polling, returns instantly when content appears)
- Product card population wait added — ensures massive pages render before extraction
- Fast-bail for dutchie.com pages when SPA fails to render
- Retry-on-zero fallback: if primary URL returns 0 products, tries fallback URL automatically

#### Curaleaf Fixes (Feb 19)
- Curaleaf NY 100% failure rate fixed (0/6 → 6/6)
- Pagination timeout resolved
- Age gate state mapping for all 11 states
- `&Shine` brand recognition added

#### Jane Fixes (Feb 17–19)
- Force-navigate `about:blank` iframes before extraction
- Remove overlays before "View More" pagination click
- 189 new Jane dispensaries added across CO, MI, MA, MO, OH, AZ
- Loose qualification extended (same as Carrot/AIQ — flat 15-point baseline)

#### Cloudflare Bypass (Feb 19)
- 10 PA Dutchie sites switched to store-hosted URLs
- 20 NY Dutchie sites switched to store-hosted URLs
- Auto-detecting `dutchie.com` fallback URLs for sites blocked on their own domain

#### Deal Quality (Feb 16–20)
- Bundle/promo deals rejected (was contaminating category detection)
- Vape-as-flower misclassification corrected
- Cookies brand-as-strain false positive fixed
- Preroll-as-flower reclassification (1g products)
- Chain diversity cap raised 15 → 25
- Vape subtype price floors added
- Matrix Ripper vape classification fixed
- Product name pollution stripped (THC %, promo text, strain codes)
- Dynamic diversity caps: relax when total supply < target × 0.85

#### Multi-State Expansion (Feb 15–16)
- Wave 1: MI + IL + AZ data collection (317 sites)
- Wave 2: +85 net new (861 sites)
- Wave 3: NJ +11, MA +46 (918 sites)
- Wave 4: OH + CO + NY +225 (1,143 sites)
- Jane Sprint: +386 Jane sites across all states
- Michigan sharded into 4 parallel cron jobs
- 24 cron jobs spread across full day by local timezone (6 AM–6 PM EST)
- Region-aware idempotency check (was cross-blocking UTC neighbors)

#### Infrastructure (Feb 14–17)
- `asyncio.wait_for()` hard timeout on all scraper tasks
- Per-platform concurrency limits (Dutchie 3, Jane 4, Curaleaf 4)
- Stealth mode propagated to all scrapers
- Crash-proof summary report
- Site Diagnostics workflow added

---

### What Was Fixed — Frontend (Last 8 Days)

#### Bloat Cut (Feb 14) — 3,101 lines removed
- Deleted: Challenge system, Streak system, Brand Affinity, Smart Tips, Coach Marks (6-step), PreferenceSelector (dead — selections did nothing), Daily Complete Modal, Nine Clear Modal, Coming Soon Modal, Heat Indicator, Personalization lib
- Deleted dead code: AuthPrompt, CompactDealCard, lib/auth.ts, lib/badges.ts
- Replaced "feed gets smarter" with "hand-curated"

#### Admin Dashboard (Feb 17)
- Consolidated 7 tabs → 4 (Dashboard, Scraper, Analytics, Settings)
- Flagged products section with editor (product_subtype dropdown, collapsible flag history)
- Deal Pipeline Health card
- Growth-stage + B2B-ready metrics
- Per-region scrape summaries
- Stickiness formula fixed, skeleton grid added

#### UX Polish (Feb 14–20)
- 3-column desktop grid
- iOS notch + home indicator safe areas
- Stale/yesterday deals visible between midnight and morning
- Skip zip screen when geolocation granted during FTUE
- FTUE copy overhaul (conversion-focused)
- Dispensary diversity in first 12 cards
- Multi-select weight filter
- Dispensary name cleanup
- Saved tab icon: bookmark → heart
- Accordion expand on dispensary search cards
- Browse tabs swapped (Dispensaries first)
- Cookie consent banner
- Branded CD monogram favicon
- Desktop glassmorphism Chrome/Safari parity

#### Security (Feb 16)
- Per-IP rate limiting on all API routes (sliding window)
- Health endpoint hardened — business metrics moved behind PIN gate
- Search routed through API (was querying Supabase from browser)
- Anonymous insert caps (500/day events, 100/day saves, 20/day reports)
- Security headers: X-Content-Type-Options, X-Frame-Options, Referrer-Policy
- Bearer token auth on deal posting endpoints

#### SEO & Discoverability (Feb 13–19)
- Google Search Console verification
- Bing Webmaster Tools verification
- AI visibility: llms.txt, AI crawler rules
- Internal linking across SEO pages
- SEO body copy on category and dispensary pages
- Lighthouse / Core Web Vitals optimizations

#### Legal (Feb 17)
- Incorporation state corrected to Delaware in ToS
- Old domains stripped from Privacy Policy and Terms
- Contact email standardized

---

### Locked Beta Plan — Next 4 Weeks (Feb 22 – Mar 21, 2026)

**The system is now LOCKED. No new features. No refactors. No expansion. Only surgical fixes that protect deal accuracy and uptime for beta testers.**

#### What "Locked" Means

1. **NO new dispensaries.** ~2,072 active is enough. Stabilize what we have.
2. **NO new scrapers or platforms.** Dutchie/Jane/Curaleaf/Carrot/AIQ only.
3. **NO frontend features.** The UI ships as-is.
4. **NO gamification, ML, personalization, or social proof.** All deferred to post-beta.
5. **NO database schema changes** unless something is actively broken.
6. **YES** to: bug fixes that affect deal accuracy, scraper reliability patches, security patches, copy/legal fixes.

#### Founder's 4-Week Hustle Outreach Plan — What Engineering Supports

| Week | Founder Focus | Engineering Support |
|------|--------------|-------------------|
| **Week 1** (Feb 22–28) | Recruit 15–25 inner circle testers (budtenders, r/vegastrees, cannabis Twitter) | Monitor scraper health daily. Fix any site that returns 0 products. Respond to flagged deals same-day. |
| **Week 2** (Mar 1–7) | Collect first feedback. Watch retention numbers. | Surgical fixes based on tester reports only. No proactive changes. |
| **Week 3** (Mar 8–14) | Double down on what's working. Cut what's not. DST transition (Mar 8 — crons already adjusted). | ✅ DST crons pre-adjusted Feb 26. Fix any reported deal accuracy issues. |
| **Week 4** (Mar 15–21) | Assess: do we have 30%+ D7 retention? If yes, widen beta. If no, diagnose why. | Prepare data for founder's retention analysis. Fix blockers only. |

#### Daily Operations Checklist (During Beta)

- [ ] Check GitHub Actions for green checks across all 24 cron jobs
- [ ] Check admin Dashboard pipeline status banner
- [ ] Review flagged products (if count > 0, fix same day)
- [ ] Spot-check 5 random NV deals against live dispensary sites
- [ ] Check Supabase for anomalies (0-product dispensaries, deal_score spikes)

#### Known Risks Accepted for Beta

| Risk | Impact | Mitigation | Status |
|------|--------|------------|--------|
| Rise (37 sites) blocked by Cloudflare | 0% Rise coverage | Accepted. Revisit post-PMF. | Won't fix |
| Carrot/AIQ single-price limitation | Flat 15-pt baseline, no discount depth | Loose qualification + dispensary floor | Mitigated |
| Jane no original prices | Can't verify true discount % | Loose qualification, brand-required gate | Mitigated |
| SLV double age gate (Treez) | May break if Treez changes | Monitor. Low priority. | Accepted |
| DST shift Mar 8 | NV cron moves from 8 AM to 9 AM local | All 33 scrape crons + 4 tweet crons shifted -1hr UTC (Feb 26) | ✅ Done |
| Stale data if GHA outage | Testers see yesterday's deals | Manual workflow_dispatch as backup | Documented |

#### Surgical Fix Criteria (What Qualifies)

A change is allowed during locked beta ONLY if it meets ALL of these:

1. A real beta tester reported the problem, OR it's a scraper returning 0 products
2. The fix is < 50 lines of code
3. The fix does not change scoring logic, category detection order, or price caps
4. The fix does not add new dependencies
5. The fix has a clear rollback (revert 1 commit)

Anything else goes on the post-beta backlog.

#### Post-Beta Backlog (Do NOT Touch Until After Mar 21)

- [ ] Run migration `029_deal_reports.sql` on production Supabase
- [ ] Run migration `035_anonymous_insert_rate_limits.sql` on production Supabase
- [x] ~~Add Sentry error monitoring (frontend + scraper)~~ — shipped Feb 26
- [ ] Add UptimeRobot on `/api/health`
- [ ] CSRF protection on admin endpoints
- [ ] CSP header via middleware
- [ ] Persistent rate limiting (Upstash Redis — replaces in-memory Map)
- [ ] SEO pages: `/dispensary/[slug]`, `/brand/[slug]`, `/deals/[category]`
- [ ] SMS daily deal digest (Twilio)
- [ ] PWA manifest + service worker
- [ ] Supabase Auth (magic link) for cross-device saves
- [ ] Price history frontend (badges, charts, trend arrows)
- [ ] Social proof frontend (save counts, trending indicators)
- [ ] Full-text search index (trigram) — needed before 1,000+ DAU
- [ ] Data retention policy for analytics/events tables
- [ ] Sunnyside scraper (Cresco's IL locations)
- [ ] Weedmaps embed scraper (biggest platform gap nationally)

#### The Only 3 Numbers That Matter

1. **D1 → D7 retention**: Do testers come back? Target: 30%+
2. **Save rate**: Do testers save deals? Target: 20%+ save at least 1/session
3. **Session frequency**: Are deal hunters checking daily?

If these numbers are bad after 4 weeks, the product has a problem — not the engineering. Fix the product, not the infrastructure.

---

*Locked beta entered Feb 22, 2026. Next operations update: Mar 22, 2026 (post-beta retrospective).*
