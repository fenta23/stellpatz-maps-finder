import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import L from 'leaflet'
import 'leaflet.markercluster'
import { MapService } from './map/MapService.js'
import { fetchPois, type OsmPoi } from './poi/OverpassClient.js'
import { PoiMarkerManager } from './poi/PoiMarkerManager.js'
import { DirectionsService, type RoutingMode } from './routing/DirectionsService.js'
import type { OsmNote, PoiImage } from './ui/PoiDetailPanel.js'
import { FilterPanel } from './ui/FilterPanel.js'
import { PoiDetailPanel } from './ui/PoiDetailPanel.js'
import { SearchBar } from './ui/SearchBar.js'

const DEFAULT_CENTER: [number, number] = [51.163, 10.447] // Germany center

async function requestLocation(statusEl: HTMLElement): Promise<[number, number] | null> {
  if (!navigator.geolocation) return null

  statusEl.textContent = 'Standort wird ermittelt…'
  statusEl.className = 'status-loading'

  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve([pos.coords.latitude, pos.coords.longitude]),
      () => resolve(null),
      { timeout: 15000, maximumAge: 60000, enableHighAccuracy: false },
    )
  })
}

async function init() {
  const mapContainer = document.getElementById('map')!
  const filterContainer = document.getElementById('poi-filter')!
  const detailContainer = document.getElementById('detail-panel')!
  const searchContainer = document.getElementById('search-bar')!
  const statusEl = document.getElementById('status')!

  function setStatus(msg: string, isError = false) {
    statusEl.textContent = msg
    statusEl.className = isError ? 'status-error' : msg ? 'status-loading' : ''
  }

  // Ask for location upfront before map init
  const userPos = await requestLocation(statusEl)

  const center: [number, number] = userPos ?? DEFAULT_CENTER
  const zoom = userPos ? 13 : 6

  setStatus('')

  const mapService = new MapService(mapContainer, center, zoom)
  const filterPanel = new FilterPanel(filterContainer)
  const detailPanel = new PoiDetailPanel(detailContainer)
  const searchBar = new SearchBar(searchContainer)
  const directionsService = new DirectionsService(mapService.getMap())
  const leafletMap = mapService.getMap()

  // currentUserPos is null when location is unknown — never default to map center
  let currentUserPos: { lat: number; lon: number } | null = userPos
    ? { lat: userPos[0], lon: userPos[1] }
    : null

  let routingMode: RoutingMode = 'driving'
  let selectedPoi: OsmPoi | null = null

  const routingModeEl = document.getElementById('routing-mode')!
  routingModeEl.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.mode-btn')
    if (!btn?.dataset['mode']) return
    const newMode = btn.dataset['mode'] as RoutingMode
    if (newMode === routingMode) return
    routingMode = newMode
    routingModeEl.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    if (selectedPoi && currentUserPos) {
      void directionsService
        .route(currentUserPos, { lat: selectedPoi.lat, lon: selectedPoi.lon }, routingMode)
        .then(route => detailPanel.show(selectedPoi!, route, routingMode))
        .catch(() => directionsService.clearRoute())
    } else {
      directionsService.clearRoute()
    }
  })

  let locationMarker: L.CircleMarker | null = null

  function updateLocationMarker(pos: [number, number]) {
    if (locationMarker) locationMarker.remove()
    locationMarker = L.circleMarker(pos, {
      radius: 8,
      fillColor: '#4285F4',
      fillOpacity: 1,
      color: '#fff',
      weight: 2,
    }).addTo(leafletMap).bindTooltip('Mein Standort')
    currentUserPos = { lat: pos[0], lon: pos[1] }
  }

  if (userPos) {
    updateLocationMarker(userPos)
  } else {
    setStatus('Standort nicht verfügbar – Karte auf Deutschland zentriert', true)
    setTimeout(() => setStatus(''), 4000)
  }

  // Watch position for ongoing updates
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
      pos => updateLocationMarker([pos.coords.latitude, pos.coords.longitude]),
      () => { /* silently ignore watch errors */ },
      { maximumAge: 30000, enableHighAccuracy: false },
    )
  }

  const clusterGroup = L.markerClusterGroup({
    maxClusterRadius: 50,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    zoomToBoundsOnClick: true,
    disableClusteringAtZoom: 17,
  })
  clusterGroup.addTo(leafletMap)

  const adapter = {
    createMarker({ lat, lon, title, icon, onClick }: {
      lat: number; lon: number; title: string; icon: string; onClick: () => void
    }) {
      const leafletIcon = L.icon({ iconUrl: icon, iconSize: [32, 32], iconAnchor: [16, 32] })
      const marker = L.marker([lat, lon], { icon: leafletIcon, title })
      marker.on('click', onClick)
      clusterGroup.addLayer(marker)
      return {
        setVisible(v: boolean) {
          if (v) clusterGroup.addLayer(marker)
          else clusterGroup.removeLayer(marker)
        },
        remove() { clusterGroup.removeLayer(marker) },
      }
    },
  }

  const markerManager = new PoiMarkerManager(
    adapter,
    async (poi) => {
      selectedPoi = poi
      if (!currentUserPos) {
        detailPanel.show(poi, undefined)
        setStatus('Standort unbekannt – Route nicht möglich', true)
        setTimeout(() => setStatus(''), 3000)
        return
      }
      const route = await directionsService.route(
        currentUserPos,
        { lat: poi.lat, lon: poi.lon },
        routingMode,
      ).catch(() => undefined)
      detailPanel.show(poi, route, routingMode)
      void loadImagesFor(poi)
      loadNotesFor(poi)
    },
    filterPanel.getActiveTypes(),
  )

  let abortController: AbortController | null = null
  let isLoading = false

  async function refreshPois() {
    const bounds = mapService.getBounds()
    if (!bounds) return

    const latSpan = bounds.north - bounds.south
    const lonSpan = bounds.east - bounds.west
    if (latSpan > 1.5 || lonSpan > 1.5) {
      setStatus('Bitte weiter reinzoomen…')
      return
    }

    const types = filterPanel.getActiveTypes()
    if (types.size === 0) {
      markerManager.clear()
      setStatus('')
      return
    }

    abortController?.abort()
    abortController = new AbortController()
    isLoading = true
    setStatus('Lade Stellplätze…')

    const slowTimer = setTimeout(() => {
      if (isLoading) setStatus('Warte auf Overpass-Server – kann bis 30 s dauern…')
    }, 8000)

    try {
      const pois = await fetchPois(bounds, types, abortController.signal)
      clearTimeout(slowTimer)
      markerManager.updatePois(pois)
      setStatus(pois.length > 0 ? `${pois.length} Orte gefunden` : 'Keine Orte in diesem Bereich')
      setTimeout(() => { if (!isLoading) setStatus('') }, 3000)
    } catch (err) {
      clearTimeout(slowTimer)
      if ((err as Error).name === 'AbortError') return
      console.error('POI fetch failed:', err)
      const msg = (err as Error).message ?? ''
      if (msg.includes('429')) {
        setStatus('Overpass API überlastet – bitte 30 Sekunden warten und erneut zoomen', true)
      } else if (msg.includes('503') || msg.includes('fetch')) {
        setStatus('Overpass API nicht erreichbar – Server vorübergehend down', true)
      } else {
        setStatus('Fehler beim Laden der Daten', true)
      }
    } finally {
      isLoading = false
    }
  }

  mapService.onBoundsChanged((bounds) => {
    searchBar.updateBounds(bounds)
    void refreshPois()
  })
  setTimeout(() => void refreshPois(), 800)

  filterPanel.onChange(({ type, active }) => {
    markerManager.setTypeVisible(type, active)
    void refreshPois()
  })

  detailPanel.onNavigate(async ({ poi }) => {
    if (!currentUserPos) {
      setStatus('Standort unbekannt – Route nicht möglich', true)
      setTimeout(() => setStatus(''), 3000)
      return
    }
    const route = await directionsService.route(
      currentUserPos,
      { lat: poi.lat, lon: poi.lon },
      routingMode,
    ).catch(() => undefined)
    if (route) {
      detailPanel.show(poi, route, routingMode)
      void loadImagesFor(poi)
      loadNotesFor(poi)
    }
  })

  detailPanel.onClose(() => {
    selectedPoi = null
    directionsService.clearRoute()
  })

  async function loadImagesFor(poi: OsmPoi) {
    const images: PoiImage[] = []

    if (poi.tags['image']) {
      images.push({ src: poi.tags['image'], caption: 'OSM' })
    }

    const wmc = poi.tags['wikimedia_commons']
    if (wmc) {
      const title = wmc.startsWith('File:') || wmc.startsWith('Category:') ? wmc : `File:${wmc}`
      try {
        const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json&origin=*`
        const resp = await fetch(url, { signal: AbortSignal.timeout(5000) })
        const data = await resp.json() as {
          query?: { pages?: Record<string, { imageinfo?: Array<{ url: string; thumburl: string }> }> }
        }
        const page = Object.values(data.query?.pages ?? {})[0]
        const info = page?.imageinfo?.[0]
        if (info?.thumburl) {
          images.push({
            src: info.thumburl,
            link: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
            caption: 'Wikimedia Commons',
          })
        }
      } catch { /* ignore */ }
    }

    if (selectedPoi?.id === poi.id) detailPanel.updateImages(images)

    try {
      const resp = await fetch(`/api/mapillary?lat=${poi.lat}&lon=${poi.lon}`)
      if (resp.ok) {
        const mapillaryImages = await resp.json() as PoiImage[]
        if (selectedPoi?.id === poi.id) detailPanel.updateImages([...images, ...mapillaryImages])
      }
    } catch { /* ignore */ }
  }

  function loadNotesFor(poi: { id: number; lat: number; lon: number }) {
    fetch(`/api/notes?lat=${poi.lat}&lon=${poi.lon}`)
      .then(r => r.json() as Promise<OsmNote[]>)
      .then(notes => {
        if (selectedPoi?.id === poi.id) detailPanel.updateNotes(notes)
      })
      .catch(() => {
        if (selectedPoi?.id === poi.id) detailPanel.updateNotes([])
      })
  }

  searchBar.onPlaceSelected(({ lat, lng }) => {
    mapService.setCenter(lat, lng, 14)
  })
}

init().catch(err => {
  console.error('Startup failed:', err)
  const map = document.getElementById('map')
  if (map) map.textContent = `Fehler beim Laden: ${(err as Error).message}`
})
