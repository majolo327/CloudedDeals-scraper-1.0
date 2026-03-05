-- =========================================================================
-- 042_optimize_dashboard_rpcs.sql — Optimize dashboard RPCs for speed
-- =========================================================================
-- Supabase PostgREST has an ~8s HTTP timeout that can't be overridden by
-- SET statement_timeout. Each RPC must complete in <8s.
--
-- Problem: 041's RPCs did multiple sequential COUNT(DISTINCT) scans on
-- analytics_events — each scan ~1-3s, totaling >8s.
--
-- Fix: Rewrite to use single-scan CTEs. One scan → multiple metrics.
-- Safe to run multiple times (CREATE OR REPLACE).
-- =========================================================================

-- =========================================================================
-- 1. get_dashboard_growth(window_days) — single-scan rewrite
-- =========================================================================
CREATE OR REPLACE FUNCTION get_dashboard_growth(window_days INT DEFAULT 30)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET statement_timeout = '30s'
AS $$
DECLARE
  v_result JSON;
  v_daily_visitors JSON;
BEGIN
  -- Single scan: extract all count metrics at once
  SELECT json_build_object(
    'dau', COUNT(DISTINCT anon_id) FILTER (WHERE created_at::date = CURRENT_DATE),
    'mau', COUNT(DISTINCT anon_id) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'),
    'total_users', COUNT(DISTINCT anon_id),
    'dau_mau_ratio', CASE
      WHEN COUNT(DISTINCT anon_id) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') > 0
      THEN ROUND(
        COUNT(DISTINCT anon_id) FILTER (WHERE created_at::date = CURRENT_DATE)::numeric
        / COUNT(DISTINCT anon_id) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') * 100, 1)
      ELSE NULL
    END,
    'save_rate', CASE
      WHEN COUNT(DISTINCT anon_id) > 0
      THEN ROUND(
        COUNT(DISTINCT anon_id) FILTER (
          WHERE event_name IN ('deal_saved', 'deal_save')
        )::numeric / COUNT(DISTINCT anon_id) * 100, 1)
      ELSE NULL
    END
  ) INTO v_result
  FROM analytics_events
  WHERE anon_id IS NOT NULL
    AND created_at >= NOW() - (window_days || ' days')::INTERVAL;

  -- Sparkline: lightweight group-by (already uses idx_analytics_anon_created)
  SELECT COALESCE(json_agg(row_to_json(d) ORDER BY d.dt), '[]'::json)
  INTO v_daily_visitors
  FROM (
    SELECT created_at::date AS dt, COUNT(DISTINCT anon_id) AS visitors
    FROM analytics_events
    WHERE created_at >= NOW() - (window_days || ' days')::INTERVAL
      AND anon_id IS NOT NULL
    GROUP BY created_at::date
  ) d;

  RETURN v_result::jsonb || jsonb_build_object('daily_visitors', v_daily_visitors);
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_growth TO anon, authenticated;

-- =========================================================================
-- 2. get_dashboard_retention(window_days) — single-scan rewrite
-- =========================================================================
CREATE OR REPLACE FUNCTION get_dashboard_retention(window_days INT DEFAULT 30)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET statement_timeout = '30s'
AS $$
DECLARE
  v_retention_7d NUMERIC;
  v_retention_30d NUMERIC;
  v_activation_rate NUMERIC;
  v_return_rate NUMERIC;
  v_bounce_rate NUMERIC;
  v_avg_events NUMERIC;
  v_avg_saves NUMERIC;
BEGIN
  -- 7-day retention: users who first appeared 7-14 days ago and returned within 7 days
  WITH cohort AS (
    SELECT anon_id, MIN(created_at::date) AS first_day
    FROM analytics_events
    WHERE anon_id IS NOT NULL
      AND created_at >= NOW() - INTERVAL '14 days'
      AND created_at < NOW() - INTERVAL '7 days'
    GROUP BY anon_id
  )
  SELECT CASE WHEN COUNT(*) > 0
    THEN ROUND(
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM analytics_events ae
        WHERE ae.anon_id = cohort.anon_id
          AND ae.created_at::date > cohort.first_day
          AND ae.created_at::date <= cohort.first_day + 7
      ))::numeric / COUNT(*)::numeric * 100, 1)
    ELSE NULL END
  INTO v_retention_7d FROM cohort;

  -- 30-day retention: users who first appeared 30-60 days ago
  WITH cohort AS (
    SELECT anon_id, MIN(created_at::date) AS first_day
    FROM analytics_events
    WHERE anon_id IS NOT NULL
      AND created_at >= NOW() - INTERVAL '60 days'
      AND created_at < NOW() - INTERVAL '30 days'
    GROUP BY anon_id
  )
  SELECT CASE WHEN COUNT(*) > 0
    THEN ROUND(
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM analytics_events ae
        WHERE ae.anon_id = cohort.anon_id
          AND ae.created_at::date > cohort.first_day
          AND ae.created_at::date <= cohort.first_day + 30
      ))::numeric / COUNT(*)::numeric * 100, 1)
    ELSE NULL END
  INTO v_retention_30d FROM cohort;

  -- Engagement metrics: single scan, two-step CTE (no correlated subquery)
  WITH user_stats AS (
    SELECT
      anon_id,
      COUNT(*) AS event_count,
      COUNT(DISTINCT created_at::date) AS active_days,
      COUNT(*) FILTER (WHERE event_name IN ('deal_saved', 'deal_save')) AS save_count,
      MIN(created_at::date) AS first_day
    FROM analytics_events
    WHERE anon_id IS NOT NULL
      AND created_at >= NOW() - (window_days || ' days')::INTERVAL
    GROUP BY anon_id
  ),
  with_activation AS (
    SELECT
      us.*,
      EXISTS (
        SELECT 1 FROM analytics_events ae
        WHERE ae.anon_id = us.anon_id
          AND ae.created_at::date = us.first_day
          AND ae.event_name IN ('deal_saved', 'deal_save')
      ) AS activated
    FROM user_stats us
  )
  SELECT
    -- Activation rate: saved on first day
    CASE WHEN COUNT(*) > 0
      THEN ROUND(COUNT(*) FILTER (WHERE activated)::numeric / COUNT(*)::numeric * 100, 1)
      ELSE NULL END,
    -- Return rate: multi-day users
    CASE WHEN COUNT(*) > 0
      THEN ROUND(COUNT(*) FILTER (WHERE active_days > 1)::numeric / COUNT(*)::numeric * 100, 1)
      ELSE NULL END,
    -- Bounce rate: single-event users
    CASE WHEN COUNT(*) > 0
      THEN ROUND(COUNT(*) FILTER (WHERE event_count = 1)::numeric / COUNT(*)::numeric * 100, 1)
      ELSE NULL END,
    -- Avg events per session (per user-day)
    ROUND(COALESCE(SUM(event_count)::numeric / NULLIF(SUM(active_days), 0), 0), 1),
    -- Avg saves per active saver
    ROUND(COALESCE(AVG(save_count) FILTER (WHERE save_count > 0), 0), 1)
  INTO v_activation_rate, v_return_rate, v_bounce_rate, v_avg_events, v_avg_saves
  FROM with_activation;

  RETURN json_build_object(
    'retention_7d', v_retention_7d,
    'retention_30d', v_retention_30d,
    'activation_rate', v_activation_rate,
    'return_rate', v_return_rate,
    'bounce_rate', v_bounce_rate,
    'avg_events_per_session', v_avg_events,
    'avg_saves_per_active_user', v_avg_saves
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_retention TO anon, authenticated;

-- =========================================================================
-- 3. get_dashboard_cohorts() — optimized with materialized first_day
-- =========================================================================
CREATE OR REPLACE FUNCTION get_dashboard_cohorts()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET statement_timeout = '30s'
AS $$
DECLARE
  v_cohorts JSON;
BEGIN
  WITH user_first AS (
    SELECT anon_id, MIN(created_at::date) AS first_day
    FROM analytics_events
    WHERE anon_id IS NOT NULL
      AND created_at >= NOW() - INTERVAL '56 days'
    GROUP BY anon_id
  ),
  cohort_users AS (
    SELECT
      anon_id, first_day,
      first_day - ((EXTRACT(ISODOW FROM first_day)::int - 1)) AS cohort_monday
    FROM user_first
  ),
  user_active_days AS (
    SELECT DISTINCT anon_id, created_at::date AS d
    FROM analytics_events
    WHERE anon_id IS NOT NULL
      AND created_at >= NOW() - INTERVAL '56 days'
  ),
  joined AS (
    SELECT
      cu.cohort_monday, cu.anon_id,
      BOOL_OR(ua.d >= cu.cohort_monday + 7  AND ua.d < cu.cohort_monday + 14) AS w1,
      BOOL_OR(ua.d >= cu.cohort_monday + 14 AND ua.d < cu.cohort_monday + 21) AS w2,
      BOOL_OR(ua.d >= cu.cohort_monday + 21 AND ua.d < cu.cohort_monday + 28) AS w3,
      BOOL_OR(ua.d >= cu.cohort_monday + 28 AND ua.d < cu.cohort_monday + 35) AS w4
    FROM cohort_users cu
    LEFT JOIN user_active_days ua ON ua.anon_id = cu.anon_id
    GROUP BY cu.cohort_monday, cu.anon_id
  )
  SELECT COALESCE(json_agg(row_to_json(c) ORDER BY c.cohort_week), '[]'::json)
  INTO v_cohorts
  FROM (
    SELECT
      j.cohort_monday::text AS cohort_week,
      COUNT(DISTINCT j.anon_id) AS cohort_size,
      100 AS week0,
      CASE WHEN CURRENT_DATE >= j.cohort_monday + 14
        THEN ROUND(COUNT(DISTINCT j.anon_id) FILTER (WHERE j.w1)::numeric
          / NULLIF(COUNT(DISTINCT j.anon_id), 0) * 100, 1)
        ELSE NULL END AS week1,
      CASE WHEN CURRENT_DATE >= j.cohort_monday + 21
        THEN ROUND(COUNT(DISTINCT j.anon_id) FILTER (WHERE j.w2)::numeric
          / NULLIF(COUNT(DISTINCT j.anon_id), 0) * 100, 1)
        ELSE NULL END AS week2,
      CASE WHEN CURRENT_DATE >= j.cohort_monday + 28
        THEN ROUND(COUNT(DISTINCT j.anon_id) FILTER (WHERE j.w3)::numeric
          / NULLIF(COUNT(DISTINCT j.anon_id), 0) * 100, 1)
        ELSE NULL END AS week3,
      CASE WHEN CURRENT_DATE >= j.cohort_monday + 35
        THEN ROUND(COUNT(DISTINCT j.anon_id) FILTER (WHERE j.w4)::numeric
          / NULLIF(COUNT(DISTINCT j.anon_id), 0) * 100, 1)
        ELSE NULL END AS week4
    FROM joined j
    GROUP BY j.cohort_monday
  ) c;

  RETURN json_build_object('cohorts', v_cohorts);
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_cohorts TO anon, authenticated;

-- =========================================================================
-- 4. get_dashboard_pipeline() — already fast, just fix jsonb + keep
-- =========================================================================
CREATE OR REPLACE FUNCTION get_dashboard_pipeline()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET statement_timeout = '30s'
AS $$
DECLARE
  v_total_deals_active BIGINT;
  v_total_products BIGINT;
  v_deals_pipeline_total BIGINT;
  v_states_live BIGINT;
  v_scraper_success NUMERIC;
  v_last_run_at TIMESTAMPTZ;
  v_coverage JSON;
  v_total_shares BIGINT;
BEGIN
  -- Active deals
  SELECT COALESCE(COUNT(*), 0) INTO v_total_deals_active
  FROM products WHERE is_active = true AND deal_score > 0;

  -- Total products
  SELECT COALESCE(COUNT(*), 0) INTO v_total_products FROM products;

  -- Total deals ever
  SELECT COALESCE(COUNT(*), 0) INTO v_deals_pipeline_total
  FROM products WHERE deal_score > 0;

  -- States live
  SELECT COALESCE(COUNT(DISTINCT
    CASE WHEN region ~ '^(.+)-\d+$' THEN regexp_replace(region, '-\d+$', '')
         ELSE region END
  ), 0) INTO v_states_live
  FROM scrape_runs WHERE started_at >= NOW() - INTERVAL '7 days';

  -- Last run
  SELECT MAX(started_at) INTO v_last_run_at FROM scrape_runs;

  -- Scraper success rate (last 15 runs)
  WITH recent AS (
    SELECT sites_scraped, sites_failed
    FROM scrape_runs
    WHERE status IN ('completed', 'completed_with_errors')
    ORDER BY started_at DESC LIMIT 15
  )
  SELECT ROUND(AVG(
    CASE WHEN (COALESCE(jsonb_array_length(sites_scraped), 0) + COALESCE(jsonb_array_length(sites_failed), 0)) > 0
    THEN COALESCE(jsonb_array_length(sites_scraped), 0)::numeric
      / (COALESCE(jsonb_array_length(sites_scraped), 0) + COALESCE(jsonb_array_length(sites_failed), 0)) * 100
    ELSE 100 END
  ), 0) INTO v_scraper_success FROM recent;

  -- Coverage by state
  WITH region_runs AS (
    SELECT
      CASE WHEN region ~ '^(.+)-\d+$' THEN regexp_replace(region, '-\d+$', '')
           ELSE region END AS base_region,
      sites_scraped, sites_failed, total_products, started_at
    FROM scrape_runs WHERE started_at >= NOW() - INTERVAL '7 days'
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
        ELSE 100 END
      ), 0) AS success_rate_7d,
      MAX(started_at) AS last_run
    FROM region_runs GROUP BY base_region
  )
  SELECT COALESCE(json_agg(row_to_json(r) ORDER BY r.base_region), '[]'::json)
  INTO v_coverage FROM by_region r;

  -- Total shares
  SELECT COALESCE(COUNT(*), 0) INTO v_total_shares
  FROM analytics_events
  WHERE event_name IN ('deal_shared', 'share_saves');

  RETURN json_build_object(
    'pipeline', json_build_object(
      'total_deals_active', v_total_deals_active,
      'total_products', v_total_products,
      'deals_pipeline_total', v_deals_pipeline_total,
      'states_live', v_states_live,
      'scraper_success', COALESCE(v_scraper_success, 0),
      'last_run_at', v_last_run_at
    ),
    'viral', json_build_object('total_shares', v_total_shares),
    'coverage', v_coverage,
    'calculated_at', NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_pipeline TO anon, authenticated;
