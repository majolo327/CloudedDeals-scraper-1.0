# Dashboard KPI Audit & Enhancement Plan

**Date:** 2026-02-20 (reviewed 2026-02-25)
**Status:** Proposed — awaiting approval before implementation

---

## Executive Summary

An audit of the admin dashboard KPIs reveals **one critical data bug**, **multiple misleading metrics**, and **terminology inconsistencies** that would confuse investors, advisors, and the founding team. The "Products in DB: 64,736" headline metric is technically counting all accumulated product rows (active + inactive, all time), not meaningful "unique products." Additionally, 9 of 11 region cards on the Scraper page are showing **stale data** from old non-sharded runs because the frontend doesn't aggregate sharded region names.

---

## CRITICAL BUG: Sharded Region Cards Show Stale Data

### Root Cause

Sharded cron jobs store region names as `"michigan-1"`, `"michigan-2"`, etc. in `scrape_runs.region` (`main.py:149`), but the Scraper page filters with exact match `run.region === r.id` where `r.id = "michigan"` (`scraper/page.tsx:123`). The same bug exists in the expanded region detail view (`scraper/page.tsx:338`).

### Impact

| Region | Shards | Card Shows | Actual Today (Feb 20) |
|--------|--------|------------|----------------------|
| Michigan | 4 | 1,008 products (Feb 16 stale) | ~7,782 products / 503 deals |
| Illinois | 3 | 15,771 (Feb 16 stale) | ~15,479 products |
| Colorado | 3 | 1,251 (Feb 16 stale) | ~3,582 products |
| Massachusetts | 2 | 1,652 (Feb 16 stale) | ~8,381 products |
| New Jersey | 2 | 2,751 (Feb 16 stale) | ~7,696 products |
| Arizona | 2 | 4,562 (Feb 16 stale) | ~9,642 products |
| Missouri | 2 | 1,242 (Feb 16 stale) | ~1,361 products |
| Ohio | 2 | 61 (Feb 16 stale) | ~1,965 products |
| New York | 2 | 421 (Feb 16 stale) | ~3,555 products |

**9 of 11 regions are affected.** Only NV and PA (non-sharded) show current data.

### Fix

`scraper/page.tsx:123` — change:
```js
const regionRuns = allRuns.filter((run) => run.region === r.id);
```
to match shards:
```js
const regionRuns = allRuns.filter(
  (run) => run.region === r.id || run.region?.startsWith(r.id + "-")
);
```
Then aggregate Products/Deals/Sites across same-day shards for the region card display.

---

## ISSUE 1: "Products in DB: 64,736" Is Misleading

### What It Actually Counts

`admin/page.tsx:238`:
```js
supabase.from("products").select("id", { count: "exact", head: true })
```

This is `COUNT(*)` on the **entire products table** — every row ever created, including:
- Inactive/stale products (`is_active = false`) from prior days
- Duplicate product rows created when prices change (dedup key is `dispensary_id, name, weight_value, sale_price`)
- Products from deactivated dispensaries
- Historical accumulation with **no retention policy** on the products table

### Why 64K Is Plausible But Misleading

- Daily scrape touches ~78K+ raw products across all regions
- Dedup constraint collapses same-price products into one row (upsert)
- Price changes create new rows → table grows over time
- `033_data_retention_policy.sql` cleans `scrape_runs`, `user_events`, `analytics_events`, `shared_saves`, but **NOT products**
- So 64K is the total accumulated unique (dispensary, name, weight, price) tuples ever seen

### What Stakeholders Expect

An investor seeing "64,736 unique products" assumes that's the current active catalog. In reality:
- **Active products today** (is_active = true) is a much smaller number
- **Active deals today** (deal_score > 0, is_active = true) is ~200-500
- The 64K includes a large tail of historical/inactive rows

---

## ISSUE 2: Terminology Is Inconsistent

| Location | Current Label | Actual Meaning | Proposed Label |
|----------|--------------|----------------|----------------|
| Dashboard main card | "Products in DB" / "unique products" | COUNT(*) on products table (all rows, all time) | "Total Catalog Size" / "all-time product rows" |
| Dashboard main card | "Qualifying Deals" | COUNT(*) WHERE deal_score > 0 | "Deals Detected (All Time)" |
| Dashboard main card | — (missing) | — | **"Active Deals Today"** (headline KPI) |
| Scraper region cards | "Products" | total_products from latest scrape_run | "Menu Items Scraped" |
| Scraper history table | "Products" | total_products per run | "Items Scraped" |
| Scraper history table | "Deals" | qualifying_deals per run | "Deals Qualified" |
| Health page | "active_deals" | deal_score > 0 AND is_active = true | "Live Deals" |

### The Michigan Example

User says: "Michigan shows 1,000 products but really it is 1,000 deals."

The region card shows `total_products` from the latest non-sharded run (1,008 menu items scraped). This is NOT qualifying deals. Looking at actual sharded runs today:
- michigan-1: 1,500 products → 96 deals
- michigan-2: 2,244 products → 140 deals
- michigan-3: 2,011 products → 142 deals
- michigan-4: 2,027 products → 125 deals

Products ≠ Deals. The card doesn't show deals at all.

---

## PROPOSED ENHANCEMENTS

### P0 — Critical Fixes (Data Accuracy)

#### 1. Fix sharded region aggregation
**File:** `frontend/src/app/admin/scraper/page.tsx`
- Match sharded runs via startsWith (line 123 + line 338)
- Aggregate across same-day shards for region card stats
- Show combined Sites OK / Products / Deals

#### 2. Replace "Products in DB" with meaningful KPIs
**File:** `frontend/src/app/admin/page.tsx`
- **"Active Deals Today"** = `WHERE deal_score > 0 AND is_active = true` (HEADLINE)
- **"Active Products"** = `WHERE is_active = true`
- **"Total Cataloged"** = current COUNT(*) (secondary/smaller)

#### 3. Add products table data retention
**File:** `supabase/migrations/033_data_retention_policy.sql`
- Add: `DELETE FROM products WHERE is_active = false AND scraped_at < NOW() - INTERVAL '30 days'`
- Prevents unbounded growth from price-change rows

### P1 — Terminology Standardization

#### 4. Rename labels across all dashboard pages
- Region cards: "Products" → "Menu Items" + add "Deals" metric
- History table: "Products" → "Items Scraped"
- Main dashboard: per table above
- Consistent vocabulary in code comments and log messages

#### 5. Add "Deals" to region cards
Currently region cards only show Products (menu items). Add qualifying_deals alongside for immediate visibility.

### P2 — Fundraising-Ready KPI Board

#### 6. Investor-grade KPI summary section
New top-of-dashboard panel with:

| KPI | Definition | Source |
|-----|-----------|--------|
| **Live Deals** | Curated deals available right now | `products WHERE deal_score > 0 AND is_active = true` |
| **Markets Active** | States with active scraping | Count of regions with completed runs in last 48h |
| **Dispensary Coverage** | Sites successfully scraped / total configured | `sites_scraped / (scraped + failed)` from latest runs |
| **Daily Deal Volume** | Deals curated today + 7d trend | `daily_metrics.qualifying_deals` with WoW delta |
| **Data Freshness** | Time since last completed run | Color-coded: green <1h, yellow <4h, red >4h |
| **Category Mix** | Distribution across product types | From `daily_metrics` category counts |

#### 7. Week-over-week trend indicators
- Pull from `daily_metrics` table for prior-week comparison
- Show +/-% arrows on key metrics
- Sparkline charts for deal volume, coverage, score trends

#### 8. Engagement metrics panel
Surface existing `analytics_events` data:
- DAU / WAU / MAU
- Deal saves & get-deal clicks per day
- Activation rate (% visitors who save or click)
- Viral coefficient (K-factor from shares → conversions)

### P3 — In-Dashboard User Guide

#### 9. Info tooltips on every KPI card
- Small (?) icon on each stat card
- Hover/click shows: metric name, definition, data source, refresh frequency
- Example: "Active Deals — Products scoring 50+ on our deal detection algorithm that were scraped today. Refreshed with each scrape run (~every 4-6 hours per market)."

#### 10. Expandable "How This Works" panel
- Collapsible section at top of dashboard
- Written for non-technical audience (investors, advisors)
- Covers: data pipeline, metric definitions, scoring methodology, scraping schedule

#### 11. Glossary page at `/admin/guide`
Full reference with:
- Term definitions with examples
- Deal score breakdown (0-100 scale, STEAL ≥ 85 / FIRE 70-84 / SOLID 50-69)
- How deduplication works
- How region sharding works
- Data freshness expectations per region
- FAQ for common questions

---

## Implementation Priority

| Phase | Effort | Impact | Items |
|-------|--------|--------|-------|
| **P0** | ~2-3 hours | Critical — fixes broken data | #1, #2, #3 |
| **P1** | ~1-2 hours | High — prevents confusion | #4, #5 |
| **P2** | ~4-6 hours | High — fundraising readiness | #6, #7, #8 |
| **P3** | ~3-4 hours | Medium — self-service clarity | #9, #10, #11 |

**Recommended order:** P0 → P1 → P2 → P3
