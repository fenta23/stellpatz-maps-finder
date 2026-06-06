import 'dotenv/config'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createCache } from './cache.js'
import { createHealthRouter } from './routes/health.js'
import { createOverpassRouter } from './routes/overpass.js'
import { createGeocodeRouter } from './routes/geocode.js'
import { createRouteRouter } from './routes/route.js'
import { createNearbyRouter } from './routes/nearby.js'
import { createMapillaryRouter } from './routes/mapillary.js'
import { createNotesRouter } from './routes/notes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Leaflet needs inline styles
      imgSrc: [
        "'self'", 'data:', 'blob:',
        'https://*.tile.openstreetmap.org',
        'https://upload.wikimedia.org',
        'https://commons.wikimedia.org',
        'https://images.mapillary.com',
        'https://graph.mapillary.com',
      ],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
})

const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
})

export function createApp() {
  const app = express()

  // Behind Render / load balancer — req.ip is the LB IP without this
  app.set('trust proxy', 1)
  app.use(helmetConfig)
  app.use('/api', apiLimiter)

  // Cache is created per app instance so tests start clean
  const cache = createCache<unknown>()

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
