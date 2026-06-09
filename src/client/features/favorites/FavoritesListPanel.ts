import type { FavoritePoi } from './FavoritesStore.js'
import { favoriteLabel, typeIcon, typeLabel } from './poiLabel.js'
import { paginate } from '@shared/paginate.js'
import { clone, ref } from '@/core/template.js'
import { renderList } from '@/core/bind.js'
import { renderPagination } from '@/core/pagination.js'
import panelHtml from './favoritesPanel.html?raw'

export interface FavoritesListPanelDeps {
  getFavorites: () => readonly FavoritePoi[]
  onSelect: (fav: FavoritePoi) => void
  onRemove: (fav: FavoritePoi) => void
  /** Personal note for a POI, shown as the row subtitle when present. */
  getNote?: (id: string) => string
}

const PAGE_SIZE = 8

/** Full-screen overlay listing favorited POIs, paginated, click to navigate. */
export class FavoritesListPanel {
  private readonly panel: HTMLElement
  private readonly listEl: HTMLElement
  private readonly footer: HTMLElement
  private page = 1

  constructor(container: HTMLElement, private readonly deps: FavoritesListPanelDeps) {
    this.panel = clone(panelHtml)
    this.listEl = ref(this.panel, 'list')
    this.footer = ref(this.panel, 'footer')
    this.panel.querySelector('.fav-close')?.addEventListener('click', () => this.close())
    container.appendChild(this.panel)

    document.addEventListener('keydown', e => { if (e.key === 'Escape' && this.isOpen()) this.close() })
  }

  isOpen(): boolean { return this.panel.classList.contains('open') }

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
      row: fav => {
        const note = this.deps.getNote?.(fav.id)?.trim()
        return {
          icon: typeIcon(fav.type),
          name: favoriteLabel(fav),
          sub: note ? `📝 ${note}` : typeLabel(fav.type),
        }
      },
      on: {
        select: fav => { this.close(); this.deps.onSelect(fav) },
        remove: fav => { this.deps.onRemove(fav); this.refresh() },
      },
      decorate: (row, fav) =>
        row.querySelector('[data-on="remove"]')?.setAttribute('aria-label', `${favoriteLabel(fav)} entfernen`),
    })

    renderPagination(this.footer, page, pages, total, p => { this.page = p; this.render() })
  }
}
