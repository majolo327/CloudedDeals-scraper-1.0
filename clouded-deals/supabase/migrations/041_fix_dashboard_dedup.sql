-- =========================================================================
-- 041_fix_dashboard_dedup.sql — Fix inflated dashboard metrics
-- =========================================================================
-- Problems fixed:
--   1. Coverage "sites_ok" was SUM(array_length) across all 7-day runs
--      without deduplication — showed 1,774 for Michigan (446 real sites).
--   2. Coverage "products" was SUM(total_products) across runs — counted
--      same products repeatedly across shards and days.
--   3. "Unique Products in DB" counted ALL rows including inactive/stale.
--   4. "Total Deals Active" counted from products table not deals.
--
-- Fix approach:
--   - Coverage sites_ok: unnest sites_scraped arrays → COUNT DISTINCT
--   - Coverage products: query actual products table per region (7-day)
--   - Unique Products: COUNT WHERE is_active = true only
--   - Pipeline deals total: keep cumulative but label clearly
--
-- Safe to run multiple times (CREATE OR REPLACE).
-- =========================================================================

CREATE OR REPLACE FUNCTION get_dashboard_metrics(window_days INT DEFAULT 30)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result JSON;

  -- Growth metrics
  v_dau BIGINT;
  v_mau BIGINT;
  v_total_users BIGINT;
  v_dau_mau_ratio NUMERIC;
  v_save_rate NUMERIC;
  v_daily_visitors JSON;

  -- Retention metrics
  v_retention_7d NUMERIC;
  v_retention_30d NUMERIC;
  v_activation_rate NUMERIC;
  v_return_rate NUMERIC;
  v_bounce_rate NUMERIC;
  v_avg_events_per_session NUMERIC;
  v_avg_saves_per_active NUMERIC;

  -- Cohorts
  v_cohorts JSON;

  -- Pipeline
  v_total_deals_active BIGINT;
  v_total_products BIGINT;
  v_states_live BIGINT;
  v_scraper_success NUMERIC;
  v_last_run_at TIMESTAMPTZ;
  v_deals_pipeline_total BIGINT;
  v_coverage JSON;

  -- Viral
  v_total_shares BIGINT;

BEGIN
  -- =====================================================================
  -- GROWTH METRICS
  -- =====================================================================

  -- DAU: unique users today
  SELECT COALESCE(COUNT(DISTINCT anon_id), 0) INTO v_dau
  FROM analytics_events
  WHERE created_at >= CURRENT_DATE
    AND anon_id IS NOT NULL;

  -- MAU: unique users last 30 days
  SELECT COALESCE(COUNT(DISTINCT anon_id), 0) INTO v_mau
  FROM analytics_events
  WHERE created_at >= NOW() - INTERVAL '30 days'
    AND anon_id IS NOT NULL;

  -- Total unique users (all time)
  SELECT COALESCE(COUNT(DISTINCT anon_id), 0) INTO v_total_users
  FROM analytics_events
  WHERE anon_id IS NOT NULL;

  -- DAU/MAU ratio
  v_dau_mau_ratio := CASE
    WHEN v_mau > 0 THEN ROUND(v_dau::numeric / v_mau * 100, 1)
    ELSE NULL
  END;

  -- Save rate (FIXED): unique users who saved / unique visitors
  WITH window_data AS (
    SELECT
      COUNT(DISTINCT anon_id) AS total_visitors,
      COUNT(DISTINCT anon_id) FILTER (
        WHERE event_name IN ('deal_saved', 'deal_save')
      ) AS users_who_saved
    FROM analytics_events
    WHERE created_at >= NOW() - (window_days || ' days')::INTERVAL
      AND anon_id IS NOT NULL
  )
  SELECT CASE
    WHEN total_visitors > 0
    THEN ROUND(users_who_saved::numeric / total_visitors * 100, 1)
    ELSE NULL
  END INTO v_save_rate
  FROM window_data;

  -- Daily unique visitors for sparkline (last N days)
  SELECT COALESCE(json_agg(row_to_json(d) ORDER BY d.dt), '[]'::json)
  INTO v_daily_visitors
  FROM (
    SELECT
      created_at::date AS dt,
      COUNT(DISTINCT anon_id) AS visitors
    FROM analytics_events
    WHERE created_at >= NOW() - (window_days || ' days')::INTERVAL
      AND anon_id IS NOT NULL
    GROUP BY created_at::date
    ORDER BY created_at::date
  ) d;

  -- =====================================================================
  -- RETENTION METRICS
  -- =====================================================================

  -- 7-day retention: users first seen 8-14 days ago who returned within 7d
  WITH first_seen AS (
    SELECT anon_id, MIN(created_at::date) AS first_day
    FROM analytics_events
    WHERE anon_id IS NOT NULL
      AND created_at >= NOW() - INTERVAL '14 days'
      AND created_at < NOW() - INTERVAL '7 days'
    GROUP BY anon_id
  ),
  returned AS (
    SELECT DISTINCT fs.anon_id
    FROM first_seen fs
    JOIN analytics_events ae ON ae.anon_id = fs.anon_id
      AND ae.created_at::date > fs.first_day
      AND ae.created_at::date <= fs.first_day + INTERVAL '7 days'
  )
  SELECT CASE WHEN COUNT(*) > 0
    THEN ROUND((SELECT COUNT(*) FROM returned)::numeric / COUNT(*)::numeric * 100, 1)
    ELSE NULL
  END INTO v_retention_7d
  FROM first_seen;

  -- 30-day retention: users first seen 31-60 days ago who returned within 30d
  WITH first_seen AS (
    SELECT anon_id, MIN(created_at::date) AS first_day
    FROM analytics_events
    WHERE anon_id IS NOT NULL
      AND created_at >= NOW() - INTERVAL '60 days'
      AND created_at < NOW() - INTERVAL '30 days'
    GROUP BY anon_id
  ),
  returned AS (
    SELECT DISTINCT fs.anon_id
    FROM first_seen fs
    JOIN analytics_events ae ON ae.anon_id = fs.anon_id
      AND ae.created_at::date > fs.first_day
      AND ae.created_at::date <= fs.first_day + INTERVAL '30 days'
  )
  SELECT CASE WHEN COUNT(*) > 0
    THEN ROUND((SELECT COUNT(*) FROM returned)::numeric / COUNT(*)::numeric * 100, 1)
    ELSE NULL
  END INTO v_retention_30d
  FROM first_seen;

  -- Activation rate: users who saved >= 1 deal in first session / new users
  WITH new_users AS (
    SELECT anon_id, MIN(created_at::date) AS first_day
    FROM analytics_events
    WHERE anon_id IS NOT NULL
      AND created_at >= NOW() - (window_days || ' days')::INTERVAL
    GROUP BY anon_id
  ),
  activated AS (
    SELECT DISTINCT nu.anon_id
    FROM new_users nu
    JOIN analytics_events ae ON ae.anon_id = nu.anon_id
      AND ae.created_at::date = nu.first_day
      AND ae.event_name IN ('deal_saved', 'deal_save')
  )
  SELECT CASE WHEN COUNT(*) > 0
    THEN ROUND((SELECT COUNT(*) FROM activated)::numeric / COUNT(*)::numeric * 100, 1)
    ELSE NULL
  END INTO v_activation_rate
  FROM new_users;

  -- Return rate: users active on multiple distinct days / total active users
  WITH user_days AS (
    SELECT anon_id, COUNT(DISTINCT created_at::date) AS active_days
    FROM analytics_events
    WHERE anon_id IS NOT NULL
      AND created_at >= NOW() - (window_days || ' days')::INTERVAL
    GROUP BY anon_id
  )
  SELECT CASE WHEN COUNT(*) > 0
    THEN ROUND(COUNT(*) FILTER (WHERE active_days > 1)::numeric / COUNT(*)::numeric * 100, 1)
    ELSE NULL
  END INTO v_return_rate
  FROM user_days;

  -- Bounce rate: users with only 1 event in the window / total users
  WITH user_events AS (
    SELECT anon_id, COUNT(*) AS event_count
    FROM analytics_events
    WHERE anon_id IS NOT NULL
      AND created_at >= NOW() - (window_days || ' days')::INTERVAL
    GROUP BY anon_id
  )
  SELECT CASE WHEN COUNT(*) > 0
    THEN ROUND(COUNT(*) FILTER (WHERE event_count = 1)::numeric / COUNT(*)::numeric * 100, 1)
    ELSE NULL
  END INTO v_bounce_rate
  FROM user_events;

  -- Avg events per session (per user-day)
  WITH user_day_events AS (
    SELECT anon_id, created_at::date AS d, COUNT(*) AS events
    FROM analytics_events
    WHERE anon_id IS NOT NULL
      AND created_at >= NOW() - (window_days || ' days')::INTERVAL
    GROUP BY anon_id, created_at::date
  )
  SELECT ROUND(COALESCE(AVG(events), 0), 1)
  INTO v_avg_events_per_session
  FROM user_day_events;

  -- Avg saves per active user (users who saved at least once)
  WITH savers AS (
    SELECT anon_id, COUNT(*) AS save_count
    FROM analytics_events
    WHERE anon_id IS NOT NULL
      AND event_name IN ('deal_saved', 'deal_save')
      AND created_at >= NOW() - (window_days || ' days')::INTERVAL
    GROUP BY anon_id
  )
  SELECT ROUND(COALESCE(AVG(save_count), 0), 1)
  INTO v_avg_saves_per_active
  FROM savers;

  -- =====================================================================
  -- WEEKLY COHORTS (Week 0/1/2/3/4 format)
  -- =====================================================================
  WITH user_first AS (
    SELECT anon_id, MIN(created_at::date) AS first_day
    FROM analytics_events
    WHERE anon_id IS NOT NULL
      AND created_at >= NOW() - INTERVAL '56 days'  -- 8 weeks lookback
    GROUP BY anon_id
  ),
  cohort_users AS (
    SELECT
      anon_id,
      first_day,
      first_day - ((EXTRACT(ISODOW FROM first_day)::int - 1)) AS cohort_monday
    FROM user_first
  ),
  user_activity AS (
    SELECT DISTINCT anon_id, created_at::date AS active_day
    FROM analytics_events
    WHERE anon_id IS NOT NULL
      AND created_at >= NOW() - INTERVAL '56 days'
  ),
  cohort_retention AS (
    SELECT
      cu.cohort_monday,
      cu.anon_id,
      cu.first_day,
      BOOL_OR(ua.active_day >= cu.cohort_monday + 7
          AND ua.active_day < cu.cohort_monday + 14) AS ret_w1,
      BOOL_OR(ua.active_day >= cu.cohort_monday + 14
          AND ua.active_day < cu.cohort_monday + 21) AS ret_w2,
      BOOL_OR(ua.active_day >= cu.cohort_monday + 21
          AND ua.active_day < cu.cohort_monday + 28) AS ret_w3,
      BOOL_OR(ua.active_day >= cu.cohort_monday + 28
          AND ua.active_day < cu.cohort_monday + 35) AS ret_w4
    FROM cohort_users cu
    LEFT JOIN user_activity ua ON ua.anon_id = cu.anon_id
    GROUP BY cu.cohort_monday, cu.anon_id, cu.first_day
  )
  SELECT COALESCE(json_agg(row_to_json(c) ORDER BY c.cohort_week), '[]'::json)
  INTO v_cohorts
  FROM (
    SELECT
      cr.cohort_monday::text AS cohort_week,
      COUNT(DISTINCT cr.anon_id) AS cohort_size,
      100 AS week0,
      CASE WHEN CURRENT_DATE >= cr.cohort_monday + 14
        THEN ROUND(COUNT(DISTINCT cr.anon_id) FILTER (WHERE cr.ret_w1)::numeric
          / NULLIF(COUNT(DISTINCT cr.anon_id), 0) * 100, 1)
        ELSE NULL
      END AS week1,
      CASE WHEN CURRENT_DATE >= cr.cohort_monday + 21
        THEN ROUND(COUNT(DISTINCT cr.anon_id) FILTER (WHERE cr.ret_w2)::numeric
          / NULLIF(COUNT(DISTINCT cr.anon_id), 0) * 100, 1)
        ELSE NULL
      END AS week2,
      CASE WHEN CURRENT_DATE >= cr.cohort_monday + 28
        THEN ROUND(COUNT(DISTINCT cr.anon_id) FILTER (WHERE cr.ret_w3)::numeric
          / NULLIF(COUNT(DISTINCT cr.anon_id), 0) * 100, 1)
        ELSE NULL
      END AS week3,
      CASE WHEN CURRENT_DATE >= cr.cohort_monday + 35
        THEN ROUND(COUNT(DISTINCT cr.anon_id) FILTER (WHERE cr.ret_w4)::numeric
          / NULLIF(COUNT(DISTINCT cr.anon_id), 0) * 100, 1)
        ELSE NULL
      END AS week4
    FROM cohort_retention cr
    GROUP BY cr.cohort_monday
    ORDER BY cr.cohort_monday
  ) c;

  -- =====================================================================
  -- PIPELINE METRICS
  -- =====================================================================

  -- Active deals today (products currently active with a qualifying score)
  SELECT COALESCE(COUNT(*), 0) INTO v_total_deals_active
  FROM products
  WHERE is_active = true AND deal_score > 0;

  -- Unique active products currently in DB (not historical/stale rows)
  SELECT COALESCE(COUNT(*), 0) INTO v_total_products
  FROM products
  WHERE is_active = true;

  -- Total deals ever detected (cumulative pipeline — includes historical)
  SELECT COALESCE(COUNT(*), 0) INTO v_deals_pipeline_total
  FROM products WHERE deal_score > 0;

  -- States live (distinct regions with scrape runs in last 7 days)
  SELECT COALESCE(COUNT(DISTINCT
    CASE
      WHEN region ~ '^(.+)-\d+$' THEN regexp_replace(region, '-\d+$', '')
      ELSE region
    END
  ), 0) INTO v_states_live
  FROM scrape_runs
  WHERE started_at >= NOW() - INTERVAL '7 days';

  -- Last run time
  SELECT MAX(started_at) INTO v_last_run_at
  FROM scrape_runs;

  -- Scraper success rate (last 15 completed runs)
  WITH recent AS (
    SELECT
      sites_scraped,
      sites_failed
    FROM scrape_runs
    WHERE status IN ('completed', 'completed_with_errors')
    ORDER BY started_at DESC
    LIMIT 15
  )
  SELECT ROUND(
    AVG(
      CASE WHEN (COALESCE(jsonb_array_length(sites_scraped), 0) + COALESCE(jsonb_array_length(sites_failed), 0)) > 0
      THEN COALESCE(jsonb_array_length(sites_scraped), 0)::numeric
        / (COALESCE(jsonb_array_length(sites_scraped), 0) + COALESCE(jsonb_array_length(sites_failed), 0))
        * 100
      ELSE 100
      END
    ), 0
  ) INTO v_scraper_success
  FROM recent;

  -- =====================================================================
  -- COVERAGE BY STATE (7-day) — DEDUPLICATED
  -- =====================================================================
  -- sites_ok: DISTINCT slugs across all runs (not naive SUM of array lengths)
  -- products: actual unique product rows from products table (not run totals)
  WITH region_runs AS (
    SELECT
      sr.id,
      CASE
        WHEN sr.region ~ '^(.+)-\d+$' THEN regexp_replace(sr.region, '-\d+$', '')
        ELSE sr.region
      END AS base_region,
      sr.sites_scraped,
      sr.sites_failed,
      sr.started_at
    FROM scrape_runs sr
    WHERE sr.started_at >= NOW() - INTERVAL '7 days'
      AND sr.status IN ('completed', 'completed_with_errors')
  ),
  -- Unnest all scraped slugs (JSONB arrays) and count distinct per region
  deduped_sites AS (
    SELECT
      rr.base_region,
      COUNT(DISTINCT slug_val) AS sites_ok
    FROM region_runs rr,
    LATERAL jsonb_array_elements_text(
      CASE jsonb_typeof(rr.sites_scraped)
        WHEN 'array' THEN rr.sites_scraped
        ELSE '[]'::jsonb
      END
    ) AS slug_val
    GROUP BY rr.base_region
  ),
  -- Count actual unique products per region from the products table (7-day)
  product_counts AS (
    SELECT
      d.region AS base_region,
      COUNT(DISTINCT p.id) AS products
    FROM products p
    JOIN dispensaries d ON d.id = p.dispensary_id
    WHERE p.is_active = true
      AND p.scraped_at >= NOW() - INTERVAL '7 days'
    GROUP BY d.region
  ),
  -- Success rate per region (average across all runs)
  region_success AS (
    SELECT
      rr.base_region,
      ROUND(AVG(
        CASE WHEN (COALESCE(jsonb_array_length(rr.sites_scraped), 0) + COALESCE(jsonb_array_length(rr.sites_failed), 0)) > 0
        THEN COALESCE(jsonb_array_length(rr.sites_scraped), 0)::numeric
          / (COALESCE(jsonb_array_length(rr.sites_scraped), 0) + COALESCE(jsonb_array_length(rr.sites_failed), 0)) * 100
        ELSE 100
        END
      ), 0) AS success_rate_7d,
      MAX(rr.started_at) AS last_run
    FROM region_runs rr
    GROUP BY rr.base_region
  ),
  by_region AS (
    SELECT
      rs.base_region,
      COALESCE(ds.sites_ok, 0) AS sites_ok,
      COALESCE(pc.products, 0) AS products,
      rs.success_rate_7d,
      rs.last_run
    FROM region_success rs
    LEFT JOIN deduped_sites ds ON ds.base_region = rs.base_region
    LEFT JOIN product_counts pc ON pc.base_region = rs.base_region
  )
  SELECT COALESCE(json_agg(row_to_json(r) ORDER BY r.base_region), '[]'::json)
  INTO v_coverage
  FROM by_region r;

  -- =====================================================================
  -- VIRAL METRICS
  -- =====================================================================

  SELECT COALESCE(COUNT(*), 0) INTO v_total_shares
  FROM analytics_events
  WHERE event_name IN ('deal_shared', 'share_saves')
    AND created_at >= NOW() - (window_days || ' days')::INTERVAL;

  -- =====================================================================
  -- BUILD RESULT
  -- =====================================================================

  result := json_build_object(
    'growth', json_build_object(
      'dau', v_dau,
      'mau', v_mau,
      'total_users', v_total_users,
      'dau_mau_ratio', v_dau_mau_ratio,
      'save_rate', v_save_rate,
      'daily_visitors', v_daily_visitors
    ),
    'retention', json_build_object(
      'retention_7d', v_retention_7d,
      'retention_30d', v_retention_30d,
      'activation_rate', v_activation_rate,
      'return_rate', v_return_rate,
      'bounce_rate', v_bounce_rate,
      'avg_events_per_session', v_avg_events_per_session,
      'avg_saves_per_active_user', v_avg_saves_per_active
    ),
    'cohorts', v_cohorts,
    'pipeline', json_build_object(
      'total_deals_active', v_total_deals_active,
      'total_products', v_total_products,
      'deals_pipeline_total', v_deals_pipeline_total,
      'states_live', v_states_live,
      'scraper_success', COALESCE(v_scraper_success, 0),
      'last_run_at', v_last_run_at
    ),
    'viral', json_build_object(
      'total_shares', v_total_shares
    ),
    'coverage', v_coverage,
    'calculated_at', NOW()
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_metrics TO anon, authenticated;

COMMENT ON FUNCTION get_dashboard_metrics IS
  'Unified dashboard metrics RPC. Coverage uses DISTINCT slugs (not naive SUM). Product counts from actual products table. Total products = active only.';
