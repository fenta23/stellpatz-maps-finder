# Stellpatz Maps Finder

## Project Overview
Web app for route planning with automatic display of parking spots, camper pitches, and campsites in the current map viewport. Built with Leaflet + OSM tiles, Overpass API, Node.js/Express backend, Vite + TypeScript frontend. Deployed as a single Express service on Render.com.

## Commands
```bash
npm install          # install dependencies
npm run dev          # start dev server (Vite :5173 + Express :3000)
npm test             # run all unit tests (Vitest)
npm run test:watch   # watch mode
npm run build        # production build → dist/client/ (Vite) + dist/server/ (tsc)
npm run build:client # only Vite frontend build
npm run build:server # only TypeScript server compilation
npm run generate-pwa-assets # regenerate PWA icons from public/logo.svg
```

## PWA
- `vite-plugin-pwa` (Workbox) erzeugt Service Worker + Manifest beim Build (nur Production, nicht im Dev-Server)
- SW-Test lokal: `npm run build && node dist/server/index.js` (Launch-Config `stellpatz-prod`)
- API-Aufrufe gehen über `apiUrl()` (`src/client/config.ts`) — relativ im Web, absolut (`VITE_API_BASE`) für spätere Capacitor-Builds. **Neue API-Fetches immer über `apiUrl()`.**

## Deployment (Render.com)
1. Repo auf GitHub pushen
2. https://dashboard.render.com → New → Web Service → Repo verbinden
3. Render liest `render.yaml` automatisch (Build + Start Command, Health Check)
4. `MAPILLARY_ACCESS_TOKEN` im Render Dashboard unter Environment setzen

Der Express-Server serviert in Production sowohl `/api/**` als auch die statischen
Client-Dateien aus `dist/client/` — ein einziger Service für alles.

## Architecture

### Backend (`src/server/`)
- `index.ts` — Express server, `createApp()` für Tests + Produktion exportiert
- Proxies: Overpass, Nominatim, Valhalla routing, Mapillary, OSM Notes
- In-memory Overpass cache (TTL 5 min, BBox-Snapping auf 0,05°-Raster)
- Security: helmet (CSP, X-Frame-Options …), trust proxy, rate limiting

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
```

**Slice-Regel:** Ein Slice importiert **nicht die Interna** eines anderen — Verdrahtung passiert in `app/`. Typen über Slices hinweg sind ok. Neue Features bekommen einen eigenen `features/<name>/`-Ordner.

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
SERVER_PORT=3000
MAPILLARY_ACCESS_TOKEN=   # optional — Mapillary street-level photos
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
