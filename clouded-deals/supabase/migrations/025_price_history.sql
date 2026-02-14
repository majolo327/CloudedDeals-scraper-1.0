-- =========================================================================
-- 025_price_history.sql — Append-only price observation log
-- =========================================================================
--
-- Records every price observation for every product on every scrape run.
-- This preserves the full time-series data that the upsert pipeline
-- currently overwrites.  Enables:
--
--   - Price trend analysis (price drops, inflation, seasonal patterns)
--   - Historical deal validation (was this product really $X last week?)
--   - ML training data for price prediction and deal scoring
--   - Competitive intelligence across dispensaries over time
--
-- The table is append-only: rows are never updated or deleted.
-- One row per product per scrape run.  Deduplication is handled by the
-- unique index on (product_id, observed_date) — if the same product is
-- scraped twice on the same day, the second observation updates in place.
--
-- Safe to run multiple times: uses IF NOT EXISTS.
-- =========================================================================

CREATE TABLE IF NOT EXISTS price_history (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    dispensary_id   TEXT        NOT NULL REFERENCES dispensaries(id) ON DELETE CASCADE,

    -- Price snapshot
    sale_price       NUMERIC(10,2),
    original_price   NUMERIC(10,2),
    discount_percent NUMERIC(5,1),

    -- Product context (denormalized for fast queries without joins)
    name             TEXT,
    brand            TEXT,
    category         TEXT,
    weight_value     NUMERIC(10,2),
    weight_unit      TEXT,

    -- Observation metadata
    deal_score       INTEGER     DEFAULT 0,
    scrape_run_id    UUID,
    observed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    observed_date    DATE        NOT NULL DEFAULT CURRENT_DATE,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One observation per product per day (idempotent re-runs update in place)
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_history_product_date
    ON price_history(product_id, observed_date);

-- Time-series queries: "show me all prices for product X over time"
CREATE INDEX IF NOT EXISTS idx_price_history_product
    ON price_history(product_id, observed_at DESC);

-- Dispensary-level price trends
CREATE INDEX IF NOT EXISTS idx_price_history_dispensary_date
    ON price_history(dispensary_id, observed_date DESC);

-- Category/brand analysis across time
CREATE INDEX IF NOT EXISTS idx_price_history_category_date
    ON price_history(category, observed_date DESC)
    WHERE category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_price_history_brand_date
    ON price_history(brand, observed_date DESC)
    WHERE brand IS NOT NULL;

-- Find price drops: products where today's price < yesterday's
CREATE INDEX IF NOT EXISTS idx_price_history_sale_price
    ON price_history(dispensary_id, name, sale_price, observed_date DESC);

-- Scrape run linkage
CREATE INDEX IF NOT EXISTS idx_price_history_run
    ON price_history(scrape_run_id)
    WHERE scrape_run_id IS NOT NULL;

-- RLS
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'price_history' AND policyname = 'service_full_price_history'
    ) THEN
        CREATE POLICY "service_full_price_history" ON price_history
            FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'price_history' AND policyname = 'authenticated_read_price_history'
    ) THEN
        CREATE POLICY "authenticated_read_price_history" ON price_history
            FOR SELECT TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'price_history' AND policyname = 'anon_read_price_history'
    ) THEN
        CREATE POLICY "anon_read_price_history" ON price_history
            FOR SELECT TO anon USING (true);
    END IF;
END $$;

COMMENT ON TABLE  price_history              IS 'Append-only log of every price observation per product per day.';
COMMENT ON COLUMN price_history.product_id   IS 'FK to products — links back to the canonical product row.';
COMMENT ON COLUMN price_history.observed_date IS 'Date of observation (for dedup and time-series partitioning).';
COMMENT ON COLUMN price_history.deal_score   IS 'Deal score at time of observation (may change across runs).';
