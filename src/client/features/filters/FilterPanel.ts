import type { PoiType } from '@/features/pois/OverpassClient.js'
import { typeIcon } from '@/features/pois/poiMeta.js'

const STORAGE_KEY = 'stellpatz:filters'
const ALL_TYPES: readonly PoiType[] = ['parking', 'camper', 'campsite', 'dump', 'water', 'climbing']

const TYPE_LABELS: Record<PoiType, string> = {
  parking: 'Parkplatz',
  camper: 'Stellplatz',
  campsite: 'Camping',
  dump: 'Entsorgung',
  water: 'Wasser',
  climbing: 'Klettern',
}

export type FilterChangeEvent = { readonly type: PoiType; readonly active: boolean }

const SVG_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>'

// Custom POI icon (map-pin with plus)
const SVG_CUSTOM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/><path d="M12 7v6"/><path d="M9 10h6"/></svg>'

export type CustomPoiToggleEvent = { readonly active: boolean }

export class FilterPanel {
  private readonly state: Map<PoiType, boolean>
  private readonly listeners: Array<(e: FilterChangeEvent) => void> = []
  private readonly customListeners: Array<(e: CustomPoiToggleEvent) => void> = []
  private customVisible = true

  constructor(
    private readonly container: HTMLElement,
    private readonly onAddClick: () => void,
  ) {
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

    // "+" button for adding custom POIs
    const addBtn = document.createElement('button')
    addBtn.className = 'filter-btn filter-add'
    addBtn.innerHTML = SVG_PLUS
    addBtn.title = 'Eigenen POI hinzufügen'
    addBtn.setAttribute('aria-label', 'Eigenen POI hinzufügen')
    addBtn.addEventListener('click', () => this.onAddClick())
    this.container.appendChild(addBtn)

    // Separator
    const sep = document.createElement('span')
    sep.className = 'filter-sep'
    this.container.appendChild(sep)

    // Type filter buttons
    for (const type of ALL_TYPES) {
      const label = TYPE_LABELS[type]
      const btn = document.createElement('button')
      btn.dataset['type'] = type
      btn.innerHTML = typeIcon(type)
      btn.title = label
      btn.setAttribute('aria-label', label)
      btn.className = `filter-btn ${this.state.get(type) ? 'active' : ''}`
      btn.setAttribute('aria-pressed', String(this.state.get(type) ?? true))
      btn.addEventListener('click', () => this.toggle(type))
      this.container.appendChild(btn)
    }

    // Custom POI toggle
    const customBtn = document.createElement('button')
    customBtn.className = `filter-btn filter-custom ${this.customVisible ? 'active' : ''}`
    customBtn.innerHTML = SVG_CUSTOM
    customBtn.title = 'Eigene POIs'
    customBtn.setAttribute('aria-label', 'Eigene POIs anzeigen')
    customBtn.setAttribute('aria-pressed', String(this.customVisible))
    customBtn.dataset['action'] = 'custom'
    customBtn.addEventListener('click', () => this.toggleCustom())
    this.container.appendChild(customBtn)
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

  private toggleCustom(): void {
    this.customVisible = !this.customVisible
    const btn = this.container.querySelector<HTMLButtonElement>('[data-action="custom"]')
    if (btn) {
      btn.classList.toggle('active', this.customVisible)
      btn.setAttribute('aria-pressed', String(this.customVisible))
    }
    for (const l of this.customListeners) l({ active: this.customVisible })
  }

  onChange(listener: (e: FilterChangeEvent) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const idx = this.listeners.indexOf(listener)
      if (idx !== -1) this.listeners.splice(idx, 1)
    }
  }

  onCustomToggle(listener: (e: CustomPoiToggleEvent) => void): () => void {
    this.customListeners.push(listener)
    return () => {
      const idx = this.customListeners.indexOf(listener)
      if (idx !== -1) this.customListeners.splice(idx, 1)
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

  isCustomVisible(): boolean {
    return this.customVisible
  }
}
