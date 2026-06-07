-- Persistent POI cache for the Overpass proxy.
-- Only the Express server (service-role key) reads/writes this table; the
-- service role bypasses RLS, so we enable RLS with no policies to deny all
-- other roles (anon / authenticated).

create table if not exists public.poi_cache (
  key        text primary key,
  data       jsonb not null,
  fetched_at timestamptz not null default now()
);

-- helps the (optional) cleanup of stale rows
create index if not exists poi_cache_fetched_at_idx on public.poi_cache (fetched_at);

alter table public.poi_cache enable row level security;

-- Optional housekeeping: delete entries older than 30 days.
--   delete from public.poi_cache where fetched_at < now() - interval '30 days';
-- Can be scheduled later via pg_cron.
