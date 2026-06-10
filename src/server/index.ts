import 'dotenv/config'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createInMemoryCache } from './cache.js'
import { createSupabaseCache } from './supabaseCache.js'
import {
  CACHE_TTL_MS, CACHE_MAX_ENTRIES,
  POI_CACHE_TTL_MS, SUPABASE_URL, SUPABASE_SERVICE_KEY,
  ALLOWED_ORIGINS,
} from './config.js'
import { originGuard } from './originGuard.js'
import { createHealthRouter } from './routes/health.js'
import { createOverpassRouter } from './routes/overpass.js'
import { createGeocodeRouter } from './routes/geocode.js'
import { createRouteRouter } from './routes/route.js'
import { createNearbyRouter } from './routes/nearby.js'
import { createMapillaryRouter } from './routes/mapillary.js'
import { createNotesRouter } from './routes/notes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The client talks to Supabase (auth) via fetch → its origin must be in connect-src.
const supabaseOrigin = (() => {
  const raw = process.env['SUPABASE_URL']
  try { return raw ? new URL(raw).origin : null } catch { return null }
})()

const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Leaflet needs inline styles
      imgSrc: [
        "'self'", 'data:', 'blob:',
        'https://*.basemaps.cartocdn.com', // CARTO Voyager base map (<img>)
        'https://*.tile.openstreetmap.org', // OSM map tiles (<img>)
        'https://server.arcgisonline.com',  // Esri satellite tiles (<img>)
        'https://upload.wikimedia.org',
        'https://commons.wikimedia.org',
        'https://images.mapillary.com',
        'https://graph.mapillary.com',
      ],
      // 'self' for the API proxy; commons for the client-side Wikimedia
      // image-info lookup; the Supabase origin for auth (all fetches).
      // Map tiles load as <img> (see img-src), not via fetch → no entry needed.
      connectSrc: ["'self'", 'https://commons.wikimedia.org', ...(supabaseOrigin ? [supabaseOrigin] : [])],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
})

export function createApp() {
  const app = express()

  // Behind Render / load balancer — req.ip is the LB IP without this
  app.set('trust proxy', 1)
  app.use(helmetConfig)
  // Cross-site browser traffic is rejected before it can burn upstream quotas.
  app.use('/api', originGuard(ALLOWED_ORIGINS))
  // Limiters per app instance so tests get fresh counters.
  app.use('/api', rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false }))
  // Mapillary calls spend our API token — keep its budget tight.
  app.use('/api/mapillary', rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false }))

  // Persistent Supabase cache when configured, else in-memory fallback.
  // Always in-memory under test so the suite stays hermetic (no real Supabase
  // even if a local .env is present). Created per app instance → tests start clean.
  const useSupabase = SUPABASE_URL && SUPABASE_SERVICE_KEY && process.env['NODE_ENV'] !== 'test'
  const cache = useSupabase
    ? createSupabaseCache({ url: SUPABASE_URL, serviceKey: SUPABASE_SERVICE_KEY, ttlMs: POI_CACHE_TTL_MS })
    : createInMemoryCache(CACHE_TTL_MS, CACHE_MAX_ENTRIES)

  app.use('/api', createHealthRouter())
  app.use('/api/overpass', createOverpassRouter(cache))
  app.use('/api/geocode', createGeocodeRouter())
  app.use('/api/route', createRouteRouter())
  app.use('/api/nearby', createNearbyRouter())
  app.use('/api/mapillary', createMapillaryRouter())
  app.use('/api/notes', createNotesRouter())

  // Static client build (production)
  const clientDist = path.resolve(__dirname, '../../dist/client')
  app.use(express.static(clientDist))
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')))

  return app
}

if (process.env['NODE_ENV'] !== 'test') {
  const port = Number(process.env['SERVER_PORT'] ?? process.env['PORT'] ?? 3000)
  createApp().listen(port, () => console.log(`Server running on http://localhost:${port}`))
}
