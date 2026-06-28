import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Must mock before importing routeHandler because its dependency
// _shared/utils.ts uses Deno.env and npm: imports which don't resolve in Node.
vi.mock('../_shared/utils.ts', () => {
  const jsonResponse = (data: unknown, status = 200, _origin: string | null = null) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
  const errorResponse = (msg: string, status = 400, _origin: string | null = null) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json' } })
  const parseLatLon = (latRaw: unknown, lonRaw: unknown) => {
    if (typeof latRaw !== 'string' || typeof lonRaw !== 'string') return null
    const lat = Number(latRaw)
    const lon = Number(lonRaw)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
    return { lat, lon }
  }
  return { jsonResponse, errorResponse, parseLatLon, USER_AGENT: 'test/1.0' }
})

import { handleRoute } from './routeHandler.ts'

const OSRM_RESPONSE = {
  code: 'Ok',
  routes: [{
    distance: 2944,
    duration: 419.7,
    geometry: {
      coordinates: [[13.408623, 52.51907], [13.408712, 52.519001]],
    },
  }],
}

function buildRequest(params: Record<string, string> = {}): Request {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  return new Request(`https://example.com/api/route${qs ? '?' + qs : ''}`)
}

function mockOsrmResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('handleRoute', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ── Success ────────────────────────────────────────────────────────────

  it('returns OSRM response for valid driving route', async () => {
    vi.mocked(fetch).mockResolvedValue(mockOsrmResponse(OSRM_RESPONSE))

    const req = buildRequest({ from: '52.52,13.41', to: '52.50,13.40', mode: 'driving' })
    const res = await handleRoute(req, null)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.code).toBe('Ok')
    expect(body.routes[0].distance).toBe(2944)
    expect(body.routes[0].duration).toBe(419.7)

    const fetchCall = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(fetchCall[0]).toContain('/routed-car/route/v1/driving/')
    expect(fetchCall[0]).toContain('13.41,52.52;13.4,52.5')
  })

  it('maps cycling mode to bike profile', async () => {
    vi.mocked(fetch).mockResolvedValue(mockOsrmResponse(OSRM_RESPONSE))

    const req = buildRequest({ from: '52.52,13.41', to: '52.50,13.40', mode: 'cycling' })
    await handleRoute(req, null)

    const fetchCall = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(fetchCall[0]).toContain('/routed-bike/')
  })

  it('maps foot mode to foot profile', async () => {
    vi.mocked(fetch).mockResolvedValue(mockOsrmResponse(OSRM_RESPONSE))

    const req = buildRequest({ from: '52.52,13.41', to: '52.50,13.40', mode: 'foot' })
    await handleRoute(req, null)

    const fetchCall = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(fetchCall[0]).toContain('/routed-foot/')
  })

  it('defaults to driving when mode is missing', async () => {
    vi.mocked(fetch).mockResolvedValue(mockOsrmResponse(OSRM_RESPONSE))

    const req = buildRequest({ from: '52.52,13.41', to: '52.50,13.40' })
    await handleRoute(req, null)

    const fetchCall = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(fetchCall[0]).toContain('/routed-car/route/v1/driving/')
  })

  it('defaults to driving for unknown mode', async () => {
    vi.mocked(fetch).mockResolvedValue(mockOsrmResponse(OSRM_RESPONSE))

    const req = buildRequest({ from: '52.52,13.41', to: '52.50,13.40', mode: 'rocket' })
    await handleRoute(req, null)

    const fetchCall = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(fetchCall[0]).toContain('/routed-car/route/v1/driving/')
  })

  it('includes geometries=geojson in OSRM request', async () => {
    vi.mocked(fetch).mockResolvedValue(mockOsrmResponse(OSRM_RESPONSE))

    const req = buildRequest({ from: '52.52,13.41', to: '52.50,13.40' })
    await handleRoute(req, null)

    const fetchCall = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(fetchCall[0]).toContain('routing.openstreetmap.de')
    expect(fetchCall[0]).toContain('geometries=geojson')
    expect(fetchCall[0]).toContain('overview=full')
  })

  // ── Validation errors (400) ────────────────────────────────────────────

  it('returns 400 when from is missing', async () => {
    const req = buildRequest({ to: '52.50,13.40' })
    const res = await handleRoute(req, null)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('from')
  })

  it('returns 400 when to is missing', async () => {
    const req = buildRequest({ from: '52.52,13.41' })
    const res = await handleRoute(req, null)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('from')
  })

  it('returns 400 for invalid latitude', async () => {
    const req = buildRequest({ from: '99,13.41', to: '52.50,13.40' })
    const res = await handleRoute(req, null)

    expect(res.status).toBe(400)
  })

  it('returns 400 for non-numeric coordinates', async () => {
    const req = buildRequest({ from: 'abc,def', to: '52.50,13.40' })
    const res = await handleRoute(req, null)

    expect(res.status).toBe(400)
  })

  // ── Upstream errors ────────────────────────────────────────────────────

  it('returns upstream status when OSRM responds with error', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('Internal Server Error', { status: 500 }),
    )

    const req = buildRequest({ from: '52.52,13.41', to: '52.50,13.40' })
    const res = await handleRoute(req, null)

    expect(res.status).toBe(500)
  })

  it('returns 502 when OSRM returns no route', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockOsrmResponse({ code: 'NoRoute', routes: [] }),
    )

    const req = buildRequest({ from: '52.52,13.41', to: '52.50,13.40' })
    const res = await handleRoute(req, null)

    expect(res.status).toBe(502)
  })

  it('returns 502 when OSRM response has no routes array', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockOsrmResponse({ code: 'Ok' }),
    )

    const req = buildRequest({ from: '52.52,13.41', to: '52.50,13.40' })
    const res = await handleRoute(req, null)

    expect(res.status).toBe(502)
  })

  // ── Network / timeout errors ───────────────────────────────────────────

  it('returns 504 on timeout', async () => {
    vi.mocked(fetch).mockRejectedValue(
      new DOMException('The operation was aborted', 'TimeoutError'),
    )

    const req = buildRequest({ from: '52.52,13.41', to: '52.50,13.40' })
    const res = await handleRoute(req, null)

    expect(res.status).toBe(504)
    const body = await res.json()
    expect(body.error).toContain('time')
  })

  it('returns 503 on network error', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))

    const req = buildRequest({ from: '52.52,13.41', to: '52.50,13.40' })
    const res = await handleRoute(req, null)

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toContain('unreachable')
  })
})
