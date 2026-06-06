import { Router } from 'express'
import { decodeValhallaPolyline } from '../geo.js'
import { USER_AGENT } from '../config.js'

const VALHALLA_URL = 'https://valhalla1.openstreetmap.de/route'

const COSTING: Record<string, string> = {
  driving: 'auto',
  cycling: 'bicycle',
  foot: 'pedestrian',
}

interface ValhallaShape { type: string; coordinates: Array<[number, number]> }
interface ValhallaLeg { shape: string | ValhallaShape }
interface ValhallaResponse {
  trip: {
    legs: ValhallaLeg[]
    summary: { length: number; time: number }
  }
}

function parseCoordPair(raw: string): [number, number] | null {
  const [latStr, lonStr] = raw.split(',')
  const lat = Number(latStr)
  const lon = Number(lonStr)
  if (!isFinite(lat) || !isFinite(lon)) return null
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return [lat, lon]
}

export function createRouteRouter(): Router {
  const router = Router()

  router.get('/', async (req, res) => {
    const fromCoords = parseCoordPair(String(req.query['from'] ?? ''))
    const toCoords = parseCoordPair(String(req.query['to'] ?? ''))

    if (!fromCoords || !toCoords) {
      res.status(400).json({ error: 'from and to coordinates required (lat,lon)' })
      return
    }

    const costing = COSTING[String(req.query['mode'] ?? 'driving')] ?? 'auto'
    const jsonParam = encodeURIComponent(JSON.stringify({
      locations: [
        { lat: fromCoords[0], lon: fromCoords[1] },
        { lat: toCoords[0], lon: toCoords[1] },
      ],
      costing,
      units: 'km',
    }))

    try {
      const upstream = await fetch(`${VALHALLA_URL}?json=${jsonParam}`, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(10_000),
      })
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: 'Routing error' })
        return
      }

      const data = await upstream.json() as ValhallaResponse
      const leg = data.trip?.legs?.[0]
      if (!leg) {
        res.status(502).json({ error: 'No route found' })
        return
      }

      const coordinates = typeof leg.shape === 'string'
        ? decodeValhallaPolyline(leg.shape)
        : (leg.shape as ValhallaShape).coordinates

      res.json({
        code: 'Ok',
        routes: [{
          distance: data.trip.summary.length * 1000, // km → meters
          duration: data.trip.summary.time,
          geometry: { coordinates },
        }],
      })
    } catch {
      res.status(503).json({ error: 'Routing service unreachable' })
    }
  })

  return router
}
