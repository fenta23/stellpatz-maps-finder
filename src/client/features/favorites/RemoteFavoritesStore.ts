import type { SupabaseClient } from '@supabase/supabase-js'
import type { PoiType } from '@/features/pois/OverpassClient.js'
import type { FavoritePoi, IFavoritesStore } from './FavoritesStore.js'
import { LocalFavoritesStore } from './FavoritesStore.js'

/** Remote persistence for favorites. All ops are async and may reject. */
export interface FavoritesBackend {
  load(): Promise<readonly FavoritePoi[]>
  add(poi: FavoritePoi): Promise<void>
  remove(id: string): Promise<void>
}

/**
 * A favorites store with the same synchronous interface, backed by a local
 * mirror that is always authoritative for reads. When a remote backend is
 * connected (on login), toggles write through to it in the background and the
 * mirror is merged with the server set. Sync failures never block the UI.
 */
export class SyncedFavoritesStore implements IFavoritesStore {
  private backend: FavoritesBackend | null = null

  constructor(private readonly local: LocalFavoritesStore = new LocalFavoritesStore()) {}

  has(id: string): boolean {
    return this.local.has(id)
  }

  getAll(): ReadonlySet<string> {
    return this.local.getAll()
  }

  list(): readonly FavoritePoi[] {
    return this.local.list()
  }

  onChange(cb: () => void): () => void {
    return this.local.onChange(cb)
  }

  toggle(poi: FavoritePoi): boolean {
    const isFavorite = this.local.toggle(poi)
    const backend = this.backend
    if (backend) {
      const op = isFavorite ? backend.add(poi) : backend.remove(poi.id)
      void op.catch(err => console.warn('[favorites] remote sync failed:', err))
    }
    return isFavorite
  }

  /**
   * Attach a backend on login: pull the server favorites into the local mirror
   * and push any guest-only (local) favorites up to the server. Merge is a
   * union — nothing is deleted.
   */
  async connect(backend: FavoritesBackend): Promise<void> {
    this.backend = backend
    let remote: readonly FavoritePoi[]
    try {
      remote = await backend.load()
    } catch (err) {
      console.warn('[favorites] remote load failed:', err)
      return
    }
    const remoteIds = new Set(remote.map(p => p.id))
    const guestOnly = this.local.list().filter(p => !remoteIds.has(p.id))
    this.local.addMany(remote)
    await Promise.allSettled(guestOnly.map(poi => backend.add(poi)))
  }

  /** Detach on logout; the local mirror stays as the guest set. */
  disconnect(): void {
    this.backend = null
  }
}

interface FavoriteRow {
  poi_id: unknown
  type: unknown
  name: unknown
  lat: unknown
  lon: unknown
}

function rowToFavorite(row: FavoriteRow): FavoritePoi {
  return {
    id: String(row.poi_id),
    type: (row.type as PoiType) ?? 'parking',
    name: typeof row.name === 'string' ? row.name : '',
    lat: Number(row.lat),
    lon: Number(row.lon),
  }
}

/** Supabase-backed favorites, fenced per-user by RLS (auth.uid() = user_id). */
export function createSupabaseFavoritesBackend(
  client: SupabaseClient,
  userId: string,
): FavoritesBackend {
  return {
    async load() {
      const { data, error } = await client.from('favorites').select('poi_id,type,name,lat,lon')
      if (error) throw new Error(error.message)
      return (data ?? []).map(row => rowToFavorite(row as FavoriteRow))
    },
    async add(poi) {
      const { error } = await client.from('favorites').upsert(
        { user_id: userId, poi_id: poi.id, type: poi.type, name: poi.name, lat: poi.lat, lon: poi.lon },
        { onConflict: 'user_id,poi_id' },
      )
      if (error) throw new Error(error.message)
    },
    async remove(id) {
      const { error } = await client.from('favorites').delete().eq('poi_id', id)
      if (error) throw new Error(error.message)
    },
  }
}
