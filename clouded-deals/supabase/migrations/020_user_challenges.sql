-- ============================================================================
-- USER CHALLENGES — Gamification Progress Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_challenges (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  anonymous_id  TEXT NOT NULL,
  challenge_id  TEXT NOT NULL,
  progress      INTEGER DEFAULT 0,
  is_completed  BOOLEAN DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(anonymous_id, challenge_id)
);

CREATE INDEX IF NOT EXISTS idx_challenges_user ON public.user_challenges (anonymous_id);

-- RLS
ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon insert challenges" ON public.user_challenges FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon update challenges" ON public.user_challenges FOR UPDATE TO anon USING (true);
CREATE POLICY "Anon read own challenges" ON public.user_challenges FOR SELECT TO anon USING (true);
CREATE POLICY "Service read challenges" ON public.user_challenges FOR SELECT TO service_role USING (true);
CREATE POLICY "Authenticated read challenges" ON public.user_challenges FOR SELECT TO authenticated USING (true);
