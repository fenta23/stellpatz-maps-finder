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
 * writes go through to the backend in the background. On connect, server state
 * is reconciled with the local mirror using a persisted synced-IDs set so that
 * deletions on another device are respected (even across page reloads). For
 * shared IDs the local version wins.
 * A 30 s polling interval keeps the store in sync. Sync failures never block the UI.
 */
export class SyncedCustomPoiStore implements ICustomPoiStore {
  private backend: CustomPoiBackend | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private static readonly SYNCED_IDS_KEY = 'stellplatz:custom-pois-synced-ids'
  private syncedIds: Set<string> = new Set()

  constructor(private readonly local: LocalCustomPoiStore = new LocalCustomPoiStore()) {
    this.loadSyncedIds()
  }

  get(id: string): CustomPoi | undefined { return this.local.get(id) }
  getAll(): readonly CustomPoi[] { return this.local.getAll() }
  onChange(cb: () => void): () => void { return this.local.onChange(cb) }

  put(poi: CustomPoi): void {
    this.local.put(poi)
    void this.backend?.upsert(poi).then(() => {
      this.syncedIds.add(poi.id)
      this.saveSyncedIds()
    }).catch(err => console.warn('[custom-pois] remote sync failed:', err))
  }

  addMany(pois: Iterable<CustomPoi>): void {
    this.local.addMany(pois)
    const copy = [...pois]
    if (this.backend) {
      void Promise.allSettled(copy.map(poi => this.backend!.upsert(poi)))
        .then(() => {
          for (const p of copy) this.syncedIds.add(p.id)
          this.saveSyncedIds()
        })
        .catch(err => console.warn('[custom-pois] remote sync failed:', err))
    }
  }

  remove(id: string): void {
    this.local.remove(id)
    void this.backend?.remove(id).then(() => {
      this.syncedIds.delete(id)
      this.saveSyncedIds()
    }).catch(err => console.warn('[custom-pois] remote sync failed:', err))
  }

  async connect(backend: CustomPoiBackend): Promise<void> {
    if (this.backend) return
    this.backend = backend
    await this.reconcile()
    this.startPolling()
  }

  /** Detach on logout; the local mirror stays as the guest set. */
  disconnect(): void {
    this.backend = null
    this.stopPolling()
  }

  private async reconcile(): Promise<void> {
    const backend = this.backend
    if (!backend) return
    let remote: readonly CustomPoi[]
    try {
      remote = await backend.load()
    } catch (err) {
      console.warn('[custom-pois] remote load failed:', err)
      return
    }
    const remoteById = new Map(remote.map(p => [p.id, p]))
    const localAll = this.local.getAll()

    // True guest-only: local items not on server and never synced.
    const guestOnly = localAll.filter(
      p => !remoteById.has(p.id) && !this.syncedIds.has(p.id),
    )

    // Build final set: for items previously synced, server is authoritative;
    // for items never synced, local wins (preserves offline creations/edits).
    // Items that were previously synced but absent from the server are dropped.
    const final = new Map<string, CustomPoi>()
    for (const r of remote) {
      const local = localAll.find(p => p.id === r.id)
      if (local && this.syncedIds.has(r.id)) {
        final.set(r.id, r)
      } else {
        final.set(r.id, local ?? r)
      }
    }
    for (const g of guestOnly) final.set(g.id, g)

    this.local.replaceAll(final.values())

    // Push guest-only items and locally-modified-but-unsynced shared items up.
    // Items already in syncedIds are NOT pushed — the server is authoritative.
    const modifiedUnsynced = localAll.filter(p => {
      const r = remoteById.get(p.id)
      return r && !this.syncedIds.has(p.id) && p.updatedAt > r.updatedAt
    })
    const toPush = [...guestOnly, ...modifiedUnsynced]
    if (toPush.length > 0) {
      await Promise.allSettled(toPush.map(poi => backend.upsert(poi)))
    }

    // Update synced IDs.
    for (const r of remote) this.syncedIds.add(r.id)
    for (const p of toPush) this.syncedIds.add(p.id)
    this.saveSyncedIds()
  }

  private startPolling(): void {
    this.stopPolling()
    this.pollTimer = setInterval(() => { void this.reconcile() }, 30_000)
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  private loadSyncedIds(): void {
    try {
      const raw = localStorage.getItem(SyncedCustomPoiStore.SYNCED_IDS_KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : []
      this.syncedIds = new Set(
        Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [],
      )
    } catch {
      this.syncedIds = new Set()
    }
  }

  private saveSyncedIds(): void {
    try {
      localStorage.setItem(
        SyncedCustomPoiStore.SYNCED_IDS_KEY,
        JSON.stringify([...this.syncedIds]),
      )
    } catch { /* ignore quota */ }
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
      const { error } = await client.from('custom_pois').delete().eq('user_id', userId).eq('id', id)
      if (error) throw new Error(error.message)
    },
  }
}
