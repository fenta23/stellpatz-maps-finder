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
 * to the backend in the background. On connect, server state is reconciled with
 * the local mirror using a persisted synced-IDs set so that deletions on another
 * device are respected (even across page reloads). For shared IDs the local
 * version wins — we never silently discard a note the user just typed.
 * A 30 s polling interval keeps the two in sync. Sync failures never block the UI.
 */
export class SyncedNotesStore implements INotesStore {
  private backend: NotesBackend | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private static readonly SYNCED_IDS_KEY = 'stellplatz-notes-synced-ids'
  private syncedIds: Set<string> = new Set()

  constructor(private readonly local: LocalNotesStore = new LocalNotesStore()) {
    this.loadSyncedIds()
  }

  get(id: string): string { return this.local.get(id) }
  has(id: string): boolean { return this.local.has(id) }
  list(): readonly PoiNote[] { return this.local.list() }
  onChange(cb: () => void): () => void { return this.local.onChange(cb) }

  set(target: NoteTarget, text: string): string {
    const saved = this.local.set(target, text)
    const backend = this.backend
    if (backend) {
      const op = saved ? backend.upsert({ ...target, text: saved }) : backend.remove(target.id)
      void op.then(() => {
        if (saved) { this.syncedIds.add(target.id); this.saveSyncedIds() }
        else { this.syncedIds.delete(target.id); this.saveSyncedIds() }
      }).catch(err => console.warn('[notes] remote sync failed:', err))
    }
    return saved
  }

  remove(id: string): void {
    this.local.remove(id)
    void this.backend?.remove(id).then(() => {
      this.syncedIds.delete(id)
      this.saveSyncedIds()
    }).catch(err => console.warn('[notes] remote sync failed:', err))
  }

  /**
   * Attach a backend on login: reconcile server state with the local mirror
   * using persisted synced IDs so that deletions performed on another device
   * are respected, then start polling.
   */
  async connect(backend: NotesBackend): Promise<void> {
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
    let remote: readonly PoiNote[]
    try {
      remote = await backend.load()
    } catch (err) {
      console.warn('[notes] remote load failed:', err)
      return
    }
    const remoteById = new Map(remote.map(n => [n.id, n]))
    const localList = this.local.list()

    // True guest-only: local items not on server and never synced.
    const guestOnly = localList.filter(
      n => !remoteById.has(n.id) && !this.syncedIds.has(n.id),
    )

    // Build final set: server items (local wins ties) + guest-only items.
    // Items that were previously synced but absent from the server are dropped.
    const final = new Map<string, PoiNote>()
    for (const r of remote) {
      const local = localList.find(n => n.id === r.id)
      final.set(r.id, local ?? r)
    }
    for (const g of guestOnly) final.set(g.id, g)

    this.local.replaceAll(final.values())

    // Push genuine guest items and locally modified shared items up.
    const modified = localList.filter(n => {
      const r = remoteById.get(n.id)
      return r && n.text !== r.text
    })
    const toPush = [...guestOnly, ...modified]
    if (toPush.length > 0) {
      await Promise.allSettled(toPush.map(n => backend.upsert(n)))
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
      const raw = localStorage.getItem(SyncedNotesStore.SYNCED_IDS_KEY)
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
      localStorage.setItem(SyncedNotesStore.SYNCED_IDS_KEY, JSON.stringify([...this.syncedIds]))
    } catch { /* ignore quota */ }
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
      const { error } = await client.from('notes').delete().eq('user_id', userId).eq('poi_id', id)
      if (error) throw new Error(error.message)
    },
  }
}
