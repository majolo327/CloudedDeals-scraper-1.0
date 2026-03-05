# Beta Status Report

**Audit dates:** February 14, 2026 (initial) | March 5, 2026 (latest update)
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
streaks, smart tips, dead code), DB CHECK constraints added, foreign keys
added, composite indexes added, security headers hardened, cannabis legal
disclaimers added, beta indicator added, DST cron adjustment. Post-lock:
disposable vape classification overhaul, 3 UX polish phases, retention KPI
migration, blog pages, coach marks (re-added), haptic feedback.

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
| Feature bloat (~1,200 lines) | Deleted: challenges, streaks, brand affinity, smart tips, preference selector, dead components. Coach marks re-added in UX Phase 1 (Mar 2026) as a targeted onboarding tool. |
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

## Scoring Algorithm Status (verified correct as of Mar 5, 2026)

- **Unit value scoring** — per-category $/g and $/mg thresholds, well-calibrated
- **Top-200 selection** — stratified by category with round-robin diversity;
  dedicated disposable allocation (30 slots) alongside carts/pods (21 slots)
- **3-level deduplication** — per-dispensary, cross-chain, global name
- **Quality gates** — brand required, name >=5 chars, weight required for
  flower/concentrate/vape
- **Hard filters** — $3-$100 range, 15-85% discount (12% min for edibles/prerolls),
  category price caps, vape subtype price floors
- **Brand detection** — 264 brands with alias handling and strain blockers
- **Disposable scoring boost** — +12pts for disposable vapes (compensates for
  inventory underrepresentation; ~25% of NV users are disposable-exclusive)
- **Disposable classification** — brand-specific product line detection (~30
  brand lines) in `clouded_logic.py` + `product_classifier.py`

**Price caps (tightened Mar 2026):**

| Category | Cap | Status |
|----------|-----|--------|
| Flower 3.5g | $22 | Tightened from $25 |
| Flower 7g | $40 | Tightened from $45 |
| Flower 14g | $55 | Tightened from $65 |
| Flower 28g | $100 | Good |
| Vape (fallback) | $25 | Tightened from $35 |
| Edible | $15 | Tightened from $18 |
| Concentrate 0.5g | $18 | New |
| Concentrate 1g | $25 | Tightened from $45 |
| Concentrate 2g | $50 | New |
| Preroll | $9 | Tightened from $10 |
| Infused preroll | $15 | New |
| Preroll pack | $20 | New |

**Vape subtype caps (size-aware, new):**

| Subtype | Size | Floor | Cap |
|---------|------|-------|-----|
| Disposable | ≤0.6g | $8 | $25 |
| Disposable | >0.6g | $17 | $35 |
| Cart/Pod | ≤0.6g | $7 | $25 |
| Cart/Pod | >0.6g | $14 | $35 |

---

## What's Solid

- Scraper architecture (6 platforms, ~2,122 sites, proven patterns)
- Disposable vape classification (brand-specific detection, dedicated scoring
  boost, size-aware price floors/caps, 30-slot allocation in top-200)
- Frontend UX (3 polish phases shipped: haptics, coach marks, smart defaults,
  pull-to-refresh, sticky CTA, transitions, accessibility improvements)
- Mobile responsive (touch-friendly, safe-area, responsive grid)
- SEO foundation (sitemap, JSON-LD, canonicals, OG images, breadcrumbs, blog)
- Data pipeline (automated daily scrapes, quality scoring, diversity selection)
- Analytics (comprehensive event tracking, server-side retention KPIs, 90-day
  cohort tracking via migration 039)
- Security basics (constant-time PIN, RLS, env secrets, no source maps)

---

*Re-run this audit before public launch. Focus areas: Sentry, cookie consent,
privacy policy, CSRF, frontend tests, uptime monitoring. Last full review:
Mar 5, 2026.*
