import type { LatLngBounds } from '../poi/OverpassClient.js'

export interface MapBoundsChangedEvent {
  readonly bounds: LatLngBounds
}

export async function loadGoogleMapsApi(): Promise<void> {
  if (typeof google !== 'undefined' && google.maps) return

  const res = await fetch('/api/maps-key')
  if (!res.ok) throw new Error('Could not load Google Maps API key')
  const { key } = await res.json() as { key: string }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Maps script'))
    document.head.appendChild(script)
  })
}

export class GoogleMapService {
  private readonly map: google.maps.Map
  private readonly listeners: Array<(e: MapBoundsChangedEvent) => void> = []
  private debounceTimer: ReturnType<typeof setTimeout> | null = null

  constructor(container: HTMLElement, center: google.maps.LatLngLiteral = { lat: 48.137, lng: 11.576 }, zoom = 13) {
    this.map = new google.maps.Map(container, {
      center,
      zoom,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
    })

    this.map.addListener('bounds_changed', () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => this.emitBoundsChanged(), 1200)
    })
  }

  private emitBoundsChanged(): void {
    const bounds = this.getBounds()
    if (!bounds) return
    for (const l of this.listeners) l({ bounds })
  }

  getBounds(): LatLngBounds | null {
    const b = this.map.getBounds()
    if (!b) return null
    const sw = b.getSouthWest()
    const ne = b.getNorthEast()
    return { south: sw.lat(), west: sw.lng(), north: ne.lat(), east: ne.lng() }
  }

  onBoundsChanged(listener: (e: MapBoundsChangedEvent) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const idx = this.listeners.indexOf(listener)
      if (idx !== -1) this.listeners.splice(idx, 1)
    }
  }

  getMap(): google.maps.Map {
    return this.map
  }

  setCenter(lat: number, lng: number, zoom?: number): void {
    this.map.setCenter({ lat, lng })
    if (zoom !== undefined) this.map.setZoom(zoom)
  }

  panTo(lat: number, lng: number): void {
    this.map.panTo({ lat, lng })
  }
}

export async function getUserLocation(): Promise<google.maps.LatLngLiteral | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000 },
    )
  })
}
