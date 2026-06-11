import type { CustomPoi } from './CustomPoi.js'

export interface ICustomPoiStore {
  get(id: string): CustomPoi | undefined
  getAll(): readonly CustomPoi[]
  put(poi: CustomPoi): void
  remove(id: string): void
  onChange(cb: () => void): () => void
}

export class LocalCustomPoiStore implements ICustomPoiStore {
  private static readonly KEY = 'stellpatz:custom-pois'
  private items = new Map<string, CustomPoi>()
  private readonly listeners: Array<() => void> = []

  constructor() {
    try {
      const raw = localStorage.getItem(LocalCustomPoiStore.KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : []
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (isCustomPoi(entry)) this.items.set(entry.id, entry)
        }
      }
    } catch {
      this.items = new Map()
    }
  }

  get(id: string): CustomPoi | undefined {
    return this.items.get(id)
  }

  getAll(): readonly CustomPoi[] {
    return [...this.items.values()]
  }

  put(poi: CustomPoi): void {
    this.items.set(poi.id, poi)
    this.persist()
    this.notify()
  }

  remove(id: string): void {
    if (this.items.delete(id)) {
      this.persist()
      this.notify()
    }
  }

  addMany(pois: Iterable<CustomPoi>): void {
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

  onChange(cb: () => void): () => void {
    this.listeners.push(cb)
    return () => {
      const idx = this.listeners.indexOf(cb)
      if (idx !== -1) this.listeners.splice(idx, 1)
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(LocalCustomPoiStore.KEY, JSON.stringify([...this.items.values()]))
    } catch { /* ignore quota */ }
  }

  private notify(): void {
    for (const cb of this.listeners) cb()
  }
}

function isCustomPoi(value: unknown): value is CustomPoi {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v['id'] === 'string' && typeof v['iconId'] === 'string' && typeof v['lat'] === 'number' && typeof v['lon'] === 'number'
}
