-- Waitlist table for email capture from non-Vegas visitors.
-- Stores email + zip code so we know which markets have demand.

create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  zip_code   text not null,
  created_at timestamptz not null default now(),
  -- Prevent duplicate signups from the same email + zip
  constraint waitlist_email_zip_unique unique (email, zip_code)
);

-- Allow anonymous inserts (public-facing signup form uses anon key).
alter table public.waitlist enable row level security;

create policy "Anyone can sign up for the waitlist"
  on public.waitlist
  for insert
  to anon
  with check (true);

-- Only service role can read the waitlist (admin dashboard).
create policy "Service role can read waitlist"
  on public.waitlist
  for select
  to service_role
  using (true);
