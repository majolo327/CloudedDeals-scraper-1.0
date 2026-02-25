-- =========================================================================
-- 038_clean_analytics_kpis.sql — Server-side KPI functions
-- =========================================================================
-- Creates SECURITY DEFINER functions that bypass RLS to guarantee
-- accurate KPI calculations regardless of client auth state.
-- Single source of truth: analytics_events table.
-- =========================================================================

-- Combined KPI summary: one RPC call returns all hero metrics
CREATE OR REPLACE FUNCTION get_kpi_summary()
RETURNS JSON
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'dau',
      (SELECT COALESCE(COUNT(DISTINCT anon_id), 0)
       FROM analytics_events
       WHERE created_at >= CURRENT_DATE),
    'dau_yesterday',
      (SELECT COALESCE(COUNT(DISTINCT anon_id), 0)
       FROM analytics_events
       WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
         AND created_at < CURRENT_DATE),
    'wau',
      (SELECT COALESCE(COUNT(DISTINCT anon_id), 0)
       FROM analytics_events
       WHERE created_at >= NOW() - INTERVAL '7 days'),
    'wau_prev',
      (SELECT COALESCE(COUNT(DISTINCT anon_id), 0)
       FROM analytics_events
       WHERE created_at >= NOW() - INTERVAL '14 days'
         AND created_at < NOW() - INTERVAL '7 days'),
    'mau',
      (SELECT COALESCE(COUNT(DISTINCT anon_id), 0)
       FROM analytics_events
       WHERE created_at >= NOW() - INTERVAL '30 days'),
    'mau_prev',
      (SELECT COALESCE(COUNT(DISTINCT anon_id), 0)
       FROM analytics_events
       WHERE created_at >= NOW() - INTERVAL '60 days'
         AND created_at < NOW() - INTERVAL '30 days'),
    'total_unique_users',
      (SELECT COALESCE(COUNT(DISTINCT anon_id), 0)
       FROM analytics_events
       WHERE anon_id IS NOT NULL),
    'today_saves',
      (SELECT COUNT(*)
       FROM analytics_events
       WHERE created_at >= CURRENT_DATE
         AND event_name IN ('deal_saved', 'deal_save')),
    'today_clicks',
      (SELECT COUNT(*)
       FROM analytics_events
       WHERE created_at >= CURRENT_DATE
         AND event_name = 'get_deal_click')
  );
$$;

-- Grant execute to both anon and authenticated roles
GRANT EXECUTE ON FUNCTION get_kpi_summary() TO anon, authenticated;

-- Also add anon SELECT on user_sessions as a safety net
-- (the admin dashboard sometimes runs as anon before auth loads)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_sessions'
      AND policyname = 'anon_read_sessions'
  ) THEN
    CREATE POLICY "anon_read_sessions" ON public.user_sessions
      FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- Index for efficient all-time unique user count
CREATE INDEX IF NOT EXISTS idx_analytics_anon_notnull
  ON analytics_events(anon_id)
  WHERE anon_id IS NOT NULL;

COMMENT ON FUNCTION get_kpi_summary()
  IS 'Returns core KPI metrics (DAU, WAU, MAU, total unique users) as JSON. Uses SECURITY DEFINER to bypass RLS.';
