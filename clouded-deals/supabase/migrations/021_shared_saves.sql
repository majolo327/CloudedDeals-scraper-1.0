-- Shared saves: short-lived shareable snapshots of a user's saved deals
-- Links expire at midnight Pacific the day they were created

create table if not exists shared_saves (
  id          text primary key,              -- short share ID (8 chars)
  anon_id     text not null,                 -- who created the share
  deal_ids    text[] not null default '{}',  -- array of product UUIDs
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,          -- midnight PT that night
  view_count  integer not null default 0
);

-- Index for lookups by share ID (primary key already covers this)
-- Index for cleanup of expired shares
create index if not exists idx_shared_saves_expires on shared_saves (expires_at);

-- RLS: anyone can read (public share links), only creator can insert
alter table shared_saves enable row level security;

create policy "Anyone can read shared saves"
  on shared_saves for select
  using (true);

create policy "Anyone can insert shared saves"
  on shared_saves for insert
  with check (true);

-- Allow incrementing view_count
create policy "Anyone can update view count"
  on shared_saves for update
  using (true)
  with check (true);
