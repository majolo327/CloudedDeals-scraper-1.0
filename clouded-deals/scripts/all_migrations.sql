-- ===========================================================================
-- CloudedDeals — All Migrations (Idempotent)
-- ===========================================================================
-- Copy-paste this entire file into the Supabase SQL Editor and click "Run".
-- It's safe to run multiple times — all statements use IF NOT EXISTS.
-- ===========================================================================


-- ===========================================================================
-- 001: Core Schema (dispensaries, products, deals, scrape_runs)
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS dispensaries (
    id         TEXT        PRIMARY KEY,
    name       TEXT        NOT NULL,
    url        TEXT        NOT NULL,
    platform   TEXT        NOT NULL,
    address    TEXT,
    city       TEXT        DEFAULT 'Las Vegas',
    state      TEXT        DEFAULT 'NV',
    is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
    config     JSONB       DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    dispensary_id    TEXT        NOT NULL REFERENCES dispensaries(id) ON DELETE CASCADE,
    name             TEXT        NOT NULL,
    brand            TEXT,
    category         TEXT,
    original_price   NUMERIC(10,2),
    sale_price       NUMERIC(10,2),
    discount_percent NUMERIC(5,1),
    weight_value     NUMERIC(10,2),
    weight_unit      TEXT,
    thc_percent      NUMERIC(5,2),
    cbd_percent      NUMERIC(5,2),
    raw_text         TEXT,
    scraped_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deals (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    dispensary_id   TEXT        NOT NULL REFERENCES dispensaries(id) ON DELETE CASCADE,
    deal_score      NUMERIC(5,1) NOT NULL DEFAULT 0,
    is_posted       BOOLEAN     NOT NULL DEFAULT FALSE,
    posted_at       TIMESTAMPTZ,
    tweet_id        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scrape_runs (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at     TIMESTAMPTZ,
    status           TEXT        NOT NULL DEFAULT 'running',
    total_products   INTEGER     DEFAULT 0,
    qualifying_deals INTEGER     DEFAULT 0,
    sites_scraped    JSONB       DEFAULT '[]'::JSONB,
    sites_failed     JSONB       DEFAULT '[]'::JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes (idempotent via IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_products_dispensary    ON products (dispensary_id);
CREATE INDEX IF NOT EXISTS idx_products_scraped_at    ON products (scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_category      ON products (category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_brand         ON products (brand) WHERE brand IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_discount      ON products (discount_percent DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_deals_unposted         ON deals (deal_score DESC) WHERE is_posted = FALSE;
CREATE INDEX IF NOT EXISTS idx_deals_dispensary       ON deals (dispensary_id);
CREATE INDEX IF NOT EXISTS idx_deals_product          ON deals (product_id);
CREATE INDEX IF NOT EXISTS idx_deals_score            ON deals (deal_score DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_runs_started    ON scrape_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_runs_status     ON scrape_runs (status);
CREATE INDEX IF NOT EXISTS idx_dispensaries_platform  ON dispensaries (platform) WHERE is_active = TRUE;

-- RLS
ALTER TABLE dispensaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE products     ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_runs  ENABLE ROW LEVEL SECURITY;

-- Drop-and-recreate policies (idempotent)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read access on dispensaries" ON dispensaries;
  DROP POLICY IF EXISTS "Public read access on products" ON products;
  DROP POLICY IF EXISTS "Public read access on deals" ON deals;
  DROP POLICY IF EXISTS "Public read access on scrape_runs" ON scrape_runs;
END $$;

CREATE POLICY "Public read access on dispensaries" ON dispensaries FOR SELECT USING (TRUE);
CREATE POLICY "Public read access on products"     ON products FOR SELECT USING (TRUE);
CREATE POLICY "Public read access on deals"        ON deals FOR SELECT USING (TRUE);
CREATE POLICY "Public read access on scrape_runs"  ON scrape_runs FOR SELECT USING (TRUE);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dispensaries_updated_at ON dispensaries;
CREATE TRIGGER trg_dispensaries_updated_at BEFORE UPDATE ON dispensaries
FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ===========================================================================
-- 002: Waitlist
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  zip_code   text not null,
  created_at timestamptz not null default now(),
  constraint waitlist_email_zip_unique unique (email, zip_code)
);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Anyone can sign up for the waitlist" ON public.waitlist;
  DROP POLICY IF EXISTS "Service role can read waitlist" ON public.waitlist;
END $$;

CREATE POLICY "Anyone can sign up for the waitlist" ON public.waitlist FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Service role can read waitlist" ON public.waitlist FOR SELECT TO service_role USING (true);


-- ===========================================================================
-- 003/004: User Tracking (sessions, events, saved, dismissed)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null unique,
  zip_code   text,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.user_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  event_type text not null,
  deal_id    uuid,
  metadata   jsonb,
  created_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_user_events_user ON public.user_events (user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_type ON public.user_events (event_type);

CREATE TABLE IF NOT EXISTS public.user_saved_deals (
  id       uuid primary key default gen_random_uuid(),
  user_id  text not null,
  deal_id  uuid not null,
  saved_at timestamptz not null default now(),
  constraint user_saved_deals_unique unique (user_id, deal_id)
);

CREATE TABLE IF NOT EXISTS public.user_dismissed_deals (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  deal_id      uuid not null,
  dismissed_at timestamptz not null default now(),
  constraint user_dismissed_deals_unique unique (user_id, deal_id)
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_saved_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_dismissed_deals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Anon insert sessions" ON public.user_sessions;
  DROP POLICY IF EXISTS "Anon update sessions" ON public.user_sessions;
  DROP POLICY IF EXISTS "Anon insert events" ON public.user_events;
  DROP POLICY IF EXISTS "Anon insert saved" ON public.user_saved_deals;
  DROP POLICY IF EXISTS "Anon delete saved" ON public.user_saved_deals;
  DROP POLICY IF EXISTS "Anon insert dismissed" ON public.user_dismissed_deals;
  DROP POLICY IF EXISTS "Anon read saved" ON public.user_saved_deals;
  DROP POLICY IF EXISTS "Anon read dismissed" ON public.user_dismissed_deals;
  DROP POLICY IF EXISTS "Service read sessions" ON public.user_sessions;
  DROP POLICY IF EXISTS "Service read events" ON public.user_events;
  DROP POLICY IF EXISTS "Service read saved" ON public.user_saved_deals;
  DROP POLICY IF EXISTS "Service read dismissed" ON public.user_dismissed_deals;
END $$;

CREATE POLICY "Anon insert sessions" ON public.user_sessions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon update sessions" ON public.user_sessions FOR UPDATE TO anon USING (true);
CREATE POLICY "Anon insert events" ON public.user_events FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon insert saved" ON public.user_saved_deals FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon delete saved" ON public.user_saved_deals FOR DELETE TO anon USING (true);
CREATE POLICY "Anon insert dismissed" ON public.user_dismissed_deals FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon read saved" ON public.user_saved_deals FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read dismissed" ON public.user_dismissed_deals FOR SELECT TO anon USING (true);
CREATE POLICY "Service read sessions" ON public.user_sessions FOR SELECT TO service_role USING (true);
CREATE POLICY "Service read events" ON public.user_events FOR SELECT TO service_role USING (true);
CREATE POLICY "Service read saved" ON public.user_saved_deals FOR SELECT TO service_role USING (true);
CREATE POLICY "Service read dismissed" ON public.user_dismissed_deals FOR SELECT TO service_role USING (true);


-- ===========================================================================
-- 005: Migration Log
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.migration_log (
  id            serial primary key,
  migration_id  text not null unique,
  applied_at    timestamptz not null default now(),
  checksum      text
);


-- ===========================================================================
-- 006: Analytics Events
-- ===========================================================================

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  anon_id TEXT,
  event_name TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_anon ON analytics_events(anon_id);
CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_insert_analytics" ON analytics_events;
  DROP POLICY IF EXISTS "service_read_analytics" ON analytics_events;
  DROP POLICY IF EXISTS "anon_read_analytics" ON analytics_events;
END $$;

CREATE POLICY "anon_insert_analytics" ON analytics_events FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_read_analytics" ON analytics_events FOR SELECT TO anon USING (true);
CREATE POLICY "service_read_analytics" ON analytics_events FOR SELECT TO service_role USING (true);


-- ===========================================================================
-- 007: Deal Save Counts View
-- ===========================================================================

CREATE OR REPLACE VIEW public.deal_save_counts AS
SELECT
  deal_id,
  COUNT(DISTINCT user_id) AS save_count
FROM public.user_saved_deals
GROUP BY deal_id;

GRANT SELECT ON public.deal_save_counts TO anon;
GRANT SELECT ON public.deal_save_counts TO authenticated;
GRANT SELECT ON public.deal_save_counts TO service_role;


-- ===========================================================================
-- Done! All tables, indexes, RLS policies, and views are set up.
-- ===========================================================================
