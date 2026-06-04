import { describe, it, expect, afterEach, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './index.js'

describe('Express server', () => {
  const originalKey = process.env['GOOGLE_MAPS_API_KEY']

  afterEach(() => {
    vi.unstubAllGlobals()
    if (originalKey === undefined) {
      delete process.env['GOOGLE_MAPS_API_KEY']
    } else {
      process.env['GOOGLE_MAPS_API_KEY'] = originalKey
    }
  })

  it('GET /api/health returns ok', async () => {
    const app = createApp()
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  it('GET /api/maps-key returns key when configured', async () => {
    process.env['GOOGLE_MAPS_API_KEY'] = 'test-key-123'
    const app = createApp()
    const res = await request(app).get('/api/maps-key')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ key: 'test-key-123' })
  })

  it('GET /api/maps-key returns 503 when key missing', async () => {
    delete process.env['GOOGLE_MAPS_API_KEY']
    const app = createApp()
    const res = await request(app).get('/api/maps-key')
    expect(res.status).toBe(503)
    expect(res.body).toHaveProperty('error')
  })

  it('does not expose raw key in non-api routes', async () => {
    process.env['GOOGLE_MAPS_API_KEY'] = 'secret-key'
    const app = createApp()
    const res = await request(app).get('/api/health')
    expect(JSON.stringify(res.body)).not.toContain('secret-key')
  })
})

describe('POST /api/overpass', () => {
  afterEach(() => vi.unstubAllGlobals())

  function mockFetch(status: number, body: unknown) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status,
      ok: status >= 200 && status < 300,
      statusText: status === 429 ? 'Too Many Requests' : 'OK',
      json: () => Promise.resolve(body),
    }))
  }

  it('proxies query to Overpass and returns JSON', async () => {
    const payload = { elements: [{ type: 'node', id: 1, lat: 48, lon: 11, tags: {} }] }
    mockFetch(200, payload)
    const app = createApp()
    const res = await request(app)
      .post('/api/overpass')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('data=%5Bout%3Ajson%5D')
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
    const app = createApp()
    const res = await request(app)
      .post('/api/overpass')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('data=test')
    expect(res.status).toBe(200)
    expect(calls).toBeGreaterThanOrEqual(2)
  })

  it('returns 429 when all endpoints are rate-limited', async () => {
    mockFetch(429, null)
    const app = createApp()
    const res = await request(app)
      .post('/api/overpass')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('data=test')
    expect(res.status).toBe(429)
  })

  it('returns 503 when all endpoints are unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    const app = createApp()
    const res = await request(app)
      .post('/api/overpass')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('data=test')
    expect(res.status).toBe(503)
  })
})
