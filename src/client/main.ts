import { loadGoogleMapsApi, GoogleMapService, getUserLocation } from './map/GoogleMapService.js'
import { fetchPois } from './poi/OverpassClient.js'
import { PoiMarkerManager } from './poi/PoiMarkerManager.js'
import { DirectionsService, buildRouteResult } from './routing/DirectionsService.js'
import { FilterPanel } from './ui/FilterPanel.js'
import { PoiDetailPanel } from './ui/PoiDetailPanel.js'
import { SearchBar } from './ui/SearchBar.js'
import type { OsmPoi } from './poi/OverpassClient.js'

async function init() {
  await loadGoogleMapsApi()

  const mapContainer = document.getElementById('map')!
  const filterContainer = document.getElementById('filter-panel')!
  const detailContainer = document.getElementById('detail-panel')!
  const searchContainer = document.getElementById('search-bar')!

  const userPos = await getUserLocation()
  const center = userPos ?? { lat: 48.137, lng: 11.576 }

  const mapService = new GoogleMapService(mapContainer, center)
  const filterPanel = new FilterPanel(filterContainer)
  const detailPanel = new PoiDetailPanel(detailContainer)
  const searchBar = new SearchBar(searchContainer)
  const directionsService = new DirectionsService(mapService.getMap())

  let currentUserPos = center

  // Google Maps adapter for PoiMarkerManager
  const adapter = {
    createMarker({ lat, lon, title, icon, onClick }: {
      lat: number; lon: number; title: string; icon: string; onClick: () => void
    }) {
      const marker = new google.maps.Marker({
        position: { lat, lng: lon },
        map: mapService.getMap(),
        title,
        icon: { url: icon, scaledSize: new google.maps.Size(32, 32) },
      })
      marker.addListener('click', onClick)
      let poiType: OsmPoi['type'] = 'parking'
      return {
        id: 0,
        get poiType() { return poiType },
        setVisible(v: boolean) { marker.setVisible(v) },
        remove() { marker.setMap(null) },
      }
    },
  }

  const markerManager = new PoiMarkerManager(adapter, async (poi) => {
    const route = await directionsService.route(
      { lat: currentUserPos.lat, lon: currentUserPos.lng },
      { lat: poi.lat, lon: poi.lon },
    ).catch(() => undefined)
    detailPanel.show(poi, route)
  }, filterPanel.getActiveTypes())

  // User location marker
  if (userPos) {
    currentUserPos = userPos
    new google.maps.Marker({
      position: userPos,
      map: mapService.getMap(),
      title: 'Mein Standort',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#4285F4',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
      },
    })
  }

  let abortController: AbortController | null = null

  async function refreshPois() {
    const bounds = mapService.getBounds()
    if (!bounds) return
    const types = filterPanel.getActiveTypes()

    abortController?.abort()
    abortController = new AbortController()

    try {
      const pois = await fetchPois(bounds, types, abortController.signal)
      markerManager.updatePois(pois)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') console.error('POI fetch failed:', err)
    }
  }

  mapService.onBoundsChanged(() => refreshPois())

  filterPanel.onChange(({ type, active }) => {
    markerManager.setTypeVisible(type, active)
    refreshPois()
  })

  detailPanel.onNavigate(async ({ poi }) => {
    const route = await directionsService.route(
      { lat: currentUserPos.lat, lon: currentUserPos.lng },
      { lat: poi.lat, lon: poi.lon },
    ).catch(() => undefined)
    if (route) detailPanel.show(poi, route)
  })

  searchBar.init(mapService.getMap())
  searchBar.onPlaceSelected(({ lat, lng }) => {
    mapService.setCenter(lat, lng, 14)
  })
}

init().catch(err => {
  console.error('Startup failed:', err)
  document.getElementById('map')!.textContent = `Fehler beim Laden: ${err.message}`
})
