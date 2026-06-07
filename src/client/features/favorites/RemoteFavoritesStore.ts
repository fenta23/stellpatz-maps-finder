import type { SupabaseClient } from '@supabase/supabase-js'
import type { IFavoritesStore } from './FavoritesStore.js'
import { LocalFavoritesStore } from './FavoritesStore.js'

/** Remote persistence for favorites. All ops are async and may reject. */
export interface FavoritesBackend {
  load(): Promise<readonly string[]>
  add(id: string): Promise<void>
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

  onChange(cb: () => void): () => void {
    return this.local.onChange(cb)
  }

  toggle(id: string): boolean {
    const isFavorite = this.local.toggle(id)
    const backend = this.backend
    if (backend) {
      const op = isFavorite ? backend.add(id) : backend.remove(id)
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
    let remote: readonly string[]
    try {
      remote = await backend.load()
    } catch (err) {
      console.warn('[favorites] remote load failed:', err)
      return
    }
    const remoteSet = new Set(remote)
    const guestOnly = [...this.local.getAll()].filter(id => !remoteSet.has(id))
    this.local.addMany(remote)
    await Promise.allSettled(guestOnly.map(id => backend.add(id)))
  }

  /** Detach on logout; the local mirror stays as the guest set. */
  disconnect(): void {
    this.backend = null
  }
}

/** Supabase-backed favorites, fenced per-user by RLS (auth.uid() = user_id). */
export function createSupabaseFavoritesBackend(
  client: SupabaseClient,
  userId: string,
): FavoritesBackend {
  return {
    async load() {
      const { data, error } = await client.from('favorites').select('poi_id')
      if (error) throw new Error(error.message)
      return (data ?? []).map(row => String((row as { poi_id: unknown }).poi_id))
    },
    async add(id) {
      const { error } = await client
        .from('favorites')
        .upsert({ user_id: userId, poi_id: id }, { onConflict: 'user_id,poi_id' })
      if (error) throw new Error(error.message)
    },
    async remove(id) {
      const { error } = await client.from('favorites').delete().eq('poi_id', id)
      if (error) throw new Error(error.message)
    },
  }
}
