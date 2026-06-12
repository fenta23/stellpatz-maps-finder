-- Per-user POI filter configuration (built-in overrides + user-defined filters).
-- Like favorites/notes/custom_pois, accessed by the authenticated browser via the
-- anon key and fenced by RLS: a user may only read/write rows where
-- user_id = auth.uid(). The full FilterDef lives in the `data` jsonb column.

create table if not exists public.poi_filters (
  user_id    uuid not null references auth.users(id) on delete cascade,
  id         text not null,  -- filter id (built-in id or client-generated uuid)
  data       jsonb not null default '{}',  -- the full FilterDef (name, icon, color, enabled, selectors, …)
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.poi_filters enable row level security;

create policy "poi_filters_select_own" on public.poi_filters
  for select using (auth.uid() = user_id);

create policy "poi_filters_insert_own" on public.poi_filters
  for insert with check (auth.uid() = user_id);

create policy "poi_filters_update_own" on public.poi_filters
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "poi_filters_delete_own" on public.poi_filters
  for delete using (auth.uid() = user_id);
