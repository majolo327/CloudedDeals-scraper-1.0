-- =========================================================================
-- 024_daily_metrics.sql — Track scraper output quality over time
-- =========================================================================
--
-- Stores one row per successful scrape run with aggregate metrics.
-- Used by the DailyMetricsCollector (runs post-scrape) and the
-- /api/health endpoint for pipeline-quality monitoring.
--
-- Safe to run multiple times: uses IF NOT EXISTS.
-- =========================================================================

CREATE TABLE IF NOT EXISTS daily_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_date DATE NOT NULL DEFAULT CURRENT_DATE,
    scrape_run_id UUID,

    -- Volume
    total_products INT NOT NULL DEFAULT 0,
    qualifying_deals INT NOT NULL DEFAULT 0,

    -- Category breakdown (deals that made it into the top-200)
    flower_count INT NOT NULL DEFAULT 0,
    vape_count INT NOT NULL DEFAULT 0,
    edible_count INT NOT NULL DEFAULT 0,
    concentrate_count INT NOT NULL DEFAULT 0,
    preroll_count INT NOT NULL DEFAULT 0,

    -- Diversity
    unique_brands INT NOT NULL DEFAULT 0,
    unique_dispensaries INT NOT NULL DEFAULT 0,

    -- Score distribution
    avg_deal_score NUMERIC(5,2) DEFAULT 0,
    median_deal_score INT DEFAULT 0,
    min_deal_score INT DEFAULT 0,
    max_deal_score INT DEFAULT 0,

    -- Badge counts
    steal_count INT NOT NULL DEFAULT 0,
    fire_count INT NOT NULL DEFAULT 0,
    solid_count INT NOT NULL DEFAULT 0,

    -- Scrape health
    sites_scraped INT NOT NULL DEFAULT 0,
    sites_failed INT NOT NULL DEFAULT 0,
    runtime_seconds INT DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One metrics row per day (idempotent re-runs overwrite)
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_metrics_date
    ON daily_metrics(run_date);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_created
    ON daily_metrics(created_at);

-- RLS: service role can read/write, authenticated can read (for admin dashboard)
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'daily_metrics' AND policyname = 'service_full_daily_metrics'
    ) THEN
        CREATE POLICY "service_full_daily_metrics" ON daily_metrics
            FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'daily_metrics' AND policyname = 'authenticated_read_daily_metrics'
    ) THEN
        CREATE POLICY "authenticated_read_daily_metrics" ON daily_metrics
            FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

COMMENT ON TABLE daily_metrics IS 'One row per scrape run — tracks pipeline output quality over time.';
