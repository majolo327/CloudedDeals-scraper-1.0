-- =========================================================================
-- 037_acquisition_tracking.sql — Campaign/QR acquisition source tracking
-- =========================================================================
-- Adds first-touch acquisition columns to user_sessions so we can segment
-- cohorts by acquisition channel (flyer QR, organic, referral, etc).
-- Safe to run multiple times: uses IF NOT EXISTS via DO blocks.
-- =========================================================================

-- Add acquisition columns to user_sessions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user_sessions'
          AND column_name = 'acquisition_source'
    ) THEN
        ALTER TABLE public.user_sessions
            ADD COLUMN acquisition_source TEXT,
            ADD COLUMN acquisition_medium TEXT,
            ADD COLUMN acquisition_campaign TEXT;
    END IF;
END $$;

-- Index for filtering sessions by acquisition source (campaign dashboards)
CREATE INDEX IF NOT EXISTS idx_user_sessions_acquisition
    ON public.user_sessions(acquisition_source)
    WHERE acquisition_source IS NOT NULL;

-- Composite index for cohort queries: first_seen + acquisition_source
CREATE INDEX IF NOT EXISTS idx_user_sessions_cohort
    ON public.user_sessions(first_seen, acquisition_source);

COMMENT ON COLUMN public.user_sessions.acquisition_source
    IS 'First-touch UTM source (e.g. flyer, twitter, google). Set once on first visit.';
COMMENT ON COLUMN public.user_sessions.acquisition_medium
    IS 'First-touch UTM medium (e.g. qr, social, organic).';
COMMENT ON COLUMN public.user_sessions.acquisition_campaign
    IS 'First-touch UTM campaign name (e.g. vegas-strip-feb26).';
