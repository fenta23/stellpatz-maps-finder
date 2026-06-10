import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { MapService } from '@/features/map/MapService.js'
import { createLeafletMarkerAdapter } from '@/features/map/leafletAdapter.js'
import { createLocationMarker } from '@/features/map/locationMarker.js'
import { panPoiIntoView } from '@/features/map/panIntoView.js'
import { PoiMarkerManager } from '@/features/pois/PoiMarkerManager.js'
import type { OsmPoi } from '@/features/pois/OverpassClient.js'
import { DirectionsService, type RoutingMode } from '@/features/routing/DirectionsService.js'
import { PoiDetailPanel } from '@/features/poi-detail/PoiDetailPanel.js'
import { collectTagImages, loadMapillaryImages, loadNearby, loadNotes } from '@/features/poi-detail/poiData.js'
import { FilterPanel } from '@/features/filters/FilterPanel.js'
import { SearchBar } from '@/features/search/SearchBar.js'
import { LocalFavoritesStore } from '@/features/favorites/FavoritesStore.js'
import { SyncedFavoritesStore, createSupabaseFavoritesBackend } from '@/features/favorites/RemoteFavoritesStore.js'
import { FavoritesListPanel } from '@/features/favorites/FavoritesListPanel.js'
import { toFavoritePoi, favoriteToPoi } from '@/features/favorites/poiLabel.js'
import { LocalNotesStore, toNoteTarget, noteToPoi } from '@/features/notes/NotesStore.js'
import { SyncedNotesStore, createSupabaseNotesBackend } from '@/features/notes/RemoteNotesStore.js'
import { NotesListPanel } from '@/features/notes/NotesListPanel.js'
import { SideMenu, type MenuItem } from '@/features/menu/SideMenu.js'
import { clearAppCache } from '@/features/menu/clearAppCache.js'
import { getSupabaseClient } from '@/features/auth/authClient.js'
import { createAuth, type Auth } from '@/features/auth/auth.js'
import { AuthPanel } from '@/features/auth/AuthPanel.js'
import { createSession } from './session.js'
import { createSelection } from './selection.js'
import { createPoiRefresher } from './poiRefresher.js'

const DEFAULT_CENTER: [number, number] = [51.163, 10.447] // Germany center

function requestLocation(statusEl: HTMLElement): Promise<[number, number] | null> {
  if (!navigator.geolocation) return Promise.resolve(null)
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
  // ── DOM ────────────────────────────────────────────────────────────────────
  const mapContainer = document.getElementById('map')!
  const statusEl = document.getElementById('status')!
  const routingModeEl = document.getElementById('routing-mode') as HTMLSelectElement

  // Auth (only when Supabase is configured) — panel built here, menu assembled
  // further down once the services it links to (favorites list, map) exist.
  const supabase = getSupabaseClient()
  let auth: Auth | null = null
  let authPanel: AuthPanel | null = null
  if (supabase) {
    auth = createAuth(supabase)
    authPanel = new AuthPanel(document.body, auth, {
      getStats: () => ({ favorites: favorites.list().length, notes: notes.list().length }),
    })
  }

  const setStatus = (msg: string, isError = false) => {
    statusEl.textContent = msg
    statusEl.className = isError ? 'status-error' : msg ? 'status-loading' : ''
  }
  const flashStatus = (msg: string) => { setStatus(msg, true); setTimeout(() => setStatus(''), 3000) }
  const flashInfo = (msg: string) => { setStatus(msg); setTimeout(() => setStatus(''), 3500) }

  // ── Location bootstrap ───────────────────────────────────────────────────────
  const userPos = await requestLocation(statusEl)
  setStatus('')

  // ── Services + state ─────────────────────────────────────────────────────────
  const mapService = new MapService(mapContainer, userPos ?? DEFAULT_CENTER, userPos ? 13 : 6)
  const map = mapService.getMap()
  const filterPanel = new FilterPanel(document.getElementById('poi-filter')!)
  const detailPanel = new PoiDetailPanel(document.getElementById('detail-panel')!)
  const searchBar = new SearchBar(document.getElementById('search-bar')!)
  const favorites = new SyncedFavoritesStore(new LocalFavoritesStore())
  const notes = new SyncedNotesStore(new LocalNotesStore())
  const directions = new DirectionsService(map)
  const session = createSession(userPos ? { lat: userPos[0], lon: userPos[1] } : null)

  // ── Location marker + live tracking ──────────────────────────────────────────
  const locationMarker = createLocationMarker(map)
  if (userPos) {
    locationMarker.update(userPos)
  } else {
    flashStatus('Standort nicht verfügbar – Karte auf Deutschland zentriert')
  }
  navigator.geolocation?.watchPosition(
    pos => {
      const next: [number, number] = [pos.coords.latitude, pos.coords.longitude]
      locationMarker.update(next)
      session.userPos = { lat: next[0], lon: next[1] }
    },
    () => { /* ignore watch errors */ },
    { maximumAge: 30000, enableHighAccuracy: false },
  )

  // ── POI markers ──────────────────────────────────────────────────────────────
  const markerManager = new PoiMarkerManager(
    createLeafletMarkerAdapter(map),
    poi => void selection.select(poi),
    filterPanel.getActiveTypes(),
  )
  markerManager.setFavorites(favorites.getAll())

  // ── Favorites sync on login/logout ───────────────────────────────────────────
  // Supabase emits the initial session on subscribe, so this also covers the
  // "already logged in at startup" case.
  if (auth && supabase) {
    auth.onChange(user => {
      if (user) {
        void favorites
          .connect(createSupabaseFavoritesBackend(supabase, user.id))
          .then(() => markerManager.setFavorites(favorites.getAll()))
        void notes.connect(createSupabaseNotesBackend(supabase, user.id))
      } else {
        favorites.disconnect()
        notes.disconnect()
      }
    })
  }

  // ── POI detail data loading (two-phase images, then nearby + notes) ──────────
  function loadDetails(poi: OsmPoi): void {
    const stillSelected = () => session.selectedPoi?.id === poi.id
    void collectTagImages(poi).then(base => {
      if (stillSelected()) detailPanel.updateImages(base)
      void loadMapillaryImages(poi).then(extra => {
        if (stillSelected()) detailPanel.updateImages([...base, ...extra])
      })
    })
    void loadNearby(poi).then(items => { if (stillSelected()) detailPanel.updateNearby(items) })
    void loadNotes(poi).then(notes => { if (stillSelected()) detailPanel.updateNotes(notes) })
  }

  // ── Selection flow (marker click / navigate / reroute / close) ───────────────
  const selection = createSelection({
    session,
    directions,
    panel: detailPanel,
    favorites,
    panIntoView: poi => panPoiIntoView(map, mapContainer, poi),
    loadDetails,
    onNoLocation: () => flashStatus('Standort unbekannt – Route nicht möglich'),
    getNote: poi => notes.get(String(poi.id)),
  })

  // ── POI refresh on map changes ───────────────────────────────────────────────
  // Tiles always carry all POI types, so filter toggles are pure visibility —
  // no refetch needed.
  const { refresh } = createPoiRefresher({
    getBounds: () => mapService.getBounds(),
    setMarkers: pois => markerManager.updatePois(pois),
    setStatus,
  })

  // ── Wiring ───────────────────────────────────────────────────────────────────
  mapService.onBoundsChanged(bounds => {
    searchBar.updateBounds(bounds)
    void refresh()
  })
  setTimeout(() => void refresh(), 800)

  filterPanel.onChange(({ type, active }) => {
    markerManager.setTypeVisible(type, active)
  })

  routingModeEl.addEventListener('change', () => {
    const mode = routingModeEl.value as RoutingMode
    if (mode === session.routingMode) return
    session.routingMode = mode
    void selection.reroute()
  })

  detailPanel.onNavigate(({ poi }) => void selection.navigate(poi))
  detailPanel.onClose(() => selection.clear())
  detailPanel.onFavoriteToggle(() => {
    if (!session.selectedPoi) return
    favorites.toggle(toFavoritePoi(session.selectedPoi))
    markerManager.setFavorites(favorites.getAll())
  })
  detailPanel.onNoteSave(text => {
    if (!session.selectedPoi) return
    notes.set(toNoteTarget(session.selectedPoi), text)
  })
  detailPanel.onNearbySelect(item => {
    const poi = session.selectedPoi
    if (!poi) return
    void directions
      .routeSecondary({ lat: poi.lat, lon: poi.lon }, { lat: item.lat, lon: item.lon })
      .then(r => flashInfo(`${item.icon} ${item.name} · ${r.distanceText} · ${r.durationText} zu Fuß`))
      .catch(() => flashStatus('Route zum Ziel nicht möglich'))
  })

  searchBar.onPlaceSelected(({ lat, lng }) => mapService.setCenter(lat, lng, 14))

  // ── Favorites list overlay + side menu ───────────────────────────────────────
  const favoritesPanel = new FavoritesListPanel(document.body, {
    getFavorites: () => favorites.list(),
    getNote: id => notes.get(id),
    onSelect: fav => {
      mapService.setCenter(fav.lat, fav.lon, 14)
      void selection.select(favoriteToPoi(fav))
    },
    onRemove: fav => {
      favorites.toggle(fav) // present → removes it
      markerManager.setFavorites(favorites.getAll())
    },
  })
  favorites.onChange(() => favoritesPanel.refresh())
  notes.onChange(() => favoritesPanel.refresh()) // a saved note updates the favorites subtitle

  const notesPanel = new NotesListPanel(document.body, {
    getNotes: () => notes.list(),
    onSelect: note => {
      mapService.setCenter(note.lat, note.lon, 14)
      void selection.select(noteToPoi(note))
    },
    onRemove: note => notes.remove(note.id),
  })
  notes.onChange(() => notesPanel.refresh())

  const menuItems: MenuItem[] = [
    { icon: '🗺️', label: 'Karte', onSelect: () => { favoritesPanel.close(); notesPanel.close() } },
    { icon: '⭐', label: 'Favoriten', onSelect: () => { notesPanel.close(); favoritesPanel.open() } },
    { icon: '📝', label: 'Notizen', onSelect: () => { favoritesPanel.close(); notesPanel.open() } },
  ]
  if (authPanel) {
    menuItems.push({ icon: '👤', label: 'Konto', onSelect: () => authPanel!.open() })
  }
  menuItems.push({
    icon: '🗑️',
    label: 'Cache leeren & neu laden',
    onSelect: () => void clearAppCache().then(() => location.reload()),
  })
  const menu = new SideMenu(document.body, menuItems)
  document.getElementById('btn-menu')?.addEventListener('click', () => menu.toggle())
}

init().catch(err => {
  console.error('Startup failed:', err)
  const map = document.getElementById('map')
  if (map) map.textContent = `Fehler beim Laden: ${(err as Error).message}`
})
