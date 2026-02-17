-- =========================================================================
-- 033_data_retention_policy.sql — Automated cleanup of stale data
-- =========================================================================
--
-- Policies:
--   1. user_events older than 180 days → deleted
--   2. analytics_events older than 180 days → deleted
--   3. shared_saves past expiry → deleted
--   4. scrape_runs older than 90 days → deleted (summary in daily_metrics)
--
-- The cleanup function is designed to be called via pg_cron or an
-- external scheduler (e.g., GitHub Actions cron).  It can also be
-- called manually:  SELECT run_data_retention();
-- =========================================================================

CREATE OR REPLACE FUNCTION run_data_retention()
RETURNS TABLE(table_name TEXT, rows_deleted BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _deleted BIGINT;
BEGIN
    -- 1. User events > 180 days
    DELETE FROM user_events
    WHERE created_at < NOW() - INTERVAL '180 days';
    GET DIAGNOSTICS _deleted = ROW_COUNT;
    table_name := 'user_events';
    rows_deleted := _deleted;
    RETURN NEXT;

    -- 2. Analytics events > 180 days
    DELETE FROM analytics_events
    WHERE created_at < NOW() - INTERVAL '180 days';
    GET DIAGNOSTICS _deleted = ROW_COUNT;
    table_name := 'analytics_events';
    rows_deleted := _deleted;
    RETURN NEXT;

    -- 3. Expired shared saves
    DELETE FROM shared_saves
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
    GET DIAGNOSTICS _deleted = ROW_COUNT;
    table_name := 'shared_saves';
    rows_deleted := _deleted;
    RETURN NEXT;

    -- 4. Old scrape runs > 90 days (metrics already captured in daily_metrics)
    DELETE FROM scrape_runs
    WHERE started_at < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS _deleted = ROW_COUNT;
    table_name := 'scrape_runs';
    rows_deleted := _deleted;
    RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION run_data_retention() IS
    'Deletes stale data per retention policy. Call via pg_cron weekly or manually.';
