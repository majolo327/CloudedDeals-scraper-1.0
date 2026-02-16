-- =========================================================================
-- CLOUDEDDEALS — MASTER EXPANSION DASHBOARD
-- =========================================================================
--
-- Idempotent read-only script. Safe to run any time, any number of times.
-- No writes, no side effects. Just SELECT queries.
--
-- Paste the entire file into the Supabase SQL Editor and hit Run,
-- or run individual sections one at a time.
--
-- Covers all regions dynamically — if you add a 7th or 8th state
-- tomorrow, these queries pick it up automatically.
--
-- Last updated: 2026-02-16
-- =========================================================================


-- =========================================================================
-- 0. FULL FLEET OVERVIEW  (the "are we alive?" check)
-- =========================================================================
-- One row showing the entire operation at a glance.

SELECT
  (SELECT count(*) FROM dispensaries WHERE is_active = TRUE)                AS total_active_dispensaries,
  (SELECT count(DISTINCT region) FROM dispensaries WHERE is_active = TRUE)  AS total_regions,
  (SELECT count(*) FROM products WHERE is_active = TRUE)                    AS active_products_now,
  (SELECT count(DISTINCT brand) FROM products
     WHERE is_active = TRUE AND brand IS NOT NULL)                          AS unique_brands_active,
  (SELECT count(*) FROM deals)                                              AS lifetime_deals,
  (SELECT count(*) FROM scrape_runs
     WHERE started_at > now() - interval '24 hours')                        AS runs_last_24h,
  (SELECT count(*) FROM scrape_runs
     WHERE started_at > now() - interval '24 hours'
       AND status IN ('completed','completed_with_errors'))                  AS successful_runs_24h;


-- =========================================================================
-- 1. FLEET BY REGION  (dispensary count per state + platform breakdown)
-- =========================================================================

SELECT
  d.region,
  count(*)                                                AS dispensaries,
  count(*) FILTER (WHERE d.platform = 'dutchie')          AS dutchie,
  count(*) FILTER (WHERE d.platform = 'jane')             AS jane,
  count(*) FILTER (WHERE d.platform = 'curaleaf')         AS curaleaf,
  count(*) FILTER (WHERE d.platform = 'rise')             AS rise,
  count(*) FILTER (WHERE d.platform = 'carrot')           AS carrot,
  count(*) FILTER (WHERE d.platform = 'aiq')              AS aiq
FROM dispensaries d
WHERE d.is_active = TRUE
GROUP BY d.region
ORDER BY dispensaries DESC;


-- =========================================================================
-- 2. LATEST SCRAPE RUN PER REGION  (did today's cron fire?)
-- =========================================================================
-- Shows the single most recent run for every region.

SELECT
  r.region,
  r.status,
  r.total_products,
  r.qualifying_deals,
  jsonb_array_length(COALESCE(r.sites_scraped, '[]'::jsonb))  AS sites_ok,
  jsonb_array_length(COALESCE(r.sites_failed,  '[]'::jsonb))  AS sites_failed,
  r.runtime_seconds,
  r.platform_group,
  to_char(r.started_at AT TIME ZONE 'America/Los_Angeles',
          'Mon DD HH12:MI AM')                                 AS started_pst,
  round(r.runtime_seconds / 60.0, 1)                          AS runtime_min
FROM scrape_runs r
INNER JOIN (
  SELECT region, max(started_at) AS max_started
  FROM scrape_runs
  GROUP BY region
) latest ON r.region = latest.region AND r.started_at = latest.max_started
ORDER BY r.started_at DESC;


-- =========================================================================
-- 3. SEVEN-DAY ROLLING HEALTH PER REGION
-- =========================================================================
-- Aggregated stats from the last 7 calendar days per region.

SELECT
  region,
  count(*)                                                              AS runs_7d,
  count(*) FILTER (WHERE status IN ('completed','completed_with_errors'))
                                                                        AS success_7d,
  round(
    100.0 * count(*) FILTER (WHERE status IN ('completed','completed_with_errors'))
    / NULLIF(count(*), 0), 0
  )                                                                     AS success_rate_pct,
  sum(total_products)                                                   AS total_products_7d,
  sum(qualifying_deals)                                                 AS total_deals_7d,
  round(avg(runtime_seconds) / 60.0, 1)                                AS avg_runtime_min,
  round(avg(total_products), 0)                                        AS avg_products_per_run,
  max(total_products)                                                   AS peak_products,
  min(total_products) FILTER (WHERE status != 'failed')                 AS min_products
FROM scrape_runs
WHERE started_at > now() - interval '7 days'
GROUP BY region
ORDER BY total_products_7d DESC;


-- =========================================================================
-- 4. ACTIVE PRODUCTS BY REGION + CATEGORY
-- =========================================================================
-- What is live in the database RIGHT NOW per state.

SELECT
  d.region,
  count(*)                                                    AS total_active,
  count(*) FILTER (WHERE p.category = 'flower')               AS flower,
  count(*) FILTER (WHERE p.category = 'vape')                 AS vape,
  count(*) FILTER (WHERE p.category = 'edible')               AS edible,
  count(*) FILTER (WHERE p.category = 'concentrate')          AS concentrate,
  count(*) FILTER (WHERE p.category = 'preroll')              AS preroll,
  count(*) FILTER (WHERE p.category IS NULL
                      OR p.category NOT IN
                         ('flower','vape','edible','concentrate','preroll'))
                                                              AS other_or_null,
  count(DISTINCT p.dispensary_id)                             AS dispensaries_with_data,
  count(DISTINCT p.brand) FILTER (WHERE p.brand IS NOT NULL) AS unique_brands
FROM products p
JOIN dispensaries d ON p.dispensary_id = d.id
WHERE p.is_active = TRUE
GROUP BY d.region
ORDER BY total_active DESC;


-- =========================================================================
-- 5. BRAND LEADERBOARD PER REGION
-- =========================================================================
-- Top 15 brands by active product count in each region.
-- Great for spotting which expansion brands are actually showing up.

SELECT * FROM (
  SELECT
    d.region,
    p.brand,
    count(*)                                                  AS products,
    count(DISTINCT p.dispensary_id)                           AS dispensaries,
    count(DISTINCT p.category)                                AS categories,
    round(avg(p.sale_price), 2)                               AS avg_sale_price,
    round(avg(p.discount_percent), 1)                         AS avg_discount_pct,
    ROW_NUMBER() OVER (PARTITION BY d.region ORDER BY count(*) DESC) AS rank
  FROM products p
  JOIN dispensaries d ON p.dispensary_id = d.id
  WHERE p.is_active = TRUE
    AND p.brand IS NOT NULL
    AND p.brand != ''
  GROUP BY d.region, p.brand
) ranked
WHERE rank <= 15
ORDER BY region, rank;


-- =========================================================================
-- 6. BRANDS UNIQUE TO EXPANSION STATES  (not seen in NV)
-- =========================================================================
-- Brands that appear in expansion state products but NOT in Nevada.
-- This is your "new brands discovered" count.

WITH nv_brands AS (
  SELECT DISTINCT lower(p.brand) AS brand_lower
  FROM products p
  JOIN dispensaries d ON p.dispensary_id = d.id
  WHERE d.region = 'southern-nv'
    AND p.brand IS NOT NULL AND p.brand != ''
),
expansion_brands AS (
  SELECT
    d.region,
    p.brand,
    lower(p.brand) AS brand_lower,
    count(*) AS product_count,
    count(DISTINCT p.dispensary_id) AS dispensaries
  FROM products p
  JOIN dispensaries d ON p.dispensary_id = d.id
  WHERE d.region != 'southern-nv'
    AND p.brand IS NOT NULL AND p.brand != ''
    AND p.is_active = TRUE
  GROUP BY d.region, p.brand, lower(p.brand)
)
SELECT
  eb.region,
  eb.brand,
  eb.product_count,
  eb.dispensaries
FROM expansion_brands eb
LEFT JOIN nv_brands nv ON eb.brand_lower = nv.brand_lower
WHERE nv.brand_lower IS NULL
ORDER BY eb.region, eb.product_count DESC;


-- =========================================================================
-- 7. EXPANSION BRAND SUMMARY  (rollup of Section 6)
-- =========================================================================
-- Quick count: how many net-new brands per expansion state?

WITH nv_brands AS (
  SELECT DISTINCT lower(p.brand) AS brand_lower
  FROM products p
  JOIN dispensaries d ON p.dispensary_id = d.id
  WHERE d.region = 'southern-nv'
    AND p.brand IS NOT NULL AND p.brand != ''
)
SELECT
  d.region,
  count(DISTINCT p.brand) FILTER (WHERE p.brand IS NOT NULL)  AS total_brands_seen,
  count(DISTINCT p.brand) FILTER (
    WHERE p.brand IS NOT NULL
      AND lower(p.brand) NOT IN (SELECT brand_lower FROM nv_brands)
  )                                                            AS brands_unique_to_state,
  count(DISTINCT p.brand) FILTER (
    WHERE p.brand IS NOT NULL
      AND lower(p.brand) IN (SELECT brand_lower FROM nv_brands)
  )                                                            AS brands_shared_with_nv
FROM products p
JOIN dispensaries d ON p.dispensary_id = d.id
WHERE d.region != 'southern-nv'
  AND p.is_active = TRUE
GROUP BY d.region
ORDER BY brands_unique_to_state DESC;


-- =========================================================================
-- 8. PRICE LANDSCAPE BY REGION + CATEGORY
-- =========================================================================
-- Average prices per state per category — critical for tuning price caps
-- when you go live in a new market. (MI is cheap, IL is expensive, etc.)

SELECT
  d.region,
  p.category,
  count(*)                                                    AS products,
  round(avg(p.sale_price), 2)                                 AS avg_sale,
  round(min(p.sale_price), 2)                                 AS min_sale,
  round(max(p.sale_price), 2)                                 AS max_sale,
  round(percentile_cont(0.5) WITHIN GROUP (ORDER BY p.sale_price), 2)
                                                              AS median_sale,
  round(avg(p.original_price), 2)                             AS avg_original,
  round(avg(p.discount_percent), 1)                           AS avg_discount_pct
FROM products p
JOIN dispensaries d ON p.dispensary_id = d.id
WHERE p.is_active = TRUE
  AND p.sale_price IS NOT NULL
  AND p.sale_price > 0
  AND p.category IN ('flower','vape','edible','concentrate','preroll')
GROUP BY d.region, p.category
ORDER BY d.region, p.category;


-- =========================================================================
-- 9. DISPENSARY SCOREBOARD  (which sites are producing the most data?)
-- =========================================================================
-- Per-dispensary product count, brand count, deal count for active data.
-- Helps spot which dispensaries in expansion states are actually working.

SELECT
  d.region,
  d.id                                                        AS dispensary_slug,
  d.name,
  d.platform,
  count(p.id)                                                 AS active_products,
  count(DISTINCT p.brand) FILTER (WHERE p.brand IS NOT NULL)  AS brands_found,
  count(DISTINCT p.category)                                  AS categories,
  round(avg(p.sale_price), 2)                                 AS avg_price,
  count(*) FILTER (WHERE p.deal_score > 0)                    AS products_with_score
FROM dispensaries d
LEFT JOIN products p ON p.dispensary_id = d.id AND p.is_active = TRUE
WHERE d.is_active = TRUE
GROUP BY d.region, d.id, d.name, d.platform
ORDER BY d.region, active_products DESC;


-- =========================================================================
-- 10. ZERO-PRODUCT DISPENSARIES  (configured but producing nothing)
-- =========================================================================
-- These are active in config but have zero products in the current cycle.
-- Either they haven't been scraped yet or the scrape is failing silently.

SELECT
  d.region,
  d.id AS dispensary_slug,
  d.name,
  d.platform,
  d.url
FROM dispensaries d
LEFT JOIN products p ON p.dispensary_id = d.id AND p.is_active = TRUE
WHERE d.is_active = TRUE
GROUP BY d.region, d.id, d.name, d.platform, d.url
HAVING count(p.id) = 0
ORDER BY d.region, d.platform, d.name;


-- =========================================================================
-- 11. FAILED SITES — LATEST RUN PER REGION  (what broke today?)
-- =========================================================================
-- Extracts failed site slugs + error messages from the most recent run
-- of each region. JSONB unpacking.

WITH latest_runs AS (
  SELECT DISTINCT ON (region) *
  FROM scrape_runs
  ORDER BY region, started_at DESC
)
SELECT
  lr.region,
  f->>'slug'  AS failed_site,
  f->>'error' AS error_message,
  to_char(lr.started_at AT TIME ZONE 'America/Los_Angeles',
          'Mon DD HH12:MI AM') AS run_time_pst
FROM latest_runs lr,
     jsonb_array_elements(COALESCE(lr.sites_failed, '[]'::jsonb)) AS f
ORDER BY lr.region, f->>'slug';


-- =========================================================================
-- 12. SCRAPE RUN HISTORY  (last 30 runs across all regions)
-- =========================================================================
-- Timeline view — see the rhythm of your daily cron jobs.

SELECT
  region,
  status,
  total_products,
  qualifying_deals,
  jsonb_array_length(COALESCE(sites_scraped, '[]'::jsonb))    AS sites_ok,
  jsonb_array_length(COALESCE(sites_failed, '[]'::jsonb))     AS sites_failed,
  platform_group,
  round(runtime_seconds / 60.0, 1)                            AS runtime_min,
  to_char(started_at AT TIME ZONE 'America/Los_Angeles',
          'Mon DD HH12:MI AM')                                 AS started_pst,
  to_char(completed_at AT TIME ZONE 'America/Los_Angeles',
          'HH12:MI AM')                                        AS completed_pst
FROM scrape_runs
ORDER BY started_at DESC
LIMIT 50;


-- =========================================================================
-- 13. PRICE HISTORY COVERAGE  (is the price tracker accumulating data?)
-- =========================================================================
-- Shows how many days of price history exist per region and the date range.

SELECT
  d.region,
  count(*)                                          AS total_observations,
  count(DISTINCT ph.observed_date)                  AS unique_days,
  min(ph.observed_date)                             AS earliest_date,
  max(ph.observed_date)                             AS latest_date,
  count(DISTINCT ph.product_id)                     AS unique_products_tracked,
  count(DISTINCT ph.brand) FILTER (WHERE ph.brand IS NOT NULL)
                                                    AS unique_brands_tracked
FROM price_history ph
JOIN dispensaries d ON ph.dispensary_id = d.id
GROUP BY d.region
ORDER BY total_observations DESC;


-- =========================================================================
-- 14. DEAL QUALITY DISTRIBUTION BY REGION
-- =========================================================================
-- How are deal scores distributed? Helps tune scoring per market.

SELECT
  d.region,
  count(*)                                                       AS total_scored,
  count(*) FILTER (WHERE p.deal_score >= 75)                     AS steals_75plus,
  count(*) FILTER (WHERE p.deal_score >= 40 AND p.deal_score < 75) AS solid_40_74,
  count(*) FILTER (WHERE p.deal_score > 0  AND p.deal_score < 40)  AS discovery_1_39,
  count(*) FILTER (WHERE p.deal_score = 0)                       AS unscored,
  round(avg(p.deal_score) FILTER (WHERE p.deal_score > 0), 1)   AS avg_score,
  max(p.deal_score)                                              AS max_score
FROM products p
JOIN dispensaries d ON p.dispensary_id = d.id
WHERE p.is_active = TRUE
GROUP BY d.region
ORDER BY steals_75plus DESC;


-- =========================================================================
-- 15. CROSS-STATE BRANDS  (brands that appear in 2+ states)
-- =========================================================================
-- Your multi-state brand intelligence — which brands have national reach?

SELECT
  p.brand,
  count(DISTINCT d.region)                              AS states,
  array_agg(DISTINCT d.region ORDER BY d.region)        AS which_states,
  count(*)                                              AS total_products,
  count(DISTINCT p.dispensary_id)                       AS total_dispensaries,
  round(avg(p.sale_price), 2)                           AS avg_price_all_states
FROM products p
JOIN dispensaries d ON p.dispensary_id = d.id
WHERE p.is_active = TRUE
  AND p.brand IS NOT NULL
  AND p.brand != ''
GROUP BY p.brand
HAVING count(DISTINCT d.region) >= 2
ORDER BY states DESC, total_products DESC;


-- =========================================================================
-- 16. DAILY METRICS TREND  (if daily_metrics table has data)
-- =========================================================================
-- Last 14 days of pipeline quality metrics.

SELECT
  run_date,
  total_products,
  qualifying_deals,
  flower_count,
  vape_count,
  edible_count,
  concentrate_count,
  preroll_count,
  unique_brands,
  unique_dispensaries,
  round(avg_deal_score, 1)    AS avg_score,
  sites_scraped,
  sites_failed,
  round(runtime_seconds / 60.0, 1) AS runtime_min
FROM daily_metrics
WHERE run_date > CURRENT_DATE - interval '14 days'
ORDER BY run_date DESC;


-- =========================================================================
-- END OF DASHBOARD
-- =========================================================================
-- Total: 16 sections, all read-only, all idempotent.
-- Run the whole file or copy individual sections as needed.
--
-- Quick reference:
--   0  — Full fleet overview (one row)
--   1  — Fleet by region (dispensary counts + platforms)
--   2  — Latest scrape run per region
--   3  — 7-day rolling health per region
--   4  — Active products by region + category
--   5  — Brand leaderboard per region (top 15)
--   6  — Brands unique to expansion states (not in NV)
--   7  — Expansion brand summary (rollup counts)
--   8  — Price landscape by region + category
--   9  — Dispensary scoreboard (per-site product counts)
--  10  — Zero-product dispensaries (broken/silent failures)
--  11  — Failed sites from latest run
--  12  — Scrape run history (last 50)
--  13  — Price history coverage
--  14  — Deal quality distribution by region
--  15  — Cross-state brands (national reach)
--  16  — Daily metrics trend (14 days)
-- =========================================================================
