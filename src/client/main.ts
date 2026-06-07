import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import L from 'leaflet'
import 'leaflet.markercluster'
import { MapService } from './map/MapService.js'
import { fetchPois, type OsmPoi } from './poi/OverpassClient.js'
import { PoiMarkerManager } from './poi/PoiMarkerManager.js'
import { DirectionsService, type RoutingMode } from './routing/DirectionsService.js'
import type { OsmNote, PoiImage, NearbyItem } from './ui/PoiDetailPanel.js'
import { FilterPanel } from './ui/FilterPanel.js'
import { PoiDetailPanel } from './ui/PoiDetailPanel.js'
import { SearchBar } from './ui/SearchBar.js'
import { LocalFavoritesStore } from './favorites/FavoritesStore.js'
import { apiUrl } from './config.js'
import { setupInstall } from './pwa/installPrompt.js'

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

  const installBtn = document.getElementById('btn-install')
  if (installBtn) setupInstall(installBtn)

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
  const favorites = new LocalFavoritesStore()
  const directionsService = new DirectionsService(mapService.getMap())
  const leafletMap = mapService.getMap()

  // currentUserPos is null when location is unknown — never default to map center
  let currentUserPos: { lat: number; lon: number } | null = userPos
    ? { lat: userPos[0], lon: userPos[1] }
    : null

  let routingMode: RoutingMode = 'driving'
  let selectedPoi: OsmPoi | null = null

  const routingModeEl = document.getElementById('routing-mode') as HTMLSelectElement
  routingModeEl.addEventListener('change', () => {
    const newMode = routingModeEl.value as RoutingMode
    if (newMode === routingMode) return
    routingMode = newMode
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
        updateIcon(iconUrl: string) {
          marker.setIcon(L.icon({ iconUrl, iconSize: [32, 32], iconAnchor: [16, 32] }))
        },
      }
    },
  }

  const PANEL_WIDTH = 320
  // Must match the CSS in index.html: @media (max-width: 600px) + height: 60dvh
  const MOBILE_BREAKPOINT = 600
  const MOBILE_SHEET_FRACTION = 0.6

  function panPoiIntoView(poi: { lat: number; lon: number }) {
    // Leaflet doesn't know the detail panel exists, so a POI hidden behind it must
    // be panned into the still-visible strip.
    const poiPoint = leafletMap.latLngToContainerPoint([poi.lat, poi.lon])

    if (window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches) {
      // Bottom sheet covers the lower 60dvh of the viewport — pan the POI up into
      // the visible strip above it.
      const mapTop = mapContainer.getBoundingClientRect().top
      const sheetTopInContainer = window.innerHeight * (1 - MOBILE_SHEET_FRACTION) - mapTop
      const targetY = Math.max(sheetTopInContainer / 2, 40) // center of visible strip
      const dy = poiPoint.y - targetY
      if (dy > 0) leafletMap.panBy([0, dy], { animate: true })
      return
    }

    // Desktop: side panel on the right — pan the POI into the visible left strip.
    const visibleWidth = mapContainer.clientWidth - PANEL_WIDTH
    const targetX = Math.max(visibleWidth / 2, 40)
    const dx = poiPoint.x - targetX
    if (dx > 0) leafletMap.panBy([dx, 0], { animate: true })
  }

  const markerManager = new PoiMarkerManager(
    adapter,
    async (poi) => {
      selectedPoi = poi
      panPoiIntoView(poi)
      if (!currentUserPos) {
        detailPanel.show(poi, undefined, undefined, favorites.has(String(poi.id)))
        setStatus('Standort unbekannt – Route nicht möglich', true)
        setTimeout(() => setStatus(''), 3000)
        return
      }
      const route = await directionsService.route(
        currentUserPos,
        { lat: poi.lat, lon: poi.lon },
        routingMode,
      ).catch(() => undefined)
      detailPanel.show(poi, route, routingMode, favorites.has(String(poi.id)))
      void loadImagesFor(poi)
      loadNearbyFor(poi)
      loadNotesFor(poi)
    },
    filterPanel.getActiveTypes(),
  )

  // Apply saved favorites to markers immediately (before first Overpass response)
  markerManager.setFavorites(favorites.getAll())

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
      detailPanel.show(poi, route, routingMode, favorites.has(String(poi.id)))
      void loadImagesFor(poi)
      loadNearbyFor(poi)
      loadNotesFor(poi)
    }
  })

  detailPanel.onClose(() => {
    selectedPoi = null
    directionsService.clearRoute()
  })

  detailPanel.onFavoriteToggle(() => {
    if (!selectedPoi) return
    favorites.toggle(String(selectedPoi.id))
    markerManager.setFavorites(favorites.getAll())
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
      const resp = await fetch(apiUrl(`/api/mapillary?lat=${poi.lat}&lon=${poi.lon}`))
      if (resp.ok) {
        const mapillaryImages = await resp.json() as PoiImage[]
        if (selectedPoi?.id === poi.id) detailPanel.updateImages([...images, ...mapillaryImages])
      }
    } catch { /* ignore */ }
  }

  function loadNearbyFor(poi: { id: number; lat: number; lon: number }) {
    fetch(apiUrl(`/api/nearby?lat=${poi.lat}&lon=${poi.lon}`))
      .then(r => r.json() as Promise<NearbyItem[]>)
      .then(items => { if (selectedPoi?.id === poi.id) detailPanel.updateNearby(items) })
      .catch(() => { if (selectedPoi?.id === poi.id) detailPanel.updateNearby([]) })
  }

  function loadNotesFor(poi: { id: number; lat: number; lon: number }) {
    fetch(apiUrl(`/api/notes?lat=${poi.lat}&lon=${poi.lon}`))
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
