-- Aggregated save counts per deal for social proof display.
-- Counts distinct users (by user_id text) who saved each deal.

CREATE OR REPLACE VIEW public.deal_save_counts AS
SELECT
  deal_id,
  COUNT(DISTINCT user_id) AS save_count
FROM public.user_saved_deals
GROUP BY deal_id;

-- Allow public read so the frontend can join against this view.
GRANT SELECT ON public.deal_save_counts TO anon;
GRANT SELECT ON public.deal_save_counts TO authenticated;
GRANT SELECT ON public.deal_save_counts TO service_role;
