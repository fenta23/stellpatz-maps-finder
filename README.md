# 🅿️ Stellpatz Finder

> ⚠️ **Absolute Spielwiese.** Dieses Projekt dient ausschließlich zum Experimentieren und Ausprobieren — kein Produktions-Code, keine Garantien, keine Support-Versprechen. Alles kann sich jederzeit ändern oder wegfallen.

Kartenbasierte Web-App zur Routenplanung mit automatischer Anzeige von **Parkplätzen**, **Camper-Stellplätzen** und **Campingplätzen** im aktuellen Kartenausschnitt — alles auf Basis von OpenStreetMap, ohne proprietäre APIs.

![Stellpatz Finder Screenshot](https://placehold.co/900x500/4B5640/fff?text=Stellpatz+Finder)

## Features

- 🗺️ **Interaktive Karte** (Leaflet) mit automatischem POI-Laden beim Scrollen/Zoomen — Kartenstil **CARTO Voyager** (clean, erdig) + umschaltbarer **Satelliten-Layer** (Esri)
- 🅿️ **Parkplätze** (öffentlich vs. privat unterschieden), 🚐 **Camper-Stellplätze**, ⛺ **Campingplätze**, 🚿 **Entsorgungsstationen**, 🚰 **Frischwasserpunkte**
- 🔍 **Suche** mit Nominatim-Autocomplete (viewport-basiert)
- 🧭 **Routing** (Auto / Fahrrad / Fußweg) via Valhalla — mit Distanz, Fahrtzeit und Detour-Faktor
- ❤️ **Favoriten** — Herz-Button im Panel, Herz-Badge auf dem Marker, localStorage-persistent (Server-Sync geplant)
- 📸 **Bilder** aus OSM-Tags, Wikimedia Commons und Mapillary
- 📍 **In der Nähe**: Tankstelle, Supermarkt, Apotheke, Bäckerei, Frischwasser, Entsorgung (bis 2 km)
- 📝 **Community-Hinweise** aus der OSM Notes API
- 🕐 **Öffnungsstatus-Badge** (parst `opening_hours`-Tag live)
- 📱 **Installierbare PWA** — Home-Bildschirm, Offline-Shell, „Cache leeren"-Eintrag im Menü
- 🔒 Kein Google; läuft ohne API-Keys (Mapillary & Supabase optional)

## Tech Stack

| Schicht | Technologie |
|---|---|
| Karte | [Leaflet](https://leafletjs.com) + [markercluster](https://github.com/Leaflet/Leaflet.markercluster) · [CARTO Voyager](https://carto.com) / [Esri](https://www.esri.com) Tiles |
| POI-Daten | [Overpass API](https://overpass-api.de) (OpenStreetMap) |
| Geocoding | [Nominatim](https://nominatim.org) |
| Routing | [Valhalla](https://valhalla.github.io/valhalla/) (openstreetmap.de) |
| Frontend | Vanilla TypeScript, [Vite](https://vite.dev), PWA ([vite-plugin-pwa](https://vite-pwa-org.netlify.app)) |
| Backend | Node.js + Express (Proxy + Cache) |
| Persistenz | [Supabase](https://supabase.com) Postgres — optionaler persistenter POI-Cache (Auth + Server-Favoriten geplant) |
| Deployment | [Render.com](https://render.com) |

## Lokale Entwicklung

```bash
# Abhängigkeiten installieren
npm install

# Entwicklungsserver starten (Vite :5173 + Express :3000)
npm run dev

# Tests ausführen
npm test
```

Öffne [http://localhost:5173](http://localhost:5173) im Browser.

**Optionale Umgebungsvariablen** (`.env` aus `.env.example` kopieren):
```
MAPILLARY_ACCESS_TOKEN=   # Mapillary Street-Level-Fotos aktivieren
SUPABASE_URL=             # persistenter POI-Cache (sonst In-Memory-Fallback)
SUPABASE_SERVICE_KEY=     # service_role key — nur serverseitig, nie im Client
```

## Deployment auf Render.com

Das Projekt enthält eine `render.yaml` — einfach das GitHub-Repo bei Render verbinden:

1. [dashboard.render.com](https://dashboard.render.com) → **New → Web Service**
2. Repo auswählen — Render liest `render.yaml` automatisch
3. Optional: `MAPILLARY_ACCESS_TOKEN` unter **Environment** eintragen

Bei jedem `git push` auf `main` deployed Render automatisch neu.

## Als App installieren (PWA)

Die App ist eine **Progressive Web App** — installierbar auf Handy & Desktop, lädt die Oberfläche offline (besuchte Karten-Kacheln werden gecacht).

- **Android / Chrome / Edge:** „Installieren"-Button oben rechts oder Browser-Menü → „App installieren".
- **iOS / Safari:** Teilen-Symbol → „Zum Home-Bildschirm".

Der Service Worker ist nur im Production-Build aktiv. Lokal testen:

```bash
npm run build          # erzeugt sw.js + manifest.webmanifest in dist/client/
node dist/server/index.js   # Express serviert den Build inkl. SW
```

App-Icon ändern: `public/logo.svg` anpassen, dann `npm run generate-pwa-assets`.

## Später: native App via Capacitor (ohne Rewrite)

Die Codebase ist darauf vorbereitet, die PWA in eine native iOS/Android-Shell zu wrappen:

- Alle API-Aufrufe laufen über `apiUrl()` (`src/client/config.ts`). Im Web ist die Basis leer (relativ); für einen nativen Build `VITE_API_BASE=https://<dein-render-service>.onrender.com` setzen, damit die App den gehosteten Server trifft.
- Dann: `npm i -D @capacitor/cli @capacitor/core`, `npx cap init`, `webDir` auf `dist/client` zeigen, `npx cap add ios` / `add android`. Die helmet-CSP (`connectSrc`) muss um die API-Origin erweitert werden.

## Architektur

```
Browser
  │
  ├── GET /           → dist/client/ (Vite-Build, Leaflet-App)
  └── GET /api/**     → Express-Server (Proxy + Cache)
                            ├── /api/overpass   → Overpass API
                            ├── /api/geocode    → Nominatim
                            ├── /api/route      → Valhalla
                            ├── /api/nearby     → Overpass API
                            ├── /api/mapillary  → Mapillary Graph API
                            └── /api/notes      → OSM Notes API
```

Der Express-Server cached Overpass-Antworten (BBox-Snapping auf 0,05°-Raster) und setzt Security-Header via [helmet](https://helmetjs.github.io). Der POI-Cache ist **pluggable**: mit gesetzten Supabase-Variablen persistent in Postgres (TTL 7 Tage, überlebt Render-Kaltstarts), sonst In-Memory-Fallback.

### Supabase (optional, persistenter POI-Cache)

1. Supabase-Projekt anlegen → **Project Settings → API**: Project URL + `service_role`-Key holen
2. SQL aus `supabase/migrations/0001_poi_cache.sql` im **SQL Editor** ausführen
3. `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` als Env-Vars setzen (Render-Dashboard / lokale `.env`)

Ohne diese Variablen läuft alles unverändert mit dem In-Memory-Cache.

## Datenquellen & Lizenzen

Alle Kartendaten © [OpenStreetMap-Mitwirkende](https://www.openstreetmap.org/copyright), lizenziert unter [ODbL](https://opendatacommons.org/licenses/odbl/).  
Bilder: © jeweilige Urheber (Wikimedia Commons / Mapillary).

## Contributing

Issues und PRs willkommen. Bitte für jedes Feature einen eigenen Branch anlegen (`feat/...`) und einen PR gegen `main` öffnen.
