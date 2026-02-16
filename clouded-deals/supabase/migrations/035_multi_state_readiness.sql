-- =========================================================================
-- 035_multi_state_readiness.sql — Unblock 6-state expansion
-- =========================================================================
--
-- Fixes three blockers preventing new-state scrapes from writing to DB:
--
-- 1. dispensaries.region CHECK constraint only allowed 'southern-nv'
--    and 'northern-nv' — now includes all 6 launch states.
--
-- 2. daily_metrics had a unique index on (run_date) alone, causing
--    later regions to overwrite earlier ones on the same day.
--    Adds a region column and re-keys the unique index.
--
-- 3. top_100_curated view hardcoded region='southern-nv', hiding
--    deals from new states. Now shows all active regions.
--
-- Safe to run multiple times (idempotent).
-- =========================================================================

-- =====================================================================
-- 1. Expand the region CHECK constraint on dispensaries
-- =====================================================================

ALTER TABLE dispensaries DROP CONSTRAINT IF EXISTS chk_dispensaries_region;
ALTER TABLE dispensaries
  ADD CONSTRAINT chk_dispensaries_region
  CHECK (region IN (
    'southern-nv',
    'northern-nv',
    'michigan',
    'illinois',
    'arizona',
    'missouri',
    'new-jersey',
    'ohio',
    'colorado',
    'new-york',
    'massachusetts',
    'pennsylvania'
  ));

-- =====================================================================
-- 2. Add region to daily_metrics and re-key the unique index
-- =====================================================================

-- Add region column (defaults to 'all' for legacy rows)
ALTER TABLE daily_metrics
  ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT 'all';

-- Drop the old single-column unique index
DROP INDEX IF EXISTS idx_daily_metrics_date;

-- New unique index: one metrics row per region per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_metrics_date_region
    ON daily_metrics(run_date, region);

-- =====================================================================
-- 3. Rebuild top_100_curated without hardcoded region filter
-- =====================================================================
-- Removes the `d.region = 'southern-nv'` filter so deals from all
-- active states appear.  Diversity caps still enforce balance.

CREATE OR REPLACE VIEW top_100_curated AS
WITH ranked AS (
  SELECT
    p.*,
    d.name   AS dispensary_name,
    d.region AS dispensary_region,
    ROW_NUMBER() OVER (PARTITION BY p.category       ORDER BY p.deal_score DESC) AS cat_rank,
    ROW_NUMBER() OVER (PARTITION BY p.brand          ORDER BY p.deal_score DESC) AS brand_rank,
    ROW_NUMBER() OVER (PARTITION BY p.dispensary_id   ORDER BY p.deal_score DESC) AS disp_rank
  FROM products p
  JOIN dispensaries d ON d.id = p.dispensary_id
  WHERE p.is_active = TRUE
    AND p.deal_score > 0
)
SELECT *
FROM ranked
WHERE cat_rank   <= 30
  AND brand_rank <= 5
  AND disp_rank  <= 10
ORDER BY deal_score DESC
LIMIT 100;

COMMENT ON VIEW top_100_curated IS 'Daily top 100 curated deals across all regions with category/brand/dispensary diversity caps.';
