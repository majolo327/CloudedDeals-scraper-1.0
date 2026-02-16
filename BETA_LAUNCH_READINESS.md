# Beta Launch Readiness Audit

**Date:** February 14, 2026
**Scope:** Full-stack review for sending the site to a few dozen testers
**Site:** CloudedDeals — cannabis deal aggregator, launching in Las Vegas

---

## Executive Summary

CloudedDeals has strong technical foundations: a robust scraper (382 dispensaries, 6 platforms), a polished Next.js frontend with good loading/error/empty states, comprehensive SEO, and a solid data pipeline. However, the audit identified **blockers and high-priority gaps** across legal, security, data quality, and operational readiness that must be addressed before handing URLs to external testers.

Below is the full breakdown, organized by expert perspective, with each item tagged as **BLOCKER**, **HIGH**, **MEDIUM**, or **LOW** priority.

---

## 1. HEAD OF ENGINEERING — Technical Gaps

### BLOCKER: No custom 404 page
- No `not-found.tsx` exists. Beta testers who mistype URLs will see a raw Next.js default page.
- **Fix:** Create a branded 404 with a link back to the deals feed.

### BLOCKER: No security headers configured
- `netlify.toml` has zero security headers — no CSP, no X-Frame-Options, no X-Content-Type-Options, no HSTS.
- Any XSS found by testers could be fully exploitable.
- **Fix:** Add security headers block to `netlify.toml`.

### BLOCKER: Admin PIN has no server-side rate limiting
- The `/api/admin/verify-pin` endpoint accepts unlimited attempts. The client-side lockout (5-minute timer in localStorage) is trivially bypassed via dev tools.
- A 6-digit numeric PIN can be brute-forced in ~1M requests if unthrottled.
- **Fix:** Add server-side rate limiting (IP-based, 5 attempts per 15 minutes).

### HIGH: No frontend tests
- Zero Jest/Vitest tests exist for the frontend. Backend scraper has 10 test modules.
- For beta, at minimum add smoke tests for critical paths: deal loading, search, save/unsave.
- **Fix:** Configure Vitest and add smoke tests for deal feed, search, and API routes.

### HIGH: Health endpoint exposes business metrics publicly
- `/api/health` returns deal counts, category breakdowns, dispensary counts, and pipeline status with no authentication.
- A competitor or bad actor could monitor your data pipeline in real time.
- **Fix:** Require auth or restrict to internal IPs.

### HIGH: No error monitoring/alerting
- No Sentry, LogRocket, or equivalent configured. If beta testers hit errors, you won't know unless they report it manually.
- **Fix:** Add Sentry (free tier covers beta volume) before sharing with testers.

### MEDIUM: `dangerouslySetInnerHTML` on Terms page
- `TermsPage.tsx` renders a massive raw HTML string via `dangerouslySetInnerHTML`. The content is static and hardcoded (not user input), so the immediate XSS risk is low, but it's a brittle pattern.
- **Fix:** Consider converting to React components or sanitizing with DOMPurify.

### MEDIUM: No CSRF protection on admin endpoints
- `/api/admin/verify-pin` and `/api/deals/post` have no CSRF tokens. A malicious site could trigger requests.
- **Fix:** Add CSRF validation via custom header check (e.g., require `X-Requested-With`).

### MEDIUM: RLS allows unlimited anonymous inserts
- `analytics_events`, `user_saved_deals`, `user_dismissed_deals`, `user_sessions` all allow unlimited anonymous writes. A script could spam your analytics tables.
- **Fix:** Add Supabase rate limits or database-level triggers to cap rows per anon_id.

### LOW: No `npm audit` / dependency security scan in CI
- CI runs pytest but doesn't scan npm or pip dependencies for known vulnerabilities.
- **Fix:** Add `npm audit --audit-level=high` to CI pipeline.

---

## 2. CANNABIS ATTORNEY — Legal & Compliance

### BLOCKER: Terms of Service says "18+" but age gate says "21+"
- The ToS states: *"The Services are intended for users who are at least 18 years old."*
- The AgeGate component enforces 21+.
- This inconsistency creates legal exposure. Nevada cannabis law requires 21+. The Terms must match.
- **Fix:** Update the age requirement in Terms to 21+ (requires regenerating via Termly or manual edit).

### BLOCKER: No cannabis-specific legal disclaimers
The following are standard for any cannabis-adjacent website operating in Nevada and are currently absent:

1. **Federal illegality warning** — Cannabis remains a Schedule I controlled substance under federal law. Users must understand this.
2. **No interstate transport** — Purchasing or transporting cannabis across state lines is a federal offense.
3. **Impaired driving warning** — "Do not operate a vehicle or machinery while under the influence of cannabis."
4. **Nevada possession limits** — Adults 21+ may possess up to 1 oz of flower or 1/8 oz of concentrates.
5. **Consumption location** — Cannabis consumption is prohibited in public places in Nevada. Private property only.
6. **Not a point of sale** — CloudedDeals does not sell, distribute, or deliver cannabis products.
7. **Third-party accuracy** — CloudedDeals aggregates information from dispensaries and does not guarantee pricing accuracy.
8. **Health/pregnancy warning** — "Cannabis may be harmful to your health. Do not use if pregnant or nursing."

- **Fix:** Add a "Cannabis Disclaimer" section to Footer, SeoFooter, and a dedicated `/disclaimer` page.

### HIGH: No cookie consent banner
- The Privacy Policy discusses cookies and tracking, but no opt-in consent mechanism exists.
- While GDPR enforcement on a Las Vegas site is low risk for beta, CCPA applies to any California visitor, and testers may be in CA.
- **Fix:** Add a simple cookie consent banner for beta. A full preference center can wait until public launch.

### HIGH: Privacy Policy lacks cannabis-specific protections
- Cannabis purchase intent data is sensitive. The privacy policy doesn't acknowledge that browsing cannabis deals could have employment, legal, or insurance implications.
- **Fix:** Add a section acknowledging data sensitivity and explaining your data protection practices for cannabis-related browsing data.

### MEDIUM: Terms of Service appears auto-generated and incomplete
- Generated via Termly. Contains boilerplate for features that don't exist (user registration, payments, subscriptions, mobile app, reviews, advertisers).
- Beta testers with legal knowledge will notice.
- **Fix:** Remove sections that don't apply. Trim to what CloudedDeals actually does.

### MEDIUM: Contact email inconsistency
- Footer uses `hello@cloudeddeals.com`
- Terms/Privacy use `help@onclouded.com`
- **Fix:** Standardize to one email across all pages.

---

## 3. CANNABIS INDUSTRY ADVISOR — Market & Data Readiness

### BLOCKER: Deal volume below target — category diversity gaps
Per the Feb 12 scrape review:
| Category | Actual | Target | Gap |
|----------|--------|--------|-----|
| Total deals | 136 | 200 | -32% |
| Edibles | 9 | 30 | -70% |
| Concentrates | 14 | 30 | -53% |
| Pre-rolls | 5 | 20 | -75% |

If beta testers are cannabis consumers, they'll immediately notice thin selection in edibles, concentrates, and pre-rolls. This undermines the core value proposition ("every deal").

- **Root cause:** `MAX_SAME_BRAND_TOTAL=5` diversity caps are too aggressive for current supply.
- **Fix:** Implement dynamic caps — relax to 8-10 per brand when total supply is under 200. This is documented in SCRAPE-REVIEW-2026-02-12.md but not yet implemented.

### HIGH: Product name pollution
- THC percentages, promo text, and strain codes leak into displayed product names.
- Examples: "Wedding Cake 27.5% THC BOGO" instead of "Wedding Cake"
- **Fix:** Post-parse name cleanup to strip THC/CBD percentages, promo text, and strain codes. Documented in PLAN.md.

### HIGH: 8 Nevada sites failing (18% failure rate)
- 36 of 44 Nevada sites scrape successfully. 8 fail (Planet 13, SLV, Mint Paradise, others).
- Beta testers who shop at these dispensaries will see missing deals.
- **Fix:** Prioritize embed_type hints for the biggest-name failures (Planet 13 especially — it's the world's largest dispensary and a tourist landmark).

### MEDIUM: Scrape runtime is 2x target (62 min vs 30 min goal)
- Not user-facing, but affects operational reliability. If a scrape hangs, deals could be stale when testers check in the morning.
- **Fix:** Optimize concurrency and add per-site timeout enforcement.

### MEDIUM: No dispensary-level "last updated" timestamp visible to users
- Users can't tell when a specific dispensary's prices were last verified.
- **Fix:** Show "Updated X hours ago" on dispensary pages or deal cards.

---

## 4. CMO — Marketing, Brand & User Experience

### HIGH: No email capture on the main app for beta feedback
- The waitlist/email capture only appears for out-of-market users (RegionOverlay).
- Beta testers in Las Vegas have no way to subscribe for updates or provide structured feedback beyond the in-app widget.
- **Fix:** Add a lightweight "Join the beta" email capture in the footer or a banner for beta period.

### HIGH: About page has zero legal/compliance content
- The About page is clean and well-written, but has no disclaimers. It's the page journalists and partners will visit first.
- **Fix:** Add a minimal disclaimer at the bottom.

### MEDIUM: No social proof or credibility signals
- No testimonials, press mentions, user count, or beta program description.
- For testers, a simple "Beta — Help us improve" badge in the header would set expectations.
- **Fix:** Add a beta indicator in the header/nav so testers know they're evaluating a pre-launch product.

### MEDIUM: Twitter/X integration untested at scale
- The `/api/deals/post` route posts deals to @CloudedDeals. If beta testers follow the account, ensure the automated posting cadence makes sense and doesn't spam.
- **Fix:** Verify Twitter posting logic before sharing the @CloudedDeals handle with testers.

### LOW: No beta tester onboarding instructions
- When you share the URL, testers won't know what to look for or how to give feedback.
- **Fix:** Create a simple 1-page tester guide (separate from the codebase — a Google Doc or Notion page is fine).

---

## 5. COO — Operations & Infrastructure

### HIGH: No uptime monitoring
- No Pingdom, UptimeRobot, or equivalent. If Netlify goes down or Supabase has an outage, you'll learn from a tester's complaint.
- **Fix:** Set up free-tier uptime monitoring on the `/api/health` endpoint.

### HIGH: No data backup strategy documented
- Supabase handles backups on Pro plan, but if you're on Free plan, there are no automatic backups.
- **Fix:** Verify Supabase plan includes point-in-time recovery. If not, set up pg_dump via cron.

### HIGH: Single point of failure — GitHub Actions for scraping
- All scraping runs on GitHub Actions free tier. If Actions has an outage during your morning scrape window, testers see stale or empty data all day.
- **Fix:** Document a manual scrape procedure. Ensure someone on the team knows how to trigger `workflow_dispatch` manually.

### MEDIUM: No runbook for common failures
- What happens when Planet 13 goes down? When Supabase hits its connection limit? When Twitter API gets rate-limited?
- **Fix:** Write a 1-page incident runbook covering the top 5 failure scenarios.

### MEDIUM: Scrape schedule assumes PST/PDT but doesn't adjust for DST
- Cron times are in UTC. Nevada observes PDT in summer. The "8 AM local time" scrape will shift to 9 AM when clocks spring forward (March 8, 2026).
- **Fix:** Verify cron schedule accounts for DST. Adjust if needed.

### LOW: No staging environment
- There's only production. Any code changes go straight to the live site.
- **Fix:** For beta, this is acceptable if you're careful. For public launch, set up a staging branch with a separate Netlify deploy.

---

## Consolidated Action List — What to Do Before Sending to Testers

### Must Do (Blockers)

| # | Item | Owner | Category |
|---|------|-------|----------|
| 1 | Fix Terms of Service age to 21+ | Legal | Compliance |
| 2 | Add cannabis-specific disclaimers to footers | Legal | Compliance |
| 3 | Add security headers to `netlify.toml` | Eng | Security |
| 4 | Add server-side rate limiting on admin PIN endpoint | Eng | Security |
| 5 | Create custom 404 page | Eng | UX |
| 6 | Fix deal diversity caps (dynamic thresholds) | Eng | Data Quality |

### Should Do (High Priority, Before First Tester Feedback)

| # | Item | Owner | Category |
|---|------|-------|----------|
| 7 | Add error monitoring (Sentry) | Eng | Operations |
| 8 | Add uptime monitoring (UptimeRobot) | Ops | Operations |
| 9 | Fix product name pollution | Eng | Data Quality |
| 10 | Fix Planet 13 + top failing sites | Eng | Data Quality |
| 11 | Secure `/api/health` endpoint | Eng | Security |
| 12 | Add cookie consent banner | Eng | Compliance |
| 13 | Standardize contact email | Legal | Compliance |
| 14 | Add "Beta" indicator to header | Design | UX |
| 15 | Set up beta email capture for NV users | Eng | Marketing |

### Nice to Have (Before Public Launch)

| # | Item | Owner | Category |
|---|------|-------|----------|
| 16 | Add frontend smoke tests (Vitest) | Eng | Quality |
| 17 | Clean up Terms boilerplate | Legal | Compliance |
| 18 | Add cannabis privacy section to Privacy Policy | Legal | Compliance |
| 19 | Add CSRF protection to admin endpoints | Eng | Security |
| 20 | Implement npm audit in CI | Eng | Quality |
| 21 | Write incident runbook | Ops | Operations |
| 22 | Create beta tester onboarding doc | Marketing | Operations |
| 23 | Add "last updated" timestamps to deals | Eng | UX |
| 24 | Verify DST cron schedule | Ops | Operations |
| 25 | Add service worker for true offline support | Eng | UX |

---

## What's Already in Good Shape

Credit where due — these areas are solid and ready for beta:

- **Scraper architecture** — 6 platform adapters, 382 sites, proven patterns
- **Frontend UX** — Skeleton loaders, error states, empty states, offline caching, FTUE onboarding
- **Mobile responsiveness** — Touch-friendly, safe-area aware, responsive grid
- **SEO foundation** — Sitemap, JSON-LD, canonical tags, OG images, breadcrumbs
- **Feedback mechanisms** — Floating widget, inline prompts, deal reporting
- **Data pipeline** — Automated daily scrapes, quality scoring, diversity selection
- **Age gate** — Clean 21+ gate with localStorage persistence
- **Analytics** — Comprehensive event tracking (page views, saves, clicks, searches)
- **Region handling** — State-by-state cannabis legality awareness with waitlist capture
- **Security basics** — Constant-time PIN comparison, RLS on all tables, env-based secrets, no source maps

---

*This audit should be re-run after addressing blockers and before public launch.*
