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

describe('GET /api/route', () => {
  it('returns 400 when coordinates are missing', async () => {
    const res = await request(createApp()).get('/api/route')
    expect(res.status).toBe(400)
  })

  it('proxies to OSRM and returns route', async () => {
    const osrmPayload = {
      code: 'Ok',
      routes: [{ distance: 5000, duration: 600, geometry: { coordinates: [[11.5, 48.1], [11.6, 48.2]] } }],
    }
    mockFetch(200, osrmPayload)
    const res = await request(createApp()).get('/api/route?from=48.1,11.5&to=48.2,11.6')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(osrmPayload)
    const calledUrl = String(vi.mocked(fetch).mock.calls[0]?.[0])
    expect(calledUrl).toContain('router.project-osrm.org')
    // OSRM needs lon,lat order
    expect(calledUrl).toContain('11.5,48.1')
  })

  it('returns 503 when OSRM is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    const res = await request(createApp()).get('/api/route?from=48.1,11.5&to=48.2,11.6')
    expect(res.status).toBe(503)
  })
})
