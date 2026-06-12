# Stellpatz Maps Finder

## Project Overview
Web app for route planning with automatic display of parking spots, camper pitches, and campsites in the current map viewport. Built with Leaflet + OSM tiles, Overpass API, Supabase Edge Functions (Deno), Vite + TypeScript frontend. Hosted on GitHub Pages + Supabase Edge Functions.

## Commands
```bash
npm install          # install dependencies
npm run dev          # start dev server (Vite :5173 + Supabase Edge Functions :54321)
npm test             # run all unit tests (Vitest)
npm run test:watch   # watch mode
npm run test:int     # integration tests vs Edge Function (needs supabase functions serve or VITE_API_BASE)
npm run build        # production build → dist/client/
npm run build:client # only Vite frontend build
npm run generate-pwa-assets # regenerate PWA icons from public/logo.svg
```

## PWA
- `vite-plugin-pwa` (Workbox) erzeugt Service Worker + Manifest beim Build (nur Production, nicht im Dev-Server)
- SW-Test lokal: `npm run build && npx serve dist/client`
- API-Aufrufe gehen über `apiUrl()` (`src/client/core/config.ts`) — relativ im Web (Vite-Proxy), absolut (`VITE_API_BASE`) für GitHub Pages / Capacitor. **Neue API-Fetches immer über `apiUrl()`.**
- Prod: API Calls gehen cross-origin zu Supabase Edge Functions (kein SW-Caching)

## Deployment

### Frontend (GitHub Pages)
Push auf `main` → GitHub Action `.github/workflows/deploy-pages.yml` baut + deployt automatisch.

### Backend (Supabase Edge Functions)
```bash
supabase login
supabase link --project-ref <ref>
supabase functions deploy api --no-verify-jwt
supabase secrets set MAPILLARY_ACCESS_TOKEN=...
```

Edge Function mit 7 Handlern:

| Endpunkt | Methode | Beschreibung |
|---|---|---|
| `/api/health` | GET | Health check |
| `/api/overpass` | POST | Overpass-Proxy mit Query-Validation + BBox-Snap + Postgres-Cache + 5-Endpunkt-Failover |
| `/api/geocode` | GET | Nominatim-Proxy |
| `/api/route` | GET | Valhalla-Routing |
| `/api/nearby` | GET | Overpass around + Haversine-Sort |
| `/api/mapillary` | GET | Mapillary Graph API (20 req/min limitiert) |
| `/api/notes` | GET | OSM Notes API |

## Architecture

### Backend (`supabase/functions/`)
- **`api/index.ts`** — Router (dispatcht nach `/api/*`-Pfad) + CORS
- **`api/*Handler.ts`** — 7 Handler (health, overpass, geocode, route, nearby, mapillary, notes)
- **`_shared/utils.ts`** — isValidPoiQuery, snapBboxInQuery, parseLatLon, haversineMeters, decodeValhallaPolyline, corsHeaders, Supabase-Client, Rate Limiting

POI-Cache: Supabase Postgres via `supabase-js` (Tabelle `poi_cache`, BBox-Snapping 0,05°, TTL 7 Tage). Best-Effort: Fehler werden geschluckt, nie im Request-Pfad.

### Frontend (`src/client/`) — **vertical slices**
Organisiert nach Feature, nicht nach technischer Schicht. Pfad-Aliase: `@/` → `src/client/`, `@shared/` → `src/shared/`.

```
app/        Composition Root: main.ts (nur Wiring), session.ts (State), selection.ts, poiRefresher.ts
core/       config.ts (apiUrl / VITE_API_BASE)
features/
  map/        MapService, leafletAdapter (MapAdapter-Impl), locationMarker, panIntoView (pure)
  pois/       OverpassClient, PoiMarkerManager, statusMessages (pure)
  poi-detail/ PoiDetailPanel, poiData (Wikimedia/Mapillary/Nearby/Notes-Lader)
  routing/    DirectionsService
  search/     SearchBar
  filters/    FilterPanel
  favorites/  FavoritesStore (IFavoritesStore + LocalFavoritesStore)
  install/    installPrompt (PWA)
  menu/       SideMenu (Drawer), clearAppCache
  auth/       Supabase Auth (Magic-Link): authClient, createAuth, AuthPanel — gated auf VITE_SUPABASE_*
```

Client-Env (Build-Zeit, Vite): `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (anon = öffentlich). Ohne → Login aus.

**Slice-Regel:** Ein Slice importiert **nicht die Interna** eines anderen — Verdrahtung passiert in `app/`. Typen über Slices hinweg sind ok.

### POI Types (Overpass queries)
- **Parking** → `amenity=parking`
- **Camper pitch** → `tourism=camp_pitch` OR `amenity=parking` + `motorhome=yes`
- **Campsite** → `tourism=campsite`
- **Dump station** → `amenity=sanitary_dump_station`
- **Water point** → `amenity=water_point`

## Key Principles
- No framework — vanilla TypeScript only
- Immutability: use `readonly` types, no mutation of shared state
- Pure functions where possible; explicit dependencies
- Every feature has unit tests (Vitest)
- No magic: no reflection, no decorators, no DI containers

## Environment
Copy `.env.example` → `.env` for local dev:
```
MAPILLARY_ACCESS_TOKEN=   # optional — Mapillary street-level photos
SUPABASE_URL=             # for Overpass cache
SUPABASE_SERVICE_KEY=     # service_role key
```

## Testing
- Unit tests alongside source: `*.test.ts`
- Mocking HTTP: MSW (Mock Service Worker)
- Run: `npm test`

## Git Workflow
- Jedes Feature / Bugfix bekommt einen eigenen Branch: `feat/...` oder `fix/...`
- Nach Fertigstellung: PR gegen `main` öffnen, dann mergen
- Direkte Commits auf `main` nur für triviale Dinge (typo, config)

## Changelog
Keep `CHANGELOG.md` updated (Keep-a-Changelog format) for every meaningful change.
