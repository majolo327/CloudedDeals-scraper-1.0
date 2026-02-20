-- =========================================================================
-- 036_enrichment_metrics.sql — Phase D' passive data enrichment tables
-- =========================================================================
--
-- Adds two capabilities without touching any consumer-facing tables:
--
-- 1. New columns on daily_metrics for brand detection rate and price cap
--    rejection tracking — tells us which states need brand DB expansion
--    and where NV-calibrated price caps are too tight.
--
-- 2. New enrichment_snapshots table for weekly price distributions and
--    cross-state brand pricing — builds foundation for state-aware scoring
--    and B2B brand insights.
--
-- Safe to run multiple times (idempotent).
-- =========================================================================

-- =====================================================================
-- 1. Add enrichment columns to daily_metrics
-- =====================================================================

ALTER TABLE daily_metrics
  ADD COLUMN IF NOT EXISTS brand_null_count INT DEFAULT 0;

ALTER TABLE daily_metrics
  ADD COLUMN IF NOT EXISTS brand_detection_rate NUMERIC(5,1) DEFAULT 0;

ALTER TABLE daily_metrics
  ADD COLUMN IF NOT EXISTS price_cap_reject_count INT DEFAULT 0;

ALTER TABLE daily_metrics
  ADD COLUMN IF NOT EXISTS price_cap_reject_rate NUMERIC(5,1) DEFAULT 0;

-- Top unmatched brand candidate names (JSON array of strings, max 20).
-- Stored as JSONB for flexible querying — e.g. find the most common
-- unmatched brand across all regions over the last 7 days.
ALTER TABLE daily_metrics
  ADD COLUMN IF NOT EXISTS top_unmatched_brands JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN daily_metrics.brand_null_count IS 'Number of scraped products where brand detection returned null';
COMMENT ON COLUMN daily_metrics.brand_detection_rate IS 'Percentage of products with detected brand (0-100)';
COMMENT ON COLUMN daily_metrics.price_cap_reject_count IS 'Products rejected specifically by category price caps (not discount/global filters)';
COMMENT ON COLUMN daily_metrics.price_cap_reject_rate IS 'Price cap rejects as percentage of total products (0-100)';
COMMENT ON COLUMN daily_metrics.top_unmatched_brands IS 'JSON array of top 20 most common unmatched brand candidate names';

-- =====================================================================
-- 2. Create enrichment_snapshots table
-- =====================================================================

CREATE TABLE IF NOT EXISTS enrichment_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    snapshot_type TEXT NOT NULL,  -- 'price_distribution' or 'brand_pricing'

    -- Grouping dimensions
    region TEXT NOT NULL,
    category TEXT NOT NULL,
    weight_tier TEXT NOT NULL,    -- e.g. '3.5g', '1g', '100mg'
    brand TEXT,                   -- NULL for price_distribution, set for brand_pricing

    -- Distribution stats
    sample_size INT NOT NULL DEFAULT 0,
    p25 NUMERIC(8,2),
    p50 NUMERIC(8,2),            -- median
    p75 NUMERIC(8,2),
    p_min NUMERIC(8,2),
    p_max NUMERIC(8,2),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One snapshot per (date, type, region, category, weight_tier, brand) — idempotent
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrichment_snapshots_pk
    ON enrichment_snapshots(
        snapshot_date, snapshot_type, region, category, weight_tier,
        COALESCE(brand, '__null__')
    );

-- Query patterns: "show me price distributions for michigan flower over time"
CREATE INDEX IF NOT EXISTS idx_enrichment_snapshots_lookup
    ON enrichment_snapshots(snapshot_type, region, category);

-- Query pattern: "show me STIIIZY pricing across all states"
CREATE INDEX IF NOT EXISTS idx_enrichment_snapshots_brand
    ON enrichment_snapshots(brand, snapshot_type)
    WHERE brand IS NOT NULL;

-- RLS: service role full access, authenticated read-only
ALTER TABLE enrichment_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'enrichment_snapshots' AND policyname = 'service_full_enrichment'
    ) THEN
        CREATE POLICY "service_full_enrichment" ON enrichment_snapshots
            FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'enrichment_snapshots' AND policyname = 'authenticated_read_enrichment'
    ) THEN
        CREATE POLICY "authenticated_read_enrichment" ON enrichment_snapshots
            FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

COMMENT ON TABLE enrichment_snapshots IS 'Weekly price distribution and cross-state brand pricing snapshots for ML/B2B data enrichment (Phase D'').';

-- =====================================================================
-- 3. Expand product_subtype CHECK constraint
-- =====================================================================
-- Original (migration 030): infused_preroll, preroll_pack, disposable, cartridge, pod
-- New: adds concentrate subtypes + edible subtypes for Phase D' enrichment.

ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_subtype;
ALTER TABLE products
  ADD CONSTRAINT chk_products_subtype
  CHECK (product_subtype IS NULL OR product_subtype IN (
    -- Preroll subtypes
    'infused_preroll', 'preroll_pack',
    -- Vape subtypes
    'disposable', 'cartridge', 'pod',
    -- Concentrate subtypes (Phase D')
    'live_resin', 'cured_resin', 'budder', 'badder', 'shatter',
    'diamonds', 'sauce', 'rosin', 'hash_rosin', 'live_rosin',
    'crumble', 'wax', 'sugar', 'rso', 'fsho',
    -- Edible subtypes (Phase D')
    'gummy', 'chocolate', 'beverage', 'tincture',
    'capsule', 'lozenge', 'baked_good', 'chew'
  ));
