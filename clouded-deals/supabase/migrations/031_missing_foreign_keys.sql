-- Migration 031: Add missing foreign keys to prevent orphaned records
--
-- Several tables reference products(id) or dispensaries(id) without
-- formal FK constraints, allowing orphaned rows to accumulate.

-- deal_reports.deal_id → products(id) — cascade delete when product removed
ALTER TABLE deal_reports
  ADD CONSTRAINT fk_deal_reports_product
  FOREIGN KEY (deal_id) REFERENCES products(id) ON DELETE CASCADE;

-- user_saved_deals.deal_id → products(id) — cascade so saves don't point to ghosts
ALTER TABLE user_saved_deals
  ADD CONSTRAINT fk_user_saved_deals_product
  FOREIGN KEY (deal_id) REFERENCES products(id) ON DELETE CASCADE;

-- user_dismissed_deals.deal_id → products(id) — cascade
ALTER TABLE user_dismissed_deals
  ADD CONSTRAINT fk_user_dismissed_deals_product
  FOREIGN KEY (deal_id) REFERENCES products(id) ON DELETE CASCADE;

-- user_events.deal_id → products(id) — SET NULL so we keep the event even
-- if the product is cleaned up (analytics are valuable)
ALTER TABLE user_events
  ADD CONSTRAINT fk_user_events_product
  FOREIGN KEY (deal_id) REFERENCES products(id) ON DELETE SET NULL;

-- Performance: index on deal_id columns that now have FKs
CREATE INDEX IF NOT EXISTS idx_user_saved_deals_deal
  ON user_saved_deals(deal_id);

CREATE INDEX IF NOT EXISTS idx_user_dismissed_deals_deal
  ON user_dismissed_deals(deal_id);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_products_category_score
  ON products(category, deal_score DESC)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_products_dispensary_active_score
  ON products(dispensary_id, deal_score DESC)
  WHERE is_active = TRUE;
