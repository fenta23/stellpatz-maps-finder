# Stellpatz Maps Finder

## Project Overview
Web app for route planning with automatic display of parking spots, camper pitches, and campsites in the current map viewport. Built with Google Maps JS API + Overpass API (OSM), Node.js/Express backend, Vite + TypeScript frontend.

## Commands
```bash
npm install          # install dependencies
npm run dev          # start dev server (Vite :5173 + Express :3000)
npm test             # run all unit tests (Vitest)
npm run test:watch   # watch mode
npm run build        # production build → dist/
```

## Architecture

### Backend (`src/server/`)
- `index.ts` — Express server, serves client build, proxies Google Maps API key
- `/api/maps-key` — returns `GOOGLE_MAPS_API_KEY` from `.env` (rate-limited, localhost only in dev)
- Never expose the API key in client-side bundles

### Frontend (`src/client/`)
| Module | Purpose |
|---|---|
| `map/GoogleMapService.ts` | Map init, bounds events, geolocation |
| `poi/OverpassClient.ts` | Overpass API queries for OSM POIs |
| `poi/PoiMarkerManager.ts` | Create/remove markers, clustering, icons |
| `routing/DirectionsService.ts` | Google Directions, distance calc, deeplink |
| `ui/FilterPanel.ts` | POI type toggles, localStorage persistence |
| `ui/PoiDetailPanel.ts` | Side panel with OSM tag details |
| `ui/SearchBar.ts` | Places Autocomplete scoped to viewport |
| `main.ts` | Bootstrap, wires all modules together |

### POI Types (Overpass queries)
- **Parking** → `amenity=parking`
- **Camper pitch** → `tourism=camp_pitch` OR `amenity=parking` + `motorhome=yes`
- **Campsite** → `tourism=campsite`

## Key Principles
- No framework — vanilla TypeScript only
- Immutability: use `readonly` types, no mutation of shared state
- Pure functions where possible; explicit dependencies
- Every feature has unit tests (Vitest)
- No magic: no reflection, no decorators, no DI containers

## Environment
Copy `.env.example` → `.env` and fill in your Google Maps API key.
```
GOOGLE_MAPS_API_KEY=AIza...
PORT=3000
```

## Testing
- Unit tests alongside source: `*.test.ts`
- Mocking HTTP: MSW (Mock Service Worker)
- Run: `npm test`

## Changelog
Keep `CHANGELOG.md` updated (Keep-a-Changelog format) for every meaningful change.
