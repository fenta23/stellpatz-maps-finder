import type { SupabaseClient } from '@supabase/supabase-js'
import type { PoiType } from '@/features/pois/OverpassClient.js'
import type { INotesStore, NoteTarget, PoiNote } from './NotesStore.js'
import { LocalNotesStore } from './NotesStore.js'

/** Remote persistence for notes. All ops are async and may reject. */
export interface NotesBackend {
  load(): Promise<readonly PoiNote[]>
  upsert(note: PoiNote): Promise<void>
  remove(id: string): Promise<void>
}

/**
 * Notes store with the same synchronous interface, backed by a local mirror
 * that is authoritative for reads. When connected (on login), writes go through
 * to the backend in the background and the mirror is merged with the server
 * set. Sync failures never block the UI.
 */
export class SyncedNotesStore implements INotesStore {
  private backend: NotesBackend | null = null

  constructor(private readonly local: LocalNotesStore = new LocalNotesStore()) {}

  get(id: string): string { return this.local.get(id) }
  has(id: string): boolean { return this.local.has(id) }
  list(): readonly PoiNote[] { return this.local.list() }
  onChange(cb: () => void): () => void { return this.local.onChange(cb) }

  set(target: NoteTarget, text: string): string {
    const saved = this.local.set(target, text)
    const backend = this.backend
    if (backend) {
      const op = saved ? backend.upsert({ ...target, text: saved }) : backend.remove(target.id)
      void op.catch(err => console.warn('[notes] remote sync failed:', err))
    }
    return saved
  }

  remove(id: string): void {
    this.local.remove(id)
    void this.backend?.remove(id).catch(err => console.warn('[notes] remote sync failed:', err))
  }

  /**
   * Attach a backend on login: pull server notes into the local mirror (server
   * extras are added), then push back only notes that are new or locally modified.
   * For ids present on both, the local edit wins — we never silently discard a
   * note the user just typed.
   */
  async connect(backend: NotesBackend): Promise<void> {
    if (this.backend) return
    this.backend = backend
    let remote: readonly PoiNote[]
    try {
      remote = await backend.load()
    } catch (err) {
      console.warn('[notes] remote load failed:', err)
      return
    }
    const remoteById = new Map(remote.map(n => [n.id, n]))
    this.local.addMany(remote) // additive: local edits win ties, server extras pulled in
    const toPush = this.local.list().filter(note => {
      const r = remoteById.get(note.id)
      return !r || note.text !== r.text
    })
    if (toPush.length > 0) {
      await Promise.allSettled(toPush.map(note => backend.upsert(note)))
    }
  }

  /** Detach on logout; the local mirror stays as the guest set. */
  disconnect(): void {
    this.backend = null
  }
}

interface NoteRow {
  poi_id: unknown
  type: unknown
  name: unknown
  lat: unknown
  lon: unknown
  text: unknown
}

function rowToNote(row: NoteRow): PoiNote {
  return {
    id: String(row.poi_id),
    type: (row.type as PoiType) ?? 'parking',
    name: typeof row.name === 'string' ? row.name : '',
    lat: Number(row.lat),
    lon: Number(row.lon),
    text: typeof row.text === 'string' ? row.text : '',
  }
}

/** Supabase-backed notes, fenced per-user by RLS (auth.uid() = user_id). */
export function createSupabaseNotesBackend(client: SupabaseClient, userId: string): NotesBackend {
  return {
    async load() {
      const { data, error } = await client.from('notes').select('poi_id,type,name,lat,lon,text')
      if (error) throw new Error(error.message)
      return (data ?? []).map(row => rowToNote(row as NoteRow))
    },
    async upsert(note) {
      const { error } = await client.from('notes').upsert(
        { user_id: userId, poi_id: note.id, type: note.type, name: note.name, lat: note.lat, lon: note.lon, text: note.text },
        { onConflict: 'user_id,poi_id' },
      )
      if (error) throw new Error(error.message)
    },
    async remove(id) {
      const { error } = await client.from('notes').delete().eq('poi_id', id)
      if (error) throw new Error(error.message)
    },
  }
}
