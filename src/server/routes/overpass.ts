import express, { Router } from 'express'
import type { Cache } from '../cache.js'
import { getCached, setCached } from '../cache.js'
import { snapBboxInQuery } from '../geo.js'
import { OVERPASS_ENDPOINTS, USER_AGENT, CACHE_TTL_MS, CACHE_MAX_ENTRIES } from '../config.js'

// Round-robin index lives in the closure — fresh per createApp() call (tests stay isolated).
export function createOverpassRouter(cache: Cache<unknown>): Router {
  const router = Router()
  let endpointIdx = 0

  router.post(
    '/',
    express.text({ type: 'application/x-www-form-urlencoded', limit: '4kb' }),
    async (req, res) => {
      const rawBody = req.body as string
      const rawQuery = decodeURIComponent(rawBody.startsWith('data=') ? rawBody.slice(5) : rawBody)
      const snappedQuery = snapBboxInQuery(rawQuery)

      const cached = getCached(cache, snappedQuery)
      if (cached !== null) {
        res.json(cached)
        return
      }

      const body = 'data=' + encodeURIComponent(snappedQuery)
      const n = OVERPASS_ENDPOINTS.length

      for (let i = 0; i < n; i++) {
        const url = OVERPASS_ENDPOINTS[endpointIdx % n]!
        endpointIdx++
        try {
          const upstream = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
            body,
            signal: AbortSignal.timeout(20_000),
          })

          if (upstream.status === 429 || upstream.status === 503) {
            if (i < n - 1) continue
            res.status(429).json({ error: 'Overpass rate limited on all endpoints' })
            return
          }
          if (!upstream.ok) {
            res.status(upstream.status).json({ error: `Overpass error: ${upstream.statusText}` })
            return
          }

          const data = await upstream.json() as unknown
          setCached(cache, snappedQuery, data, CACHE_TTL_MS, CACHE_MAX_ENTRIES)
          res.json(data)
          return
        } catch {
          if (i < n - 1) continue
          res.status(503).json({ error: 'All Overpass endpoints unreachable' })
          return
        }
      }
    },
  )

  return router
}
