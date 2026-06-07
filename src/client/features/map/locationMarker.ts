import L from 'leaflet'

/** A single "my location" dot that can be moved as positions stream in. */
export function createLocationMarker(map: L.Map): { update(pos: [number, number]): void } {
  let marker: L.CircleMarker | null = null
  return {
    update(pos) {
      if (marker) marker.remove()
      marker = L.circleMarker(pos, {
        radius: 8,
        fillColor: '#B5562F', // terracotta — matches the app theme
        fillOpacity: 1,
        color: '#fff',
        weight: 2,
      })
        .addTo(map)
        .bindTooltip('Mein Standort')
    },
  }
}
