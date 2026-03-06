-- Migration 045: ML Price Cap Cache
--
-- Stores data-driven price cap recommendations computed from enrichment_snapshots.
-- Caps are set at ~p30 (30th percentile) * 1.1 buffer — meaning a "deal" should
-- be cheaper than ~70% of products in that market.
--
-- Refreshed weekly by enrichment_snapshots.py. The deal_detector reads from this
-- table first, falling back to hardcoded STATE_PRICE_CAP_OVERRIDES if no data.
--
-- This replaces hand-tuned guesses with market-calibrated caps that auto-adjust
-- as markets evolve (MI prices dropping, NJ prices rising, new states added).

CREATE TABLE IF NOT EXISTS ml_price_caps (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    region          TEXT NOT NULL,           -- e.g. 'michigan', 'southern-nv'
    category        TEXT NOT NULL,           -- flower, vape, edible, concentrate, preroll
    weight_tier     TEXT,                    -- e.g. '3.5g', '1g', '100mg' (NULL = category-level cap)
    recommended_cap NUMERIC(8,2) NOT NULL,  -- data-driven price cap
    p25             NUMERIC(8,2),           -- 25th percentile of sale prices
    p30             NUMERIC(8,2),           -- 30th percentile (primary input for cap)
    p50             NUMERIC(8,2),           -- median — for reference
    p75             NUMERIC(8,2),           -- 75th percentile — for reference
    sample_size     INTEGER NOT NULL DEFAULT 0,  -- how many products in this bucket
    hardcoded_cap   NUMERIC(8,2),           -- the old hardcoded cap for comparison
    cap_delta_pct   NUMERIC(5,1),           -- % difference: (recommended - hardcoded) / hardcoded * 100
    computed_at     TIMESTAMPTZ DEFAULT NOW(),
    is_active       BOOLEAN DEFAULT TRUE,   -- FALSE = not enough data, use hardcoded fallback

    CONSTRAINT ml_price_caps_unique UNIQUE (region, category, weight_tier)
);

-- Index for the hot query path: deal_detector looks up caps by region+category
CREATE INDEX IF NOT EXISTS idx_ml_price_caps_lookup
    ON ml_price_caps (region, category, is_active)
    WHERE is_active = TRUE;

-- RLS: public read (frontend dashboard can display), service-role write
ALTER TABLE ml_price_caps ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "ml_price_caps_public_read"
    ON ml_price_caps FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY IF NOT EXISTS "ml_price_caps_service_write"
    ON ml_price_caps FOR ALL TO service_role
    USING (true) WITH CHECK (true);

COMMENT ON TABLE ml_price_caps IS
    'Data-driven price caps computed from enrichment_snapshots. '
    'Refreshed weekly. Falls back to hardcoded caps when sample_size < 20.';
