# Scraper Operations — Known Issues & Ongoing Investigations

## Carrot Platform (5 sites)

**Status:** Partially working — scrapes products but yields few/no deals.

**Root cause:** Carrot sites expose only a single price per product (no
original price / discount percentage).  The deal detector's hard filter
previously rejected everything from these sites because it requires
either a positive discount or a known original price.

**Mitigation applied (2026-02-17):**
- Extended "loose qualification" (same treatment as Jane) so Carrot
  products skip discount/original-price checks in the hard filter.
- Carrot products now receive a flat 15-point scoring baseline in lieu
  of discount-depth and dollars-saved signals.
- Dispensary minimum floor guarantees at least 1-3 deals per store
  depending on product count.

**Still needs investigation:**
- Carrot's HTML structure is inconsistent across sites — some render
  product cards differently, which causes partial extraction misses.
- Weight/size data is often missing from Carrot cards, reducing quality
  gate pass rates.  The relaxed quality gate backfill mitigates this
  but isn't a permanent fix.
- No pagination support yet — only first-page products are scraped.
  Sites with large menus may be under-represented.

---

## AIQ Platform (2 sites)

**Status:** Partially working — same pricing limitation as Carrot.

**Root cause:** AIQ menus provide only a sale price (no original price
or discount data).  Same hard-filter rejection issue as Carrot.

**Mitigation applied (2026-02-17):**
- Extended loose qualification to AIQ (same as Jane and Carrot).
- Flat 15-point scoring baseline applied.
- Dispensary minimum floor guarantees exposure.

**Still needs investigation:**
- AIQ site structure varies — some sites use different DOM layouts
  that the current selectors don't fully cover.
- Product URL extraction is inconsistent (some products link back to
  the dispensary homepage rather than the specific product page).
- Brand extraction from AIQ cards needs improvement — many products
  end up with no detected brand, which triggers quality gate rejection
  (mitigated by relaxed gate backfill for now).

---

## Dutchie Failures (recurring)

**Status:** ~72% success rate (13/18 sites). 5 sites fail intermittently.

**Common failure modes:**
- Cloudflare challenge blocking initial page load.
- Dutchie embed script not injecting iframe after age gate click
  (timing / race condition).
- Content detection cascade timeout (iframe 45s + JS embed 60s = 105s
  wasted when neither exists).

**Mitigation applied (2026-02-17):**
- Reduced overall site timeout from 600s → 300s (faster failure recovery).
- Reduced retry timeout from 300s → 180s.
- Increased smart-wait from 60s → 90s (content-based polling — returns
  instantly when content appears, longer cap helps slow-loading heavy
  pages like td-gibson and planet13).
- Added product card population wait after content detection — ensures
  massive pages have cards rendered before extraction begins.

**Additional fixes applied (2026-02-18 – 2026-02-21):**
- Age gate now always clicked before JS overlay removal (fixed 17/18 failures).
- Shadow DOM extraction added for embeds behind shadow roots.
- `about:blank` iframe fallback for sites that load empty iframes first.
- Fast-bail for `dutchie.com` pages when SPA fails to render.
- Retry-on-zero: if primary URL returns 0 products, tries fallback URL.
- **Category coverage fix (Feb 21):** Sites using `?dtche[path]=specials`
  now always scrape the base menu too. Previously, if specials returned
  even 1 product, the full catalog was skipped. Affects TD (3), Greenlight (2),
  The Grove (2), Mint (2), Jade (2), Vegas Treehouse (1).
- 30 PA/NY Dutchie sites switched to store-hosted URLs to bypass Cloudflare.

**Sites to watch:**
- `td-gibson` — massive specials page, JS embed mode. Now scrapes base menu too.
- `planet-13` — direct Dutchie content on page, very large menu. Store selector added.
- `td-decatur` — intermittent Cloudflare blocks. Fallback URL fixed (no longer points to /specials).
- `the-grove` — occasionally fails on iframe detection.
- `nuwu` — intermittent timeout failures.

---

## Locked Beta Status (Feb 22, 2026)

**All platforms are now in locked beta.** No new sites, no new scrapers.
Surgical fixes only — see root `OPERATIONS.md` for criteria.
