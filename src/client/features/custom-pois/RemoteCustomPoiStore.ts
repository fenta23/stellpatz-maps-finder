import type { SupabaseClient } from '@supabase/supabase-js'
import type { CustomPoi } from './CustomPoi.js'
import type { ICustomPoiStore } from './CustomPoiStore.js'
import { LocalCustomPoiStore } from './CustomPoiStore.js'

/** Remote persistence for custom POIs. All ops are async and may reject. */
export interface CustomPoiBackend {
  load(): Promise<readonly CustomPoi[]>
  upsert(poi: CustomPoi): Promise<void>
  remove(id: string): Promise<void>
}

/**
 * Custom-POI store with the same synchronous interface as the local one, backed
 * by a local mirror that is authoritative for reads. When connected (on login),
 * writes go through to the backend in the background and the mirror is merged
 * with the server set. Sync failures never block the UI.
 *
 * Mirrors SyncedNotesStore / SyncedFavoritesStore.
 */
export class SyncedCustomPoiStore implements ICustomPoiStore {
  private backend: CustomPoiBackend | null = null

  constructor(private readonly local: LocalCustomPoiStore = new LocalCustomPoiStore()) {}

  get(id: string): CustomPoi | undefined { return this.local.get(id) }
  getAll(): readonly CustomPoi[] { return this.local.getAll() }
  onChange(cb: () => void): () => void { return this.local.onChange(cb) }

  put(poi: CustomPoi): void {
    this.local.put(poi)
    void this.backend?.upsert(poi).catch(err => console.warn('[custom-pois] remote sync failed:', err))
  }

  addMany(pois: Iterable<CustomPoi>): void {
    this.local.addMany(pois)
    const copy = [...pois]
    if (this.backend) {
      void Promise.allSettled(copy.map(poi => this.backend!.upsert(poi)))
        .catch(err => console.warn('[custom-pois] remote sync failed:', err))
    }
  }

  remove(id: string): void {
    this.local.remove(id)
    void this.backend?.remove(id).catch(err => console.warn('[custom-pois] remote sync failed:', err))
  }

  /**
   * Attach a backend on login: pull server POIs into the local mirror (server
   * extras are added), then push back only POIs that are new or locally modified
   * since the last sync. For ids present on both, the local copy wins — we never
   * silently discard a POI the user just created offline.
   */
  async connect(backend: CustomPoiBackend): Promise<void> {
    if (this.backend) return
    this.backend = backend
    let remote: readonly CustomPoi[]
    try {
      remote = await backend.load()
    } catch (err) {
      console.warn('[custom-pois] remote load failed:', err)
      return
    }
    const remoteById = new Map(remote.map(p => [p.id, p]))
    this.local.addMany(remote) // additive: local edits win ties, server extras pulled in
    const toPush = this.local.getAll().filter(poi => {
      const r = remoteById.get(poi.id)
      return !r || poi.updatedAt > r.updatedAt
    })
    if (toPush.length > 0) {
      await Promise.allSettled(toPush.map(poi => backend.upsert(poi)))
    }
  }

  /** Detach on logout; the local mirror stays as the guest set. */
  disconnect(): void {
    this.backend = null
  }
}

interface CustomPoiRow {
  id: unknown
  icon_id: unknown
  lat: unknown
  lon: unknown
  name: unknown
  data: unknown
}

/** Fields that live in the `data` jsonb column rather than dedicated columns. */
type CustomPoiData = Omit<CustomPoi, 'id' | 'iconId' | 'lat' | 'lon' | 'name'>

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)

function rowToCustomPoi(row: CustomPoiRow): CustomPoi {
  const data = (row.data && typeof row.data === 'object' ? row.data : {}) as Record<string, unknown>
  const now = Date.now()
  return {
    id: String(row.id),
    iconId: typeof row.icon_id === 'string' ? row.icon_id : 'parking',
    lat: Number(row.lat),
    lon: Number(row.lon),
    name: typeof row.name === 'string' ? row.name : '',
    street: str(data['street']),
    housenumber: str(data['housenumber']),
    postcode: str(data['postcode']),
    city: str(data['city']),
    phone: str(data['phone']),
    email: str(data['email']),
    website: str(data['website']),
    fee: str(data['fee']),
    capacity: str(data['capacity']),
    openingHours: str(data['openingHours']),
    operator: str(data['operator']),
    description: str(data['description']),
    note: str(data['note']),
    createdAt: typeof data['createdAt'] === 'number' ? data['createdAt'] as number : now,
    updatedAt: typeof data['updatedAt'] === 'number' ? data['updatedAt'] as number : now,
  }
}

function toData(poi: CustomPoi): CustomPoiData {
  const { id: _id, iconId: _icon, lat: _lat, lon: _lon, name: _name, ...rest } = poi
  return rest
}

/** Supabase-backed custom POIs, fenced per-user by RLS (auth.uid() = user_id). */
export function createSupabaseCustomPoiBackend(client: SupabaseClient, userId: string): CustomPoiBackend {
  return {
    async load() {
      const { data, error } = await client.from('custom_pois').select('id,icon_id,lat,lon,name,data')
      if (error) throw new Error(error.message)
      return (data ?? []).map(row => rowToCustomPoi(row as CustomPoiRow))
    },
    async upsert(poi) {
      const { error } = await client.from('custom_pois').upsert(
        { user_id: userId, id: poi.id, icon_id: poi.iconId, lat: poi.lat, lon: poi.lon, name: poi.name, data: toData(poi) },
        { onConflict: 'user_id,id' },
      )
      if (error) throw new Error(error.message)
    },
    async remove(id) {
      const { error } = await client.from('custom_pois').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
  }
}
