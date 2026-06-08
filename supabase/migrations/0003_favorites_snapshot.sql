-- Store a snapshot of each favorited POI (name + coordinates + type) so the
-- favorites list can render and navigate without a live Overpass lookup.
-- Columns are nullable so any rows created by migration 0002 keep working.

alter table public.favorites
  add column if not exists type text,
  add column if not exists name text,
  add column if not exists lat  double precision,
  add column if not exists lon  double precision;
