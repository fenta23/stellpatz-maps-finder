export interface IFavoritesStore {
  has(id: string): boolean
  toggle(id: string): boolean
  getAll(): ReadonlySet<string>
  onChange(cb: () => void): () => void
}

export class LocalFavoritesStore implements IFavoritesStore {
  private static readonly KEY = 'stellpatz-favorites'
  private ids: Set<string>
  private readonly listeners: Array<() => void> = []

  constructor() {
    try {
      const raw = localStorage.getItem(LocalFavoritesStore.KEY)
      this.ids = new Set(raw ? (JSON.parse(raw) as string[]) : [])
    } catch {
      this.ids = new Set()
    }
  }

  has(id: string): boolean {
    return this.ids.has(id)
  }

  toggle(id: string): boolean {
    if (this.ids.has(id)) {
      this.ids.delete(id)
    } else {
      this.ids.add(id)
    }
    this.persist()
    this.notify()
    return this.ids.has(id)
  }

  getAll(): ReadonlySet<string> {
    return this.ids
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
      localStorage.setItem(LocalFavoritesStore.KEY, JSON.stringify([...this.ids]))
    } catch { /* ignore quota errors */ }
  }

  private notify(): void {
    for (const cb of this.listeners) cb()
  }
}
