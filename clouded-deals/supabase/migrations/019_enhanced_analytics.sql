-- ============================================================================
-- ENHANCED ANALYTICS SUPPORT
-- ============================================================================
-- 1. Allow authenticated users to read analytics tables (admin dashboard)
-- 2. Add composite indexes for common dashboard queries
-- ============================================================================

-- Allow authenticated users to read analytics data (admin dashboard)
CREATE POLICY "authenticated_read_analytics" ON analytics_events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_read_sessions" ON public.user_sessions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_read_events" ON public.user_events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_read_saved" ON public.user_saved_deals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_read_dismissed" ON public.user_dismissed_deals
  FOR SELECT TO authenticated USING (true);

-- Composite index for daily unique visitor queries
CREATE INDEX IF NOT EXISTS idx_analytics_anon_created
  ON analytics_events(anon_id, created_at);

-- Composite index for event type + date range queries
CREATE INDEX IF NOT EXISTS idx_analytics_event_created
  ON analytics_events(event_name, created_at);
