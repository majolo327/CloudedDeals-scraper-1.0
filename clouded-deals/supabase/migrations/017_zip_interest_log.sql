-- Zip code interest log for tracking out-of-area demand
-- Used by RegionOverlay to capture market intelligence

CREATE TABLE IF NOT EXISTS zip_interest_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  zip_code    text NOT NULL,
  state_code  text NOT NULL,
  cannabis_status text NOT NULL,       -- 'recreational', 'medical_only', 'no_legal'
  email       text,                     -- optional, only if user opts in
  user_agent  text,
  referrer    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for querying demand by state
CREATE INDEX IF NOT EXISTS idx_zip_interest_state ON zip_interest_log (state_code);

-- Index for querying by zip
CREATE INDEX IF NOT EXISTS idx_zip_interest_zip ON zip_interest_log (zip_code);

-- RLS: allow anonymous inserts, restrict reads to service role
ALTER TABLE zip_interest_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous inserts" ON zip_interest_log
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role reads only" ON zip_interest_log
  FOR SELECT
  USING (auth.role() = 'service_role');
