-- Per-user favorites (server-side, synced from the client).
-- Accessed directly by the authenticated browser via the anon key, so access
-- is fenced by RLS: a user may only read/write rows where user_id = auth.uid().
-- The Express server is NOT involved here (no service-role key needed).

create table if not exists public.favorites (
  user_id    uuid not null references auth.users(id) on delete cascade,
  poi_id     text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, poi_id)
);

alter table public.favorites enable row level security;

-- Users see and mutate only their own favorites.
create policy "favorites_select_own" on public.favorites
  for select using (auth.uid() = user_id);

create policy "favorites_insert_own" on public.favorites
  for insert with check (auth.uid() = user_id);

create policy "favorites_delete_own" on public.favorites
  for delete using (auth.uid() = user_id);
