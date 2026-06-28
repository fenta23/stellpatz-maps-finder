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
 * Filter store with the same synchronous interface as the local one, backed by a
 * local mirror that is authoritative for reads. On login, server records are merged
 * into the mirror (local customisations win) and the union is pushed back up.
 * Sync failures never block the UI. Mirrors SyncedCustomPoiStore.
 */
export class SyncedFilterStore implements IFilterStore {
  private backend: FilterBackend | null = null

  constructor(private readonly local: LocalFilterStore = new LocalFilterStore()) {}

  list(): readonly FilterDef[] { return this.local.list() }
  get(id: string): FilterDef | undefined { return this.local.get(id) }
  osmFilters(): readonly FilterDef[] { return this.local.osmFilters() }
  osmSignature(): string { return this.local.osmSignature() }
  isBuiltin(id: string): boolean { return this.local.isBuiltin(id) }
  onChange(cb: () => void): () => void { return this.local.onChange(cb) }

  put(def: FilterDef): void {
    this.local.put(def)
    const stored = this.local.get(def.id)
    if (stored) void this.backend?.upsert(stored).catch(err => console.warn('[filters] remote sync failed:', err))
  }

  remove(id: string): void {
    const wasBuiltin = this.local.isBuiltin(id)
    this.local.remove(id)
    // Built-ins are reset (their override row is dropped); user filters are deleted.
    if (wasBuiltin) {
      const reset = this.local.get(id)
      if (reset) void this.backend?.upsert(reset).catch(err => console.warn('[filters] remote sync failed:', err))
    } else {
      void this.backend?.remove(id).catch(err => console.warn('[filters] remote sync failed:', err))
    }
  }

  setEnabled(id: string, enabled: boolean): void {
    this.local.setEnabled(id, enabled)
    const stored = this.local.get(id)
    if (stored) void this.backend?.upsert(stored).catch(err => console.warn('[filters] remote sync failed:', err))
  }

  setHidden(id: string, hidden: boolean): void {
    this.local.setHidden(id, hidden)
    const stored = this.local.get(id)
    if (stored) void this.backend?.upsert(stored).catch(err => console.warn('[filters] remote sync failed:', err))
  }

  async connect(backend: FilterBackend): Promise<void> {
    if (this.backend) return
    this.backend = backend
    let remote: readonly FilterDef[]
    try {
      remote = await backend.load()
    } catch (err) {
      console.warn('[filters] remote load failed:', err)
      return
    }
    const remoteById = new Map(remote.map(d => [d.id, d]))
    this.local.applyRemote(remote) // additive: local customisations win ties
    const toPush = this.local.records_().filter(def => {
      const r = remoteById.get(def.id)
      return !r || JSON.stringify(stableJson(def)) !== JSON.stringify(stableJson(r))
    })
    if (toPush.length > 0) {
      await Promise.allSettled(toPush.map(def => backend.upsert(def)))
    }
  }

  disconnect(): void {
    this.backend = null
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
      const { error } = await client.from('poi_filters').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
  }
}
