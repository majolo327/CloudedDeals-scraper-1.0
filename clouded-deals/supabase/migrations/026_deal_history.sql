-- =========================================================================
-- 026_deal_history.sql — Deal lifecycle tracking
-- =========================================================================
--
-- Records every deal observation with its score, enabling:
--
--   - Deal lifecycle tracking (first seen, last seen, duration)
--   - Score evolution over time (same deal scoring differently)
--   - Deal frequency analysis (how often does dispensary X run deals?)
--   - Expired deal detection (deal was active yesterday, gone today)
--   - ML training data for deal prediction ("which deals come back?")
--
-- Unlike the `deals` table (which is a current-run insert log), this
-- table preserves EVERY observation and tracks state transitions.
--
-- Safe to run multiple times: uses IF NOT EXISTS.
-- =========================================================================

CREATE TABLE IF NOT EXISTS deal_history (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    dispensary_id   TEXT        NOT NULL REFERENCES dispensaries(id) ON DELETE CASCADE,

    -- Deal snapshot
    deal_score      INTEGER     NOT NULL DEFAULT 0,
    sale_price      NUMERIC(10,2),
    original_price  NUMERIC(10,2),
    discount_percent NUMERIC(5,1),

    -- Product context (denormalized)
    name            TEXT,
    brand           TEXT,
    category        TEXT,

    -- Lifecycle
    first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    first_seen_date DATE        NOT NULL DEFAULT CURRENT_DATE,
    last_seen_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
    times_seen      INTEGER     NOT NULL DEFAULT 1,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,

    -- Metadata
    scrape_run_id   UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One deal history row per product per dispensary — updates on re-observation
CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_history_product_dispensary
    ON deal_history(product_id, dispensary_id);

-- Active deals query (the "what's live right now" view)
CREATE INDEX IF NOT EXISTS idx_deal_history_active
    ON deal_history(dispensary_id, deal_score DESC)
    WHERE is_active = TRUE;

-- Lifecycle queries: "deals that expired today"
CREATE INDEX IF NOT EXISTS idx_deal_history_last_seen
    ON deal_history(last_seen_date DESC);

-- Deal frequency: "how many times has this deal appeared?"
CREATE INDEX IF NOT EXISTS idx_deal_history_times_seen
    ON deal_history(times_seen DESC);

-- Score evolution
CREATE INDEX IF NOT EXISTS idx_deal_history_score
    ON deal_history(deal_score DESC);

-- Category analysis
CREATE INDEX IF NOT EXISTS idx_deal_history_category
    ON deal_history(category, last_seen_date DESC)
    WHERE category IS NOT NULL;

-- Brand tracking
CREATE INDEX IF NOT EXISTS idx_deal_history_brand
    ON deal_history(brand, last_seen_date DESC)
    WHERE brand IS NOT NULL;

-- Scrape run linkage
CREATE INDEX IF NOT EXISTS idx_deal_history_run
    ON deal_history(scrape_run_id)
    WHERE scrape_run_id IS NOT NULL;

-- RLS
ALTER TABLE deal_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'deal_history' AND policyname = 'service_full_deal_history'
    ) THEN
        CREATE POLICY "service_full_deal_history" ON deal_history
            FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'deal_history' AND policyname = 'authenticated_read_deal_history'
    ) THEN
        CREATE POLICY "authenticated_read_deal_history" ON deal_history
            FOR SELECT TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'deal_history' AND policyname = 'anon_read_deal_history'
    ) THEN
        CREATE POLICY "anon_read_deal_history" ON deal_history
            FOR SELECT TO anon USING (true);
    END IF;
END $$;

COMMENT ON TABLE  deal_history                IS 'Deal lifecycle log — one row per product+dispensary, updated on each observation.';
COMMENT ON COLUMN deal_history.first_seen_at  IS 'When this deal was first detected.';
COMMENT ON COLUMN deal_history.last_seen_at   IS 'When this deal was last observed (updated each run).';
COMMENT ON COLUMN deal_history.times_seen     IS 'Number of scrape runs where this deal was observed.';
COMMENT ON COLUMN deal_history.is_active      IS 'FALSE when deal was not seen in the latest run (expired).';
