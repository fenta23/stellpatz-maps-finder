import L from 'leaflet'
import 'leaflet.markercluster'
import type { MapAdapter } from '@/features/pois/PoiMarkerManager.js'

const ICON_SIZE: [number, number] = [32, 32]
const ICON_ANCHOR: [number, number] = [16, 32]
const markerIcon = (iconUrl: string) => L.icon({ iconUrl, iconSize: ICON_SIZE, iconAnchor: ICON_ANCHOR })

/**
 * Leaflet implementation of the POI MapAdapter. Owns a marker-cluster group
 * added to the map; PoiMarkerManager drives it without knowing about Leaflet.
 */
export function createLeafletMarkerAdapter(map: L.Map): MapAdapter {
  const clusterGroup = L.markerClusterGroup({
    maxClusterRadius: 50,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    zoomToBoundsOnClick: true,
    disableClusteringAtZoom: 17,
  })
  clusterGroup.addTo(map)

  return {
    createMarker({ lat, lon, title, icon, onClick }) {
      const marker = L.marker([lat, lon], { icon: markerIcon(icon), title })
      marker.on('click', onClick)
      clusterGroup.addLayer(marker)
      return {
        setVisible(visible: boolean) {
          if (visible) clusterGroup.addLayer(marker)
          else clusterGroup.removeLayer(marker)
        },
        remove() { clusterGroup.removeLayer(marker) },
        updateIcon(iconUrl: string) { marker.setIcon(markerIcon(iconUrl)) },
      }
    },
  }
}
