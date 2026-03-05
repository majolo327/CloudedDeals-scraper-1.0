-- =========================================================================
-- 042_fix_dashboard_jsonb_array_length.sql — Fix array_length → jsonb_array_length
-- =========================================================================
-- The admin dashboard broke with:
--   "function array_length(jsonb, integer) does not exist"
--
-- Root cause: migration 040's get_dashboard_metrics() used array_length()
-- on JSONB columns (sites_scraped, sites_failed). PostgreSQL's array_length()
-- only works on native arrays (text[], integer[]); JSONB arrays need
-- jsonb_array_length().
--
-- This migration replaces get_dashboard_metrics with corrected calls.
-- Safe to run multiple times (CREATE OR REPLACE).
-- =========================================================================

CREATE OR REPLACE FUNCTION get_dashboard_metrics(window_days INT DEFAULT 30)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET statement_timeout = '30s'
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

  -- Save rate: unique users who saved / unique visitors
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
      AND created_at >= NOW() - INTERVAL '56 days'
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

  -- Active deals today
  SELECT COALESCE(COUNT(*), 0) INTO v_total_deals_active
  FROM products
  WHERE is_active = true AND deal_score > 0;

  -- Total products ever scraped
  SELECT COALESCE(COUNT(*), 0) INTO v_total_products
  FROM products;

  -- Total deals ever (for pipeline progress bar)
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

  -- Scraper success rate (last 15 runs)
  -- FIX: jsonb_array_length() instead of array_length() — sites_scraped/sites_failed are JSONB
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

  -- Coverage by state (condensed)
  -- FIX: jsonb_array_length() instead of array_length()
  WITH region_runs AS (
    SELECT
      CASE
        WHEN region ~ '^(.+)-\d+$' THEN regexp_replace(region, '-\d+$', '')
        ELSE region
      END AS base_region,
      sites_scraped,
      sites_failed,
      total_products,
      started_at
    FROM scrape_runs
    WHERE started_at >= NOW() - INTERVAL '7 days'
  ),
  by_region AS (
    SELECT
      base_region,
      SUM(COALESCE(jsonb_array_length(sites_scraped), 0)) AS sites_ok,
      SUM(total_products) AS products,
      ROUND(AVG(
        CASE WHEN (COALESCE(jsonb_array_length(sites_scraped), 0) + COALESCE(jsonb_array_length(sites_failed), 0)) > 0
        THEN COALESCE(jsonb_array_length(sites_scraped), 0)::numeric
          / (COALESCE(jsonb_array_length(sites_scraped), 0) + COALESCE(jsonb_array_length(sites_failed), 0)) * 100
        ELSE 100
        END
      ), 0) AS success_rate_7d,
      MAX(started_at) AS last_run
    FROM region_runs
    GROUP BY base_region
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
