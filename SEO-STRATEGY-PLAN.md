# CloudedDeals SEO Engineering Plan

> **Last Updated:** 2026-02-13
> **Domain:** cloudeddeals.com (live on Netlify)
> **Stack:** Next.js 14 / Tailwind / Supabase / Netlify
> **Target:** Tourists + Locals searching for Las Vegas cannabis deals

---

## Status Overview

### DONE
| Item | Phase | Date |
|------|-------|------|
| robots.txt (allow public, block admin/auth/api/saves) | Phase 1 | Feb 13 |
| Dynamic XML sitemap (41 pages: 9 static + 5 category + 27 dispensary) | Phase 1 | Feb 13 |
| Canonical tags on all pages via `metadata.alternates.canonical` | Phase 1 | Feb 13 |
| Meta tags overhaul — unique title + description per page type | Phase 1 | Feb 13 |
| JSON-LD: WebSite schema w/ SearchAction (sitelinks search box) | Phase 1 | Feb 13 |
| JSON-LD: Organization schema | Phase 1 | Feb 13 |
| JSON-LD: LocalBusiness schema on all 27 dispensary pages | Phase 1 | Feb 13 |
| JSON-LD: Product/Offer schema on deal pages (up to 10 products) | Phase 1 | Feb 13 |
| JSON-LD: BreadcrumbList schema on all subpages | Phase 1 | Feb 13 |
| JSON-LD: FAQPage schema | Phase 1 | Feb 13 |
| Breadcrumb navigation component (semantic `<nav>`) | Phase 3 | Feb 13 |
| SEO-optimized deals table component | Phase 2 | Feb 13 |
| SEO page header component | Phase 2 | Feb 13 |
| SEO footer with internal links | Phase 3 | Feb 13 |
| Dispensary pages — `/dispensary/[slug]` (27 pages, ISR) | Phase 2 | Feb 13 |
| Category pages — `/deals/[category]` (5 pages, ISR) | Phase 2 | Feb 13 |
| Hub landing page — `/las-vegas-dispensary-deals` | Phase 2 | Feb 13 |
| Strip landing page — `/strip-dispensary-deals` | Phase 2 | Feb 13 |
| OG image tags (1200x630) | Phase 1 | Feb 13 |
| Twitter card meta tags (summary_large_image) | Phase 1 | Feb 13 |
| Google Search Console — site verified | Phase 4 | Feb 13 |
| Google Search Console — sitemap submitted | Phase 4 | Feb 13 |
| Google Search Console — requested indexing for homepage, /las-vegas-dispensary-deals, /strip-dispensary-deals, /deals/flower | Phase 4 | Feb 13 |

### IN PROGRESS / NEXT UP
| Item | Phase | Priority | Owner |
|------|-------|----------|-------|
| Request indexing for remaining priority URLs (see list below) | Phase 4 | P0 | You (manual) |
| Unique SEO body copy on category pages | Phase 3 | P0 | Claude |
| Unique SEO body copy on dispensary pages | Phase 3 | P0 | Claude |
| Internal linking pass (cross-link dispensary ↔ category ↔ landing pages) | Phase 3 | P1 | Claude |
| Lighthouse audit + Core Web Vitals fixes | Phase 6 | P1 | Claude |

### NOT STARTED
| Item | Phase | Priority | Notes |
|------|-------|----------|-------|
| Blog setup (`/blog`) | Phase 5 | P2 | Long-tail keyword capture |
| Initial blog posts (5 planned) | Phase 5 | P2 | Start after core pages indexed |
| Cannabis directory submissions (Weedmaps, Leafly, etc.) | Phase 4 | P2 | Backlinks |
| Google Business Profile evaluation | Phase 4 | P2 | May not apply to aggregators |
| Zone pages (`/downtown-dispensary-deals`, etc.) | Phase 2 | P2 | After core pages prove out |
| GA4 setup | Phase 7 | P2 | Supplement existing Supabase analytics |
| Image optimization (WebP, srcset, alt text audit) | Phase 3 | P2 | Incremental gains |
| Twitter/social SEO synergy | Phase 5 | P2 | Each tweet links back to site |

---

## YOUR NEXT STEPS (Manual — do in GSC)

### Request Indexing for These URLs

You've already done: homepage, `/las-vegas-dispensary-deals`, `/strip-dispensary-deals`, `/deals/flower`

**Request indexing for these next** (in GSC > URL Inspection > paste URL > Request Indexing):

**Category pages (4 remaining):**
- `https://cloudeddeals.com/deals/vapes`
- `https://cloudeddeals.com/deals/edibles`
- `https://cloudeddeals.com/deals/concentrates`
- `https://cloudeddeals.com/deals/prerolls`

**High-traffic dispensary pages (do these first — highest branded search volume):**
- `https://cloudeddeals.com/dispensary/planet13`
- `https://cloudeddeals.com/dispensary/curaleaf-strip`
- `https://cloudeddeals.com/dispensary/medizin`
- `https://cloudeddeals.com/dispensary/td-gibson`
- `https://cloudeddeals.com/dispensary/td-decatur`
- `https://cloudeddeals.com/dispensary/the-grove`
- `https://cloudeddeals.com/dispensary/oasis`

**Note:** GSC limits you to ~10-12 indexing requests per day. Do the category pages + top dispensaries today, then do the remaining dispensaries over the next 2-3 days. Google will also discover them via the sitemap — manual requests just speed it up.

**Remaining dispensary pages (do over next 2-3 days):**
- `https://cloudeddeals.com/dispensary/curaleaf-western`
- `https://cloudeddeals.com/dispensary/curaleaf-cheyenne`
- `https://cloudeddeals.com/dispensary/curaleaf-the-reef`
- `https://cloudeddeals.com/dispensary/greenlight-downtown`
- `https://cloudeddeals.com/dispensary/greenlight-paradise`
- `https://cloudeddeals.com/dispensary/mint-paradise`
- `https://cloudeddeals.com/dispensary/mint-rainbow`
- `https://cloudeddeals.com/dispensary/deep-roots-cheyenne`
- `https://cloudeddeals.com/dispensary/deep-roots-craig`
- `https://cloudeddeals.com/dispensary/deep-roots-blue-diamond`
- `https://cloudeddeals.com/dispensary/deep-roots-parkson`
- `https://cloudeddeals.com/dispensary/cultivate-spring`
- `https://cloudeddeals.com/dispensary/cultivate-durango`
- `https://cloudeddeals.com/dispensary/thrive-sahara`
- `https://cloudeddeals.com/dispensary/thrive-cheyenne`
- `https://cloudeddeals.com/dispensary/thrive-strip`
- `https://cloudeddeals.com/dispensary/thrive-main`
- `https://cloudeddeals.com/dispensary/beyond-hello-sahara`
- `https://cloudeddeals.com/dispensary/beyond-hello-twain`
- `https://cloudeddeals.com/dispensary/rise-sunset`
- `https://cloudeddeals.com/dispensary/rise-tropicana`
- `https://cloudeddeals.com/dispensary/rise-rainbow`
- `https://cloudeddeals.com/dispensary/rise-nellis`
- `https://cloudeddeals.com/dispensary/rise-boulder`
- `https://cloudeddeals.com/dispensary/rise-durango`
- `https://cloudeddeals.com/dispensary/rise-craig`

### After Indexing
- **Check back in 2-3 days:** Go to GSC > Pages report to see what's indexed
- **Monitor keyword impressions:** GSC > Performance > Search results (data appears after ~3 days)

---

## CLAUDE'S NEXT STEPS (Code Work — Prioritized)

### Round 1: Content (Highest SEO Impact)
Google rewards pages with original content, not just data tables. This is the single biggest thing we can do right now.

**1. Add unique SEO copy to category pages (`/deals/[category]`)**
- Add an intro paragraph above the deals table (what this category is, what to look for, typical Vegas price ranges)
- Add a "Tips for buying {category} in Las Vegas" section below the table
- Each category gets unique, keyword-rich content (~150-250 words)
- Target keywords: "vegas vape deals", "las vegas edible deals", "cheapest flower las vegas", etc.

**2. Add unique SEO copy to dispensary pages (`/dispensary/[slug]`)**
- Add an "About {Dispensary}" section with location details, what they're known for, neighborhood context
- Tourist-friendly info: distance from strip, open hours, parking, etc.
- ~100-150 words per dispensary, unique to each

### Round 2: Internal Linking (Medium Impact, Fast)
**3. Cross-link dispensary ↔ category pages**
- On dispensary pages: "See all flower deals" → `/deals/flower`, "See all vape deals" → `/deals/vapes`, etc.
- On category pages: "Flower deals at Planet 13" → `/dispensary/planet13`, etc.
- In the footer: link to all 5 category pages + top dispensaries + both landing pages

**4. Contextual links in SEO copy**
- The new body copy from Round 1 should naturally link to related pages
- e.g. "Looking for vape deals near the Strip? Check out [Planet 13](/dispensary/planet13) and [Curaleaf Strip](/dispensary/curaleaf-strip)"

### Round 3: Performance (Ranking Signal)
**5. Lighthouse audit on key pages**
- Run Lighthouse on: homepage, `/las-vegas-dispensary-deals`, `/deals/flower`, `/dispensary/planet13`
- Target: Performance > 90, SEO > 95, Accessibility > 90
- Fix any flagged issues (LCP, CLS, FID/INP)

### Round 4: Future (P2 — After Core Pages Are Indexed)
**6. Blog setup + first posts** — capture long-tail keywords
**7. Cannabis directory submissions** — build backlinks
**8. Zone pages** — `/downtown-dispensary-deals`, etc.

---

## Target Keywords (Reference)

### Primary (High Intent, High Volume)
| Keyword | Target Page |
|---------|-------------|
| vegas weed deals | Homepage / Hub page |
| las vegas dispensary deals | `/las-vegas-dispensary-deals` |
| dispensary near the strip | `/strip-dispensary-deals` |
| vegas dispensary | `/las-vegas-dispensary-deals` |
| las vegas weed | Homepage |
| cheap weed las vegas | Hub page |

### Secondary (Category Intent)
| Keyword | Target Page |
|---------|-------------|
| vegas vape deals | `/deals/vapes` |
| las vegas edible deals | `/deals/edibles` |
| cheapest flower las vegas | `/deals/flower` |
| las vegas concentrate deals | `/deals/concentrates` |
| preroll deals vegas | `/deals/prerolls` |

### Long-Tail (Content / Blog)
| Keyword | Target Page |
|---------|-------------|
| best dispensary deals on the vegas strip | Blog / Strip page |
| cheapest dispensary in las vegas 2026 | Blog post |
| vegas dispensary deals today | Homepage (daily refresh) |
| planet 13 deals today | `/dispensary/planet13` |
| the dispensary henderson deals | `/dispensary/td-*` |
| best vape deals las vegas | `/deals/vapes` |

### Dispensary-Specific (Branded Search)
| Keyword | Target Page |
|---------|-------------|
| planet 13 deals | `/dispensary/planet13` |
| the dispensary nv deals | `/dispensary/td-*` |
| curaleaf las vegas deals | `/dispensary/curaleaf-*` |
| reef dispensary deals | `/dispensary/curaleaf-the-reef` |

---

## KPIs to Track

| Metric | Baseline (Now) | 3-Month Target | 6-Month Target |
|--------|---------------|-----------------|-----------------|
| Indexed pages | ~0 (just submitted) | 40+ | 80+ |
| Organic impressions/week | 0 | 500 | 5,000 |
| Organic clicks/week | 0 | 50 | 500 |
| Avg. position for "vegas dispensary deals" | N/A | Top 30 | Top 10 |
| Domain authority | 0 | 10 | 20 |
| Backlinks | 0 | 20 | 50 |

---

## Notes

- All SEO pages use ISR (revalidate every 1-3 hours) — content stays fresh without full rebuilds
- Deal data already exists in Supabase — pages are routing + rendering work
- No new scraping required — we're exposing existing data through SEO-friendly URLs
- Age verification gate must work on all pages (compliance)
- Mobile-first design is critical — most searches come from phones
- Google typically takes 3-7 days to index new pages after sitemap submission
