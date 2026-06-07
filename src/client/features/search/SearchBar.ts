import type { LatLngBounds } from '@/features/pois/OverpassClient.js'
import { apiUrl } from '@/core/config.js'

export type PlaceSelectedEvent = {
  readonly lat: number
  readonly lng: number
  readonly name: string
}

interface NominatimResult {
  readonly lat: string
  readonly lon: string
  readonly display_name: string
}

export class SearchBar {
  private readonly input: HTMLInputElement
  private readonly dropdown: HTMLElement
  private readonly listeners: Array<(e: PlaceSelectedEvent) => void> = []
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private bounds: LatLngBounds | null = null

  constructor(private readonly container: HTMLElement) {
    const wrapper = document.createElement('div')
    wrapper.className = 'search-wrapper'

    this.input = document.createElement('input')
    this.input.type = 'search'
    this.input.placeholder = 'Ort suchen…'
    this.input.className = 'search-input'
    this.input.setAttribute('aria-label', 'Ort suchen')
    this.input.setAttribute('autocomplete', 'off')

    this.dropdown = document.createElement('ul')
    this.dropdown.className = 'search-dropdown hidden'
    this.dropdown.setAttribute('role', 'listbox')

    wrapper.appendChild(this.input)
    wrapper.appendChild(this.dropdown)
    this.container.appendChild(wrapper)

    this.input.addEventListener('input', () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => void this.search(), 350)
    })

    this.input.addEventListener('blur', () => {
      // small delay so click on item fires first
      setTimeout(() => this.hideDropdown(), 150)
    })

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hideDropdown()
    })
  }

  updateBounds(bounds: LatLngBounds): void {
    this.bounds = bounds
  }

  private async search(): Promise<void> {
    const q = this.input.value.trim()
    if (q.length < 2) { this.hideDropdown(); return }

    const params = new URLSearchParams({ q, limit: '6' })
    if (this.bounds) {
      // Nominatim viewbox: left(west),top(north),right(east),bottom(south)
      params.set('viewbox', `${this.bounds.west},${this.bounds.north},${this.bounds.east},${this.bounds.south}`)
    }

    try {
      const res = await fetch(apiUrl(`/api/geocode?${params}`))
      if (!res.ok) { this.hideDropdown(); return }
      const results = await res.json() as NominatimResult[]
      this.showDropdown(results)
    } catch {
      this.hideDropdown()
    }
  }

  private showDropdown(results: NominatimResult[]): void {
    this.dropdown.innerHTML = ''
    if (results.length === 0) { this.hideDropdown(); return }

    for (const r of results) {
      const li = document.createElement('li')
      li.className = 'search-dropdown-item'
      li.setAttribute('role', 'option')
      li.textContent = r.display_name
      li.addEventListener('mousedown', () => {
        this.input.value = r.display_name
        this.hideDropdown()
        for (const l of this.listeners) {
          l({ lat: Number(r.lat), lng: Number(r.lon), name: r.display_name })
        }
      })
      this.dropdown.appendChild(li)
    }
    this.dropdown.classList.remove('hidden')
  }

  private hideDropdown(): void {
    this.dropdown.classList.add('hidden')
    this.dropdown.innerHTML = ''
  }

  onPlaceSelected(listener: (e: PlaceSelectedEvent) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const idx = this.listeners.indexOf(listener)
      if (idx !== -1) this.listeners.splice(idx, 1)
    }
  }
}
