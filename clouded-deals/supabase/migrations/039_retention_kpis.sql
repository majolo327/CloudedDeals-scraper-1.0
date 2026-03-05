-- =========================================================================
-- 039_retention_kpis.sql — Server-side retention & cohort KPIs
-- =========================================================================
-- Reliable retention metrics computed server-side, avoiding the 50K row
-- limit and 30-day window limitations of client-side computation.
--
-- Returns: total users, 7d/30d retention %, and weekly cohort retention
-- with Day 1/3/7/14/30 breakdowns.
--
-- Safe to run multiple times (CREATE OR REPLACE).
-- =========================================================================

-- =========================================================================
-- 1. get_retention_kpis(lookback_days)
-- =========================================================================
-- Returns top-level retention summary: total users, 7d retention %,
-- 30d retention %, and a weekly cohort breakdown.
--
-- 7d retention = of users first seen 8-14 days ago, % active again within
-- 7 days of their first event.  Uses a "matured" window so we only measure
-- users whose 7-day window has fully elapsed.
--
-- 30d retention = of users first seen 31-60 days ago, % active again
-- within 30 days.

CREATE OR REPLACE FUNCTION get_retention_kpis(lookback_days INT DEFAULT 90)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  total_users BIGINT;
  retention_7d NUMERIC;
  retention_30d NUMERIC;
  cohorts JSON;
BEGIN
  -- Total unique users (all time)
  SELECT COUNT(DISTINCT anon_id) INTO total_users
  FROM analytics_events
  WHERE anon_id IS NOT NULL;

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
    ELSE 0
  END INTO retention_7d
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
    ELSE 0
  END INTO retention_30d
  FROM first_seen;

  -- Weekly cohort breakdown with Day 1/3/7/14/30 retention
  WITH user_first AS (
    SELECT anon_id, MIN(created_at::date) AS first_day
    FROM analytics_events
    WHERE anon_id IS NOT NULL
      AND created_at >= NOW() - (lookback_days || ' days')::INTERVAL
    GROUP BY anon_id
  ),
  user_activity AS (
    SELECT DISTINCT anon_id, created_at::date AS active_day
    FROM analytics_events
    WHERE anon_id IS NOT NULL
      AND created_at >= NOW() - (lookback_days || ' days')::INTERVAL
  ),
  cohort_users AS (
    SELECT
      uf.anon_id,
      uf.first_day,
      -- Monday of first-seen week
      uf.first_day - ((EXTRACT(ISODOW FROM uf.first_day)::int - 1)) AS cohort_monday
    FROM user_first uf
  ),
  cohort_retention AS (
    SELECT
      cu.cohort_monday,
      cu.anon_id,
      cu.first_day,
      BOOL_OR(ua.active_day = cu.first_day + 1) AS ret_d1,
      BOOL_OR(ua.active_day > cu.first_day AND ua.active_day <= cu.first_day + 3) AS ret_d3,
      BOOL_OR(ua.active_day > cu.first_day AND ua.active_day <= cu.first_day + 7) AS ret_d7,
      BOOL_OR(ua.active_day > cu.first_day AND ua.active_day <= cu.first_day + 14) AS ret_d14,
      BOOL_OR(ua.active_day > cu.first_day AND ua.active_day <= cu.first_day + 30) AS ret_d30
    FROM cohort_users cu
    LEFT JOIN user_activity ua ON ua.anon_id = cu.anon_id
    GROUP BY cu.cohort_monday, cu.anon_id, cu.first_day
  )
  SELECT json_agg(row_to_json(c) ORDER BY c.cohort_week) INTO cohorts
  FROM (
    SELECT
      cr.cohort_monday::text AS cohort_week,
      COUNT(DISTINCT cr.anon_id) AS cohort_size,
      ROUND(COUNT(DISTINCT cr.anon_id) FILTER (WHERE cr.ret_d1)::numeric
        / NULLIF(COUNT(DISTINCT cr.anon_id), 0) * 100, 1) AS day1,
      ROUND(COUNT(DISTINCT cr.anon_id) FILTER (WHERE cr.ret_d3)::numeric
        / NULLIF(COUNT(DISTINCT cr.anon_id), 0) * 100, 1) AS day3,
      ROUND(COUNT(DISTINCT cr.anon_id) FILTER (WHERE cr.ret_d7)::numeric
        / NULLIF(COUNT(DISTINCT cr.anon_id), 0) * 100, 1) AS day7,
      ROUND(COUNT(DISTINCT cr.anon_id) FILTER (WHERE cr.ret_d14)::numeric
        / NULLIF(COUNT(DISTINCT cr.anon_id), 0) * 100, 1) AS day14,
      ROUND(COUNT(DISTINCT cr.anon_id) FILTER (WHERE cr.ret_d30)::numeric
        / NULLIF(COUNT(DISTINCT cr.anon_id), 0) * 100, 1) AS day30
    FROM cohort_retention cr
    GROUP BY cr.cohort_monday
    ORDER BY cr.cohort_monday
  ) c;

  result := json_build_object(
    'total_users', total_users,
    'retention_7d', COALESCE(retention_7d, 0),
    'retention_30d', COALESCE(retention_30d, 0),
    'cohorts', COALESCE(cohorts, '[]'::json)
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_retention_kpis TO anon, authenticated;

COMMENT ON FUNCTION get_retention_kpis IS
  'Server-side retention KPIs: total users, 7d/30d retention %, and weekly cohort breakdown with Day 1/3/7/14/30.';

-- Index to accelerate retention cohort queries (first-seen per user)
CREATE INDEX IF NOT EXISTS idx_analytics_anon_date
  ON analytics_events(anon_id, (created_at::date))
  WHERE anon_id IS NOT NULL;
