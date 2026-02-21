# CloudedDeals Operations & Roadmap

## Current State (Feb 2026)

- **11 states** active: NV, MI, IL, AZ, MO, NJ, OH, CO, NY, MA, PA
- **~1,493 dispensary sites** configured and scraping daily via GitHub Actions cron
- **~33,000+ unique products** in database with deal scoring pipeline
- **Admin dashboard** consolidated to 4 tabs: Dashboard, Scraper, Analytics, Settings
- **Flagged products** workflow: users flag misinfo from frontend, admin reviews/edits/hides from dashboard
- **Cookie consent** and global error page in place for compliance

## Architecture

```
GitHub Actions (cron)
  └─ Python Playwright scraper
       └─ Supabase (PostgreSQL)
            └─ Next.js 14 frontend (Netlify)
                 └─ Admin dashboard (PIN-gated)
```

## Daily Operations

- Scrapers run on cron schedule via GitHub Actions (waves by region)
- Monitor via admin Dashboard: pipeline status banner, success rate, flagged products
- Stale data detection: frontend shows amber indicator if data >26 hours old
- Overnight (12am-8am PT): expired deals shown with "yesterday's deals" banner

---

## Near-Future Upgrades (Bookmarked)

### Auto-Deactivate Broken Sites
**Priority:** Medium | **Effort:** ~2-4 hours

If a dispensary site fails scraping 3+ consecutive runs, automatically set `is_active = false` in the dispensaries table. This prevents broken sites from inflating failure counts and cluttering logs.

**Implementation notes:**
- Add `consecutive_failures` column to `dispensaries` table (default 0)
- Scraper increments on failure, resets to 0 on success
- When `consecutive_failures >= 3`, set `is_active = false`
- Admin dashboard shows "auto-deactivated" sites with a reactivation button
- Consider a migration: `ALTER TABLE dispensaries ADD COLUMN consecutive_failures INT DEFAULT 0;`

### Workflow Exit Code Hardening
**Priority:** Medium | **Effort:** ~1-2 hours

Ensure GitHub Actions workflows return proper exit codes so failures are visible in the Actions tab. Currently some partial failures may exit 0.

**Implementation notes:**
- Audit `main.py` and each region runner for exit code behavior
- `completed_with_errors` should exit 1 if >20% of sites failed
- `failed` status should always exit 1
- Add workflow step to check scrape_runs table status after run completes
- Slack/email alerting (when ready) should key off these exit codes

### Slack/Email Alerting
**Priority:** Low (deferred) | **Effort:** ~2 hours

Add Slack webhook notifications for:
- Pipeline status changes (healthy → degraded, degraded → down)
- Scraper failures (>3 sites failed in a single run)
- New flagged products (batch summary, not per-flag)

### Run Now Button (Wire to GitHub Actions)
**Priority:** Low | **Effort:** ~3-4 hours

The admin Scraper page has a "Run Now" button that currently isn't wired up. To make it functional:
- Create `/api/scraper/trigger` route that calls GitHub Actions `workflow_dispatch` API
- Requires `GITHUB_TOKEN` with `actions:write` scope in environment
- Support region filter parameter to match GitHub Actions input
- Show real-time status polling after trigger

---

## Monitoring Checklist (Manual for Beta)

- [ ] Check admin Dashboard daily for pipeline status
- [ ] Review flagged products weekly (or when count > 0)
- [ ] Spot-check 5-10 random deals weekly for accuracy
- [ ] Monitor GitHub Actions for failed workflow runs
- [ ] Check Netlify deploy logs after pushes

---

## Locked Beta (Feb 22 – Mar 21, 2026)

**System is LOCKED.** No new features, no refactors, no expansion. Surgical fixes only.

152 commits shipped Feb 13–21. Category coverage gap fixed (Dutchie specials-only sites now scrape full menu). Scraper regression resolved (iframe cascade, Shadow DOM, about:blank). 3,101 lines of frontend bloat cut. Security hardened. 24 cron jobs running daily across 11 states.

See root `OPERATIONS.md` addendum for full changelog and locked beta plan.
