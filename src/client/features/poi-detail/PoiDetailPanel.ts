import type { OsmPoi } from '@/features/pois/OverpassClient.js'
import { buildOsmPoiLink, buildGoogleMapsLink } from '@/features/routing/DirectionsService.js'
import type { RouteResult, RoutingMode } from '@/features/routing/DirectionsService.js'
import type { CustomPoi } from '@/features/custom-pois/CustomPoi.js'
import { customIdToNumber } from '@/features/custom-pois/CustomPoi.js'
import { coalesce } from '@shared/fp.js'
import { strEllipsisLen } from '@shared/str.js'
import { clone, ref } from '@/core/template.js'
import { renderList } from '@/core/bind.js'
import panelHtml from './poiDetailPanel.html?raw'

const SVG_MAP_PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>'
const SVG_NOTE_HEADING = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 9a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"/><path d="M15 3v5a1 1 0 0 0 1 1h5"/></svg>'

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
  readonly name: string
  readonly distance: number
  readonly lat: number
  readonly lon: number
}

const NEARBY_ICONS: Record<string, string> = {
  fuel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5"/><path d="M14 21V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16"/><path d="M2 21h13"/><path d="M3 9h11"/></svg>',
  supermarket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 10a4 4 0 0 1-8 0"/><path d="M3.103 6.034h17.794"/><path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z"/></svg>',
  pharmacy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>',
  bakery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>',
  water: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>',
  dump: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
}

interface TagRow {
  readonly label: string
  readonly value: string
  readonly href?: string
}

const MODE_ICON: Record<RoutingMode, string> = {
  driving: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>',
  cycling: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>',
  foot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1"/><path d="m9 20 3-6 3 6"/><path d="m6 8 6 2 6-2"/><path d="M12 10v4"/></svg>',
}

const HEART_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/></svg>'

export interface PanelConfig {
  readonly isCustom?: boolean
  readonly onEdit?: () => void
  readonly onDelete?: () => void
}

export class PoiDetailPanel {
  private readonly panel: HTMLElement
  private readonly listeners: Array<(r: NavigateRequest) => void> = []
  private readonly closeListeners: Array<() => void> = []
  private readonly favListeners: Array<() => void> = []
  private readonly noteListeners: Array<(text: string) => void> = []
  private readonly nearbyListeners: Array<(item: NearbyItem) => void> = []
  private nearbyItems: NearbyItem[] = []

  constructor(private readonly container: HTMLElement) {
    this.panel = document.createElement('aside')
    this.panel.className = 'poi-detail-panel hidden'
    this.panel.setAttribute('aria-label', 'POI Details')
    this.container.appendChild(this.panel)

    this.panel.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      const link = target.closest<HTMLElement>('[data-lightbox]')
      if (link?.dataset['lightbox']) {
        e.preventDefault()
        showLightbox(link.dataset['lightbox'])
        return
      }
      const nearby = target.closest<HTMLElement>('[data-nearby-idx]')
      if (nearby?.dataset['nearbyIdx']) {
        const item = this.nearbyItems[Number(nearby.dataset['nearbyIdx'])]
        if (!item) return
        this.panel.querySelectorAll('.nearby-item.active').forEach(el => el.classList.remove('active'))
        nearby.classList.add('active')
        for (const l of this.nearbyListeners) l(item)
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

  show(poi: OsmPoi, route?: RouteResult, mode: RoutingMode = 'driving', isFavorite = false, noteText = '', config?: PanelConfig): void {
    this.panel.classList.remove('hidden')
    this.panel.innerHTML = ''
    const view = clone(panelHtml)
    this.panel.appendChild(view)

    const isCustom = config?.isCustom ?? false
    const t = poi.tags
    ref(view, 'name').textContent = t.name ?? typeLabel(poi.type)

    // Favorite button (hidden for custom POIs)
    const fav = ref(view, 'fav')
    if (isCustom) {
      fav.hidden = true
    } else {
      fav.setAttribute('aria-pressed', String(isFavorite))
      fav.innerHTML = HEART_SVG
      fav.classList.toggle('active', isFavorite)
      fav.addEventListener('click', () => {
        const nowFav = fav.getAttribute('aria-pressed') !== 'true'
        fav.setAttribute('aria-pressed', String(nowFav))
        fav.classList.toggle('active', nowFav)
        for (const l of this.favListeners) l()
      })
    }

    ref(view, 'close').addEventListener('click', () => this.hide())
    view.querySelector('.btn-navigate')?.addEventListener('click', () => {
      for (const l of this.listeners) l({ poi })
    })

    // Custom POI actions (edit / delete)
    const customActions = ref(view, 'customActions')
    if (isCustom) {
      customActions.hidden = false
      ref(view, 'editBtn').addEventListener('click', () => config?.onEdit?.())
      ref(view, 'deleteBtn').addEventListener('click', () => config?.onDelete?.())
    }

    // Opening-hours badge
    const oh = t.opening_hours ? parseOpenHours(t.opening_hours) : null
    if (oh) {
      const badge = ref(view, 'ohBadge')
      badge.hidden = false
      badge.classList.add(oh.open ? 'oh-open' : 'oh-closed')
      badge.textContent = oh.hint
    }

    // Route summary
    if (route) {
      ref(view, 'routeSummary').hidden = false
      ref(view, 'routeMain').innerHTML = `${MODE_ICON[mode]} ${route.distanceText} · ${route.durationText}`
      ref(view, 'routeDetour').textContent =
        `Luftlinie: ${formatMeters(route.straightLineMeters)} (×${route.detourFactor.toFixed(1)})`
    }

    // Tags table
    renderList(ref(view, 'tags'), buildTags(poi), {
      row: r => ({ label: r.label, value: r.href ? '' : r.value }),
      decorate: (rowEl, r) => {
        if (!r.href) return
        const cell = rowEl.querySelector('[data-ref="cell"]')
        if (!cell) return
        const a = clone<HTMLAnchorElement>('<a target="_blank" rel="noopener"></a>')
        a.href = safeUrl(r.href)
        a.textContent = `${r.value} ↗`
        cell.appendChild(a)
      },
    })

    // External links
    ref<HTMLAnchorElement>(view, 'osm').href = buildOsmPoiLink({ lat: poi.lat, lon: poi.lon })
    ref<HTMLAnchorElement>(view, 'gmaps').href = buildGoogleMapsLink({ lat: poi.lat, lon: poi.lon })

    // Hide data sections for custom POIs (no nearby, images, OSM notes)
    if (isCustom) {
      const sections = view.querySelectorAll<HTMLElement>('[data-section]')
      for (const s of sections) s.hidden = true
    }

    // Personal note
    ref<HTMLTextAreaElement>(view, 'note').value = noteText
    this.wireNoteEditor(noteText)
  }

  private wireNoteEditor(initial: string): void {
    const input = this.panel.querySelector<HTMLTextAreaElement>('.mynote-input')
    const status = this.panel.querySelector<HTMLElement>('.mynote-status')
    if (!input) return
    let saved = initial
    const save = () => {
      const text = input.value.trim()
      if (text === saved) return
      saved = text
      for (const l of this.noteListeners) l(text)
      if (status) status.textContent = text ? '✓ gespeichert' : 'gelöscht'
    }
    this.panel.querySelector('.mynote-save')?.addEventListener('click', save)
    input.addEventListener('blur', save)
    input.addEventListener('input', () => { if (status) status.textContent = '' })
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
    this.nearbyItems = items
    if (items.length === 0) { section.innerHTML = ''; return }
    const rows = items.map((it, i) => {
      const dist = it.distance < 1000
        ? `${it.distance} m`
        : `${(it.distance / 1000).toFixed(1).replace('.', ',')} km`
      const svg = NEARBY_ICONS[it.kind] ?? ''
      return `<li><button type="button" class="nearby-item" data-nearby-idx="${i}" title="Route von hier zeigen"><span class="nearby-icon">${svg}</span><span class="nearby-name">${esc(it.name)}</span><span class="nearby-dist">${dist}</span></button></li>`
    }).join('')
    section.innerHTML = `<h3 class="nearby-heading">${SVG_MAP_PIN} In der Nähe <span class="nearby-hint">· tippen für Route</span></h3><ul class="nearby-list">${rows}</ul>`
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

  /** Fires with the new (trimmed) note text when the personal note is saved. */
  onNoteSave(listener: (text: string) => void): () => void {
    this.noteListeners.push(listener)
    return () => {
      const idx = this.noteListeners.indexOf(listener)
      if (idx !== -1) this.noteListeners.splice(idx, 1)
    }
  }

  /** Fires when a nearby POI row is tapped (to draw a secondary route to it). */
  onNearbySelect(listener: (item: NearbyItem) => void): () => void {
    this.nearbyListeners.push(listener)
    return () => {
      const idx = this.nearbyListeners.indexOf(listener)
      if (idx !== -1) this.nearbyListeners.splice(idx, 1)
    }
  }

  onNavigate(listener: (r: NavigateRequest) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const idx = this.listeners.indexOf(listener)
      if (idx !== -1) this.listeners.splice(idx, 1)
    }
  }
}

export function customPoiToOsmPoi(cp: CustomPoi): OsmPoi {
  return {
    id: customIdToNumber(cp.id),
    type: 'parking',
    lat: cp.lat,
    lon: cp.lon,
    tags: {
      name: cp.name || undefined,
      phone: cp.phone,
      email: cp.email,
      website: cp.website,
      fee: cp.fee,
      capacity: cp.capacity,
      opening_hours: cp.openingHours,
      operator: cp.operator,
      description: cp.description,
      'addr:street': cp.street,
      'addr:housenumber': cp.housenumber,
      'addr:postcode': cp.postcode,
      'addr:city': cp.city,
    },
  }
}

function bool(v: string | undefined): string | undefined {
  return v === 'yes' ? 'Ja' : v === 'no' ? 'Nein' : v === 'limited' ? 'Begrenzt' : v
}

/** Build the ordered key/value (and link) rows for a POI's tag table. */
function buildTags(poi: OsmPoi): TagRow[] {
  const t = poi.tags
  const rows: TagRow[] = []
  const add = (label: string, value: string | undefined) => { if (value) rows.push({ label, value }) }
  const addLink = (label: string, href: string, value: string) => rows.push({ label, value, href })

  add('Typ', typeLabel(poi.type))
  add('Zugang', ACCESS_LABELS[t['access'] ?? ''] ?? t['access'])
  add('Öffnungszeiten', t.opening_hours)

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

  add('Gebühr', t.fee === 'yes' ? 'Ja' : t.fee === 'no' ? 'Nein' : t.fee)
  add('Preis', t['charge'])
  add('Max. Aufenthalt', t['maxstay'])
  add('Kapazität', t.capacity)

  if (t.phone) addLink('Telefon', `tel:${t.phone}`, t.phone)
  if (t.email) addLink('E-Mail', `mailto:${t.email}`, t.email)
  if (t.website) addLink('Website', t.website, 'Öffnen')

  const addrParts = [
    t['addr:street'] && t['addr:housenumber']
      ? `${t['addr:street']} ${t['addr:housenumber']}`
      : t['addr:street'],
    t['addr:postcode'] && t['addr:city']
      ? `${t['addr:postcode']} ${t['addr:city']}`
      : t['addr:city'],
  ].filter(Boolean) as string[]
  if (addrParts.length) add('Adresse', addrParts.join(', '))

  add('Betreiber', t.operator)
  if (t.description) add('Beschreibung', t.description)

  return rows
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
  return `<h3 class="notes-heading">${SVG_NOTE_HEADING} Community-Hinweise</h3>${items}`
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
