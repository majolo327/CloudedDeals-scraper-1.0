-- =========================================================================
-- 037_region_kpi_functions.sql — Per-region KPI functions for admin dashboard
-- =========================================================================
--
-- Two RPC functions used by the admin dashboard to show per-state
-- product/deal/coverage metrics with configurable time windows.
--
-- Safe to run multiple times (CREATE OR REPLACE).
-- =========================================================================

-- =========================================================================
-- 1. get_region_unique_products(window_days)
-- =========================================================================
-- Returns per-region unique product and deal counts within a time window.
-- Joins products → dispensaries to get region.

CREATE OR REPLACE FUNCTION get_region_unique_products(window_days INT DEFAULT 30)
RETURNS TABLE (
  region       TEXT,
  unique_products BIGINT,
  unique_deals    BIGINT
) LANGUAGE sql STABLE AS $$
  SELECT
    d.region,
    COUNT(DISTINCT p.id)                                     AS unique_products,
    COUNT(DISTINCT p.id) FILTER (WHERE p.deal_score > 0)     AS unique_deals
  FROM products p
  JOIN dispensaries d ON d.id = p.dispensary_id
  WHERE p.scraped_at >= NOW() - (window_days || ' days')::INTERVAL
  GROUP BY d.region
  ORDER BY unique_products DESC;
$$;

COMMENT ON FUNCTION get_region_unique_products IS
  'Per-region unique product/deal counts within a rolling window. Used by admin dashboard.';


-- =========================================================================
-- 2. get_region_site_coverage()
-- =========================================================================
-- Returns per-region site counts: total in DB, active, and how many
-- were successfully scraped in the last 30 days.

CREATE OR REPLACE FUNCTION get_region_site_coverage()
RETURNS TABLE (
  region          TEXT,
  total_sites     BIGINT,
  active_sites    BIGINT,
  scraped_last_30d BIGINT
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  WITH recent_runs AS (
    SELECT sr.id, sr.sites_scraped,
      CASE
        WHEN sr.region ~ '^.+-\d+$' AND regexp_replace(sr.region, '-\d+$', '') IN (
          'southern-nv','michigan','illinois','colorado','massachusetts',
          'new-jersey','arizona','missouri','ohio','new-york','pennsylvania'
        ) THEN regexp_replace(sr.region, '-\d+$', '')
        ELSE sr.region
      END AS base_region
    FROM scrape_runs sr
    WHERE sr.started_at >= NOW() - INTERVAL '30 days'
      AND sr.status IN ('completed', 'completed_with_errors')
  ),
  scraped_slugs AS (
    SELECT DISTINCT rr.base_region, slug.val AS slug
    FROM recent_runs rr,
    LATERAL jsonb_array_elements_text(
      CASE jsonb_typeof(rr.sites_scraped)
        WHEN 'array' THEN rr.sites_scraped
        ELSE '[]'::jsonb
      END
    ) AS slug(val)
  ),
  scraped_counts AS (
    SELECT ss.base_region AS sc_region, COUNT(DISTINCT ss.slug) AS cnt
    FROM scraped_slugs ss
    JOIN dispensaries dd ON dd.id = ss.slug
    GROUP BY ss.base_region
  )
  SELECT
    d.region,
    COUNT(*)                               AS total_sites,
    COUNT(*) FILTER (WHERE d.is_active)    AS active_sites,
    COALESCE(sc.cnt, 0)                    AS scraped_last_30d
  FROM dispensaries d
  LEFT JOIN scraped_counts sc ON sc.sc_region = d.region
  GROUP BY d.region, sc.cnt
  ORDER BY active_sites DESC;
END;
$$;

COMMENT ON FUNCTION get_region_site_coverage IS
  'Per-region site coverage: total, active, and successfully scraped in last 30 days.';
