# Beta Status Report

**Audit dates:** February 14, 2026 (initial) | February 26, 2026 (final update)
**Scope:** Full-stack audit — scraper pipeline, frontend, database, scoring,
legal, operations, marketing
**Status:** **LOCKED BETA** as of Feb 22, 2026. All blockers resolved.

> This document consolidates the original `BETA_AUDIT_REPORT.md` (engineering
> deep dive) and `BETA_LAUNCH_READINESS.md` (cross-functional readiness) into
> a single reference.

---

## Summary

6 P0 blockers identified on Feb 14 — **all 6 resolved** by Feb 22:

1. "$X off" price parsing bug — `parser.py` regex rewrite
2. Brand substring matching inflating scores — word-boundary regex
3. Discount scoring not capped — capped at 80%
4. Price swap logic order bug — rule reordering
5. Rise dispensaries blocked (Cloudflare Turnstile) — accepted, removed from UI
6. Jane products artificially inflated — baseline reduced 22 to 15pts

Additional work completed: 3,101 lines of frontend bloat removed (challenges,
streaks, smart tips, coach marks, dead code), DB CHECK constraints added,
foreign keys added, composite indexes added, security headers hardened,
cannabis legal disclaimers added, beta indicator added, DST cron adjustment.

---

## Resolved Items (P0 + P1 + P2)

### Data Pipeline (all fixed)

| # | Issue | Resolution |
|---|-------|------------|
| P0-1 | "$X off" price confusion | `_RE_WAS_NOW_OFF` regex, rule ordering corrected |
| P0-2 | Brand substring matching | `startswith()` + word-boundary check |
| P0-3 | Discount scoring uncapped | `min(discount, 80)` before scoring |
| P0-4 | Price swap logic order | Discount detection before swap before equality check |
| P0-5 | Rise 100% blocked | Accepted; removed from UI |
| P0-6 | Jane score inflation | Baseline 22 to 15pts |
| P1-7 | Duplicate category detection | `parser.detect_category()` deleted; `clouded_logic` is sole authority |
| P1-9 | Missing DB CHECK constraints | Migration 030 |
| P1-10 | Missing foreign keys | Migration 031 |
| P2-11 | Edible price cap too tight | Raised $14 to $18 (state-specific caps added) |
| P2-12 | Missing composite indexes | Added in migration 031 |

### Frontend (all fixed)

| Item | Resolution |
|------|------------|
| Feature bloat (~1,200 lines) | Deleted: challenges, streaks, brand affinity, smart tips, coach marks, preference selector, dead components |
| Product name pollution | `_clean_product_name()` strips prices, deal text, brand prefixes |
| Custom 404 page | `not-found.tsx` with branded styling |
| Beta indicator | "BETA" pill badge next to logo (PR #201) |
| NV email capture | Inline phone/email in early bird banner (PR #192) |

### Security & Compliance (all fixed)

| Item | Resolution |
|------|------------|
| Security headers | CSP, HSTS, X-Frame-Options, X-Content-Type-Options in `netlify.toml` + `middleware.ts` |
| Admin PIN rate limiting | Server-side 5 attempts / 15 min, constant-time comparison |
| Terms age requirement | Updated 18+ to 21+ |
| Cannabis disclaimers | 8 standard disclaimers added to Footer (federal, transport, driving, possession, not-a-retailer, accuracy, health) |

### Operations (all fixed)

| Item | Resolution |
|------|------------|
| DST cron schedule | All 33 scrape + 4 tweet crons shifted -1hr UTC for spring-forward |
| Site failures (18% rate) | PR #184 fixed 19/53 failures (iframe cascade, Shadow DOM, embed hints) |
| Deal diversity gaps | Dynamic caps: brand cap relaxes 5 to 10 when supply < 1.5x target |

---

## Open Items (deferred to post-beta / public launch)

### Engineering

| Item | Priority | Notes |
|------|----------|-------|
| Frontend tests (Vitest) | HIGH | Zero frontend tests; add before public launch |
| Error monitoring (Sentry) | HIGH | No crash visibility; free tier sufficient |
| Health endpoint auth | HIGH | `/api/health` exposes metrics publicly |
| CSRF on admin endpoints | MEDIUM | Low risk while PIN-protected |
| `dangerouslySetInnerHTML` on Terms | MEDIUM | Static content, low XSS risk |
| RLS anonymous insert limits | MEDIUM | Spam risk at scale |
| npm audit in CI | LOW | Add `npm audit --audit-level=high` |
| Pagination retry (exponential backoff) | LOW | Most failures are Cloudflare, not pagination |
| `deals` table redundancy | LOW | Duplicates `products.deal_score` |
| Full-text search index (trigram) | LOW | ILIKE fine at beta scale |
| `price_history` partitioning | LOW | Won't hit wall for months |
| Data retention policies | LOW | 3-month runway before concern |

### Legal & Compliance

| Item | Priority | Notes |
|------|----------|-------|
| Cookie consent banner | HIGH | CCPA applies to CA visitors |
| Cannabis privacy section | HIGH | Browsing intent data is sensitive |
| Terms boilerplate cleanup | MEDIUM | Auto-generated, contains irrelevant sections |
| Contact email standardization | LOW | `hello@cloudeddeals.com` vs `help@onclouded.com` |

### Operations

| Item | Priority | Notes |
|------|----------|-------|
| Uptime monitoring | HIGH | UptimeRobot free tier (5 min setup) |
| Supabase backup verification | HIGH | Verify plan includes PITR |
| Formal incident runbook | MEDIUM | OPERATIONS.md covers basics |
| Beta tester onboarding doc | LOW | Google Doc / Notion (owner action) |
| Staging environment | LOW | Netlify deploy previews suffice for beta |

---

## Scoring Algorithm Status (verified correct)

- **Unit value scoring** — per-category $/g and $/mg thresholds, well-calibrated
- **Top-200 selection** — stratified by category with round-robin diversity
- **3-level deduplication** — per-dispensary, cross-chain, global name
- **Quality gates** — brand required, name >=5 chars, weight required for
  flower/concentrate/vape
- **Hard filters** — $3-$100 range, 15-85% discount, category price caps
- **Brand detection** — 200+ brands with alias handling and strain blockers

**Price caps:**

| Category | Cap | Status |
|----------|-----|--------|
| Flower 3.5g | $25 | Good |
| Flower 7g | $45 | Good |
| Flower 14g | $65 | Good |
| Flower 28g | $100 | Good |
| Vape | $35 | Good |
| Edible | $18 | Raised from $14 |
| Concentrate 1g | $45 | Good |
| Preroll | $10 | Good |

---

## What's Solid

- Scraper architecture (6 platforms, ~2,072 sites, proven patterns)
- Frontend UX (skeletons, error/empty states, offline cache, FTUE)
- Mobile responsive (touch-friendly, safe-area, responsive grid)
- SEO foundation (sitemap, JSON-LD, canonicals, OG images, breadcrumbs)
- Data pipeline (automated daily scrapes, quality scoring, diversity selection)
- Analytics (comprehensive event tracking)
- Security basics (constant-time PIN, RLS, env secrets, no source maps)

---

*Re-run this audit before public launch. Focus areas: Sentry, cookie consent,
privacy policy, CSRF, frontend tests, uptime monitoring.*
