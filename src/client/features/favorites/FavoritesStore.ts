import type { PoiType } from '@/features/pois/OverpassClient.js'

/** A favorited POI, snapshotted so the list works without a live Overpass query. */
export interface FavoritePoi {
  readonly id: string
  readonly type: PoiType
  readonly name: string
  readonly lat: number
  readonly lon: number
}

export interface IFavoritesStore {
  has(id: string): boolean
  /** Add (when absent) or remove (when present) a favorite; returns the new state. */
  toggle(poi: FavoritePoi): boolean
  /** Favorite ids — for the map marker layer. */
  getAll(): ReadonlySet<string>
  /** Full favorite snapshots — for the list view. */
  list(): readonly FavoritePoi[]
  onChange(cb: () => void): () => void
}

function isFavoritePoi(value: unknown): value is FavoritePoi {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v['id'] === 'string' && typeof v['lat'] === 'number' && typeof v['lon'] === 'number'
}

export class LocalFavoritesStore implements IFavoritesStore {
  private static readonly KEY = 'stellplatz-favorites'
  private items: Map<string, FavoritePoi>
  private readonly listeners: Array<() => void> = []

  constructor() {
    this.items = new Map()
    try {
      const raw = localStorage.getItem(LocalFavoritesStore.KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : []
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (isFavoritePoi(entry)) {
            this.items.set(entry.id, entry)
          } else if (typeof entry === 'string') {
            // Legacy id-only favorite: keep the id so the map heart still shows,
            // but with no coordinates it can't appear in the list until re-saved.
            this.items.set(entry, { id: entry, type: 'parking', name: '', lat: 0, lon: 0 })
          }
        }
      }
    } catch {
      this.items = new Map()
    }
  }

  has(id: string): boolean {
    return this.items.has(id)
  }

  toggle(poi: FavoritePoi): boolean {
    if (this.items.has(poi.id)) {
      this.items.delete(poi.id)
    } else {
      this.items.set(poi.id, poi)
    }
    this.persist()
    this.notify()
    return this.items.has(poi.id)
  }

  /** Add several snapshots at once (no removal); persists + notifies once if changed. */
  addMany(pois: Iterable<FavoritePoi>): void {
    let changed = false
    for (const poi of pois) {
      if (!this.items.has(poi.id)) {
        this.items.set(poi.id, poi)
        changed = true
      }
    }
    if (changed) {
      this.persist()
      this.notify()
    }
  }

  getAll(): ReadonlySet<string> {
    return new Set(this.items.keys())
  }

  list(): readonly FavoritePoi[] {
    // Drop legacy id-only entries (no coordinates) — not navigable.
    return [...this.items.values()].filter(p => p.lat !== 0 || p.lon !== 0)
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
      localStorage.setItem(LocalFavoritesStore.KEY, JSON.stringify([...this.items.values()]))
    } catch { /* ignore quota errors */ }
  }

  private notify(): void {
    for (const cb of this.listeners) cb()
  }
}
