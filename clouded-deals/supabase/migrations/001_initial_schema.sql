-- =========================================================================
-- 001_initial_schema.sql — CloudedDeals initial database schema
-- =========================================================================
--
-- Tables:  dispensaries, products, deals, scrape_runs
-- Indexes: covering the hot query paths
-- RLS:     enabled on all tables with public (anon) read access
-- =========================================================================

-- Enable pgcrypto for gen_random_uuid() if not already present.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =========================================================================
-- 1. dispensaries
-- =========================================================================

CREATE TABLE dispensaries (
    id         TEXT        PRIMARY KEY,               -- slug, e.g. "td-gibson"
    name       TEXT        NOT NULL,
    url        TEXT        NOT NULL,
    platform   TEXT        NOT NULL,                   -- dutchie | curaleaf | jane
    address    TEXT,
    city       TEXT        DEFAULT 'Las Vegas',
    state      TEXT        DEFAULT 'NV',
    is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
    config     JSONB       DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  dispensaries          IS 'Dispensary locations and their scraper configuration.';
COMMENT ON COLUMN dispensaries.id       IS 'URL-safe slug used as the primary key (matches config/dispensaries.py).';
COMMENT ON COLUMN dispensaries.platform IS 'Scraper platform: dutchie, curaleaf, or jane.';
COMMENT ON COLUMN dispensaries.config   IS 'Per-site overrides merged on top of PLATFORM_DEFAULTS.';


-- =========================================================================
-- 2. products
-- =========================================================================

CREATE TABLE products (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    dispensary_id    TEXT        NOT NULL REFERENCES dispensaries(id) ON DELETE CASCADE,
    name             TEXT        NOT NULL,
    brand            TEXT,
    category         TEXT,                              -- flower | preroll | vape | edible | concentrate
    original_price   NUMERIC(10,2),
    sale_price       NUMERIC(10,2),
    discount_percent NUMERIC(5,1),
    weight_value     NUMERIC(10,2),
    weight_unit      TEXT,                              -- g | mg | oz
    thc_percent      NUMERIC(5,2),
    cbd_percent      NUMERIC(5,2),
    raw_text         TEXT,
    scraped_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- De-duplicate within a single day per dispensary.  Same product at
    -- the same sale price on the same date is the same row.
     CONSTRAINT uq_product_per_day UNIQUE (
        dispensary_id,
        name,
        sale_price,
        scraped_at
    )
);

COMMENT ON TABLE  products                   IS 'Individual products/specials scraped from dispensary menus.';
COMMENT ON COLUMN products.category          IS 'Detected category: flower, preroll, vape, edible, concentrate.';
COMMENT ON COLUMN products.raw_text          IS 'Original unprocessed text block from the page element.';
COMMENT ON COLUMN products.discount_percent  IS 'Calculated: (1 - sale_price/original_price) * 100.';


-- =========================================================================
-- 3. deals
-- =========================================================================

CREATE TABLE deals (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    dispensary_id   TEXT        NOT NULL REFERENCES dispensaries(id) ON DELETE CASCADE,
    deal_score      NUMERIC(5,1) NOT NULL DEFAULT 0,
    is_posted       BOOLEAN     NOT NULL DEFAULT FALSE,
    posted_at       TIMESTAMPTZ,
    tweet_id        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  deals            IS 'Qualified deals that passed the scoring threshold.';
COMMENT ON COLUMN deals.deal_score IS 'Composite score 0–100 from deal_detector.score_deal().';
COMMENT ON COLUMN deals.is_posted  IS 'Whether this deal has been published (e.g. tweeted).';
COMMENT ON COLUMN deals.tweet_id   IS 'External post identifier (Twitter/X status ID, etc.).';


-- =========================================================================
-- 4. scrape_runs
-- =========================================================================

CREATE TABLE scrape_runs (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at     TIMESTAMPTZ,
    status           TEXT        NOT NULL DEFAULT 'running',  -- running | completed | failed
    total_products   INTEGER     DEFAULT 0,
    qualifying_deals INTEGER     DEFAULT 0,
    sites_scraped    JSONB       DEFAULT '[]'::JSONB,
    sites_failed     JSONB       DEFAULT '[]'::JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  scrape_runs              IS 'Audit log for each scraper execution.';
COMMENT ON COLUMN scrape_runs.status       IS 'Run status: running, completed, or failed.';
COMMENT ON COLUMN scrape_runs.sites_scraped IS 'Array of dispensary slugs that succeeded.';
COMMENT ON COLUMN scrape_runs.sites_failed  IS 'Array of {slug, error} objects for failures.';


-- =========================================================================
-- 5. Indexes
-- =========================================================================

-- Products: look up by dispensary, by date, by category, by brand.
CREATE INDEX idx_products_dispensary    ON products (dispensary_id);
CREATE INDEX idx_products_scraped_at    ON products (scraped_at DESC);
CREATE INDEX idx_products_category      ON products (category)          WHERE category IS NOT NULL;
CREATE INDEX idx_products_brand         ON products (brand)             WHERE brand    IS NOT NULL;
CREATE INDEX idx_products_discount      ON products (discount_percent DESC NULLS LAST);

-- Deals: unposted deals (the posting queue), score ranking, by dispensary.
CREATE INDEX idx_deals_unposted         ON deals (deal_score DESC)      WHERE is_posted = FALSE;
CREATE INDEX idx_deals_dispensary       ON deals (dispensary_id);
CREATE INDEX idx_deals_product          ON deals (product_id);
CREATE INDEX idx_deals_score            ON deals (deal_score DESC);

-- Scrape runs: latest runs.
CREATE INDEX idx_scrape_runs_started    ON scrape_runs (started_at DESC);
CREATE INDEX idx_scrape_runs_status     ON scrape_runs (status);

-- Dispensaries: active sites by platform.
CREATE INDEX idx_dispensaries_platform  ON dispensaries (platform)      WHERE is_active = TRUE;


-- =========================================================================
-- 6. Row-Level Security — public read access
-- =========================================================================

ALTER TABLE dispensaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE products     ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_runs  ENABLE ROW LEVEL SECURITY;

-- Anon / authenticated users can SELECT all rows.
CREATE POLICY "Public read access on dispensaries"
    ON dispensaries FOR SELECT
    USING (TRUE);

CREATE POLICY "Public read access on products"
    ON products FOR SELECT
    USING (TRUE);

CREATE POLICY "Public read access on deals"
    ON deals FOR SELECT
    USING (TRUE);

CREATE POLICY "Public read access on scrape_runs"
    ON scrape_runs FOR SELECT
    USING (TRUE);


-- =========================================================================
-- 7. updated_at trigger (dispensaries)
-- =========================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dispensaries_updated_at
    BEFORE UPDATE ON dispensaries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
