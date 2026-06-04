import type { OsmPoi } from '../poi/OverpassClient.js'
import { buildOsmPoiLink, buildGoogleMapsLink } from '../routing/DirectionsService.js'
import type { RouteResult, RoutingMode } from '../routing/DirectionsService.js'

export type NavigateRequest = { readonly poi: OsmPoi }

export interface OsmNote {
  readonly id: number
  readonly date: string
  readonly text: string
}

export interface PoiImage {
  readonly src: string
  readonly link?: string
  readonly caption?: string
}

export class PoiDetailPanel {
  private readonly panel: HTMLElement
  private readonly listeners: Array<(r: NavigateRequest) => void> = []
  private readonly closeListeners: Array<() => void> = []

  constructor(private readonly container: HTMLElement) {
    this.panel = document.createElement('aside')
    this.panel.className = 'poi-detail-panel hidden'
    this.panel.setAttribute('aria-label', 'POI Details')
    this.container.appendChild(this.panel)
  }

  show(poi: OsmPoi, route?: RouteResult, mode?: RoutingMode): void {
    this.panel.classList.remove('hidden')
    this.panel.innerHTML = this.renderHtml(poi, route, mode)
    this.panel.querySelector('.btn-navigate')?.addEventListener('click', () => {
      for (const l of this.listeners) l({ poi })
    })
    this.panel.querySelector('.btn-close')?.addEventListener('click', () => this.hide())
  }

  updateImages(images: PoiImage[]): void {
    const section = this.panel.querySelector<HTMLElement>('[data-section="images"]')
    if (!section) return
    if (images.length === 0) { section.innerHTML = ''; return }
    section.innerHTML = renderImages(images)
  }

  updateNotes(notes: OsmNote[]): void {
    const section = this.panel.querySelector<HTMLElement>('[data-section="notes"]')
    if (!section) return
    section.innerHTML = renderNotes(notes)
  }

  hide(): void {
    this.panel.classList.add('hidden')
    this.panel.innerHTML = ''
    for (const l of this.closeListeners) l()
  }

  onClose(listener: () => void): () => void {
    this.closeListeners.push(listener)
    return () => {
      const idx = this.closeListeners.indexOf(listener)
      if (idx !== -1) this.closeListeners.splice(idx, 1)
    }
  }

  onNavigate(listener: (r: NavigateRequest) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const idx = this.listeners.indexOf(listener)
      if (idx !== -1) this.listeners.splice(idx, 1)
    }
  }

  private renderHtml(poi: OsmPoi, route?: RouteResult, mode: RoutingMode = 'driving'): string {
    const t = poi.tags
    const name = t.name ?? typeLabel(poi.type)
    const osmLink = buildOsmPoiLink({ lat: poi.lat, lon: poi.lon })
    const googleLink = buildGoogleMapsLink({ lat: poi.lat, lon: poi.lon })

    const rows: string[] = []
    const add = (label: string, value: string | undefined) => {
      if (value) rows.push(`<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`)
    }
    const addLink = (label: string, href: string, text: string) => {
      rows.push(`<tr><th>${esc(label)}</th><td><a href="${esc(href)}" target="_blank" rel="noopener">${esc(text)} ↗</a></td></tr>`)
    }
    const bool = (v: string | undefined) =>
      v === 'yes' ? 'Ja' : v === 'no' ? 'Nein' : v === 'limited' ? 'Begrenzt' : v

    // ── Basic ──────────────────────────────────────────────────────────────────
    add('Typ', typeLabel(poi.type))
    add('Zugang', ACCESS_LABELS[t['access'] ?? ''] ?? t['access'])
    add('Öffnungszeiten', t.opening_hours)

    // ── Parking-specific ───────────────────────────────────────────────────────
    if (poi.type === 'parking') {
      add('Parkplatztyp', PARKING_LABELS[t['parking'] ?? ''] ?? t['parking'])
      add('Belag', SURFACE_LABELS[t['surface'] ?? ''] ?? t['surface'])
      add('Beleuchtet', bool(t['lit']))
      add('Überdacht', bool(t['covered']))
      add('Bewacht', bool(t['supervised']))
      if (t['maxheight']) add('Max. Höhe', t['maxheight'] + ' m')
      if (t['maxweight']) add('Max. Gewicht', t['maxweight'] + ' t')
      add('Park & Ride', bool(t['park_ride']))
      add('E-Ladesäule', bool(t['capacity:charging']))
    }

    // ── Camper / campsite ──────────────────────────────────────────────────────
    if (poi.type === 'camper' || poi.type === 'campsite') {
      add('Strom', bool(t['electricity'] ?? t['power_supply']))
      add('Trinkwasser', bool(t['drinking_water']))
      add('Dusche', bool(t['shower']))
      add('Toilette', bool(t['toilets']))
      add('Entsorgungsstation', bool(t['sanitary_dump_station'] ?? t['motorhome_dump_station']))
      add('WLAN', WIFI_LABELS[t['internet_access'] ?? ''] ?? bool(t['internet_access']))
      add('Hunde', DOG_LABELS[t['dog'] ?? ''] ?? bool(t['dog']))
      add('Wohnwagen', bool(t['caravans']))
      add('Zelte', bool(t['tents']))
      add('Nur Gruppen', bool(t['group_only']))
      if (t['stars']) add('Sterne', '★'.repeat(Number(t['stars'])))
    }

    // ── Costs ─────────────────────────────────────────────────────────────────
    add('Gebühr', t.fee === 'yes' ? 'Ja' : t.fee === 'no' ? 'Nein' : t.fee)
    add('Preis', t['charge'])
    add('Max. Aufenthalt', t['maxstay'])
    add('Kapazität', t.capacity)

    // ── Contact ────────────────────────────────────────────────────────────────
    if (t.phone) addLink('Telefon', `tel:${t.phone}`, t.phone)
    if (t.email) addLink('E-Mail', `mailto:${t.email}`, t.email)
    if (t.website) addLink('Website', t.website, 'Öffnen')

    // ── Address ────────────────────────────────────────────────────────────────
    const addrParts = [
      t['addr:street'] && t['addr:housenumber']
        ? `${t['addr:street']} ${t['addr:housenumber']}`
        : t['addr:street'],
      t['addr:postcode'] && t['addr:city']
        ? `${t['addr:postcode']} ${t['addr:city']}`
        : t['addr:city'],
    ].filter(Boolean)
    if (addrParts.length) add('Adresse', addrParts.join(', '))

    add('Betreiber', t.operator)
    if (t.description) add('Beschreibung', t.description)

    // ── Route summary ──────────────────────────────────────────────────────────
    const modeIcon: Record<RoutingMode, string> = { driving: '🚗', cycling: '🚲', foot: '🚶' }
    const routeHtml = route
      ? `<div class="route-summary">
          <span>${modeIcon[mode]} ${esc(route.distanceText)} · ${esc(route.durationText)}</span>
          <span class="detour">Luftlinie: ${formatMeters(route.straightLineMeters)} (×${route.detourFactor.toFixed(1)})</span>
        </div>`
      : ''

    return `
      <div class="panel-header">
        <h2>${esc(name)}</h2>
        <button class="btn-close" aria-label="Schließen">✕</button>
      </div>
      ${routeHtml}
      <div data-section="images"></div>
      <table class="poi-tags">${rows.join('')}</table>
      <div data-section="notes" class="poi-notes">
        <p class="notes-loading">Community-Hinweise werden geladen…</p>
      </div>
      <div class="panel-actions">
        <button class="btn-navigate btn-primary">🗺️ Route hierhin</button>
        <a class="btn-secondary" href="${osmLink}" target="_blank" rel="noopener">Auf OpenStreetMap anzeigen ↗</a>
        <a class="btn-secondary" href="${googleLink}" target="_blank" rel="noopener">In Google Maps öffnen ↗</a>
      </div>
    `
  }
}

function renderImages(images: PoiImage[]): string {
  const items = images.map(img => {
    const thumb = `<img src="${esc(img.src)}" alt="${esc(img.caption ?? '')}" loading="lazy" class="poi-img-thumb" />`
    const caption = img.caption ? `<div class="poi-img-caption">${esc(img.caption)}</div>` : ''
    return img.link
      ? `<a href="${esc(img.link)}" target="_blank" rel="noopener" class="poi-img-item">${thumb}${caption}</a>`
      : `<div class="poi-img-item">${thumb}${caption}</div>`
  }).join('')
  return `<div class="poi-img-strip">${items}</div>`
}

function renderNotes(notes: OsmNote[]): string {
  if (notes.length === 0) return ''
  const items = notes.map(n => `
    <div class="note-item">
      <div class="note-text">${renderNoteText(n.text)}</div>
      <div class="note-meta">${esc(n.date)}</div>
    </div>`).join('')
  return `<h3 class="notes-heading">📝 Community-Hinweise</h3>${items}`
}

const URL_RE = /https?:\/\/\S+/g
const IMG_EXT_RE = /\.(?:jpe?g|png|gif|webp)(?:\?.*)?$/i

function renderNoteText(text: string): string {
  const parts: string[] = []
  let last = 0
  let m: RegExpExecArray | null
  URL_RE.lastIndex = 0
  while ((m = URL_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(esc(text.slice(last, m.index)))
    const raw = m[0].replace(/[.,;:!?)]+$/, '') // strip trailing punctuation
    if (IMG_EXT_RE.test(raw)) {
      parts.push(`<a href="${esc(raw)}" target="_blank" rel="noopener"><img src="${esc(raw)}" class="note-img" alt="" loading="lazy" /></a>`)
    } else {
      const label = raw.length > 45 ? raw.slice(0, 45) + '…' : raw
      parts.push(`<a href="${esc(raw)}" target="_blank" rel="noopener">${esc(label)}</a>`)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(esc(text.slice(last)))
  return parts.join('')
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function typeLabel(type: OsmPoi['type']): string {
  return { parking: 'Parkplatz', camper: 'Camper-Stellplatz', campsite: 'Campingplatz' }[type]
}

function formatMeters(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}

const ACCESS_LABELS: Record<string, string> = {
  public: 'Öffentlich', private: 'Privat', permissive: 'Erlaubt',
  customers: 'Nur Kunden', yes: 'Ja', no: 'Nein',
}
const PARKING_LABELS: Record<string, string> = {
  surface: 'Außenparkplatz', underground: 'Tiefgarage',
  multi_storey: 'Parkhaus', rooftop: 'Dachparkplatz', street_side: 'Straßenrand',
}
const SURFACE_LABELS: Record<string, string> = {
  paved: 'Asphalt/Pflaster', unpaved: 'Unbefestigt', gravel: 'Schotter',
  sand: 'Sand', grass: 'Rasen', dirt: 'Erde',
}
const WIFI_LABELS: Record<string, string> = {
  wifi: 'WLAN', wired: 'Kabel', yes: 'Ja', no: 'Nein',
}
const DOG_LABELS: Record<string, string> = {
  yes: 'Erlaubt', no: 'Nicht erlaubt', leashed: 'An der Leine', unleashed: 'Frei',
}
