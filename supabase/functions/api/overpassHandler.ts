import { jsonResponse, errorResponse, snapBboxInQuery, isValidPoiQuery, OVERPASS_ENDPOINTS, USER_AGENT, POI_CACHE_TTL_MS, getSupabase } from '../_shared/utils.ts'

export async function handleOverpass(req: Request, origin: string | null): Promise<Response> {
  const bodyText = await req.text()
  const rawQuery = decodeURIComponent(bodyText.startsWith('data=') ? bodyText.slice(5) : bodyText)

  if (!isValidPoiQuery(rawQuery)) {
    return errorResponse('Unsupported query shape', 400, origin)
  }

  const snappedQuery = snapBboxInQuery(rawQuery)

  const supabase = await getSupabase()
  if (supabase) {
    const cached = await checkCache(supabase, snappedQuery)
    if (cached !== null) return jsonResponse(cached, 200, origin)
  }

  const body = 'data=' + encodeURIComponent(snappedQuery)
  const n = OVERPASS_ENDPOINTS.length
  let endpointIdx = 0

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

      if (upstream.status === 429 || upstream.status >= 500) {
        if (!isLast) continue
        return jsonResponse(
          { error: 'Overpass unavailable on all endpoints' },
          upstream.status === 429 ? 429 : 503,
          origin,
        )
      }
      if (!upstream.ok) {
        return errorResponse(`Overpass error: ${upstream.statusText}`, upstream.status, origin)
      }

      const data = await upstream.json() as unknown
      if (supabase) await setCache(supabase, snappedQuery, data)
      return jsonResponse(data, 200, origin)
    } catch {
      if (!isLast) continue
      return errorResponse('All Overpass endpoints unreachable', 503, origin)
    }
  }

  return errorResponse('All Overpass endpoints unreachable', 503, origin)
}

async function checkCache(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabase>>>,
  key: string,
): Promise<unknown | null> {
  try {
    const { data, error } = await supabase
      .from('poi_cache')
      .select('data, fetched_at')
      .eq('key', key)
      .single()

    if (error || !data) return null
    const ageMs = Date.now() - new Date(data.fetched_at as string).getTime()
    return ageMs <= POI_CACHE_TTL_MS ? (data.data as unknown) : null
  } catch {
    return null
  }
}

async function setCache(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabase>>>,
  key: string,
  data: unknown,
): Promise<void> {
  try {
    await supabase
      .from('poi_cache')
      .upsert({ key, data, fetched_at: new Date().toISOString() })
  } catch {
    // best-effort write
  }
}
