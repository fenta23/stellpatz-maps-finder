import type { PoiCache } from './cache.js'

// Persistent POI cache backed by Supabase Postgres via PostgREST (no SDK needed).
// Express uses the service-role key, which bypasses RLS. Survives restarts and
// holds far more than the in-memory cache, so the TTL can be long (days) —
// OSM POIs change slowly. All failures are swallowed: the cache is best-effort
// and must never break the map request.

export interface SupabaseCacheOptions {
  readonly url: string // e.g. https://xxxx.supabase.co
  readonly serviceKey: string
  readonly ttlMs: number
  /** Injectable for tests. */
  readonly fetchImpl?: typeof fetch
}

interface CacheRow {
  data: unknown
  fetched_at: string
}

export function createSupabaseCache(opts: SupabaseCacheOptions): PoiCache {
  const doFetch = opts.fetchImpl ?? fetch
  const endpoint = `${opts.url.replace(/\/+$/, '')}/rest/v1/poi_cache`
  const headers = {
    apikey: opts.serviceKey,
    Authorization: `Bearer ${opts.serviceKey}`,
    'Content-Type': 'application/json',
  }

  return {
    async get(key) {
      try {
        const url = `${endpoint}?key=eq.${encodeURIComponent(key)}&select=data,fetched_at`
        const res = await doFetch(url, { headers, signal: AbortSignal.timeout(5000) })
        if (!res.ok) return null
        const rows = await res.json() as CacheRow[]
        const row = rows[0]
        if (!row) return null
        const ageMs = Date.now() - new Date(row.fetched_at).getTime()
        return ageMs <= opts.ttlMs ? row.data : null // expired → treat as miss
      } catch {
        return null
      }
    },

    async set(key, data) {
      try {
        await doFetch(endpoint, {
          method: 'POST',
          headers: { ...headers, Prefer: 'resolution=merge-duplicates' }, // upsert on PK
          body: JSON.stringify({ key, data, fetched_at: new Date().toISOString() }),
          signal: AbortSignal.timeout(5000),
        })
      } catch {
        // best-effort write
      }
    },
  }
}
