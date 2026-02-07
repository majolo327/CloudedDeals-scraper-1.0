-- SMS deal alerts waitlist.
-- Collects phone numbers from users who want daily text alerts.
-- No messages are sent yet — this is demand validation only.

create table if not exists public.sms_waitlist (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null,
  source     text not null default 'sticky_cta',
  anon_id    text,
  created_at timestamptz not null default now(),
  -- Prevent duplicate signups from the same phone number
  constraint sms_waitlist_phone_unique unique (phone)
);

-- Allow anonymous inserts (public-facing signup form uses anon key).
alter table public.sms_waitlist enable row level security;

create policy "Anyone can sign up for SMS alerts"
  on public.sms_waitlist
  for insert
  to anon
  with check (true);

-- Only service role can read the list (admin dashboard / future SMS sends).
create policy "Service role can read SMS waitlist"
  on public.sms_waitlist
  for select
  to service_role
  using (true);
