import L from 'leaflet'
import type { LatLngBounds } from '../poi/OverpassClient.js'

export class MapService {
  private readonly map: L.Map
  private readonly boundsListeners: Array<(b: LatLngBounds) => void> = []
  private debounceTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    container: HTMLElement,
    center: [number, number] = [48.137, 11.576],
    zoom = 13,
  ) {
    this.map = L.map(container, { zoomControl: true }).setView(center, zoom)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende',
      maxZoom: 19,
    }).addTo(this.map)

    this.map.on('moveend', () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => this.emit(), 1200)
    })
  }

  private emit(): void {
    const b = this.getBounds()
    if (!b) return
    for (const l of this.boundsListeners) l(b)
  }

  getBounds(): LatLngBounds | null {
    const b = this.map.getBounds()
    return {
      south: b.getSouth(),
      west: b.getWest(),
      north: b.getNorth(),
      east: b.getEast(),
    }
  }

  onBoundsChanged(listener: (b: LatLngBounds) => void): () => void {
    this.boundsListeners.push(listener)
    return () => {
      const idx = this.boundsListeners.indexOf(listener)
      if (idx !== -1) this.boundsListeners.splice(idx, 1)
    }
  }

  getMap(): L.Map {
    return this.map
  }

  setCenter(lat: number, lng: number, zoom?: number): void {
    this.map.setView([lat, lng], zoom ?? this.map.getZoom())
  }

  panTo(lat: number, lng: number): void {
    this.map.panTo([lat, lng])
  }
}

export async function getUserLocation(): Promise<[number, number] | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      pos => resolve([pos.coords.latitude, pos.coords.longitude]),
      () => resolve(null),
      { timeout: 5000 },
    )
  })
}
