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

    // A real <form> so the on-screen keyboard's "Search"/"Go" key (and Enter)
    // actually submits — without it, mobile users couldn't trigger a search.
    const form = document.createElement('form')
    form.className = 'search-form'
    form.setAttribute('role', 'search')

    this.input = document.createElement('input')
    this.input.type = 'search'
    this.input.placeholder = 'Ort suchen…'
    this.input.className = 'search-input'
    this.input.setAttribute('aria-label', 'Ort suchen')
    this.input.setAttribute('autocomplete', 'off')
    this.input.setAttribute('enterkeyhint', 'search')

    this.dropdown = document.createElement('ul')
    this.dropdown.className = 'search-dropdown hidden'
    this.dropdown.setAttribute('role', 'listbox')

    form.appendChild(this.input)
    wrapper.appendChild(form)
    wrapper.appendChild(this.dropdown)
    this.container.appendChild(wrapper)

    this.input.addEventListener('input', () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => void this.search(), 350)
    })

    // Submit (Enter / mobile "Search" key) → jump straight to the best match.
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      void this.submit()
    })

    this.input.addEventListener('blur', () => {
      // small delay so a click/tap on an item fires first
      setTimeout(() => this.hideDropdown(), 150)
    })

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hideDropdown()
    })
  }

  updateBounds(bounds: LatLngBounds): void {
    this.bounds = bounds
  }

  /** Debounced as-you-type search → dropdown of suggestions. */
  private async search(): Promise<void> {
    const results = await this.fetchResults()
    this.showDropdown(results)
  }

  /** Submit (Enter / mobile keyboard) → run now and jump to the best match. */
  private async submit(): Promise<void> {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    const results = await this.fetchResults()
    if (results.length === 0) { this.hideDropdown(); return }
    this.selectResult(results[0]!)
    this.input.blur() // dismiss the on-screen keyboard
  }

  private async fetchResults(): Promise<NominatimResult[]> {
    const q = this.input.value.trim()
    if (q.length < 2) return []

    const params = new URLSearchParams({ q, limit: '6' })
    if (this.bounds) {
      // Nominatim viewbox: left(west),top(north),right(east),bottom(south)
      params.set('viewbox', `${this.bounds.west},${this.bounds.north},${this.bounds.east},${this.bounds.south}`)
    }

    try {
      const res = await fetch(apiUrl(`/api/geocode?${params}`))
      if (!res.ok) return []
      return await res.json() as NominatimResult[]
    } catch {
      return []
    }
  }

  private selectResult(r: NominatimResult): void {
    this.input.value = r.display_name
    this.hideDropdown()
    this.input.blur()
    for (const l of this.listeners) {
      l({ lat: Number(r.lat), lng: Number(r.lon), name: r.display_name })
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
      // mousedown (fires before the input's blur) + preventDefault keeps focus
      // off the blur-hide race; works for synthesized taps on touch too.
      li.addEventListener('mousedown', (e) => {
        e.preventDefault()
        this.selectResult(r)
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
