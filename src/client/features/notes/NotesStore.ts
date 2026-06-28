import type { OsmPoi, PoiType } from '@/features/pois/OverpassClient.js'

/** A personal note attached to a POI, snapshotted so the list can render + navigate. */
export interface PoiNote {
  readonly id: string
  readonly type: PoiType
  readonly name: string
  readonly lat: number
  readonly lon: number
  readonly text: string
}

/** The POI context needed to attach a note (everything but the text). */
export type NoteTarget = Omit<PoiNote, 'text'>

export interface INotesStore {
  /** The note text for a POI, or '' if none. */
  get(id: string): string
  has(id: string): boolean
  /** Set (trimmed) note text; empty text removes the note. Returns the saved text. */
  set(target: NoteTarget, text: string): string
  remove(id: string): void
  /** All notes — for the list view. */
  list(): readonly PoiNote[]
  onChange(cb: () => void): () => void
}

/** Snapshot a live POI into the note target shape. */
export function toNoteTarget(poi: OsmPoi): NoteTarget {
  return { id: String(poi.id), type: poi.type, name: poi.tags.name ?? '', lat: poi.lat, lon: poi.lon }
}

/** Rebuild a minimal OsmPoi from a note, enough to select + route to it. */
export function noteToPoi(note: PoiNote): OsmPoi {
  return {
    id: Number(note.id),
    type: note.type,
    lat: note.lat,
    lon: note.lon,
    tags: note.name ? { name: note.name } : {},
  }
}

function isPoiNote(value: unknown): value is PoiNote {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v['id'] === 'string' && typeof v['text'] === 'string'
}

export class LocalNotesStore implements INotesStore {
  private static readonly KEY = 'stellplatz-notes'
  private notes: Map<string, PoiNote>
  private readonly listeners: Array<() => void> = []

  constructor() {
    this.notes = new Map()
    try {
      const raw = localStorage.getItem(LocalNotesStore.KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : []
      if (Array.isArray(parsed)) {
        for (const entry of parsed) if (isPoiNote(entry)) this.notes.set(entry.id, entry)
      }
    } catch {
      this.notes = new Map()
    }
  }

  get(id: string): string {
    return this.notes.get(id)?.text ?? ''
  }

  has(id: string): boolean {
    return this.notes.has(id)
  }

  set(target: NoteTarget, text: string): string {
    const trimmed = text.trim()
    if (!trimmed) {
      this.remove(target.id)
      return ''
    }
    this.notes.set(target.id, { ...target, text: trimmed })
    this.persist()
    this.notify()
    return trimmed
  }

  remove(id: string): void {
    if (this.notes.delete(id)) {
      this.persist()
      this.notify()
    }
  }

  /** Merge several notes in at once (no removal); persists + notifies once if changed. */
  addMany(incoming: Iterable<PoiNote>): void {
    let changed = false
    for (const note of incoming) {
      if (!this.notes.has(note.id)) {
        this.notes.set(note.id, note)
        changed = true
      }
    }
    if (changed) {
      this.persist()
      this.notify()
    }
  }

  /** Replace the entire set atomically; persists + notifies once. */
  replaceAll(notes: Iterable<PoiNote>): void {
    this.notes = new Map()
    for (const n of notes) this.notes.set(n.id, n)
    this.persist()
    this.notify()
  }

  list(): readonly PoiNote[] {
    return [...this.notes.values()]
  }

  onChange(cb: () => void): () => void {
    this.listeners.push(cb)
    return () => {
      const idx = this.listeners.indexOf(cb)
      if (idx !== -1) this.listeners.splice(idx, 1)
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(LocalNotesStore.KEY, JSON.stringify([...this.notes.values()]))
    } catch { /* ignore quota errors */ }
  }

  private notify(): void {
    for (const cb of this.listeners) cb()
  }
}
