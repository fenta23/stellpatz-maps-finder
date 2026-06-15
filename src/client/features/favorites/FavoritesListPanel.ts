import type { FavoritePoi } from './FavoritesStore.js'
import { favoriteLabel, typeIcon, typeLabel } from './poiLabel.js'
import { paginate } from '@shared/paginate.js'
import { clone, ref } from '@/core/template.js'
import { renderList } from '@/core/bind.js'
import { renderPagination } from '@/core/pagination.js'
import { createEventScope, type EventScope } from '@/core/events.js'
import panelHtml from './favoritesPanel.html?raw'

export interface FavoritesListPanelDeps {
  getFavorites: () => readonly FavoritePoi[]
  onSelect: (fav: FavoritePoi) => void
  onRemove: (fav: FavoritePoi) => void
  /** Personal note for a POI, shown as the row subtitle when present. */
  getNote?: (id: string) => string
}

const SVG_NOTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 9a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"/><path d="M15 3v5a1 1 0 0 0 1 1h5"/></svg>'

const PAGE_SIZE = 8

/** Full-screen overlay listing favorited POIs, paginated, click to navigate. */
export class FavoritesListPanel {
  private readonly panel: HTMLElement
  private readonly listEl: HTMLElement
  private readonly footer: HTMLElement
  private readonly events: EventScope = createEventScope()
  private page = 1

  constructor(container: HTMLElement, private readonly deps: FavoritesListPanelDeps) {
    this.panel = clone(panelHtml)
    this.listEl = ref(this.panel, 'list')
    this.footer = ref(this.panel, 'footer')
    this.panel.querySelector('.fav-close')?.addEventListener('click', () => this.close())
    container.appendChild(this.panel)

    this.events.on(document, 'keydown', e => { if (e.key === 'Escape' && this.isOpen()) this.close() })
  }

  isOpen(): boolean { return this.panel.classList.contains('open') }
  destroy(): void { this.events.dispose() }

  open(): void {
    this.page = 1
    this.render()
    this.panel.classList.add('open')
  }

  close(): void { this.panel.classList.remove('open') }

  /** Re-render in place (e.g. after a favorite was removed or synced). */
  refresh(): void { if (this.isOpen()) this.render() }

  private render(): void {
    const { items, page, pages, total } = paginate(this.deps.getFavorites(), this.page, PAGE_SIZE)
    this.page = page

    renderList(this.listEl, items, {
      row: fav => ({
        name: favoriteLabel(fav),
      }),
      on: {
        select: fav => { this.close(); this.deps.onSelect(fav) },
        remove: fav => { this.deps.onRemove(fav); this.refresh() },
      },
      decorate: (row, fav) => {
        const iconEl = row.querySelector('[data-ref="poi-icon"]')
        if (iconEl) iconEl.innerHTML = typeIcon(fav.type)
        const note = this.deps.getNote?.(fav.id)?.trim()
        const subEl = row.querySelector('[data-ref="sub"]')
        if (subEl) {
          if (note) {
            subEl.innerHTML = SVG_NOTE
            subEl.append(' ' + note)
          } else {
            subEl.textContent = typeLabel(fav.type)
          }
        }
        row.querySelector('[data-on="remove"]')?.setAttribute('aria-label', `${favoriteLabel(fav)} entfernen`)
      },
    })

    renderPagination(this.footer, page, pages, total, p => { this.page = p; this.render() })
  }
}
