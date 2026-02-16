-- ============================================================================
-- ANONYMOUS INSERT RATE LIMITS
-- ============================================================================
-- Prevents abuse of anonymous write endpoints by capping inserts per anon_id
-- per day. Without this, a bot could flood analytics_events, user_saved_deals,
-- user_dismissed_deals, user_events, and deal_reports with junk data.
--
-- Strategy: Replace permissive "WITH CHECK (true)" policies with policies
-- that count today's rows per anon_id/user_id and reject above threshold.
--
-- Thresholds (generous for real users, blocking for bots):
--   analytics_events:      500/day per anon_id (power user ~50-100 events/session)
--   user_events:           500/day per user_id
--   user_saved_deals:      100/day per user_id (200 deals max, can't save more)
--   user_dismissed_deals:  500/day per user_id (could dismiss entire deck)
--   deal_reports:          20/day per anon_id  (already has unique constraint)
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. analytics_events — cap at 500 inserts/day per anon_id
-- ---------------------------------------------------------------------------

-- Drop the old permissive policy
DROP POLICY IF EXISTS "anon_insert_analytics" ON analytics_events;

-- New policy: allow insert only if under daily cap
CREATE POLICY "anon_insert_analytics_capped" ON analytics_events
  FOR INSERT TO anon
  WITH CHECK (
    anon_id IS NOT NULL
    AND (
      SELECT count(*)
      FROM analytics_events ae
      WHERE ae.anon_id = analytics_events.anon_id
        AND ae.created_at >= CURRENT_DATE
    ) < 500
  );


-- ---------------------------------------------------------------------------
-- 2. user_events — cap at 500 inserts/day per user_id
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anon insert events" ON user_events;

CREATE POLICY "anon_insert_events_capped" ON user_events
  FOR INSERT TO anon
  WITH CHECK (
    user_id IS NOT NULL
    AND length(user_id) > 0
    AND (
      SELECT count(*)
      FROM user_events ue
      WHERE ue.user_id = user_events.user_id
        AND ue.created_at >= CURRENT_DATE
    ) < 500
  );


-- ---------------------------------------------------------------------------
-- 3. user_saved_deals — cap at 100 inserts/day per user_id
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anon insert saved" ON user_saved_deals;

CREATE POLICY "anon_insert_saved_capped" ON user_saved_deals
  FOR INSERT TO anon
  WITH CHECK (
    user_id IS NOT NULL
    AND length(user_id) > 0
    AND (
      SELECT count(*)
      FROM user_saved_deals usd
      WHERE usd.user_id = user_saved_deals.user_id
        AND usd.saved_at >= CURRENT_DATE
    ) < 100
  );


-- ---------------------------------------------------------------------------
-- 4. user_dismissed_deals — cap at 500 inserts/day per user_id
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anon insert dismissed" ON user_dismissed_deals;

CREATE POLICY "anon_insert_dismissed_capped" ON user_dismissed_deals
  FOR INSERT TO anon
  WITH CHECK (
    user_id IS NOT NULL
    AND length(user_id) > 0
    AND (
      SELECT count(*)
      FROM user_dismissed_deals udd
      WHERE udd.user_id = user_dismissed_deals.user_id
        AND udd.dismissed_at >= CURRENT_DATE
    ) < 500
  );


-- ---------------------------------------------------------------------------
-- 5. deal_reports — cap at 20 inserts/day per anon_id
--    (already has unique constraint per user/deal/type/day, this adds a
--     hard ceiling to prevent a bot from creating 1000 different reports)
-- ---------------------------------------------------------------------------

-- Only apply if deal_reports table exists (migration 029 may not have run)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deal_reports') THEN
    -- Drop old permissive policy if it exists
    DROP POLICY IF EXISTS "anon_insert_reports" ON deal_reports;
    DROP POLICY IF EXISTS "Anyone can report a deal" ON deal_reports;

    EXECUTE '
      CREATE POLICY "anon_insert_reports_capped" ON deal_reports
        FOR INSERT TO anon
        WITH CHECK (
          anon_id IS NOT NULL
          AND (
            SELECT count(*)
            FROM deal_reports dr
            WHERE dr.anon_id = deal_reports.anon_id
              AND dr.created_at >= CURRENT_DATE
          ) < 20
        )
    ';
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 6. Indexes to make the daily count queries fast
--    (partial index on created_at >= today would be ideal but Postgres
--     doesn't support that in a useful way for rolling dates. These
--     composite indexes are the next best thing.)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_analytics_anon_daily
  ON analytics_events (anon_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_events_user_daily
  ON user_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_saved_user_daily
  ON user_saved_deals (user_id, saved_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_dismissed_user_daily
  ON user_dismissed_deals (user_id, dismissed_at DESC);


-- ============================================================================
-- DONE
-- ============================================================================
-- Run this migration in the Supabase SQL Editor.
--
-- To verify: try inserting >500 analytics events with the same anon_id
-- using the anon key — the 501st should be rejected with an RLS error.
-- ============================================================================
