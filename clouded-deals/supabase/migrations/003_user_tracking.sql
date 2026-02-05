-- Anonymous user session tracking.
-- Each anonymous visitor gets a UUID stored in localStorage.

create table if not exists public.user_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null unique,
  zip_code   text,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);

create table if not exists public.user_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  event_type text not null,
  deal_id    uuid,
  metadata   jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_events_user on public.user_events (user_id);
create index if not exists idx_user_events_type on public.user_events (event_type);

create table if not exists public.user_saved_deals (
  id       uuid primary key default gen_random_uuid(),
  user_id  text not null,
  deal_id  uuid not null,
  saved_at timestamptz not null default now(),
  constraint user_saved_deals_unique unique (user_id, deal_id)
);

create table if not exists public.user_dismissed_deals (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  deal_id      uuid not null,
  dismissed_at timestamptz not null default now(),
  constraint user_dismissed_deals_unique unique (user_id, deal_id)
);

-- RLS: anonymous users can insert/read their own data via anon key.

alter table public.user_sessions enable row level security;
alter table public.user_events enable row level security;
alter table public.user_saved_deals enable row level security;
alter table public.user_dismissed_deals enable row level security;

-- Anon can insert sessions and events
create policy "Anon insert sessions" on public.user_sessions for insert to anon with check (true);
create policy "Anon update sessions" on public.user_sessions for update to anon using (true);
create policy "Anon insert events" on public.user_events for insert to anon with check (true);
create policy "Anon insert saved" on public.user_saved_deals for insert to anon with check (true);
create policy "Anon delete saved" on public.user_saved_deals for delete to anon using (true);
create policy "Anon insert dismissed" on public.user_dismissed_deals for insert to anon with check (true);

-- Service role can read everything (admin dashboard)
create policy "Service read sessions" on public.user_sessions for select to service_role using (true);
create policy "Service read events" on public.user_events for select to service_role using (true);
create policy "Service read saved" on public.user_saved_deals for select to service_role using (true);
create policy "Service read dismissed" on public.user_dismissed_deals for select to service_role using (true);
