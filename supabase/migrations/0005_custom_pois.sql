-- Per-user custom POIs (user-defined points on the map).
-- Like favorites/notes, accessed by the authenticated browser via the anon
-- key and fenced by RLS: a user may only read/write rows where
-- user_id = auth.uid().

create table if not exists public.custom_pois (
  user_id    uuid not null references auth.users(id) on delete cascade,
  id         text not null,  -- client-generated uuid
  icon_id    text not null,
  lat        double precision not null,
  lon        double precision not null,
  name       text not null default '',
  data       jsonb not null default '{}',  -- address, contact, details, note, timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.custom_pois enable row level security;

create policy "custom_pois_select_own" on public.custom_pois
  for select using (auth.uid() = user_id);

create policy "custom_pois_insert_own" on public.custom_pois
  for insert with check (auth.uid() = user_id);

create policy "custom_pois_update_own" on public.custom_pois
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "custom_pois_delete_own" on public.custom_pois
  for delete using (auth.uid() = user_id);
