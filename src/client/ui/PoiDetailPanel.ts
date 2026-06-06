import type { OsmPoi } from '../poi/OverpassClient.js'
import { buildOsmPoiLink, buildGoogleMapsLink } from '../routing/DirectionsService.js'
import type { RouteResult, RoutingMode } from '../routing/DirectionsService.js'
import { coalesce } from '../../shared/fp.js'
import { strEllipsisLen } from '../../shared/str.js'

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

export interface NearbyItem {
  readonly kind: string
  readonly icon: string
  readonly name: string
  readonly distance: number
}

export class PoiDetailPanel {
  private readonly panel: HTMLElement
  private readonly listeners: Array<(r: NavigateRequest) => void> = []
  private readonly closeListeners: Array<() => void> = []
  private readonly favListeners: Array<() => void> = []

  constructor(private readonly container: HTMLElement) {
    this.panel = document.createElement('aside')
    this.panel.className = 'poi-detail-panel hidden'
    this.panel.setAttribute('aria-label', 'POI Details')
    this.container.appendChild(this.panel)

    this.panel.addEventListener('click', (e) => {
      const link = (e.target as HTMLElement).closest<HTMLElement>('[data-lightbox]')
      if (link?.dataset['lightbox']) {
        e.preventDefault()
        showLightbox(link.dataset['lightbox'])
      }
    })

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return
      if (this.panel.classList.contains('hidden')) return
      // Lightbox handles its own ESC — don't also close the panel behind it
      const lightbox = document.getElementById('poi-lightbox')
      if (lightbox && !lightbox.classList.contains('hidden')) return
      this.hide()
    })
  }

  show(poi: OsmPoi, route?: RouteResult, mode?: RoutingMode, isFavorite = false): void {
    this.panel.classList.remove('hidden')
    this.panel.innerHTML = this.renderHtml(poi, route, mode, isFavorite)
    this.panel.querySelector('.btn-navigate')?.addEventListener('click', () => {
      for (const l of this.listeners) l({ poi })
    })
    this.panel.querySelector('.btn-close')?.addEventListener('click', () => this.hide())

    const favBtn = this.panel.querySelector<HTMLButtonElement>('.btn-favorite')
    favBtn?.addEventListener('click', () => {
      const nowFav = favBtn.getAttribute('aria-pressed') !== 'true'
      favBtn.setAttribute('aria-pressed', String(nowFav))
      favBtn.textContent = nowFav ? '♥' : '♡'
      favBtn.classList.toggle('active', nowFav)
      for (const l of this.favListeners) l()
    })
  }

  updateImages(images: PoiImage[]): void {
    const section = this.panel.querySelector<HTMLElement>('[data-section="images"]')
    if (!section) return
    if (images.length === 0) { section.innerHTML = ''; return }
    section.innerHTML = renderImages(images)
  }

  updateNearby(items: NearbyItem[]): void {
    const section = this.panel.querySelector<HTMLElement>('[data-section="nearby"]')
    if (!section) return
    if (items.length === 0) { section.innerHTML = ''; return }
    const rows = items.map(it => {
      const dist = it.distance < 1000
        ? `${it.distance} m`
        : `${(it.distance / 1000).toFixed(1).replace('.', ',')} km`
      return `<li class="nearby-item"><span class="nearby-icon">${it.icon}</span><span class="nearby-name">${esc(it.name)}</span><span class="nearby-dist">${dist}</span></li>`
    }).join('')
    section.innerHTML = `<h3 class="nearby-heading">📍 In der Nähe</h3><ul class="nearby-list">${rows}</ul>`
  }

  updateNotes(notes: OsmNote[]): void {
    const section = this.panel.querySelector<HTMLElement>('[data-section="notes"]')
    if (!section) return
    section.innerHTML = renderNotes(notes)
  }

  hide(): void {
    this.panel.classList.add('hidden')
    this.panel.innerHTML = ''
    hideLightbox()
    for (const l of this.closeListeners) l()
  }

  onClose(listener: () => void): () => void {
    this.closeListeners.push(listener)
    return () => {
      const idx = this.closeListeners.indexOf(listener)
      if (idx !== -1) this.closeListeners.splice(idx, 1)
    }
  }

  onFavoriteToggle(listener: () => void): () => void {
    this.favListeners.push(listener)
    return () => {
      const idx = this.favListeners.indexOf(listener)
      if (idx !== -1) this.favListeners.splice(idx, 1)
    }
  }

  onNavigate(listener: (r: NavigateRequest) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const idx = this.listeners.indexOf(listener)
      if (idx !== -1) this.listeners.splice(idx, 1)
    }
  }

  private renderHtml(poi: OsmPoi, route?: RouteResult, mode: RoutingMode = 'driving', isFavorite = false): string {
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
    if (t.phone) addLink('Telefon', safeUrl(`tel:${t.phone}`), t.phone)
    if (t.email) addLink('E-Mail', safeUrl(`mailto:${t.email}`), t.email)
    if (t.website) addLink('Website', safeUrl(t.website), 'Öffnen')

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

    // ── Opening hours status ───────────────────────────────────────────────────
    const ohStatus = t.opening_hours ? parseOpenHours(t.opening_hours) : null
    const ohBadge = ohStatus
      ? `<div class="oh-badge ${ohStatus.open ? 'oh-open' : 'oh-closed'}">${esc(ohStatus.hint)}</div>`
      : ''

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
        <button class="btn-favorite${isFavorite ? ' active' : ''}" aria-label="Favorit" aria-pressed="${isFavorite}">${isFavorite ? '♥' : '♡'}</button>
        <button class="btn-close" aria-label="Schließen">✕</button>
      </div>
      ${ohBadge}
      ${routeHtml}
      <div data-section="images"></div>
      <table class="poi-tags">${rows.join('')}</table>
      <div data-section="nearby"></div>
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
      ? `<a href="${esc(safeUrl(img.link))}" target="_blank" rel="noopener" class="poi-img-item">${thumb}${caption}</a>`
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
      parts.push(`<a href="${esc(raw)}" data-lightbox="${esc(raw)}"><img src="${esc(raw)}" class="note-img" alt="" loading="lazy" /></a>`)
    } else {
      const label = strEllipsisLen(45)(raw) ?? raw
      parts.push(`<a href="${esc(raw)}" target="_blank" rel="noopener">${esc(label)}</a>`)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(esc(text.slice(last)))
  return parts.join('')
}

function parseOpenHours(value: string): { open: boolean; hint: string } | null {
  const v = value.trim()
  if (!v) return null
  if (v === '24/7') return { open: true, hint: 'Immer geöffnet' }

  const now = new Date()
  const todayDow = now.getDay() // 0=Sun
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const DOW: Record<string, number> = { Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6, Su: 0 }

  function dayApplies(spec: string): boolean {
    if (!spec) return true
    if (spec.includes('-')) {
      const [a, b] = spec.split('-').map(d => DOW[d.trim()] ?? -1)
      if (a === undefined || b === undefined || a < 0 || b < 0) return true
      return a <= b ? todayDow >= a && todayDow <= b : todayDow >= a || todayDow <= b
    }
    const days = spec.split(',').map(d => DOW[d.trim()] ?? -1).filter(d => d >= 0)
    return days.length ? days.includes(todayDow) : true
  }

  for (const rule of v.split(';').map(r => r.trim()).filter(Boolean)) {
    const tms = [...rule.matchAll(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/g)]
    if (!tms.length) continue
    const daySpec = rule.slice(0, tms[0]!.index).trim().replace(/[,\s]+$/, '')
    if (!dayApplies(daySpec)) continue

    for (const m of tms) {
      const start = parseInt(m[1]!) * 60 + parseInt(m[2]!)
      const end = parseInt(m[3]!) * 60 + parseInt(m[4]!)
      if (nowMin >= start && nowMin < end)
        return { open: true, hint: `Geöffnet · schließt ${m[3]!.padStart(2, '0')}:${m[4]}` }
    }
    const f = tms[0]!
    return { open: false, hint: `Geschlossen · öffnet ${f[1]!.padStart(2, '0')}:${f[2]}` }
  }
  return null
}

function getLightbox(): HTMLElement {
  let lb = document.getElementById('poi-lightbox')
  if (!lb) {
    lb = document.createElement('div')
    lb.id = 'poi-lightbox'
    lb.className = 'lightbox hidden'
    lb.innerHTML = `
      <div class="lightbox-backdrop"></div>
      <button class="lightbox-close" aria-label="Schließen">✕</button>
      <img class="lightbox-img" src="" alt="" />
    `
    document.body.appendChild(lb)
    lb.querySelector('.lightbox-backdrop')!.addEventListener('click', hideLightbox)
    lb.querySelector('.lightbox-close')!.addEventListener('click', hideLightbox)
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideLightbox() })
  }
  return lb
}

function showLightbox(src: string): void {
  const lb = getLightbox()
  lb.querySelector<HTMLImageElement>('.lightbox-img')!.src = src
  lb.classList.remove('hidden')
}

function hideLightbox(): void {
  document.getElementById('poi-lightbox')?.classList.add('hidden')
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Sanitize a URL so that only safe protocols can appear in href attributes.
 *  OSM tags like `website` are user-provided and could contain `javascript:` URLs.
 */
function safeUrl(url: string): string {
  try {
    const u = new URL(url)
    return ['http:', 'https:', 'tel:', 'mailto:'].includes(u.protocol) ? url : '#'
  } catch {
    return '#'
  }
}

const TYPE_LABELS: Record<OsmPoi['type'], string> = {
  parking: 'Parkplatz',
  camper: 'Camper-Stellplatz',
  campsite: 'Campingplatz',
  dump: 'Entsorgungsstation',
  water: 'Wasserstelle',
}

// coalesce ensures we always get a string, even if a new type is added later
const typeLabel = (type: OsmPoi['type']): string => coalesce('Ort')(TYPE_LABELS[type])

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
