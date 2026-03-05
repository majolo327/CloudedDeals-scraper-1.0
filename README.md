# CloudedDeals

A cannabis deal aggregator that scrapes ~2,072 dispensary websites daily across
11 states, scores deals, and displays the best ones to consumers. Built with
Playwright (Python), Next.js 14 (TypeScript), and Supabase (PostgreSQL).

**Status:** Locked Beta (Feb 22, 2026) — Nevada consumer-facing, 10 additional
states in data-collection mode.

## Architecture

```
GitHub Actions (33 daily cron jobs)
  └─ Python Playwright scraper (6 platform adapters)
       └─ Supabase (PostgreSQL + RLS)
            └─ Next.js 14 frontend (Netlify)
                 └─ PIN-gated admin dashboard
```

## Project Structure

```
clouded-deals/
├── scraper/        # Python Playwright scraper
│   ├── platforms/  # Dutchie, Jane, Curaleaf, Carrot, AIQ, Rise
│   ├── handlers/   # Age gate, iframe detection, pagination
│   ├── tests/      # pytest suite (unit + live markers)
│   └── config/     # ~2,072 dispensary configs, fingerprint pools
├── frontend/       # Next.js 14 (TypeScript + Tailwind)
│   └── src/        # App Router pages, components, lib, hooks
├── supabase/       # 38 migrations (schema, RLS, indexes)
├── scripts/        # Migration runner, seed data
└── docs/           # Setup guide
```

## Quick Start

See [clouded-deals/docs/README.md](clouded-deals/docs/README.md) for full
setup instructions.

**Scraper:**
```bash
cd clouded-deals/scraper
pip install -r requirements.txt
playwright install chrome chromium
python main.py                        # Scrape all regions
python main.py td-gibson              # Single site by slug
DRY_RUN=true python main.py           # Scrape without DB writes
```

**Frontend:**
```bash
cd clouded-deals/frontend
npm install
npm run dev                            # localhost:3000
```

**Tests:**
```bash
cd clouded-deals/scraper
pip install pytest
python -m pytest tests/ -v --tb=short -m "not live"
```

## Key Documentation

| Document | Purpose |
|----------|---------|
| [CLAUDE.md](CLAUDE.md) | AI assistant instructions and full codebase guide |
| [OPERATIONS.md](OPERATIONS.md) | Authoritative ops reference (coverage, pipeline, anti-bot) |
| [BETA_STATUS_REPORT.md](BETA_STATUS_REPORT.md) | Consolidated beta audit and open items |
| [clouded-deals/docs/README.md](clouded-deals/docs/README.md) | Setup instructions |

## Tech Stack

- **Scraper:** Python 3.11, Playwright, playwright-stealth, Supabase client
- **Frontend:** Next.js 14.2, React 18, TypeScript 5, Tailwind CSS 3.4
- **Database:** Supabase (PostgreSQL) with RLS
- **Deployment:** Netlify (frontend), GitHub Actions (scraper cron)
- **Platforms scraped:** Dutchie, Jane, Curaleaf, Carrot, AIQ (Rise disabled)
