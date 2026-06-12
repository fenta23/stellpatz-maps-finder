import L from 'leaflet'
import type { LatLngBounds } from '@/features/pois/OverpassClient.js'

const SVG_MAP = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/></svg>'

const SVG_SATELLITE = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m13.5 6.5-3.148-3.148a1.205 1.205 0 0 0-1.704 0L6.352 5.648a1.205 1.205 0 0 0 0 1.704L9.5 10.5"/><path d="M16.5 7.5 19 5"/><path d="m17.5 10.5 3.148 3.148a1.205 1.205 0 0 1 0 1.704l-2.296 2.296a1.205 1.205 0 0 1-1.704 0L13.5 14.5"/><path d="M9 21a6 6 0 0 0-6-6"/><path d="M9.352 10.648a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l4.296-4.296a1.205 1.205 0 0 0 0-1.704l-2.296-2.296a1.205 1.205 0 0 0-1.704 0z"/></svg>'

// Lucide "locate-fixed" — crosshair with centre dot
const SVG_LOCATE = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="5" y1="12" y2="12"/><line x1="19" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="5"/><line x1="12" x2="12" y1="19" y2="22"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/></svg>'

// Lucide plus / minus — replace Leaflet's default "+"/"−" glyphs so the zoom
// control matches the icon style of the layer switcher / locate button.
const SVG_PLUS = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>'
const SVG_MINUS = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" x2="19" y1="12" y2="12"/></svg>'

/** A control button that recenters the map on the user's location. */
export function createLocateControl(onClick: () => void): L.Control {
  const control = L.control({ position: 'bottomleft' })
  control.onAdd = () => {
    const container = L.DomUtil.create('div', 'locate-control leaflet-bar')
    const btn = L.DomUtil.create('button', 'locate-btn', container) as HTMLButtonElement
    btn.type = 'button'
    btn.innerHTML = SVG_LOCATE
    btn.title = 'Zu meinem Standort'
    btn.setAttribute('aria-label', 'Zu meinem Standort')
    L.DomEvent.on(btn, 'click', (e: Event) => { L.DomEvent.stop(e); onClick() })
    L.DomEvent.disableClickPropagation(container)
    return container
  }
  return control
}

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

function createLayerSwitcher(baseLayers: Record<string, L.TileLayer>, map: L.Map): L.Control {
  const control = L.control({ position: 'topright' })

  control.onAdd = () => {
    const container = L.DomUtil.create('div', 'layer-switcher leaflet-bar')

    const keys = Object.keys(baseLayers)
    let activeKey = keys[0]!

    for (const key of keys) {
      const btn = L.DomUtil.create('button', 'layer-btn', container)
      btn.innerHTML = key === 'Karte' ? SVG_MAP : SVG_SATELLITE
      btn.title = key
      btn.setAttribute('aria-label', key)
      if (key === activeKey) btn.classList.add('active')

      L.DomEvent.on(btn, 'click', () => {
        if (key === activeKey) return
        baseLayers[activeKey]?.remove()
        baseLayers[key]?.addTo(map)
        activeKey = key
        container.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
      })
    }

    L.DomEvent.disableClickPropagation(container)
    return container
  }

  return control
}

export class MapService {
  private readonly map: L.Map
  private readonly boundsListeners: Array<(b: LatLngBounds) => void> = []
  private readonly contextMenuListeners: Array<(lat: number, lng: number) => void> = []
  private readonly placementListeners: Array<(lat: number, lng: number) => void> = []
  private readonly locateListeners: Array<() => void> = []
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private _isPlacing = false

  constructor(
    container: HTMLElement,
    center: [number, number] = [48.137, 11.576],
    zoom = 13,
  ) {
    this.map = L.map(container, { zoomControl: true }).setView(center, zoom)

    const baseLayers = buildBaseLayers()
    baseLayers[BASE_LAYER_CONFIGS[0]!.label]!.addTo(this.map)
    createLayerSwitcher(baseLayers, this.map).addTo(this.map)
    createLocateControl(() => { for (const l of this.locateListeners) l() }).addTo(this.map)

    // Swap Leaflet's "+"/"−" zoom glyphs for Lucide icons (styled like the other controls).
    const c = this.map.getContainer()
    const zin = c.querySelector('.leaflet-control-zoom-in')
    const zout = c.querySelector('.leaflet-control-zoom-out')
    if (zin) zin.innerHTML = SVG_PLUS
    if (zout) zout.innerHTML = SVG_MINUS

    this.map.on('moveend', () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => this.emit(), 1200)
    })

    this.map.on('contextmenu', (e: L.LeafletMouseEvent) => {
      if (this._isPlacing) return
      for (const l of this.contextMenuListeners) l(e.latlng.lat, e.latlng.lng)
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

  onContextMenu(listener: (lat: number, lng: number) => void): () => void {
    this.contextMenuListeners.push(listener)
    return () => {
      const idx = this.contextMenuListeners.indexOf(listener)
      if (idx !== -1) this.contextMenuListeners.splice(idx, 1)
    }
  }

  /** Fires when the "my location" control is tapped. */
  onLocate(listener: () => void): () => void {
    this.locateListeners.push(listener)
    return () => {
      const idx = this.locateListeners.indexOf(listener)
      if (idx !== -1) this.locateListeners.splice(idx, 1)
    }
  }

  /** Enter placement mode — next map click places a POI. */
  startPlacement(): void {
    if (this._isPlacing) return
    this._isPlacing = true
    this.map.getContainer().classList.add('placing-poi')
    const handler = (e: L.LeafletMouseEvent) => {
      if (!this._isPlacing) return
      this.cancelPlacement()
      for (const l of this.placementListeners) l(e.latlng.lat, e.latlng.lng)
    }
    this.map.once('click', handler)
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { this.cancelPlacement(); document.removeEventListener('keydown', escHandler) }
    }
    document.addEventListener('keydown', escHandler)
    const cancelClick = () => this.cancelPlacement() // right-click cancels
    this.map.once('contextmenu', cancelClick)
  }

  /** Exit placement mode without placing. */
  cancelPlacement(): void {
    if (!this._isPlacing) return
    this._isPlacing = false
    this.map.getContainer().classList.remove('placing-poi')
  }

  onPlacement(listener: (lat: number, lng: number) => void): () => void {
    this.placementListeners.push(listener)
    return () => {
      const idx = this.placementListeners.indexOf(listener)
      if (idx !== -1) this.placementListeners.splice(idx, 1)
    }
  }

  get isPlacing(): boolean {
    return this._isPlacing
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
