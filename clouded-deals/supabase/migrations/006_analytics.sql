-- Analytics events table for anonymous user tracking.
-- anon_id links to the client-generated UUID stored in localStorage.
-- user_id is populated after account creation to merge anonymous history.

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  anon_id TEXT,
  event_name TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_anon ON analytics_events(anon_id);
CREATE INDEX idx_analytics_user ON analytics_events(user_id);
CREATE INDEX idx_analytics_event ON analytics_events(event_name);
CREATE INDEX idx_analytics_created ON analytics_events(created_at);

-- Allow anonymous inserts from the frontend
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_analytics" ON analytics_events
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "service_read_analytics" ON analytics_events
  FOR SELECT TO service_role USING (true);
