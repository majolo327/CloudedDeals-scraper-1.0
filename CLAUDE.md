# CLAUDE.md — Project Instructions for Claude Code

> **Last updated:** Mar 5, 2026 | Pre-seed stage | Locked Beta (Feb 22, 2026)

## Project Overview

**CloudedDeals** is a deal-tracking platform for cannabis dispensaries. A
Playwright-based scraper visits ~2,122 dispensary websites daily across 11
states, extracts menus/pricing, detects and scores deals, and pushes the top
results to Supabase. A Next.js frontend displays curated deals to consumers.
The scraper runs as GitHub Actions cron jobs — no servers to maintain.

**Key docs:**
- `OPERATIONS.md` — authoritative operational reference (coverage, platforms,
  pipeline, anti-bot stack, beta policy)
- `clouded-deals/docs/README.md` — setup instructions
- `docs/INVESTOR-DILIGENCE-RESPONSES.md` — investor-facing Q&A

---

## Git & GitHub Environment Constraints

### No GitHub CLI API access

This environment uses a **local git proxy** that only supports git protocol
operations:

- **Works:** `git push`, `git pull`, `git fetch`, `git clone`
- **Does NOT work:** `gh pr create`, `gh issue`, `gh api`, or any GitHub
  REST/GraphQL API call — there is no GitHub API token available

The `gh` CLI will always fail with `gh auth login` errors. Do not retry it or
attempt workarounds (curl to api.github.com, GH_TOKEN env vars, etc.).

### Pull Request Workflow

Since `gh` CLI cannot create PRs, follow this process **every time**:

1. **Push the branch** with `git push -u origin <branch-name>`
2. **Provide the compare URL** for the user to create the PR in their browser:
   ```
   https://github.com/majolo327/CloudedDeals-scraper-1.0/compare/main...<branch-name>
   ```
3. **Include a suggested PR title and body** so the user can copy-paste it
4. **Never assume a PR is merged or closed** — the user handles merging

### Branch Naming & Commit Standards

- Feature branches: `claude/<descriptive-name>-<session-suffix>`
- Always push with `-u` flag to set upstream tracking
- Never force-push to `main`
- Sign commits (gpgsign is already configured)
- Use conventional commit prefixes: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Commit message body should explain **why**, not just what
- Append the Claude session URL to every commit message

### Mandatory Build Verification (Frontend)

**CRITICAL:** Before pushing ANY branch that touches files under
`clouded-deals/frontend/`, you MUST run a full production build and confirm
zero errors:

```bash
cd clouded-deals/frontend
npx next build
```

- **Do NOT push** if the build fails — fix all TypeScript and compilation
  errors first
- This applies to every push, not just the final one — Netlify builds deploy
  previews for every branch push, and failures block production deploys when
  merged to main
- Common pitfalls that have caused build failures:
  - Missing properties on TypeScript interfaces (especially in error/fallback
    code paths that aren't exercised at runtime)
  - Using `for...of` on `Set` or `Map` without `--downlevelIteration` (use
    `.forEach()` instead)
  - JSX comment syntax errors (`//` comments inside JSX — use
    `{/* comment */}` instead)

### Mandatory Test Verification (Scraper)

Before pushing ANY branch that touches files under `clouded-deals/scraper/`,
run the unit test suite:

```bash
cd clouded-deals/scraper
python -m pytest tests/ -v --tb=short -m "not live" --ignore=tests/test_platform_recon.py
```

- **Do NOT push** if tests fail — fix all failures first

---

## Repository Structure

```
CloudedDeals-scraper-1.0/
├── CLAUDE.md                         # This file — AI assistant instructions
├── OPERATIONS.md                     # Authoritative ops guide (coverage, pipeline, anti-bot)
├── README.md                         # Project overview
│
├── clouded-deals/
│   ├── scraper/                      # Python Playwright scraper
│   │   ├── main.py                   # Entry point — orchestrates scraping
│   │   ├── platforms/
│   │   │   ├── base.py               # BaseScraper — browser lifecycle, anti-bot, debug
│   │   │   ├── dutchie.py            # Dutchie (~1,260 sites) — iframe/JS-embed extraction
│   │   │   ├── jane.py               # Jane (~696 sites) — hybrid iframe/direct + View More
│   │   │   ├── curaleaf.py           # Curaleaf (~122 sites) — React SPA + age-gate redirect
│   │   │   ├── carrot.py             # Carrot (5 sites) — getcarrot.io widget
│   │   │   ├── aiq.py                # AIQ (2 sites) — Alpine IQ / Dispense SPA
│   │   │   └── rise.py               # Rise (37 sites) — ALL DISABLED (Cloudflare Turnstile)
│   │   ├── handlers/
│   │   │   ├── age_verification.py   # Universal age-gate dismissal (selectors + JS fallback)
│   │   │   ├── iframe.py             # Dutchie iframe/JS-embed/direct-page detection
│   │   │   └── pagination.py         # Platform-specific page navigation
│   │   ├── clouded_logic.py          # Single source of truth: category detection, weight
│   │   │                             #   validation, brand DB, price caps, qualification
│   │   ├── deal_detector.py          # Hard filters → scoring (0-100) → quality gate →
│   │   │                             #   similarity dedup → top-200 selection
│   │   ├── product_classifier.py     # Subtype enrichment: infused, pack, vape/conc subtypes
│   │   ├── parser.py                 # Raw text → structured fields (prices, weight, brand)
│   │   ├── metrics_collector.py      # Daily pipeline metrics → Supabase daily_metrics table
│   │   ├── enrichment_snapshots.py   # Weekly price distributions & cross-state brand pricing
│   │   ├── diagnose_disposables.py    # Vape subtype classification diagnostic
│   │   ├── debug.py                  # Database diagnostic utility
│   │   ├── test_connection.py        # Supabase connectivity check
│   │   ├── config/
│   │   │   ├── __init__.py
│   │   │   └── dispensaries.py       # All dispensary configs, UA pool, viewport pool,
│   │   │                             #   region→timezone mapping, fingerprint generation
│   │   ├── tests/
│   │   │   ├── conftest.py           # Fixtures: logic(), make_product(), scored_deals_pool()
│   │   │   ├── test_deal_detector.py # Hard filters, scoring, quality gate, dedup, top-200
│   │   │   ├── test_clouded_logic.py # Category detection, weight validation, parse_product
│   │   │   ├── test_parser.py        # Price extraction, weight parsing
│   │   │   ├── test_product_classifier.py
│   │   │   ├── test_enrichment.py    # Price distribution snapshots
│   │   │   ├── test_metrics_collector.py
│   │   │   ├── test_nv_regression.py # Nevada-specific regression tests
│   │   │   ├── test_platform_recon.py     # Live site platform detection (needs network)
│   │   │   ├── test_site_diagnostics.py   # Deep site health checks (needs network)
│   │   │   ├── test_michigan_diagnostic.py
│   │   │   ├── test_power_user_search.py
│   │   │   └── test_product_identification.py
│   │   ├── pyproject.toml            # Python project config (pytest settings)
│   │   └── requirements.txt          # playwright, playwright-stealth, supabase, python-dotenv
│   │
│   ├── frontend/                     # Next.js 14 React frontend (TypeScript + Tailwind)
│   │   ├── src/
│   │   │   ├── app/                  # Next.js App Router pages
│   │   │   │   ├── page.tsx          # Home — deal feed
│   │   │   │   ├── deals/[category]/ # Category-filtered deal pages
│   │   │   │   ├── dispensary/[slug]/# Per-dispensary deal pages
│   │   │   │   ├── deal/[id]/        # Individual deal + redirect
│   │   │   │   ├── admin/            # PIN-protected admin dashboard (6 tabs)
│   │   │   │   ├── api/              # API routes (search, health, auto-post, admin)
│   │   │   │   ├── blog/             # Blog listing and individual posts
│   │   │   │   ├── downtown-dispensary-deals/ # Downtown-focused deals SEO page
│   │   │   │   ├── local-dispensary-deals/    # Local deals SEO page
│   │   │   │   └── ...               # SEO pages, auth callback, saves, sitemap
│   │   │   ├── components/           # React components
│   │   │   │   ├── DealCard.tsx      # Core deal display card
│   │   │   │   ├── DealsPage.tsx     # Main deal feed
│   │   │   │   ├── FilterSheet.tsx   # Category/brand/dispensary filters
│   │   │   │   ├── SearchPage.tsx    # Extended search (rate-limited)
│   │   │   │   ├── badges/           # Deal badges (steal/fire/solid)
│   │   │   │   ├── modals/           # Deal detail, share, report modals
│   │   │   │   ├── seo/              # JSON-LD, breadcrumbs, SEO headers
│   │   │   │   ├── layout/           # Footer, age gate, sticky stats bar
│   │   │   │   ├── ftue/             # First-time user experience flow
│   │   │   │   └── CoachMark.tsx     # Interactive coach mark component
│   │   │   ├── lib/
│   │   │   │   ├── supabase.ts       # Lazy public client + service client (RLS bypass)
│   │   │   │   ├── api.ts            # Main data layer: fetchDeals(), fetchDispensaries(),
│   │   │   │   │                     #   searchExtendedDeals() — with capping + caching
│   │   │   │   ├── types.ts          # Core types: Category, Platform, Product, Deal
│   │   │   │   ├── region.ts         # Multi-region: southern-nv / northern-nv detection
│   │   │   │   ├── twitter.ts        # OAuth 1.0a Twitter API v2 client
│   │   │   │   ├── auto-post-selector.ts # Daily tweet deal selection logic
│   │   │   │   ├── haptics.ts        # Haptic feedback utility
│   │   │   └── ...               # analytics, auth, share, zip codes, SEO data
│   │   │   ├── hooks/                # useDeck, useSavedDeals, useAnalytics, useFilters
│   │   │   ├── middleware.ts         # Edge rate-limiting + security headers
│   │   │   └── types/index.ts        # Extended types: BadgeType, BrandTier, DealStatus
│   │   ├── package.json              # Next.js 14.2.35, React 18, Tailwind 3.4
│   │   ├── netlify.toml              # Deployment config (Node 22, security headers)
│   │   └── tailwind.config.ts
│   │
│   ├── supabase/
│   │   ├── config.toml               # Supabase project config
│   │   └── migrations/               # 001–039: schema, RLS, indexes, views
│   │       ├── 001_initial_schema.sql # dispensaries, products, deals, scrape_runs
│   │       └── ...                    # User tracking, analytics, search indexes,
│   │                                  #   price history, deal observations, retention KPIs
│   ├── scripts/
│   │   ├── migrate.sh                # Idempotent migration runner (requires psql)
│   │   └── all_migrations.sql        # Combined schema for fresh installs
│   └── shared/constants.ts           # Shared constants between frontend and scraper
│
├── .github/workflows/
│   ├── scrape.yml                    # Daily scraper — 33 cron jobs across 12 regions
│   ├── ci.yml                        # PR/push test suite (pytest, not-live, 10 min)
│   ├── recon.yml                     # Manual platform detection recon
│   ├── site-diagnostics.yml          # Manual deep site health checks
│   ├── tweet-deals.yml               # Auto-post 4 tweets/day to Twitter
│   ├── debug.yml                     # Manual database diagnostic
│   └── diagnose-disposables.yml      # Manual vape classification diagnostic
│
├── .claude/agents/
│   └── deal-curation-engineer.md     # Custom Claude agent for deal scoring/curation fixes
│
├── docs/                             # Strategy docs
│   └── INVESTOR-DILIGENCE-RESPONSES.md
│
├── archive/                          # Historical docs (no longer authoritative)
│   ├── README.md
│   ├── market-research/              # Pre-expansion research & planning
│   │   ├── DISPENSARY-EXPANSION-PLAN.md
│   │   ├── EXPANSION-ROADMAP-PHASES-2-4.md
│   │   ├── MARKET-COVERAGE-SPRINT-GUIDE.md
│   │   └── research-*.md             # Per-state market research
│   ├── audits/                       # Pre-beta QA reports
│   │   ├── QA-AUDIT-REPORT.md
│   │   └── MICHIGAN_TEST1_ANALYSIS.md
│   └── snapshots/
│       └── SCRAPE-REVIEW-2026-02-12.md
│
└── [root-level docs]                 # Active reference docs
    ├── BETA_STATUS_REPORT.md         # Consolidated beta audit + readiness
    ├── SEO-STRATEGY-PLAN.md
    ├── VEGAS-FLYER-CAMPAIGN.md
    └── ...
```

---

## Tech Stack

### Scraper (Python)
- **Python 3.11** (CI uses 3.11; pyproject requires >=3.10)
- **Playwright** >=1.40.0 — browser automation
- **playwright-stealth** >=1.0.6 — anti-bot evasion patches
- **supabase** >=2.3.0 — database client
- **python-dotenv** >=1.0.0 — env var loading
- **pytest** >=8.0.0 — test runner (async via `asyncio_mode = "auto"`)

### Frontend (TypeScript)
- **Next.js 14.2.35** (App Router, React 18)
- **TypeScript 5**, **Tailwind CSS 3.4.1**
- **@supabase/supabase-js** ^2.94.0 + **@supabase/ssr** ^0.8.0
- **lucide-react** — icons
- **react-spring** + **@use-gesture/react** — animations and gestures
- **Deployed on Netlify** (Node 22, `@netlify/plugin-nextjs`)

### Database
- **Supabase** (hosted PostgreSQL)
- 39 migrations (001–039)
- Core tables: `dispensaries`, `products`, `deals`, `scrape_runs`, `daily_metrics`
- User tables: `user_sessions`, `user_events`, `user_saved_deals`, `analytics_events`
- RLS policies: public read for deals/products, service-role for writes

### CI/CD
- **GitHub Actions** — all automation
- 7 workflow files (scrape, CI, recon, diagnostics, tweets, debug, diagnose-disposables)

---

## Environment Variables

### Scraper (`clouded-deals/scraper/.env`)
```
SUPABASE_URL=             # Supabase project URL
SUPABASE_SERVICE_KEY=     # Service-role key (bypasses RLS)
```

**Runtime env vars (set by workflow or CLI):**
```
DRY_RUN=true|false        # Scrape only, skip DB writes
LIMIT_DISPENSARIES=true   # Test with 1 site per platform
PLATFORM_GROUP=stable|new|all
REGION=southern-nv|michigan-1|...
SINGLE_SITE=slug-name     # Scrape one dispensary by slug
FORCE_RUN=true|false      # Ignore idempotency check
SCRAPE_CONCURRENCY=6      # Total browser contexts (default)
```

### Frontend (`clouded-deals/frontend/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

TWITTER_API_KEY=
TWITTER_API_SECRET=
TWITTER_ACCESS_TOKEN=
TWITTER_ACCESS_SECRET=

ADMIN_API_KEY=             # For protected /api endpoints
```

---

## Development Workflows

### Running Scraper Tests

```bash
cd clouded-deals/scraper
pip install -r requirements.txt
pip install pytest

# Run all unit tests (excludes live site tests)
python -m pytest tests/ -v --tb=short -m "not live" --ignore=tests/test_platform_recon.py

# Run specific test file
python -m pytest tests/test_deal_detector.py -v

# Run by keyword
python -m pytest tests/ -k "test_infused" -v
```

**Test markers:**
- `@pytest.mark.live` — hits real dispensary sites (needs network + Playwright browsers)
- `@pytest.mark.slow` — takes 30–120s per test case

### Running Scraper Locally

```bash
cd clouded-deals/scraper

# Scrape all active sites (requires .env with Supabase creds)
python main.py

# Scrape single site by slug
python main.py td-gibson

# Dry run (scrape but don't write to DB)
DRY_RUN=true python main.py

# Test with limited sites
LIMIT_DISPENSARIES=true python main.py

# Specific region
REGION=southern-nv python main.py
```

### Running Frontend Locally

```bash
cd clouded-deals/frontend
npm install
npm run dev          # Dev server on localhost:3000
npm run build        # Production build
npm run lint         # ESLint
```

### Database Migrations

```bash
cd clouded-deals
./scripts/migrate.sh [DB_CONNECTION_STRING]
```

---

## Scraper Architecture

### Data Pipeline

```
main.py orchestrator
  → Load dispensary configs from config/dispensaries.py
  → Filter by REGION / PLATFORM_GROUP
  → Launch browser pool (shared Chrome contexts)
  → For each dispensary:
      → Route to platform scraper (Dutchie/Jane/Curaleaf/Carrot/AIQ)
      → Dismiss age gate (handlers/age_verification.py)
      → Extract products (platform-specific)
      → Parse raw text → structured fields (parser.py)
      → Detect category, validate weight (clouded_logic.py)
      → Classify subtypes (product_classifier.py)
  → Score all products (deal_detector.py)
      → Hard filters (price caps, min discount, data quality)
      → Composite score 0-100 (discount depth, brand tier, unit value)
      → Quality gate (reject garbage data)
      → Similarity dedup (brand+category diversity)
      → Select top ~200 deals
  → Upsert products + deals to Supabase
  → Collect metrics (metrics_collector.py) → daily_metrics table
```

### Platform Scrapers

All scrapers inherit `BaseScraper` and implement `async scrape()`:

| Platform | Sites | Complexity | Concurrency Cap | Key Challenge |
|----------|-------|------------|-----------------|---------------|
| **Dutchie** | ~1,260 | High | 3 | iframe/JS-embed detection, category tabs, pagination |
| **Jane** | ~696 | Medium | 4 | Hybrid iframe/direct, "View More" load-more |
| **Curaleaf** | ~122 | Medium | 4 | React SPA, redirect-based age gate, overlay dismissal |
| **Carrot** | 5 | Low | 3 | SPA or WordPress embed, lazy-load scroll |
| **AIQ** | 2 | Low | 3 | Dispense React SPA, Load More buttons |
| **Rise** | 37 | N/A | — | 100% Cloudflare Turnstile blocked (all disabled) |

### Anti-Bot Stack

1. **playwright-stealth** — patches navigator props, WebGL fingerprinting
2. **Rotated User-Agents** — Chrome 133–134 pool, one per context
3. **Randomized viewports** — 4 base resolutions (1920x1080, 1366x768,
   1440x900, 1536x864) with jitter (±16px width, ±8px height)
4. **Region-mapped timezones** — each context gets timezone matching dispensary
   location (e.g. `michigan` → `America/Detroit`)
5. **Rotated locale** — `en-US` variant pool per context
6. **JS stealth init script** — overrides webdriver detection, fake plugins
7. **Real Chrome channel** — branded Chrome (not Chromium) for TLS fingerprint
8. **Startup jitter** — 0–180s random delay on scheduled cron runs

### Deal Scoring

**Hard filter thresholds:**
- Global price: $3.00–$100.00 sale price
- Minimum discount: 15% (12% for edibles/prerolls)
- Maximum discount: 85% (data error threshold)
- Category-specific price caps:
  - Flower: $22 (3.5g), $40 (7g), $55 (14g), $100 (28g)
  - Vape: $25 (fallback); subtype-specific caps for disposable/cart/pod by size
  - Edible: $15, Concentrate: $18 (0.5g) / $25 (1g) / $50 (2g)
  - Preroll: $9, Infused preroll: $15, Preroll pack: $20
- Vape subtype price floors (disposable ≤0.6g: $8, >0.6g: $17; carts/pods lower)

**Badge thresholds (from score 0–100):**
- **STEAL:** score >= 85
- **FIRE:** 70–84
- **SOLID:** 50–69

**Disposable scoring boost:** +12pts for vape products classified as
disposable, compensating for inventory underrepresentation (~25% of NV users
are disposable-exclusive).

**Top-200 category targets:**
- Flower: 58, Disposable: 30, Edible: 29, Concentrate: 29, Preroll: 24,
  Vape (cart/pod): 21, Other: 9

---

## Coverage (as of Mar 2026)

**~2,122 active dispensaries** across 11 states (12 regions), 6 platforms.

| Region | Sites | Platforms | Status |
|--------|-------|-----------|--------|
| Southern NV | 53 | Dutchie, Curaleaf, Jane, Carrot, AIQ | Production (consumer-facing) |
| Northern NV | 40 | Dutchie, Curaleaf, Jane, Carrot, AIQ | Production (consumer-facing) |
| Michigan | 446 | Dutchie, Jane, Curaleaf | Data collection only |
| Missouri | 261 | Dutchie, Jane | Data collection only |
| Ohio | 247 | Dutchie, Jane, Curaleaf | Data collection only |
| New Jersey | 232 | Dutchie, Jane, Curaleaf | Data collection only |
| Colorado | 200 | Dutchie, Jane | Data collection only |
| Massachusetts | 184 | Dutchie, Jane | Data collection only |
| Illinois | 166 | Dutchie, Jane, Curaleaf, Rise(disabled) | Data collection only |
| Arizona | 127 | Dutchie, Curaleaf | Data collection only |
| New York | 73 | Dutchie, Jane | Data collection only |
| Pennsylvania | 43 | Dutchie, Jane, Curaleaf | Data collection only |

Only Nevada is consumer-facing. All other states collect data for ML training,
brand intelligence, and future market launches.

---

## CI/CD Workflows

| Workflow | Trigger | Purpose | Timeout |
|----------|---------|---------|---------|
| `scrape.yml` | 33 daily crons + manual | Scrape dispensaries by region shard | 120 min |
| `ci.yml` | PRs to `scraper/**` + pushes to main | Run pytest (unit tests only) | 10 min |
| `recon.yml` | Manual | Platform detection recon across sites | 30 min |
| `site-diagnostics.yml` | Manual | Deep site health analysis | 90 min |
| `tweet-deals.yml` | 4x daily + manual | Auto-post deals to Twitter | 5 min |
| `debug.yml` | Manual | Database diagnostic dump | 5 min |
| `diagnose-disposables.yml` | Manual | Vape product classification diagnostic | 5 min |

**Scrape workflow region sharding:** Large states are sharded into parallel
cron jobs (Michigan = 6 shards, Missouri/Ohio/NJ = 4 shards, Illinois/Colorado
= 3 shards, Arizona/Massachusetts/NY = 2 shards). Each shard runs at a
staggered 2-minute offset. All times DST-adjusted as of March 8, 2026.

---

## Key Source Files — Quick Reference

### Scraper (business logic)

| File | Purpose | Key exports |
|------|---------|-------------|
| `clouded_logic.py` | **Single source of truth** — category detection, weight validation, brand DB (264), price caps, disposable brand lines, qualification | `CloudedLogic.detect_category()`, `validate_weight()`, `parse_product()`, `is_qualifying()` |
| `deal_detector.py` | Hard filters → scoring → quality gate → dedup → top-200 | `detect_deals()`, `passes_hard_filters()`, `calculate_deal_score()`, `select_top_deals()` |
| `product_classifier.py` | Post-detection enrichment: infused, pack, vape/concentrate/edible subtypes, disposable detection (brand-specific), category correction | `classify_product()` → `{is_infused, product_subtype, corrected_category}` |
| `parser.py` | Raw text extraction: prices (was/now, bundle, BOGO), weight, brand, THC/CBD | Pure functions, regex-based |
| `metrics_collector.py` | Pipeline metrics: counts, category breakdown, score distribution, enrichment rates | `collect_daily_metrics()` |
| `enrichment_snapshots.py` | Weekly: price distributions by (region, category, weight_tier), cross-state brand pricing | `compute_price_distributions()`, `compute_brand_pricing()` |
| `diagnose_disposables.py` | Vape subtype classification diagnostic (DB + offline modes) | CLI tool, no exports |

### Scraper (browser automation)

| File | Purpose |
|------|---------|
| `platforms/base.py` | `BaseScraper` — browser launch, context manager, anti-bot fingerprinting, debug screenshots |
| `handlers/age_verification.py` | Universal age-gate dismissal: primary selectors → secondary → JS fallback → MutationObserver |
| `handlers/iframe.py` | Dutchie content detection cascade: iframe → JS embed → direct page |
| `handlers/pagination.py` | Platform-specific pagination: Dutchie (page N buttons), Curaleaf (numbered), Jane (View More) |
| `config/dispensaries.py` | ~2,122 dispensary configs, UA pool (Chrome 133–134), viewport pool, region→timezone map |

### Frontend (data layer)

| File | Purpose |
|------|---------|
| `lib/api.ts` | Main data layer: `fetchDeals()`, `fetchDispensaries()`, `searchExtendedDeals()` — with chain/brand capping, localStorage cache |
| `lib/supabase.ts` | Lazy public client (anon key + RLS) + service client (service-role, bypasses RLS) |
| `lib/region.ts` | Region detection: ZIP code → geolocation → default southern-nv |
| `lib/types.ts` | Core types: `Category`, `Platform`, `Product`, `Deal`, `Dispensary` |
| `middleware.ts` | Edge rate-limiting (sliding window per IP) + security headers |

---

## Testing Conventions

- **Framework:** pytest with `asyncio_mode = "auto"` (pyproject.toml)
- **Test paths:** `clouded-deals/scraper/tests/`
- **CI command:** `python -m pytest tests/ -v --tb=short -m "not live" --ignore=tests/test_platform_recon.py`
- **Key fixtures (conftest.py):**
  - `logic()` — fresh `CloudedLogic` instance per test
  - `make_product()` — factory for product dicts with sensible defaults
  - `scored_deals_pool()` — 150+ pre-scored deals for selection tests
- **Markers:**
  - `@pytest.mark.live` — requires network + Playwright (excluded from CI)
  - `@pytest.mark.slow` — 30–120s per test
- **Pattern:** Unit tests are pure/mocked; live tests are in separate files
  (`test_platform_recon.py`, `test_site_diagnostics.py`)

---

## Beta Lock (Feb 22, 2026)

All platforms are in **locked beta**. Rules:
- No new sites, no new scrapers
- Surgical fixes only (see `OPERATIONS.md` for criteria)
- Anti-bot and reliability improvements are permitted
- Data collection continues across all 11 states

---

## Documentation Map

### Current & Authoritative

| Document | Audience | Content |
|----------|----------|---------|
| `OPERATIONS.md` (root) | Engineering, Ops | Complete ops reference — coverage, pipeline, anti-bot, platform status |
| `CLAUDE.md` | AI assistants | This file — project instructions and codebase guide |
| `BETA_STATUS_REPORT.md` | Engineering | Consolidated beta audit + readiness report (all P0s resolved) |
| `clouded-deals/docs/README.md` | New contributors | Setup instructions for scraper + frontend + DB |
| `docs/INVESTOR-DILIGENCE-RESPONSES.md` | Investors | Product positioning, TAM, cost structure Q&A |
| `SEO-STRATEGY-PLAN.md` | Marketing | SEO/AI visibility plan (llms.txt, JSON-LD, GSC) |
| `VEGAS-FLYER-CAMPAIGN.md` | Marketing | Guerilla QR flyer campaign for Vegas Strip |
| `clouded-deals/docs/AUDIT-dashboard-kpi.md` | Engineering | Dashboard KPI improvements (awaiting implementation) |

### Historical / Reference (archived in `/archive/`)

| Document | Status | Notes |
|----------|--------|-------|
| `archive/market-research/DISPENSARY-EXPANSION-PLAN.md` | Superseded | Planned ~600 sites; achieved 2,122 |
| `archive/market-research/EXPANSION-ROADMAP-PHASES-2-4.md` | Superseded | Phase planning complete |
| `archive/market-research/research-*.md` | Superseded | Pre-expansion market research; states now live |
| `archive/snapshots/SCRAPE-REVIEW-2026-02-12.md` | Snapshot | Feb 12 data quality snapshot |
| `archive/audits/QA-AUDIT-REPORT.md` | Snapshot | Feb 8 pre-beta QA (many items fixed) |
| `archive/audits/MICHIGAN_TEST1_ANALYSIS.md` | Snapshot | Feb 12 test run analysis (bugs fixed) |

---

## Custom Agents

### deal-curation-engineer

Defined in `.claude/agents/deal-curation-engineer.md`. Expert in deal scoring,
filtering, curation logic, and per-dispensary category coverage. Use when deal
quality is wrong, bad deals are surfacing, good deals are missing, category
variety is broken, or the curation pipeline needs surgical fixes. Has access
to: Read, Edit, Write, Bash, Grep, Glob.

**Rule:** Beta-locked — surgical fixes only, never touch the scraper layer,
maintain 90%+ site success rate.

---

## Important Patterns

### Supabase usage (scraper)
```python
db = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
db.table("products").upsert([...]).execute()
db.table("deals").select(...).eq("is_active", True).execute()
```

### Supabase usage (frontend)
```typescript
// Browser (RLS-enforced)
const supabase = getSupabase()
// Server (bypasses RLS)
const serviceClient = createServiceClient()
```

### Scraper async pattern
```python
async with DutchieScraper(dispensary_cfg) as scraper:
    products = await scraper.scrape()
# Automatic cleanup on __aexit__
```

### Error handling
- Pagination: up to 3 retries; 5 consecutive empty pages before stopping
- Age gate: primary selectors (5s) → secondary (3s) → JS fallback
- Click: normal → force → JavaScript (3 strategies)
- Frontend: localStorage cache (24h TTL) for offline resilience

### Logging
```python
logger = logging.getLogger(__name__)
logger.info("[%s] Scraped %d products", self.slug, count)
```
