-- =========================================================================
-- 034_materialize_deal_save_counts.sql — Materialized view for save counts
-- =========================================================================
--
-- Replaces the regular VIEW from 007 with a MATERIALIZED VIEW.
-- At scale, the regular view runs a full GROUP BY on every frontend
-- page load.  The materialized view is pre-computed and refreshed
-- after each scrape run (or on demand).
--
-- Refresh strategy:
--   - Call: REFRESH MATERIALIZED VIEW CONCURRENTLY deal_save_counts;
--   - "CONCURRENTLY" allows reads during refresh (requires unique index)
--   - Trigger: after scrape completes or via pg_cron every 15 min
-- =========================================================================

-- Drop both forms to ensure idempotency (re-runnable)
DROP MATERIALIZED VIEW IF EXISTS public.deal_save_counts;
DROP VIEW IF EXISTS public.deal_save_counts;

-- Create materialized view with same schema
CREATE MATERIALIZED VIEW public.deal_save_counts AS
SELECT
    deal_id,
    COUNT(DISTINCT user_id) AS save_count
FROM public.user_saved_deals
GROUP BY deal_id;

-- Unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_save_counts_deal_id
    ON deal_save_counts (deal_id);

-- Maintain same permissions as the original view
GRANT SELECT ON public.deal_save_counts TO anon;
GRANT SELECT ON public.deal_save_counts TO authenticated;
GRANT SELECT ON public.deal_save_counts TO service_role;

-- Convenience function to refresh the view (callable from scraper or pg_cron)
CREATE OR REPLACE FUNCTION refresh_deal_save_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY deal_save_counts;
END;
$$;

COMMENT ON MATERIALIZED VIEW deal_save_counts IS
    'Pre-computed save counts per product for social proof. Refresh via refresh_deal_save_counts().';
