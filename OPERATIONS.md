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
- Minimum **20% discount** from original price
- Price between **$3 and $80**
- Must have an original price to compare against
- Category-specific price caps (e.g., flower 3.5g max $19, edibles max $9)

### How deals are scored (0-100)
- **Base:** `(discount% - 20) * 2` — so 50% off = 60 points
- **Brand boost:** +15 for premium brands (STIIIZY, Cookies, Raw Garden, etc.)
- **Category boost:** Flower/Vape +10, Edible +8, Concentrate +5
- **THC bonus:** If THC% reported and high

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
  tests/                     # 421 unit tests (pure logic, no network)

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

## What's Next

### Short-term (prove new platforms)
- [ ] Run "new" group manually for 1-2 weeks, check data quality
- [ ] Monitor Rise (9 sites), Carrot (6 sites), AIQ (5 sites) for failures
- [ ] Promote to stable once reliable
- [ ] Investigate SLV — may need Treez-specific scraper if Dutchie fallback fails

### Medium-term (coverage & quality)
- [ ] Nevada Made Henderson/Warm Springs — retry periodically, may come back online
- [ ] Top Notch (Weedmaps) — evaluate if worth building a 7th scraper
- [ ] Add more dispensaries as new ones open in the market
- [ ] Tune deal scoring weights based on user engagement data

### Longer-term (scale)
- [ ] Expand beyond Southern Nevada (Reno, other states)
- [ ] Add price history tracking (track trends over time)
- [ ] Alert system for exceptional deals (Slack/email notification)
- [ ] Frontend search/filter improvements based on richer product data
