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
- [ ] Add `og:image` for social share previews

### Longer-term (scale)
- [ ] Expand beyond Southern Nevada (Reno, other states)
- [ ] Add price history tracking (track trends over time)
- [ ] Alert system for exceptional deals (Slack/email notification)
- [ ] Frontend search/filter improvements based on richer product data
