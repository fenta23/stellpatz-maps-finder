import L from 'leaflet'
import type { LatLngBounds } from '@/features/pois/OverpassClient.js'

export interface BaseLayerConfig {
  readonly label: string
  readonly url: string
  readonly attribution: string
  readonly maxZoom: number
}

/** Base map layers offered in the layer switcher (top-right control). */
export const BASE_LAYER_CONFIGS: readonly BaseLayerConfig[] = [
  {
    // CARTO Voyager — clean, muted earthy tones (free, no API key)
    label: 'Karte',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende © <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  },
  {
    label: 'Satellit',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Luftbilder © <a href="https://www.esri.com">Esri</a>, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
] as const

/** Builds a `{ label → TileLayer }` map from the configs — first entry is the default. */
export function buildBaseLayers(): Record<string, L.TileLayer> {
  const layers: Record<string, L.TileLayer> = {}
  for (const cfg of BASE_LAYER_CONFIGS) {
    layers[cfg.label] = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: cfg.maxZoom })
  }
  return layers
}

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

    const baseLayers = buildBaseLayers()
    // First config is the default base layer shown on load
    baseLayers[BASE_LAYER_CONFIGS[0]!.label]!.addTo(this.map)
    L.control.layers(baseLayers, undefined, { position: 'topright' }).addTo(this.map)

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
