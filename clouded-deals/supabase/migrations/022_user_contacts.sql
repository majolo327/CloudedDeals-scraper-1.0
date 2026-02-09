-- User contacts capture table.
-- Collects phone numbers and emails from engaged users for VIP launch campaigns.
-- No verification needed — simple input → save to DB.

CREATE TABLE IF NOT EXISTS public.user_contacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_id       text,
  phone         varchar(20),
  email         varchar(255),
  source        varchar(50) NOT NULL, -- 'saved_deals_banner', 'out_of_market', 'share_link'
  saved_deals_count int,
  zip_entered   varchar(10),          -- If from out-of-market flow
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- At least one contact method must be provided
  CONSTRAINT user_contacts_has_contact CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

-- Indexes for lookups and dedup
CREATE INDEX idx_user_contacts_phone ON public.user_contacts(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_user_contacts_email ON public.user_contacts(email) WHERE email IS NOT NULL;
CREATE INDEX idx_user_contacts_source ON public.user_contacts(source);
CREATE INDEX idx_user_contacts_anon_id ON public.user_contacts(anon_id) WHERE anon_id IS NOT NULL;

-- RLS: anyone can insert (public-facing capture form uses anon key)
ALTER TABLE public.user_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit contact info"
  ON public.user_contacts
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Only service role can read (admin dashboard / export)
CREATE POLICY "Service role can read contacts"
  ON public.user_contacts
  FOR SELECT
  TO service_role
  USING (true);
