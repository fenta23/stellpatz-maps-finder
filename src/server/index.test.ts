import { describe, it, expect, afterEach, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './index.js'

afterEach(() => vi.unstubAllGlobals())

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    statusText: status === 429 ? 'Too Many Requests' : 'OK',
    json: () => Promise.resolve(body),
  }))
}

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await request(createApp()).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})

describe('POST /api/overpass', () => {
  it('proxies query to Overpass and returns JSON', async () => {
    const payload = { elements: [] }
    mockFetch(200, payload)
    const res = await request(createApp())
      .post('/api/overpass')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('data=test')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(payload)
  })

  it('retries next endpoint on 429 and succeeds', async () => {
    const payload = { elements: [] }
    let calls = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      calls++
      return Promise.resolve({
        status: calls === 1 ? 429 : 200,
        ok: calls !== 1,
        statusText: calls === 1 ? 'Too Many Requests' : 'OK',
        json: () => Promise.resolve(payload),
      })
    }))
    const res = await request(createApp())
      .post('/api/overpass')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('data=test')
    expect(res.status).toBe(200)
    expect(calls).toBeGreaterThanOrEqual(2)
  })

  it('returns cached result on second identical request without hitting upstream', async () => {
    const payload = { elements: [{ id: 1 }] }
    mockFetch(200, payload)
    const app = createApp()
    await request(app)
      .post('/api/overpass')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('data=' + encodeURIComponent('[out:json];(node["amenity"="parking"](48.00,11.00,48.05,11.05););out center tags;'))
    const callsAfterFirst = vi.mocked(fetch).mock.calls.length
    await request(app)
      .post('/api/overpass')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('data=' + encodeURIComponent('[out:json];(node["amenity"="parking"](48.00,11.00,48.05,11.05););out center tags;'))
    expect(vi.mocked(fetch).mock.calls.length).toBe(callsAfterFirst)
  })

  it('returns 429 when all endpoints are rate-limited', async () => {
    mockFetch(429, null)
    const res = await request(createApp())
      .post('/api/overpass')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('data=test')
    expect(res.status).toBe(429)
  })

  it('returns 503 when all endpoints are unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    const res = await request(createApp())
      .post('/api/overpass')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('data=test')
    expect(res.status).toBe(503)
  })
})

describe('GET /api/geocode', () => {
  it('returns 400 when q is missing', async () => {
    const res = await request(createApp()).get('/api/geocode')
    expect(res.status).toBe(400)
  })

  it('proxies to Nominatim and returns results', async () => {
    const payload = [{ lat: '48.1', lon: '11.5', display_name: 'München' }]
    mockFetch(200, payload)
    const res = await request(createApp()).get('/api/geocode?q=München')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(payload)
    const calledUrl = String(vi.mocked(fetch).mock.calls[0]?.[0])
    expect(calledUrl).toContain('nominatim.openstreetmap.org')
    expect(calledUrl).toContain('M%C3%BCnchen')
  })

  it('includes viewbox when provided', async () => {
    mockFetch(200, [])
    await request(createApp()).get('/api/geocode?q=test&viewbox=11,48.5,11.5,48')
    const calledUrl = String(vi.mocked(fetch).mock.calls[0]?.[0])
    expect(calledUrl).toContain('viewbox')
  })

  it('returns 503 when Nominatim is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    const res = await request(createApp()).get('/api/geocode?q=test')
    expect(res.status).toBe(503)
  })
})

// Valhalla returns encoded polyline string for shape; empty string → empty coords
const VALHALLA_PAYLOAD = {
  trip: {
    legs: [{ shape: '' }],
    summary: { length: 5.0, time: 600 },
  },
}

function decodeJsonParam(calledUrl: string) {
  const match = calledUrl.match(/json=([^&]+)/)
  return JSON.parse(decodeURIComponent(match![1]))
}

describe('GET /api/mapillary', () => {
  afterEach(() => { delete process.env['MAPILLARY_ACCESS_TOKEN'] })

  it('returns 400 when lat/lon missing', async () => {
    const res = await request(createApp()).get('/api/mapillary')
    expect(res.status).toBe(400)
  })

  it('returns empty array when MAPILLARY_ACCESS_TOKEN not set', async () => {
    const res = await request(createApp()).get('/api/mapillary?lat=48.1&lon=11.5')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('proxies to Mapillary graph API and returns simplified images', async () => {
    process.env['MAPILLARY_ACCESS_TOKEN'] = 'test_token'
    mockFetch(200, {
      data: [{ id: 'img1', thumb_256_url: 'https://cdn.mapillary.com/img1.jpg', captured_at: 1709298000000 }],
    })
    const res = await request(createApp()).get('/api/mapillary?lat=48.1&lon=11.5')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0]).toMatchObject({
      src: 'https://cdn.mapillary.com/img1.jpg',
      caption: expect.stringContaining('Mapillary'),
      link: expect.stringContaining('mapillary.com'),
    })
    const calledUrl = String(vi.mocked(fetch).mock.calls[0]?.[0])
    expect(calledUrl).toContain('graph.mapillary.com/images')
    expect(calledUrl).toContain('test_token')
  })

  it('returns 503 when Mapillary is unreachable', async () => {
    process.env['MAPILLARY_ACCESS_TOKEN'] = 'test_token'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    const res = await request(createApp()).get('/api/mapillary?lat=48.1&lon=11.5')
    expect(res.status).toBe(503)
  })
})

describe('GET /api/notes', () => {
  const OSM_NOTES_RESPONSE = {
    features: [
      {
        properties: {
          id: 42,
          date_created: '2024-03-10 14:00:00 UTC',
          comments: [{ text: 'Campsite is closed for the season' }],
        },
      },
      {
        properties: { id: 43, date_created: '2024-01-01 00:00:00 UTC', comments: [] }, // no comments → filtered out
      },
    ],
  }

  it('returns 400 when lat/lon missing', async () => {
    const res = await request(createApp()).get('/api/notes')
    expect(res.status).toBe(400)
  })

  it('parses and returns simplified notes array', async () => {
    mockFetch(200, OSM_NOTES_RESPONSE)
    const res = await request(createApp()).get('/api/notes?lat=48.1&lon=11.5')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0]).toMatchObject({ id: 42, date: '2024-03-10', text: 'Campsite is closed for the season' })
  })

  it('calls OSM Notes API with bbox around the coordinate', async () => {
    mockFetch(200, { features: [] })
    await request(createApp()).get('/api/notes?lat=48.1&lon=11.5')
    const calledUrl = String(vi.mocked(fetch).mock.calls[0]?.[0])
    expect(calledUrl).toContain('openstreetmap.org/api/0.6/notes.json')
    expect(calledUrl).toContain('bbox=')
  })

  it('returns 503 when OSM Notes is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    const res = await request(createApp()).get('/api/notes?lat=48.1&lon=11.5')
    expect(res.status).toBe(503)
  })
})

describe('GET /api/route', () => {
  it('returns 400 when coordinates are missing', async () => {
    const res = await request(createApp()).get('/api/route')
    expect(res.status).toBe(400)
  })

  it('proxies to Valhalla via GET and transforms response', async () => {
    mockFetch(200, VALHALLA_PAYLOAD)
    const res = await request(createApp()).get('/api/route?from=48.1,11.5&to=48.2,11.6')
    expect(res.status).toBe(200)
    expect(res.body.code).toBe('Ok')
    expect(res.body.routes[0].distance).toBe(5000) // 5 km → meters
    expect(res.body.routes[0].duration).toBe(600)
    const calledUrl = String(vi.mocked(fetch).mock.calls[0]?.[0])
    expect(calledUrl).toContain('valhalla1.openstreetmap.de')
    expect(calledUrl).toContain('json=')
  })

  it('sends auto costing for driving mode', async () => {
    mockFetch(200, VALHALLA_PAYLOAD)
    await request(createApp()).get('/api/route?from=48.1,11.5&to=48.2,11.6&mode=driving')
    const req = decodeJsonParam(String(vi.mocked(fetch).mock.calls[0]?.[0]))
    expect(req.costing).toBe('auto')
  })

  it('sends bicycle costing for mode=cycling', async () => {
    mockFetch(200, VALHALLA_PAYLOAD)
    await request(createApp()).get('/api/route?from=48.1,11.5&to=48.2,11.6&mode=cycling')
    const req = decodeJsonParam(String(vi.mocked(fetch).mock.calls[0]?.[0]))
    expect(req.costing).toBe('bicycle')
  })

  it('sends pedestrian costing for mode=foot', async () => {
    mockFetch(200, VALHALLA_PAYLOAD)
    await request(createApp()).get('/api/route?from=48.1,11.5&to=48.2,11.6&mode=foot')
    const req = decodeJsonParam(String(vi.mocked(fetch).mock.calls[0]?.[0]))
    expect(req.costing).toBe('pedestrian')
  })

  it('falls back to auto costing for unknown mode', async () => {
    mockFetch(200, VALHALLA_PAYLOAD)
    await request(createApp()).get('/api/route?from=48.1,11.5&to=48.2,11.6&mode=helicopter')
    const req = decodeJsonParam(String(vi.mocked(fetch).mock.calls[0]?.[0]))
    expect(req.costing).toBe('auto')
  })

  it('decodes encoded polyline shape (empty string → empty coords)', async () => {
    mockFetch(200, VALHALLA_PAYLOAD)
    const res = await request(createApp()).get('/api/route?from=48.1,11.5&to=48.2,11.6')
    expect(res.body.routes[0].geometry.coordinates).toEqual([])
  })

  it('returns 503 when Valhalla is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    const res = await request(createApp()).get('/api/route?from=48.1,11.5&to=48.2,11.6')
    expect(res.status).toBe(503)
  })
})
