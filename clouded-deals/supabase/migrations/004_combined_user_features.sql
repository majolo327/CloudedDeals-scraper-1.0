-- ============================================================================
-- CLOUDED DEALS - Combined User Features Migration
-- ============================================================================
-- This migration creates all tables needed for:
--   1. Waitlist (email capture for non-Vegas visitors)
--   2. Anonymous user tracking (sessions, events, saved/dismissed deals)
--
-- Run this in the Supabase SQL Editor to set up all user tracking features.
-- ============================================================================


-- ============================================================================
-- SECTION 1: WAITLIST
-- ============================================================================
-- Captures emails from visitors outside the Vegas area who want to be
-- notified when we expand to their market.

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


-- ============================================================================
-- SECTION 2: USER SESSIONS
-- ============================================================================
-- Tracks anonymous visitors. Each visitor gets a UUID stored in localStorage.
-- We track first_seen and last_seen for engagement metrics.

create table if not exists public.user_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null unique,
  zip_code   text,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);


-- ============================================================================
-- SECTION 3: USER EVENTS
-- ============================================================================
-- Generic event tracking table for analytics.
-- event_type examples: 'deal_view', 'deal_click', 'filter_change', etc.

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


-- ============================================================================
-- SECTION 4: USER SAVED DEALS
-- ============================================================================
-- Tracks which deals a user has saved (hearted).
-- Used for personalization and the "Saved" tab.

create table if not exists public.user_saved_deals (
  id       uuid primary key default gen_random_uuid(),
  user_id  text not null,
  deal_id  uuid not null,
  saved_at timestamptz not null default now(),
  constraint user_saved_deals_unique unique (user_id, deal_id)
);


-- ============================================================================
-- SECTION 5: USER DISMISSED DEALS
-- ============================================================================
-- Tracks which deals a user has dismissed (swiped left / X'd).
-- Used for personalization to avoid showing same deals again.

create table if not exists public.user_dismissed_deals (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  deal_id      uuid not null,
  dismissed_at timestamptz not null default now(),
  constraint user_dismissed_deals_unique unique (user_id, deal_id)
);


-- ============================================================================
-- SECTION 6: ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Enable RLS on all user tracking tables.

alter table public.user_sessions enable row level security;
alter table public.user_events enable row level security;
alter table public.user_saved_deals enable row level security;
alter table public.user_dismissed_deals enable row level security;


-- ============================================================================
-- SECTION 7: RLS POLICIES - ANONYMOUS ACCESS
-- ============================================================================
-- Anonymous users (using anon key) can write their own tracking data.

-- Sessions: insert and update (for last_seen updates)
create policy "Anon insert sessions" on public.user_sessions for insert to anon with check (true);
create policy "Anon update sessions" on public.user_sessions for update to anon using (true);

-- Events: insert only
create policy "Anon insert events" on public.user_events for insert to anon with check (true);

-- Saved deals: insert and delete (to unsave)
create policy "Anon insert saved" on public.user_saved_deals for insert to anon with check (true);
create policy "Anon delete saved" on public.user_saved_deals for delete to anon using (true);

-- Dismissed deals: insert only
create policy "Anon insert dismissed" on public.user_dismissed_deals for insert to anon with check (true);

-- Allow anon to read their own saved/dismissed for personalization
create policy "Anon read saved" on public.user_saved_deals for select to anon using (true);
create policy "Anon read dismissed" on public.user_dismissed_deals for select to anon using (true);


-- ============================================================================
-- SECTION 8: RLS POLICIES - SERVICE ROLE ACCESS
-- ============================================================================
-- Service role (admin) can read everything for dashboards and analytics.

create policy "Service read sessions" on public.user_sessions for select to service_role using (true);
create policy "Service read events" on public.user_events for select to service_role using (true);
create policy "Service read saved" on public.user_saved_deals for select to service_role using (true);
create policy "Service read dismissed" on public.user_dismissed_deals for select to service_role using (true);


-- ============================================================================
-- DONE!
-- ============================================================================
-- Tables created:
--   - waitlist (email capture)
--   - user_sessions (anonymous visitor tracking)
--   - user_events (analytics events)
--   - user_saved_deals (saved/hearted deals)
--   - user_dismissed_deals (dismissed deals)
--
-- All tables have RLS enabled with appropriate policies for anon and service_role.
-- ============================================================================
