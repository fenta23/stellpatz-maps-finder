import type { MapAdapter } from '@/features/pois/PoiMarkerManager.js'
import { CustomPoiMarkerManager, DEFAULT_PERSONAL_COLOR } from '@/features/custom-pois/CustomPoiMarkerManager.js'
import { CustomPoiEditor } from '@/features/custom-pois/CustomPoiEditor.js'
import { SyncedCustomPoiStore, createSupabaseCustomPoiBackend, type CustomPoiBackend } from '@/features/custom-pois/RemoteCustomPoiStore.js'
import { LocalCustomPoiStore } from '@/features/custom-pois/CustomPoiStore.js'
import type { CustomPoi } from '@/features/custom-pois/CustomPoi.js'
import type { MapService } from '@/features/map/MapService.js'
import type { Selection } from './selection.js'
import { customPoiToOsmPoi } from '@/features/poi-detail/PoiDetailPanel.js'

export interface CustomPoiWiringDeps {
  readonly adapter: MapAdapter
  readonly mapService: MapService
  readonly selection: Selection
  readonly color: string
}

export interface CustomPoiWiringResult {
  readonly store: SyncedCustomPoiStore
  readonly editor: CustomPoiEditor
  readonly markerManager: CustomPoiMarkerManager
  readonly refreshMarkers: () => void
  readonly editCurrent: () => void
  readonly deleteCurrent: () => void
  readonly connect: (backend: CustomPoiBackend) => Promise<void>
  readonly disconnect: () => void
}

export function initCustomPois(deps: CustomPoiWiringDeps): CustomPoiWiringResult {
  const { adapter, mapService, selection, color } = deps

  const store = new SyncedCustomPoiStore(new LocalCustomPoiStore())
  const editor = new CustomPoiEditor(document.body)
  let currentCustomPoi: CustomPoi | undefined

  const markerManager = new CustomPoiMarkerManager(
    adapter,
    poi => {
      currentCustomPoi = poi
      void selection.select(customPoiToOsmPoi(poi))
    },
    color,
  )

  const refreshMarkers = () => markerManager.updatePois(store.getAll())

  const editCurrent = () => {
    const p = currentCustomPoi
    if (!p) return
    void editor.openEdit(p).then(updated => {
      if (!updated) return
      store.put(updated)
      currentCustomPoi = updated
      refreshMarkers()
      void selection.select(customPoiToOsmPoi(updated))
    })
  }

  const deleteCurrent = () => {
    const p = currentCustomPoi
    if (!p) return
    if (!confirm('Diesen POI wirklich löschen?')) return
    store.remove(p.id)
    currentCustomPoi = undefined
    refreshMarkers()
    selection.clear()
  }

  store.onChange(() => refreshMarkers())

  // Long-press / context menu → new POI
  mapService.onContextMenu((lat, lng) => {
    void editor.openNew(lat, lng).then(poi => {
      if (!poi) return
      store.put(poi)
      refreshMarkers()
      mapService.setCenter(poi.lat, poi.lon, 16)
    })
  })

  // Placement mode → new POI
  mapService.onPlacement((lat, lng) => {
    void editor.openNew(lat, lng).then(poi => {
      if (!poi) return
      store.put(poi)
      refreshMarkers()
      mapService.setCenter(poi.lat, poi.lon, 16)
    })
  })

  return {
    store, editor, markerManager, refreshMarkers, editCurrent, deleteCurrent,
    connect: async (backend) => {
      await store.connect(backend)
      refreshMarkers()
    },
    disconnect: () => store.disconnect(),
  }
}
