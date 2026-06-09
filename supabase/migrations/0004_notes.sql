-- Per-user personal notes on POIs (server-side, synced from the client).
-- Like favorites, accessed directly by the authenticated browser via the anon
-- key and fenced by RLS: a user may only read/write rows where
-- user_id = auth.uid(). The Express server is NOT involved (no service-role key).

create table if not exists public.notes (
  user_id    uuid not null references auth.users(id) on delete cascade,
  poi_id     text not null,
  type       text,
  name       text,
  lat        double precision,
  lon        double precision,
  text       text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, poi_id)
);

alter table public.notes enable row level security;

create policy "notes_select_own" on public.notes
  for select using (auth.uid() = user_id);

create policy "notes_insert_own" on public.notes
  for insert with check (auth.uid() = user_id);

create policy "notes_update_own" on public.notes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "notes_delete_own" on public.notes
  for delete using (auth.uid() = user_id);
