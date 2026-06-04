# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-06-05

### Added
- **Render.com Deployment**: `render.yaml` — ein einziger Web Service (Express) serviert `/api/**` + statischen Client-Build; Build/Start/Health-Check vorkonfiguriert
- `tsconfig.server.json` — separates TS-Kompilierungsziel für den Server (`node16`-Auflösung, kein DOM, Ausgabe nach `dist/server/`)
- `npm run build:client` / `npm run build:server` — separate Build-Targets; `npm run build` führt beide aus
- **Security Hardening** (vollständiger Codebase-Review):
  - `safeUrl()` in PoiDetailPanel — blockt `javascript:`-Protokoll in OSM `website`/`phone`/`email`-Tags (XSS)
  - `helmet` — CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
  - `app.set('trust proxy', 1)` — korrektes `req.ip` hinter Load Balancer
  - Overpass-Body-Limit 4 kb (DoS-Mitigation)
  - Koordinatenvalidierung (`isFinite` + Bereichsprüfung) in `/api/route`
  - Viewbox-Format-Validierung in `/api/geocode`
  - Mapillary-Token aus URL-Query-Param → `Authorization`-Header (verhindert Log-Leakage)

### Changed
- `.env.example` — Firebase-Hinweise durch Render-Hinweise ersetzt

## [0.2.0] - 2026-06-04

### Added
- **Favoriten**: Herz-Button (♡/♥) im Detail-Panel-Header — ein Klick markiert einen POI als Favorit
- Favorisierte Marker erhalten ein rotes Herz-Badge (kleiner roter Kreis oben rechts am Marker-Icon)
- Favoriten werden in `localStorage` gespeichert und bleiben nach Reload erhalten
- `LocalFavoritesStore` implementiert `IFavoritesStore`-Interface — vorbereitet für Firebase-Swap (gleiche API, anderer Backing Store)
- `PoiMarkerManager.setFavorites()` aktualisiert alle sichtbaren Marker-Icons live ohne Neu-Laden
- 9 neue Tests für `LocalFavoritesStore`, 4 neue Tests für Marker-Icons (101 Tests gesamt)

## [0.1.9] - 2026-06-04

### Added
- **Öffnungsstatus-Badge**: grüner/roter Streifen unter dem Titel mit "Geöffnet · schließt HH:MM" / "Geschlossen · öffnet HH:MM" (parst `Mo-Fr HH:MM-HH:MM`-Syntax, keine externe Library)
- **„In der Nähe"**: neuer Panel-Abschnitt mit Entfernung zu Tankstelle ⛽, Supermarkt 🛒, Apotheke 💊, Bäckerei 🥐, Entsorgung 🚿, Frischwasser 🚰 (max 2 km, Haversine, sortiert nach Distanz) via neuem `/api/nearby`-Proxy
- **Entsorgung & Wasser als eigene Kartenebene**: zwei neue Filter-Buttons in der Filterleiste; eigene Marker und Overpass-Queries für `amenity=sanitary_dump_station` und `amenity=water_point`
- 6 neue Server-Tests für `/api/nearby`, 2 neue Client-Tests (87 Tests gesamt)

## [0.1.8] - 2026-06-04

### Added
- Bildergalerie im Detail-Panel: scrollbarer Streifen direkt unterhalb der Routen-Zusammenfassung
- OSM `image`-Tag wird sofort angezeigt (direkte URL)
- `wikimedia_commons`-Tag wird via Wikimedia Commons API aufgelöst (client-seitig, CORS-fähig)
- Mapillary Street-Level-Fotos (bis 6 Bilder, ~50 m Radius) über neuen Server-Proxy `/api/mapillary`
- `MAPILLARY_ACCESS_TOKEN` in `.env.example` — ohne Token liefert der Endpunkt ein leeres Array
- 4 neue Server-Tests für `/api/mapillary` (81 Tests gesamt)

## [0.1.7] - 2026-06-04

### Added
- Detail-Panel massiv erweitert: typ-spezifische Tags für Parking (Belag, Höhe, überdacht, bewacht, Park&Ride) und Camping/Stellplatz (Strom, Wasser, Dusche, Toilette, Entsorgung, WLAN, Hunde, Sterne)
- Adressen aus `addr:*`-Tags zusammengesetzt, E-Mail als `mailto:`-Link
- Community-Hinweise aus der OSM Notes API (300 m Radius) laden asynchron nach und erscheinen gelb hervorgehoben unter dem Panel
- Neuer Server-Proxy `/api/notes` (4 Tests)

## [0.1.6] - 2026-06-04

### Added
- Server-seitiger In-Memory-Cache für Overpass-Antworten (TTL 5 min, max 200 Einträge)
- BBox-Snapping auf 0,05°-Raster (~5 km): leicht unterschiedliche Viewports treffen denselben Cache-Eintrag — zweiter Request in der gleichen Region kommt sofort zurück

## [0.1.5] - 2026-06-04

### Fixed
- Routing-Modi liefern jetzt wirklich unterschiedliche Routen: OSRM-Public-Server durch **Valhalla** (`valhalla1.openstreetmap.de`) ersetzt, das `auto`/`bicycle`/`pedestrian` mit eigenen Algorithmen berechnet
- Korrekte API: GET mit `json=`-Param (nicht POST); Polyline-Decoder für Valhalla-6-dezimal-Format
- Server-Proxy transformiert Valhalla-Response in OSRM-kompatibles Format für den Client

## [0.1.4] - 2026-06-04

### Added
- Routing-Modus-Auswahl: 🚗 Auto / 🚲 Fahrrad / 🚶 Fußweg in der Filterleiste
- OSRM-Proxy nutzt jetzt das passende Profil (`driving` / `cycling` / `foot`)
- Polyline-Farbe je Modus: blau (Auto), grün (Fahrrad), orange (Fußweg)
- 3 neue Server-Tests für Modus-Parameter (ungültige Werte → Fallback auf `driving`)

## [0.1.3] - 2026-06-04

### Added
- Marker-Clustering via `leaflet.markercluster` — bei vielen POIs werden Gruppen gebündelt (farbcodiert grün/gelb/orange/rot nach Dichte), einzelne Marker ab Zoom 17

### Fixed
- Overpass `openstreetmap.fr` als erster Endpoint (antwortet in <2s)
- Per-Endpoint-Timeout auf 20s gesetzt; Fallback auf 4 Endpoints statt 3
- Client zeigt "Warte auf Overpass-Server…" nach 8s damit der User weiß dass es normal ist

## [0.1.2] - 2026-06-04

### Changed
- **Komplette Migration auf OpenStreetMap**: Google Maps vollständig entfernt
  - Karte: Google Maps JS API → Leaflet.js mit OSM-Tiles
  - Suche: Google Places Autocomplete → Nominatim (via `/api/geocode` Express-Proxy)
  - Routing: Google Directions API → OSRM (via `/api/route` Express-Proxy)
  - Kein Google Maps API-Key mehr erforderlich, `/api/maps-key` entfernt
  - Externer POI-Link: "In Google Maps öffnen" → "Auf OpenStreetMap anzeigen"
- `SearchBar` neu: eigenes Dropdown-Autocomplete mit Nominatim-Ergebnissen
- `DirectionsService` neu: OSRM-Routing mit GeoJSON-Polyline auf Leaflet-Karte
- `MapService` ersetzt `GoogleMapService` (Leaflet-basiert, kein Google-Typ-Abhängigkeit)

### Added
- 67 Unit-Tests (7 mehr als zuvor: neue SearchBar-Tests + neue Server-Proxy-Tests)

## [0.1.1] - 2026-06-04

### Changed
- Overpass API requests now go through Express proxy (`/api/overpass`) instead of being made directly from the browser — fixes `ERR_CONNECTION_REFUSED` in browser, removes CORS exposure
- Express proxy rotates across 3 Overpass endpoints with a 12s timeout each and a mandatory `User-Agent` header
- Improved error messages: 429 and 503 states now show descriptive German text in the status bar

## [0.1.0] - 2026-06-04

### Added
- Initial project scaffold (Vite + TypeScript + Node.js/Express)
- Express server with Google Maps API key proxy (`/api/maps-key`)
- Rate limiting on API routes
- Google Maps integration with Geolocation start marker
- Overpass API client for querying OSM POIs (parking, camper pitches, campsites) in viewport
- POI marker manager with per-type SVG icons and MarkerClusterer
- Detail side panel with OSM tags (name, hours, phone, website, fees, capacity)
- Google Maps Directions routing with distance/time display and deeplink
- Search bar with Google Places Autocomplete scoped to viewport
- Filter panel with toggleable POI types, state persisted in localStorage
- Unit tests for all modules (Vitest + MSW)
- Git repository initialized
