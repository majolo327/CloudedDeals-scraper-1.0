-- =========================================================================
-- 041_fix_dashboard_indexes.sql — Fix dashboard metrics timeout
-- =========================================================================
-- The get_dashboard_metrics() RPC (migration 040) runs 12+ queries on
-- analytics_events filtering on raw `created_at` timestamps, but the only
-- composite index (039) uses `created_at::date` which PostgreSQL cannot
-- use for timestamp range predicates. This causes full table scans and
-- statement timeouts on Supabase.
--
-- These indexes let all dashboard queries use index scans instead.
-- Safe to run multiple times (IF NOT EXISTS).
-- =========================================================================

-- Primary composite: covers most dashboard queries that filter
-- WHERE anon_id IS NOT NULL AND created_at >= <timestamp>
CREATE INDEX IF NOT EXISTS idx_analytics_anon_created_ts
  ON analytics_events(created_at, anon_id)
  WHERE anon_id IS NOT NULL;

-- Event-specific: covers save rate, activation rate, avg saves queries
-- WHERE event_name IN (...) AND anon_id IS NOT NULL AND created_at >= ...
CREATE INDEX IF NOT EXISTS idx_analytics_event_anon_created
  ON analytics_events(event_name, created_at, anon_id)
  WHERE anon_id IS NOT NULL;

-- Also bump the statement timeout for this specific function since it
-- runs 12 sequential queries (even with indexes, cohort joins are heavy)
ALTER FUNCTION get_dashboard_metrics SET statement_timeout = '30s';
