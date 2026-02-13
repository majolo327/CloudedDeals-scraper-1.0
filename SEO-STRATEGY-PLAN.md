# CloudedDeals SEO Engineering Plan

> **Status:** Pre-implementation plan — ready for review
> **Domain:** cloudeddeals.com (live on Netlify)
> **Stack:** Next.js 14 / Tailwind / Supabase / Netlify
> **Target:** Tourists + Locals searching for Las Vegas cannabis deals
> **Approach:** Start indexing during beta to build domain authority pre-launch

---

## Target Keywords (Priority Order)

### Primary (High Intent, High Volume)
| Keyword | Intent | Target Page |
|---------|--------|-------------|
| vegas weed deals | Tourist + Local | Homepage / Hub page |
| las vegas dispensary deals | Tourist + Local | `/las-vegas-dispensary-deals` |
| dispensary near the strip | Tourist | `/strip-dispensary-deals` |
| vegas dispensary | Tourist | `/las-vegas-dispensary-deals` |
| las vegas weed | Tourist | Homepage |
| cheap weed las vegas | Local + Tourist | Hub page |

### Secondary (Category Intent)
| Keyword | Intent | Target Page |
|---------|--------|-------------|
| vegas vape deals | Both | `/deals/vapes` |
| las vegas edible deals | Both | `/deals/edibles` |
| cheapest flower las vegas | Local | `/deals/flower` |
| las vegas concentrate deals | Both | `/deals/concentrates` |
| preroll deals vegas | Both | `/deals/prerolls` |

### Long-Tail (Content / Blog)
| Keyword | Intent | Target Page |
|---------|--------|-------------|
| best dispensary deals on the vegas strip | Tourist | Blog / Strip page |
| cheapest dispensary in las vegas 2026 | Local | Blog post |
| vegas dispensary deals today | Both | Homepage (daily refresh) |
| planet 13 deals today | Tourist | `/dispensary/planet-13` |
| the dispensary henderson deals | Local | `/dispensary/td-eastern` |
| best vape deals las vegas | Both | `/deals/vapes` |

### Dispensary-Specific (Branded Search)
| Keyword | Target Page |
|---------|-------------|
| planet 13 deals | `/dispensary/planet-13` |
| the dispensary nv deals | `/dispensary/td-*` |
| jade dispensary deals | `/dispensary/jade-*` |
| curaleaf las vegas deals | `/dispensary/curaleaf-*` |
| reef dispensary deals | `/dispensary/reef-*` |
| zen leaf deals | `/dispensary/zen-leaf-*` |

---

## Phase 1: Technical SEO Foundation

**Goal:** Make the site crawlable, indexable, and structured for search engines.

### 1.1 robots.txt
- **File:** `public/robots.txt` (or Next.js app route)
- **Allow:** All public pages (/, /search, /browse, /deals/*, /dispensary/*)
- **Disallow:** `/admin`, `/admin/*`, `/auth/*`, `/api/*`, `/saved`, `/saves/*`
- **Sitemap:** Reference `https://cloudeddeals.com/sitemap.xml`
- **Priority:** P0

### 1.2 XML Sitemap (Dynamic)
- **Route:** `src/app/sitemap.ts` (Next.js built-in sitemap generation)
- **Include:**
  - Static pages: `/`, `/about`, `/search`, `/browse`, `/terms`, `/privacy`
  - SEO landing pages: `/las-vegas-dispensary-deals`, `/strip-dispensary-deals`
  - Category pages: `/deals/flower`, `/deals/vapes`, `/deals/edibles`, `/deals/concentrates`, `/deals/prerolls`
  - Dispensary pages: `/dispensary/[slug]` for all 27 active dispensaries (fetched from Supabase)
  - Blog posts: `/blog/[slug]` (future)
- **Exclude:** `/admin/*`, `/auth/*`, `/saved`, `/saves/*`, `/deal/[id]` (ephemeral daily deals)
- **Update frequency:** Daily (dispensary pages change daily with new deals)
- **Priority:** P0

### 1.3 Canonical Tags
- Add `<link rel="canonical">` to all page layouts
- Homepage: `https://cloudeddeals.com`
- Deal pages: canonical to themselves (or to homepage if we decide deal pages are ephemeral)
- Prevent duplicate content from query params (`?deal=`, `?ref=`, `?auth=`)
- **Implementation:** Next.js `metadata.alternates.canonical` in each page's metadata export
- **Priority:** P0

### 1.4 Meta Tags Overhaul
- Every page gets unique, keyword-optimized `<title>` and `<meta description>`
- **Title formula:** `{Page-Specific Keyword} | CloudedDeals — Las Vegas Cannabis Deals`
- **Description formula:** Action-oriented, includes target keyword, under 160 chars
- Examples:
  - **Home:** `"Las Vegas Dispensary Deals Today | CloudedDeals"` / `"Every deal from every Las Vegas dispensary, updated daily at 8 AM. Compare prices on flower, vapes, edibles & concentrates."`
  - **Browse:** `"Browse Las Vegas Dispensaries & Brands | CloudedDeals"` / `"Explore 27+ Las Vegas dispensaries and top cannabis brands. Find the best deals on flower, vapes, edibles near the Strip and beyond."`
  - **Search:** `"Search Cannabis Deals in Las Vegas | CloudedDeals"` / `"Search thousands of cannabis products across Las Vegas dispensaries. Filter by brand, category, strain type, and price."`
- **Priority:** P0

### 1.5 Structured Data (JSON-LD)
- **Product Schema** on deal cards / deal detail pages:
  ```json
  {
    "@type": "Product",
    "name": "HAZE Fruit Gelly Live Resin Badder 1g",
    "brand": { "@type": "Brand", "name": "HAZE" },
    "offers": {
      "@type": "Offer",
      "price": "24.99",
      "priceCurrency": "USD",
      "availability": "InStock",
      "seller": { "@type": "LocalBusiness", "name": "Planet 13" }
    }
  }
  ```
- **LocalBusiness Schema** on dispensary pages:
  ```json
  {
    "@type": "LocalBusiness",
    "name": "Planet 13",
    "address": { "@type": "PostalAddress", "streetAddress": "...", "addressLocality": "Las Vegas", "addressRegion": "NV" },
    "geo": { "@type": "GeoCoordinates", "latitude": "...", "longitude": "..." },
    "url": "https://cloudeddeals.com/dispensary/planet-13"
  }
  ```
- **WebSite Schema** on homepage (for sitelinks search box):
  ```json
  {
    "@type": "WebSite",
    "name": "CloudedDeals",
    "url": "https://cloudeddeals.com",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://cloudeddeals.com/search?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  }
  ```
- **BreadcrumbList Schema** on all pages with breadcrumb navigation
- **Priority:** P1

---

## Phase 2: SEO Page Architecture

**Goal:** Create crawlable, keyword-rich pages that target high-intent searches.

### 2.1 Dispensary Pages — `/dispensary/[slug]`
- **Route:** `src/app/dispensary/[slug]/page.tsx`
- **Data:** Fetched from `dispensaries` table + today's `products` for that dispensary
- **Content:**
  - H1: `"{Dispensary Name} Deals Today — Las Vegas"`
  - Dispensary info: address, zone (Strip/Downtown/Local), platform
  - Map embed or static map image (using lat/long from DB)
  - Today's deals grid (reuse existing deal card components)
  - "About {Dispensary}" blurb (manually curated or generated)
  - Links to category-filtered views of this dispensary's deals
- **Meta title:** `"{Dispensary Name} Deals Today | CloudedDeals"`
- **Meta desc:** `"Today's best deals at {Dispensary Name} in Las Vegas. {X} deals on flower, vapes, edibles & more. Updated daily."`
- **Rendering:** ISR (Incremental Static Regeneration) with revalidate every 1 hour
- **Generates 27+ indexable pages from existing data**
- **Priority:** P0

### 2.2 Category Deal Pages — `/deals/[category]`
- **Route:** `src/app/deals/[category]/page.tsx`
- **Categories:** `flower`, `vapes`, `edibles`, `concentrates`, `prerolls`
- **Content:**
  - H1: `"Best {Category} Deals in Las Vegas Today"`
  - Filtered deal grid (today's active deals for that category)
  - Price range summary, top brands for category
  - Links to dispensary pages
  - Short SEO paragraph: what to look for in {category}, typical price ranges
- **Meta title:** `"Las Vegas {Category} Deals Today — Best Prices | CloudedDeals"`
- **Rendering:** ISR with revalidate every 1 hour
- **Generates 5 indexable pages**
- **Priority:** P0

### 2.3 Hub Landing Page — `/las-vegas-dispensary-deals`
- **Route:** `src/app/las-vegas-dispensary-deals/page.tsx`
- **This is the primary SEO landing page**
- **Content:**
  - H1: `"Las Vegas Dispensary Deals — Updated Daily"`
  - Hero section: "We check every dispensary in Las Vegas every morning"
  - Quick stats: X dispensaries, Y deals today, Z categories
  - Featured deals (top 6-10 by deal score)
  - Dispensary directory (links to all `/dispensary/[slug]` pages)
  - Category quick links (links to all `/deals/[category]` pages)
  - FAQ section (structured data: FAQPage schema):
    - "How often are deals updated?"
    - "Which dispensaries do you cover?"
    - "Are these deals near the Las Vegas Strip?"
    - "Do I need a medical card?"
  - SEO body copy (300-500 words) about Las Vegas dispensary landscape
- **Meta title:** `"Las Vegas Dispensary Deals Today — Every Deal, Every Dispensary | CloudedDeals"`
- **Rendering:** ISR with revalidate every 1 hour
- **Priority:** P0

### 2.4 Strip Landing Page — `/strip-dispensary-deals`
- **Route:** `src/app/strip-dispensary-deals/page.tsx`
- **Content:**
  - H1: `"Dispensary Deals Near the Las Vegas Strip"`
  - Filtered to `zone = 'strip'` dispensaries only
  - Map showing Strip-area dispensary locations
  - Today's best deals from Strip dispensaries
  - Tourist-friendly copy: walking distance, open late, etc.
  - Links to individual Strip dispensary pages
- **Meta title:** `"Dispensary Deals Near the Strip — Las Vegas | CloudedDeals"`
- **Rendering:** ISR with revalidate every 1 hour
- **Priority:** P1

### 2.5 Zone Pages (Future)
- `/downtown-dispensary-deals` — Downtown/Fremont area
- `/local-dispensary-deals` — Off-strip locals-focused
- Same pattern as Strip page, filtered by zone
- **Priority:** P2

---

## Phase 3: On-Page SEO & Internal Linking

**Goal:** Maximize crawl efficiency and keyword relevance across the site.

### 3.1 Internal Linking Strategy
- **Homepage → Hub page:** "See all Las Vegas dispensary deals" prominent link
- **Homepage → Category pages:** Category cards/tabs link to `/deals/[category]`
- **Homepage → Dispensary pages:** "Browse by dispensary" section
- **Deal cards → Dispensary page:** Each deal card links to its dispensary page
- **Dispensary pages → Category pages:** "See all {category} deals" links
- **Category pages → Dispensary pages:** Show which dispensaries have deals in this category
- **All pages → Hub page:** Breadcrumb trail: `Home > Las Vegas Deals > {Current Page}`
- **Footer links:** All major SEO pages linked in footer
- **Priority:** P1

### 3.2 Heading Hierarchy
- Every page: single H1 with primary keyword
- H2s for major sections
- H3s for subsections
- No skipping levels
- **Priority:** P1

### 3.3 Breadcrumb Navigation
- Visual breadcrumbs on all pages below homepage
- BreadcrumbList JSON-LD on every page
- Examples:
  - `/dispensary/planet-13`: Home > Dispensaries > Planet 13
  - `/deals/vapes`: Home > Deals > Vape Deals
  - `/strip-dispensary-deals`: Home > Strip Dispensaries
- **Priority:** P1

### 3.4 Image Optimization
- Alt text on all images (deal images, dispensary logos if added later)
- Next.js `<Image>` component with proper sizing
- WebP format
- Lazy loading below the fold
- **Priority:** P2

---

## Phase 4: Local SEO

**Goal:** Win local search results for Las Vegas cannabis queries.

### 4.1 Google Search Console
- Verify cloudeddeals.com in Google Search Console
- Submit sitemap.xml
- Monitor indexing status, crawl errors, keyword rankings
- **Priority:** P0 (do this immediately)

### 4.2 Google Business Profile
- Evaluate if an aggregator qualifies for GBP (likely not a direct fit, but worth exploring "Online Retailer" or "Business Consultant" categories)
- If not, focus on being listed in cannabis directories instead
- **Priority:** P2

### 4.3 LocalBusiness Schema for Dispensaries
- Already covered in Phase 1.5 — each dispensary page gets LocalBusiness JSON-LD
- Includes address, lat/long, zone info
- This helps Google understand the geographic relevance
- **Priority:** P1

### 4.4 Cannabis Directory Listings
- Submit to: Weedmaps, Leafly, cannabis.net, potguide.com directories
- Not as a dispensary, but as a "deals aggregator" / "cannabis deals tool"
- Build backlinks from these high-authority cannabis domains
- **Priority:** P2

---

## Phase 5: Content Marketing & Blog

**Goal:** Capture long-tail keywords and build topical authority.

### 5.1 Blog Setup — `/blog`
- **Route:** `src/app/blog/page.tsx` (list) + `src/app/blog/[slug]/page.tsx` (posts)
- **Storage:** Markdown files in `/content/blog/` or Supabase table (simpler to start with MDX files)
- **Design:** Minimal, fast-loading, matches app aesthetic
- **Priority:** P2

### 5.2 Initial Blog Posts (Pre-Launch SEO)
Target posts to write during beta period:

1. **"Best Dispensary Deals on the Las Vegas Strip (2026 Guide)"**
   - Target: tourists planning Vegas trips
   - Keywords: best dispensary deals vegas strip, dispensary near strip
   - Content: Overview of Strip-area dispensaries, what to expect on pricing, how CloudedDeals helps

2. **"Cheapest Dispensaries in Las Vegas — Comparing Prices Daily"**
   - Target: locals + budget-conscious tourists
   - Keywords: cheapest dispensary las vegas, cheap weed vegas
   - Content: Price comparison methodology, which dispensaries consistently have lowest prices

3. **"Las Vegas Vape Deals — How to Find the Best Prices"**
   - Target: vape-specific searchers
   - Keywords: vegas vape deals, las vegas vape prices
   - Content: Vape categories (disposable, cart, pod), typical price ranges, deal tips

4. **"Your Guide to Las Vegas Dispensary Deals in 2026"**
   - Target: broad informational intent
   - Keywords: las vegas dispensary deals, vegas weed deals
   - Evergreen guide, updated monthly

5. **"How CloudedDeals Works — Every Deal, Every Dispensary"**
   - Target: branded search / about us intent
   - Keywords: clouded deals, cloudeddeals
   - Explains the daily scraping process, trust/transparency

- **Priority:** P2 (but start during beta for early indexing)

### 5.3 Twitter / Social SEO Synergy
- Each tweet links back to cloudeddeals.com (deal page or landing page)
- Use trending Vegas hashtags: #Vegas #LasVegas #VegasDeals #Cannabis
- Pin a tweet linking to `/las-vegas-dispensary-deals`
- **Priority:** P1

---

## Phase 6: Performance & Core Web Vitals

**Goal:** Ensure the site meets Google's page experience signals.

### 6.1 Lighthouse Audit
- Run Lighthouse on key pages: home, hub page, dispensary page, category page
- Target scores: Performance > 90, SEO > 95, Accessibility > 90
- **Priority:** P1

### 6.2 Core Web Vitals Targets
| Metric | Target | Notes |
|--------|--------|-------|
| LCP (Largest Contentful Paint) | < 2.5s | Optimize hero section, deal card loading |
| FID (First Input Delay) | < 100ms | Minimize JS blocking |
| CLS (Cumulative Layout Shift) | < 0.1 | Reserve space for deal cards, no layout jumps |
| INP (Interaction to Next Paint) | < 200ms | Optimize modal opens, filter interactions |

### 6.3 Optimizations
- Server-side rendering for SEO pages (ISR or SSR)
- Client-side rendering only for interactive features (saved, modals, swipe)
- Font optimization (next/font)
- Image optimization (next/image, WebP, srcset)
- Code splitting (dynamic imports for admin, heavy components)
- **Priority:** P1

---

## Phase 7: Monitoring & Iteration

### 7.1 Tools to Set Up
- **Google Search Console** — indexing, crawl errors, keyword positions
- **Google Analytics 4** — traffic sources, user behavior (supplement your existing Supabase analytics)
- **Ahrefs / Semrush Free Tier** — backlink monitoring, keyword tracking (optional but helpful)
- **Priority:** P1

### 7.2 KPIs to Track
| Metric | Baseline (Beta) | 3-Month Target | 6-Month Target |
|--------|-----------------|-----------------|-----------------|
| Indexed pages | 0 | 40+ | 80+ |
| Organic impressions/week | 0 | 500 | 5,000 |
| Organic clicks/week | 0 | 50 | 500 |
| Avg. position for "vegas dispensary deals" | N/A | Top 30 | Top 10 |
| Domain authority | 0 | 10 | 20 |
| Backlinks | 0 | 20 | 50 |

---

## Implementation Priority Summary

| Priority | Phase | Effort | Impact |
|----------|-------|--------|--------|
| **P0** | robots.txt, sitemap.xml, canonical tags | Small | High — unblocks indexing |
| **P0** | Meta tags overhaul (titles + descriptions) | Small | High — immediate ranking signal |
| **P0** | Google Search Console setup | Tiny | High — visibility into indexing |
| **P0** | Hub page (`/las-vegas-dispensary-deals`) | Medium | Very High — primary keyword target |
| **P0** | Dispensary pages (`/dispensary/[slug]`) | Medium | Very High — 27 new indexed pages, branded search |
| **P0** | Category pages (`/deals/[category]`) | Medium | High — 5 new indexed pages |
| **P1** | JSON-LD structured data | Medium | High — rich results in SERP |
| **P1** | Strip landing page | Small | High — tourist keyword capture |
| **P1** | Internal linking + breadcrumbs | Medium | Medium — crawl efficiency |
| **P1** | Lighthouse / Core Web Vitals audit | Small | Medium — page experience signal |
| **P1** | GA4 + Search Console monitoring | Small | Medium — data for iteration |
| **P2** | Blog setup + initial posts | Large | High long-term — long-tail capture |
| **P2** | Cannabis directory submissions | Small | Medium — backlinks |
| **P2** | Image optimization | Small | Small — incremental gains |

---

## Estimated Implementation Timeline

| Week | Deliverables |
|------|-------------|
| **Week 1** | robots.txt, sitemap.xml, canonical tags, meta tags overhaul, Search Console setup |
| **Week 2** | Hub landing page, dispensary pages (`/dispensary/[slug]`) |
| **Week 3** | Category pages (`/deals/[category]`), Strip landing page |
| **Week 4** | JSON-LD structured data, internal linking, breadcrumbs |
| **Week 5** | Lighthouse audit + fixes, Core Web Vitals optimization |
| **Week 6** | Blog setup, first 2 blog posts |
| **Week 7-8** | Remaining blog posts, directory submissions, monitoring setup |

---

## Notes

- All new pages use ISR (revalidate every 1-3 hours) so content stays fresh without rebuilding
- Deal data already exists in Supabase — these pages are mostly routing + rendering work
- No new scraping required — we're exposing existing data through SEO-friendly URLs
- Age verification gate must still work on all new pages (compliance)
- Mobile-first design is critical — most searches will be from phones
- During beta: index everything, monitor rankings, iterate on content before marketing push
