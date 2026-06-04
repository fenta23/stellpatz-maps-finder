import type { OsmPoi } from '../poi/OverpassClient.js'
import { buildOsmPoiLink, buildGoogleMapsLink } from '../routing/DirectionsService.js'
import type { RouteResult, RoutingMode } from '../routing/DirectionsService.js'

export type NavigateRequest = { readonly poi: OsmPoi }

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

    add('Typ', typeLabel(poi.type))
    add('Öffnungszeiten', t.opening_hours)
    add('Telefon', t.phone)
    add('Website', t.website ? undefined : undefined) // handled below
    add('Gebühr', t.fee)
    add('Kapazität', t.capacity)
    add('Betreiber', t.operator)
    add('Beschreibung', t.description)

    const websiteRow = t.website
      ? `<tr><th>Website</th><td><a href="${esc(t.website)}" target="_blank" rel="noopener">Öffnen ↗</a></td></tr>`
      : ''

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
      <table class="poi-tags">
        ${rows.join('')}
        ${websiteRow}
      </table>
      <div class="panel-actions">
        <button class="btn-navigate btn-primary">🗺️ Route hierhin</button>
        <a class="btn-secondary" href="${osmLink}" target="_blank" rel="noopener">Auf OpenStreetMap anzeigen ↗</a>
        <a class="btn-secondary" href="${googleLink}" target="_blank" rel="noopener">In Google Maps öffnen ↗</a>
      </div>
    `
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function typeLabel(type: OsmPoi['type']): string {
  const labels: Record<OsmPoi['type'], string> = {
    parking: 'Parkplatz',
    camper: 'Camper-Stellplatz',
    campsite: 'Campingplatz',
  }
  return labels[type]
}

function formatMeters(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}
