import type { PoiType } from '../poi/OverpassClient.js'

const STORAGE_KEY = 'stellpatz:filters'
const ALL_TYPES: readonly PoiType[] = ['parking', 'camper', 'campsite']

export type FilterChangeEvent = { readonly type: PoiType; readonly active: boolean }

export class FilterPanel {
  private readonly state: Map<PoiType, boolean>
  private readonly listeners: Array<(e: FilterChangeEvent) => void> = []

  constructor(private readonly container: HTMLElement) {
    this.state = this.loadState()
    this.render()
  }

  private loadState(): Map<PoiType, boolean> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>
        const map = new Map<PoiType, boolean>()
        for (const t of ALL_TYPES) {
          map.set(t, parsed[t] !== false)
        }
        return map
      }
    } catch {
      // ignore
    }
    return new Map(ALL_TYPES.map(t => [t, true]))
  }

  private saveState(): void {
    const obj: Record<string, boolean> = {}
    for (const [k, v] of this.state) obj[k] = v
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
  }

  private render(): void {
    this.container.innerHTML = ''
    const labels: Record<PoiType, string> = {
      parking: '🅿️ Parkplatz',
      camper: '🚐 Stellplatz',
      campsite: '⛺ Camping',
    }
    for (const type of ALL_TYPES) {
      const btn = document.createElement('button')
      btn.dataset['type'] = type
      btn.textContent = labels[type]
      btn.className = `filter-btn ${this.state.get(type) ? 'active' : ''}`
      btn.setAttribute('aria-pressed', String(this.state.get(type) ?? true))
      btn.addEventListener('click', () => this.toggle(type))
      this.container.appendChild(btn)
    }
  }

  private toggle(type: PoiType): void {
    const next = !(this.state.get(type) ?? true)
    this.state.set(type, next)
    this.saveState()

    const btn = this.container.querySelector<HTMLButtonElement>(`[data-type="${type}"]`)
    if (btn) {
      btn.classList.toggle('active', next)
      btn.setAttribute('aria-pressed', String(next))
    }

    for (const listener of this.listeners) {
      listener({ type, active: next })
    }
  }

  onChange(listener: (e: FilterChangeEvent) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const idx = this.listeners.indexOf(listener)
      if (idx !== -1) this.listeners.splice(idx, 1)
    }
  }

  getActiveTypes(): ReadonlySet<PoiType> {
    const active = new Set<PoiType>()
    for (const [t, v] of this.state) {
      if (v) active.add(t)
    }
    return active
  }

  isActive(type: PoiType): boolean {
    return this.state.get(type) ?? true
  }
}
