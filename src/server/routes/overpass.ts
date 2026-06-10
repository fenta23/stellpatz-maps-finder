import express, { Router } from 'express'
import type { PoiCache } from '../cache.js'
import { snapBboxInQuery } from '../geo.js'
import { isValidPoiQuery } from '../overpassQuery.js'
import { OVERPASS_ENDPOINTS, USER_AGENT } from '../config.js'

// Round-robin index lives in the closure — fresh per createApp() call (tests stay isolated).
export function createOverpassRouter(cache: PoiCache): Router {
  const router = Router()
  let endpointIdx = 0

  router.post(
    '/',
    express.text({ type: 'application/x-www-form-urlencoded', limit: '4kb' }),
    async (req, res) => {
      const rawBody = req.body as string
      const rawQuery = decodeURIComponent(rawBody.startsWith('data=') ? rawBody.slice(5) : rawBody)

      // Only the app's bbox'd POI-query shape is proxied — this is not a
      // general Overpass relay (expensive arbitrary QL gets rejected).
      if (!isValidPoiQuery(rawQuery)) {
        res.status(400).json({ error: 'Unsupported query shape' })
        return
      }

      const snappedQuery = snapBboxInQuery(rawQuery)

      const cached = await cache.get(snappedQuery)
      if (cached !== null) {
        res.json(cached)
        return
      }

      const body = 'data=' + encodeURIComponent(snappedQuery)
      const n = OVERPASS_ENDPOINTS.length

      for (let i = 0; i < n; i++) {
        const url = OVERPASS_ENDPOINTS[endpointIdx % n]!
        endpointIdx++
        const isLast = i === n - 1
        try {
          const upstream = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
            body,
            signal: AbortSignal.timeout(15_000),
          })

          // Overloaded / rate-limited / server-side errors (incl. 504 Gateway
          // Timeout) are transient — try the next endpoint before giving up.
          if (upstream.status === 429 || upstream.status >= 500) {
            if (!isLast) continue
            res.status(upstream.status === 429 ? 429 : 503)
              .json({ error: 'Overpass unavailable on all endpoints' })
            return
          }
          if (!upstream.ok) {
            // A genuine client error (bad query) — retrying won't help.
            res.status(upstream.status).json({ error: `Overpass error: ${upstream.statusText}` })
            return
          }

          const data = await upstream.json() as unknown
          await cache.set(snappedQuery, data)
          res.json(data)
          return
        } catch {
          // Network error or timeout — fall through to the next endpoint.
          if (!isLast) continue
          res.status(503).json({ error: 'All Overpass endpoints unreachable' })
          return
        }
      }
    },
  )

  return router
}
