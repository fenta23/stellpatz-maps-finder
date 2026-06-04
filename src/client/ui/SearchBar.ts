export type PlaceSelectedEvent = {
  readonly lat: number
  readonly lng: number
  readonly name: string
}

export class SearchBar {
  private readonly input: HTMLInputElement
  private autocomplete: google.maps.places.Autocomplete | null = null
  private readonly listeners: Array<(e: PlaceSelectedEvent) => void> = []

  constructor(private readonly container: HTMLElement) {
    this.input = document.createElement('input')
    this.input.type = 'search'
    this.input.placeholder = 'Ort suchen…'
    this.input.className = 'search-input'
    this.input.setAttribute('aria-label', 'Ort suchen')
    this.container.appendChild(this.input)
  }

  init(map: google.maps.Map): void {
    this.autocomplete = new google.maps.places.Autocomplete(this.input, {
      fields: ['geometry', 'name'],
    })
    this.autocomplete.bindTo('bounds', map)

    this.autocomplete.addListener('place_changed', () => {
      const place = this.autocomplete?.getPlace()
      const loc = place?.geometry?.location
      if (!loc) return
      for (const l of this.listeners) {
        l({ lat: loc.lat(), lng: loc.lng(), name: place?.name ?? '' })
      }
    })
  }

  onPlaceSelected(listener: (e: PlaceSelectedEvent) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const idx = this.listeners.indexOf(listener)
      if (idx !== -1) this.listeners.splice(idx, 1)
    }
  }
}
