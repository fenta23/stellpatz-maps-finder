import type { SupabaseClient } from '@supabase/supabase-js'
import type { FilterDef } from './filterModel.js'
import type { IFilterStore } from './FilterStore.js'
import { LocalFilterStore } from './FilterStore.js'

function stableJson(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stableJson)
  if (v && typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, val]) => [k, stableJson(val)] as const)
    return Object.fromEntries(entries)
  }
  return v
}

/** Remote persistence for filter definitions. All ops are async and may reject. */
export interface FilterBackend {
  load(): Promise<readonly FilterDef[]>
  upsert(def: FilterDef): Promise<void>
  remove(id: string): Promise<void>
}

/**
 * Filter store with the same synchronous interface as the local one, backed by
 * a local mirror that is authoritative for reads. On connect, server records are
 * reconciled with the local mirror using a persisted synced-IDs set so that
 * deletions on another device are respected. For shared IDs the local version wins.
 * A 30 s polling interval keeps the store in sync. Sync failures never block the UI.
 */
export class SyncedFilterStore implements IFilterStore {
  private backend: FilterBackend | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private static readonly SYNCED_IDS_KEY = 'stellplatz:filters-synced-ids'
  private syncedIds: Set<string> = new Set()

  constructor(private readonly local: LocalFilterStore = new LocalFilterStore()) {
    this.loadSyncedIds()
  }

  list(): readonly FilterDef[] { return this.local.list() }
  get(id: string): FilterDef | undefined { return this.local.get(id) }
  osmFilters(): readonly FilterDef[] { return this.local.osmFilters() }
  osmSignature(): string { return this.local.osmSignature() }
  isBuiltin(id: string): boolean { return this.local.isBuiltin(id) }
  onChange(cb: () => void): () => void { return this.local.onChange(cb) }

  put(def: FilterDef): void {
    this.local.put(def)
    const stored = this.local.get(def.id)
    if (stored) {
      void this.backend?.upsert(stored).then(() => {
        this.syncedIds.add(def.id)
        this.saveSyncedIds()
      }).catch(err => console.warn('[filters] remote sync failed:', err))
    }
  }

  remove(id: string): void {
    const wasBuiltin = this.local.isBuiltin(id)
    this.local.remove(id)
    if (wasBuiltin) {
      const reset = this.local.get(id)
      if (reset) {
        void this.backend?.upsert(reset).then(() => {
          this.syncedIds.add(id)
          this.saveSyncedIds()
        }).catch(err => console.warn('[filters] remote sync failed:', err))
      }
    } else {
      void this.backend?.remove(id).then(() => {
        this.syncedIds.delete(id)
        this.saveSyncedIds()
      }).catch(err => console.warn('[filters] remote sync failed:', err))
    }
  }

  setEnabled(id: string, enabled: boolean): void {
    this.local.setEnabled(id, enabled)
    const stored = this.local.get(id)
    if (stored) {
      void this.backend?.upsert(stored).then(() => {
        this.syncedIds.add(id)
        this.saveSyncedIds()
      }).catch(err => console.warn('[filters] remote sync failed:', err))
    }
  }

  setHidden(id: string, hidden: boolean): void {
    this.local.setHidden(id, hidden)
    const stored = this.local.get(id)
    if (stored) {
      void this.backend?.upsert(stored).then(() => {
        this.syncedIds.add(id)
        this.saveSyncedIds()
      }).catch(err => console.warn('[filters] remote sync failed:', err))
    }
  }

  async connect(backend: FilterBackend): Promise<void> {
    if (this.backend) return
    this.backend = backend
    await this.reconcile()
    this.startPolling()
  }

  disconnect(): void {
    this.backend = null
    this.stopPolling()
  }

  private async reconcile(): Promise<void> {
    const backend = this.backend
    if (!backend) return
    let remote: readonly FilterDef[]
    try {
      remote = await backend.load()
    } catch (err) {
      console.warn('[filters] remote load failed:', err)
      return
    }
    const remoteById = new Map(remote.map(d => [d.id, d]))
    const localRecords = this.local.records_()

    // True guest-only: local records not on server and never synced.
    const guestOnly = localRecords.filter(
      d => !remoteById.has(d.id) && !this.syncedIds.has(d.id),
    )

    // Build final set: for items previously synced, server is authoritative;
    // for items never synced, local wins (preserves offline creations/edits).
    // Items that were previously synced but absent from the server are dropped.
    const final = new Map<string, FilterDef>()
    for (const r of remote) {
      const local = localRecords.find(d => d.id === r.id)
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
    const modifiedUnsynced = localRecords.filter(d => {
      const r = remoteById.get(d.id)
      return r && !this.syncedIds.has(d.id) && JSON.stringify(stableJson(d)) !== JSON.stringify(stableJson(r))
    })
    const toPush = [...guestOnly, ...modifiedUnsynced]
    if (toPush.length > 0) {
      await Promise.allSettled(toPush.map(def => backend.upsert(def)))
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
      const raw = localStorage.getItem(SyncedFilterStore.SYNCED_IDS_KEY)
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
      localStorage.setItem(SyncedFilterStore.SYNCED_IDS_KEY, JSON.stringify([...this.syncedIds]))
    } catch { /* ignore quota */ }
  }
}

interface FilterRow {
  id: unknown
  data: unknown
}

/** Supabase-backed filter defs, fenced per-user by RLS (auth.uid() = user_id). */
export function createSupabaseFilterBackend(client: SupabaseClient, userId: string): FilterBackend {
  return {
    async load() {
      const { data, error } = await client.from('poi_filters').select('id,data')
      if (error) throw new Error(error.message)
      return (data ?? [])
        .map(row => (row as FilterRow).data)
        .filter((d): d is FilterDef => !!d && typeof d === 'object')
    },
    async upsert(def) {
      const { error } = await client.from('poi_filters').upsert(
        { user_id: userId, id: def.id, data: def },
        { onConflict: 'user_id,id' },
      )
      if (error) throw new Error(error.message)
    },
    async remove(id) {
      const { error } = await client.from('poi_filters').delete().eq('user_id', userId).eq('id', id)
      if (error) throw new Error(error.message)
    },
  }
}
