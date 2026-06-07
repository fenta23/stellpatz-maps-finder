# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.8.0] - 2026-06-07

### Added
- **Login (Supabase Auth, Magic-Link)** — Phase 2 der Server-Erweiterung:
  - Neuer Slice `features/auth/`: `authClient` (Client aus `VITE_SUPABASE_*`), `createAuth` (sendMagicLink/signOut/currentUser/onChange), pure `isValidEmail`, `AuthPanel` (Modal).
  - ☰-Menü-Eintrag **„👤 Konto"** → Modal: passwortloser Login per E-Mail bzw. „Angemeldet als … · Abmelden".
  - **Gated:** ohne `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` ist Login einfach aus → PR sicher mergebar.
  - `@supabase/supabase-js` als Client-Dependency; Server-CSP `connect-src` um die Supabase-Origin erweitert; `render.yaml` + `.env.example` um die `VITE_SUPABASE_*` ergänzt.
  - 16 neue Tests (`isValidEmail`, `createAuth` mit Mock-Client, `AuthPanel`-Rendering/Flows).

### Changed
- POI-Cache-Auswahl im Test immer In-Memory (`NODE_ENV==='test'`) — Suite bleibt hermetisch, auch wenn lokal eine `.env` mit Supabase-Keys liegt.
- README aktualisiert: Tech-Stack (CARTO Voyager + Esri, PWA, Supabase), Features, Supabase-Setup, pluggable Cache-Hinweis.

## [0.7.0] - 2026-06-07

### Added
- **Sidebar-Menü** (`features/menu/`): Hamburger-Button (☰) in der Topbar öffnet einen Slide-in-Drawer mit Backdrop; ESC/Backdrop schließen. Datengetriebene Einträge — leicht erweiterbar.
- Erster Eintrag **„Cache leeren & neu laden"**: löscht alle Service-Worker-Caches + meldet den SW ab und lädt neu → erzwingt die frischeste App-Version (Nutzerdaten in localStorage bleiben). Behebt die SW-Stale-Krux ohne DevTools.
- 9 neue Tests (`clearAppCache`, `SideMenu`)

## [0.6.0] - 2026-06-07

### Added
- **Persistenter POI-Cache (Supabase Postgres)** — Phase 1 der Server-Erweiterung:
  - Pluggable async `PoiCache`-Interface mit zwei Implementierungen: `createSupabaseCache` (persistent, via PostgREST + `fetch` — **keine neue Server-Dependency**) und `createInMemoryCache` (Fallback).
  - Aktiv, sobald `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` gesetzt sind; sonst In-Memory-Fallback → **PR sofort sicher mergebar**, der Cache überlebt dann Render-Restarts.
  - TTL 7 Tage (OSM-POIs ändern sich langsam). Cache-Fehler werden geschluckt — nie im Request-Pfad.
  - SQL-Migration `supabase/migrations/0001_poi_cache.sql` (Tabelle `poi_cache`, RLS an, service-role-only).
  - `render.yaml` + `.env.example` um `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` erweitert.
  - 10 neue Tests (In-Memory-TTL/Eviction, Supabase get/set inkl. Stale-/Fehlerfälle).

### Changed
- Overpass-Route nutzt jetzt das async `PoiCache`-Interface (`await cache.get/set`) statt der synchronen `getCached/setCached`.

## [0.5.0] - 2026-06-07

### Changed
- **Frischer, erdiger „Camper"-Look** über ein CSS-Design-Token-System (`:root`-Variablen, keine neue Dependency):
  - Palette: warmes Off-White, Oliv/Forest-Akzent (`#5E6B4F` / Topbar `#4B5640`) statt Tech-Blau, Terrakotta für Links/Highlights, Sand-/Tinten-Töne
  - Weichere Rundungen, ruhigere Schatten, aufgeräumte Komponenten (Topbar, Filter-Chips, Dropdown, Suche, Detail-Panel, Badges, Lightbox)
- **Karten-Default: CARTO Voyager** (clean, gedämpft, erdig — gratis, kein API-Key) statt OSM-Standard; Satellit bleibt als zweiter Layer
- App-Icon-Hintergrund auf Oliv, Camper-Fenster auf gedämpftes Slate (statt Tech-Blau); PWA `theme_color`/`background_color` + `theme-color`-Meta angepasst
- Routen-Polylinien (Auto/Rad/Fuß) und Standort-Marker auf die erdige Palette umgestellt

### Fixed
- CSP: `img-src` um `*.basemaps.cartocdn.com` erweitert (sonst blockt die Karte in Production)

## [0.4.1] - 2026-06-07

### Changed
- **Client auf Vertical Slices umgestellt** — Organisation nach Feature statt technischer Schicht: `app/` (Composition Root), `core/`, `features/{map,pois,poi-detail,routing,search,filters,favorites,install}`. Pfad-Aliase `@/` → `src/client/`, `@shared/` → `src/shared/` (Vite + tsconfig).
- **`main.ts` von 364 → ~150 Zeilen** (reines Wiring). Aus der God-`init()` extrahiert:
  - `app/session.ts` — expliziter UI-State statt verstreuter Closure-`let`s
  - `app/selection.ts` — der zuvor 3-fach duplizierte „select → route → show → load"-Flow (Marker-Klick / Navigate / Routing-Wechsel) an einer Stelle
  - `app/poiRefresher.ts` — Bounds → Overpass → Marker → Status (Abort/Slow-Hint/Zoom-Guard gekapselt)
  - `features/map/leafletAdapter.ts` — Leaflet-`MapAdapter`-Implementierung (war inline)
  - `features/map/locationMarker.ts`, `features/map/panIntoView.ts` (pure Pan-Mathematik)
  - `features/pois/statusMessages.ts` (pure Overpass-Fehler-/Count-Texte)
  - `features/poi-detail/poiData.ts` (Wikimedia/Mapillary/Nearby/Notes-Lader + pure Helpers)
- 24 neue Unit-Tests für die extrahierten Pure-Units + Selection-Controller (258 gesamt). Verhalten unverändert (Browser-Smoke verifiziert).

## [0.4.0] - 2026-06-07

### Added
- **PWA (installierbare App)**: `vite-plugin-pwa` (Workbox) erzeugt Service Worker + Web-App-Manifest. App ist auf iOS/Android/Desktop zum Home-Bildschirm hinzufügbar und lädt die Shell offline.
  - Caching-Strategien: App-Shell precache · OSM-/Esri-Tiles `CacheFirst` (gedeckelt, nur besuchte — tile-policy-freundlich) · `/api/*` `NetworkFirst` (kurz offline-resilient)
  - Grafisches App-Icon (Camper-Van + Mond, Camping/Overnighter-Thema) auf Markenblau — generiert aus `public/logo.svg` via `@vite-pwa/assets-generator` (`npm run generate-pwa-assets`)
  - iOS-Meta-Tags (`apple-mobile-web-app-*`, apple-touch-icon), `theme-color`, `viewport-fit=cover` + Safe-Area-Insets (Notch/Home-Indicator)
  - „Installieren"-Button (Chrome/Android via `beforeinstallprompt`) bzw. iOS-Hinweis „Teilen → Zum Home-Bildschirm"
- **Capacitor-Vorbereitung**: `apiUrl()` / `VITE_API_BASE` entkoppelt den Client vom Same-Origin-API — relativ im Web/PWA, absolut (Render-URL) für spätere native Builds. Alle API-Fetches umgestellt.
- 13 neue Tests (`apiUrl`-Auflösung, Install-Affordance + Plattform-Erkennung)

### Changed
- `.claude/launch.json` — Production-Launch-Config (`stellpatz-prod`, `node dist/server/index.js`) für PWA-/SW-Tests gegen den echten Express-Build

## [0.3.9] - 2026-06-06

### Changed
- **Filterleiste kompakter**: POI-Buttons zeigen nur noch Icons (🅿️ 🚐 ⛺ 🚿 🚰) statt Icon + Text — Klartext bleibt als `title`/`aria-label` erhalten
- **Routenmodus als Dropdown**: Auto/Fahrrad/Fußweg sind statt drei Buttons jetzt ein icon-only `<select>` (🚗/🚲/🚶, Klartext als `title`) — spart Platz, Mobile-Filterleiste passt jetzt in **eine** Zeile
- Dropdown ist immer rechtsbündig (`margin-left: auto`, Desktop + Mobile); `.filter-spacer`-Hilfs-Div entfernt
- **Status-Anzeige als schwebendes Toast**: „Lade Stellplätze…" / „Bitte weiter reinzoomen…" liegt jetzt als absolut positioniertes Pill oben mittig über der Karte statt im Flex-Flow — schiebt die Karte beim Ein-/Ausblenden nicht mehr nach unten (kein Layout-Shift)

### Fixed
- **Mobile-Filterleiste**: POI- und Routing-Buttons liefen am rechten Rand aus dem Bild (`flex-wrap: nowrap`) — auf Mobilgeräten war die Routing-Auswahl (Auto/Fahrrad/Fußweg) gar nicht erreichbar. Jetzt bricht die Leiste um: POI-Chips in eigene(r) Zeile(n), Routing-Modus darunter, kompaktere Buttons
- **Mobile-Detail-Panel war nie sichtbar** — zwei zusammenwirkende Bugs:
  1. Der `#detail-panel`-Host kollabiert auf 0px Breite (einziges Kind ist `position: absolute`), wodurch das Panel rechts außerhalb des Schirms landete → Fix: `position: fixed` relativ zum Viewport
  2. `z-index: 20` lag unter Leaflets Karten-Panes (Tile 200, Marker 600), die mangels Stacking-Context auf `#map` im Root-Stacking-Context rendern → das Panel verschwand *hinter* der Karte. Fix: `z-index: 1100` (über Panes + Controls)
- Zusätzlich: abgerundete obere Ecken + Schatten, Höhe `60dvh` (dynamische Viewport-Höhe, korrekt mit mobiler Browser-Toolbar)
- **Karten-Pan beim POI-Klick**: auf Mobile schiebt die Karte den angeklickten POI jetzt nach **oben** in den sichtbaren Streifen über dem Bottom-Sheet (statt wie auf Desktop horizontal neben das Seitenpanel)

## [0.3.8] - 2026-06-06

### Changed
- Overpass-Cache: TTL 5 min → 25 min, max. Einträge 200 → 20.000 — weniger Upstream-Requests, längere Vorhaltung bei der Spielwiesen-Nutzung

## [0.3.7] - 2026-06-06

### Added
- **Private Parkplätze visuell unterscheidbar**: Parkplätze mit `access=private`/`no` erhalten ein graues Marker-Icon mit Schloss-Badge (unten links), öffentliche bleiben blau
- `isPrivateParking()` — pure Klassifizierer in `OverpassClient.ts` (öffentlich = `yes`/`public`/`permissive`/`customers` oder kein Tag; privat = `private`/`no`)
- 13 neue Tests (Klassifizierer + Icon-Varianten + Persistenz durch Favoriten-Toggle)

### Changed
- `buildIcon(type, isFavorite, isPrivate?)` — dritter Parameter; Schloss- und Herz-Badge kombinierbar ohne Kollision (Schloss unten links, Herz oben rechts)

### Added
- **Satelliten-Ansicht**: Layer-Switcher oben rechts (Leaflet `L.control.layers`) schaltet zwischen „Karte" (OSM) und „Satellit" (Esri World Imagery) um — Marker bleiben in beiden Ansichten sichtbar
- Esri-Tiles sind gratis und ohne API-Key nutzbar; Attribution „Luftbilder © Esri, Maxar, Earthstar Geographics" wird automatisch eingeblendet
- `BASE_LAYER_CONFIGS` + `buildBaseLayers()` als pure, testbare Funktionen in `MapService.ts` (7 neue Tests)

## [0.3.5] - 2026-06-06

### Added
- ESC-Taste schließt die Sidebar (Detail-Panel) — außer wenn die Lightbox gerade offen ist (die hat ihren eigenen ESC-Handler)
- 4 neue Tests für das ESC-Verhalten in `PoiDetailPanel.test.ts`

## [0.3.4] - 2026-06-06

### Changed
- `OverpassClient.ts` → `parseElements`: `map().filter((p): p is OsmPoi => p !== null)` → `filter(notNullUndefined)` (typisiertes Predikat aus `shared/common`)
- `PoiDetailPanel.ts` → `typeLabel`: alle 5 POI-Typen abgedeckt (dump/water fehlten), `coalesce('Ort')` als Fallback
- `PoiDetailPanel.ts` → `renderNoteText`: URL-Truncation via `strEllipsisLen(45)` aus `shared/str`
- `shared/str.ts` → `strEllipsisLen`: `'...'` → `'…'` (Unicode-Ellipsis-Zeichen)

### Fixed
- `OverpassClient.ts` → `fetchPois`: `signal: undefined` via bedingtem Spread (Fehler mit `exactOptionalPropertyTypes: true`)
- `index.test.ts` → `decodeJsonParam`: fehlende Non-null-Assertion für `match![1]!` (Fehler mit `noUncheckedIndexedAccess`)

## [0.3.3] - 2026-06-06

### Added
- `src/shared/` — FP-Utilities, aus dem `util-manipulation`-Ordner extrahiert und bereinigt:
  - `fp.ts` — `compose` (getypte Overloads bis 6 Stufen), `coalesce`, `curry`, `flip`, `findOrDefault`, `not`
  - `common.ts` — `notNullUndefined`, `isNullUndefined`, `jsonCopy`, `jsonEqual`, `jsonDiff`
  - `str.ts` — `strNonNull`, `strTrim`, `strCompareAlphanumeric`, `strPadLeftWithZeroN`, `strEllipsisLen`, u. a.
  - `array.ts` — `arrayFilterNotEmpty`, `arrayUnique`, `arraySortByKey`, `arrayRemove`, u. a.
  - Vollständige Test-Suite für alle vier Module (94 neue Tests)

### Changed
- `routes/geocode.ts` — Query-Normalisierung via `compose(strTrim, strNonNull)` statt manuellem `String() + trim()`
- `routes/notes.ts` — `notNullUndefined` als Type-Guard für ersten Comment; `filter/map/filter` → `flatMap` (entfernt `[0]!`-Non-null-Assertion)
- `tsconfig.server.json` — `rootDir: src/server` → `src`, `outDir: dist/server` → `dist`; inkludiert jetzt `src/shared/**/*.ts`

### Removed
- `src/util-manipulation/` — Angular/RxJS/Date-Cruft entfernt; die nutzbaren Teile leben jetzt in `src/shared/`
  - Entfernt: `rxjs/` (Angular-Decorators + RxJS), `date/` (15 Dateien, nicht benötigt), `sort.ts` (`@angular/common`-Abhängigkeit), `fp/math.ts` (triviale Math-Wrapper), alle Nx/Angular-Konfigdateien

## [0.3.2] - 2026-06-06

### Changed
- **Server-Refactoring**: `src/server/index.ts` (417 Zeilen, alles in einer Datei) aufgeteilt in:
  - `config.ts` — Konstanten (Endpoints, UA, Cache-Parameter)
  - `cache.ts` — reine Cache-Funktionen (`createCache`, `getCached`, `setCached`)
  - `geo.ts` — reine Geo-Funktionen (`snapBboxInQuery`, `haversineMeters`, `decodeValhallaPolyline`)
  - `routes/health.ts`, `routes/overpass.ts`, `routes/geocode.ts`, `routes/route.ts`, `routes/nearby.ts`, `routes/mapillary.ts`, `routes/notes.ts`
  - `index.ts` jetzt nur noch Middleware-Wiring + Bootstrap (~55 Zeilen)
- Route-Handler als Factory-Funktionen (`createXxxRouter()`) — Composition via Parameter, keine Vererbung, keine globale State
- `nearby.ts`: `NEARBY_ICONS` + `NEARBY_LABELS` → `KIND_META` zusammengeführt (DRY)
- `nearby.ts`: `filter` + `map` + `filter(null)` → `flatMap` (lesbarer)
- `route.ts`: Koordinaten-Parsing in pure `parseCoordPair()` extrahiert
- `geo.ts`: `decodeValhallaPolyline` mit `decodeVarInt` helper — klare Rückgabe `{ value, nextIndex }`

## [0.3.1] - 2026-06-05

### Fixed
- Render build: vite 8→7 (rolldown/binding-linux-ppc64-gnu fehlende Version crashte npm install auf Linux)
- Render build: `npm install` statt `npm ci`, Node-Version-Pin entfernt (Render nutzt Node 24 default)
- Lockfile neu generiert nach npm 11/10 Inkompatibilität

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
