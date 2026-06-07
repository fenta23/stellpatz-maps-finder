// Pluggable async POI cache. The Overpass route reads/writes through this
// interface so the backing store (in-memory vs Supabase Postgres) is swappable.
// A cache must NEVER throw into the request path — implementations swallow errors.

export interface PoiCache {
  get(key: string): Promise<unknown | null>
  set(key: string, data: unknown): Promise<void>
}

/** In-memory cache with TTL + insertion-order eviction.
 *  Used locally and as the fallback when no persistent store is configured.
 *  Note: lost on every process restart (Render free tier sleeps → cold cache). */
export function createInMemoryCache(ttlMs: number, maxEntries: number): PoiCache {
  const store = new Map<string, { data: unknown; expiresAt: number }>()
  return {
    async get(key) {
      const entry = store.get(key)
      return entry !== undefined && entry.expiresAt > Date.now() ? entry.data : null
    },
    async set(key, data) {
      store.set(key, { data, expiresAt: Date.now() + ttlMs })
      if (store.size > maxEntries) {
        store.delete(store.keys().next().value!) // oldest (insertion order)
      }
    },
  }
}
