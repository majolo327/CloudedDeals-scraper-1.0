-- Deal reports: users flag wrong prices, expired deals, incorrect info
-- Supports anonymous reporting (no auth required, uses anon_id from client)

CREATE TABLE IF NOT EXISTS deal_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL,
  anon_id TEXT,
  report_type VARCHAR(50) NOT NULL,  -- 'wrong_price', 'deal_gone', 'wrong_product', 'other'
  report_message TEXT,
  deal_price NUMERIC(10,2),          -- snapshot of price at time of report
  dispensary_name TEXT,
  brand_name TEXT,
  product_name TEXT,
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent spam: one report per user per deal per type per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_reports_unique_daily
  ON deal_reports (deal_id, anon_id, report_type, (created_at::DATE));

-- Fast lookups by deal and by date
CREATE INDEX IF NOT EXISTS idx_deal_reports_deal_id ON deal_reports(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_reports_created ON deal_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_reports_unreviewed ON deal_reports(reviewed) WHERE reviewed = FALSE;

-- RLS: anonymous users can insert reports, only service role can read/update
ALTER TABLE deal_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can report a deal"
  ON deal_reports FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Service role can manage reports"
  ON deal_reports FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- View for admin dashboard: unreviewed reports grouped by deal
CREATE OR REPLACE VIEW deal_report_summary AS
SELECT
  deal_id,
  product_name,
  dispensary_name,
  brand_name,
  deal_price,
  COUNT(*) AS report_count,
  COUNT(*) FILTER (WHERE report_type = 'wrong_price') AS wrong_price_count,
  COUNT(*) FILTER (WHERE report_type = 'deal_gone') AS deal_gone_count,
  COUNT(*) FILTER (WHERE report_type = 'wrong_product') AS wrong_product_count,
  MIN(created_at) AS first_reported,
  MAX(created_at) AS last_reported
FROM deal_reports
WHERE reviewed = FALSE
GROUP BY deal_id, product_name, dispensary_name, brand_name, deal_price
ORDER BY report_count DESC, last_reported DESC;
