import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapService, getUserLocation } from './map/MapService.js'
import { fetchPois } from './poi/OverpassClient.js'
import { PoiMarkerManager } from './poi/PoiMarkerManager.js'
import { DirectionsService } from './routing/DirectionsService.js'
import { FilterPanel } from './ui/FilterPanel.js'
import { PoiDetailPanel } from './ui/PoiDetailPanel.js'
import { SearchBar } from './ui/SearchBar.js'

async function init() {
  const mapContainer = document.getElementById('map')!
  const filterContainer = document.getElementById('filter-panel')!
  const detailContainer = document.getElementById('detail-panel')!
  const searchContainer = document.getElementById('search-bar')!
  const statusEl = document.getElementById('status')!

  const userPos = await getUserLocation()
  const center: [number, number] = userPos ?? [48.137, 11.576]

  const mapService = new MapService(mapContainer, center)
  const filterPanel = new FilterPanel(filterContainer)
  const detailPanel = new PoiDetailPanel(detailContainer)
  const searchBar = new SearchBar(searchContainer)
  const directionsService = new DirectionsService(mapService.getMap())

  let currentUserPos = { lat: center[0], lon: center[1] }

  if (userPos) {
    currentUserPos = { lat: userPos[0], lon: userPos[1] }
    L.circleMarker(userPos, {
      radius: 8,
      fillColor: '#4285F4',
      fillOpacity: 1,
      color: '#fff',
      weight: 2,
    }).addTo(mapService.getMap()).bindTooltip('Mein Standort')
  }

  const leafletMap = mapService.getMap()

  const adapter = {
    createMarker({ lat, lon, title, icon, onClick }: {
      lat: number; lon: number; title: string; icon: string; onClick: () => void
    }) {
      const leafletIcon = L.icon({ iconUrl: icon, iconSize: [32, 32], iconAnchor: [16, 32] })
      const marker = L.marker([lat, lon], { icon: leafletIcon, title })
      marker.on('click', onClick)
      marker.addTo(leafletMap)
      return {
        setVisible(v: boolean) {
          if (v) marker.addTo(leafletMap)
          else marker.remove()
        },
        remove() { marker.remove() },
      }
    },
  }

  const markerManager = new PoiMarkerManager(
    adapter,
    async (poi) => {
      const route = await directionsService.route(
        currentUserPos,
        { lat: poi.lat, lon: poi.lon },
      ).catch(() => undefined)
      detailPanel.show(poi, route)
    },
    filterPanel.getActiveTypes(),
  )

  let abortController: AbortController | null = null
  let isLoading = false

  function setStatus(msg: string, isError = false) {
    statusEl.textContent = msg
    statusEl.className = isError ? 'status-error' : msg ? 'status-loading' : ''
  }

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
    const route = await directionsService.route(
      currentUserPos,
      { lat: poi.lat, lon: poi.lon },
    ).catch(() => undefined)
    if (route) detailPanel.show(poi, route)
  })

  searchBar.onPlaceSelected(({ lat, lng }) => {
    mapService.setCenter(lat, lng, 14)
  })
}

init().catch(err => {
  console.error('Startup failed:', err)
  const map = document.getElementById('map')
  if (map) map.textContent = `Fehler beim Laden: ${(err as Error).message}`
})
