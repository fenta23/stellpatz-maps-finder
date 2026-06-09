import type { FavoritePoi } from './FavoritesStore.js'
import { favoriteLabel, typeIcon, typeLabel } from './poiLabel.js'
import { paginate } from '@shared/paginate.js'

export interface FavoritesListPanelDeps {
  getFavorites: () => readonly FavoritePoi[]
  onSelect: (fav: FavoritePoi) => void
  onRemove: (fav: FavoritePoi) => void
  /** Personal note for a POI, shown as the row subtitle when present. */
  getNote?: (id: string) => string
}

const PAGE_SIZE = 8

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = cls
  return node
}

/** Full-screen overlay listing favorited POIs, paginated, click to navigate. */
export class FavoritesListPanel {
  private readonly panel: HTMLElement
  private readonly listEl: HTMLElement
  private readonly footer: HTMLElement
  private page = 1

  constructor(container: HTMLElement, private readonly deps: FavoritesListPanelDeps) {
    this.panel = el('div', 'fav-panel')
    this.panel.setAttribute('role', 'dialog')
    this.panel.setAttribute('aria-label', 'Favoriten')

    this.listEl = el('ul', 'fav-list')
    this.footer = el('div', 'fav-footer')
    this.panel.append(this.buildHeader(), this.listEl, this.footer)
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

  private buildHeader(): HTMLElement {
    const header = el('div', 'fav-header')
    const title = el('span', 'fav-title')
    title.textContent = '⭐ Favoriten'
    const close = el('button', 'fav-close')
    close.type = 'button'
    close.textContent = '✕'
    close.setAttribute('aria-label', 'Schließen')
    close.addEventListener('click', () => this.close())
    header.append(title, close)
    return header
  }

  private render(): void {
    const all = this.deps.getFavorites()
    const { items, page, pages, total } = paginate(all, this.page, PAGE_SIZE)
    this.page = page

    this.listEl.innerHTML = ''
    if (total === 0) {
      const empty = el('li', 'fav-empty')
      empty.textContent = 'Noch keine Favoriten. Tippe auf das Herz in der Detailansicht eines Ortes.'
      this.listEl.appendChild(empty)
    } else {
      for (const fav of items) this.listEl.appendChild(this.buildRow(fav))
    }

    this.renderFooter(page, pages, total)
  }

  private buildRow(fav: FavoritePoi): HTMLElement {
    const li = el('li', 'fav-item')

    const main = el('button', 'fav-item-main')
    main.type = 'button'
    const icon = el('span', 'fav-item-icon')
    icon.textContent = typeIcon(fav.type)
    const text = el('span', 'fav-item-text')
    const name = el('span', 'fav-item-name')
    name.textContent = favoriteLabel(fav)
    const note = this.deps.getNote?.(fav.id)?.trim()
    const sub = el('span', 'fav-item-sub')
    sub.textContent = note ? `📝 ${note}` : typeLabel(fav.type)
    text.append(name, sub)
    main.append(icon, text)
    main.addEventListener('click', () => { this.close(); this.deps.onSelect(fav) })

    const remove = el('button', 'fav-item-remove')
    remove.type = 'button'
    remove.textContent = '🗑️'
    remove.title = 'Aus Favoriten entfernen'
    remove.setAttribute('aria-label', `${favoriteLabel(fav)} entfernen`)
    remove.addEventListener('click', () => { this.deps.onRemove(fav); this.refresh() })

    li.append(main, remove)
    return li
  }

  private renderFooter(page: number, pages: number, total: number): void {
    this.footer.innerHTML = ''
    if (pages <= 1) return

    const prev = el('button', 'fav-page-btn')
    prev.type = 'button'
    prev.textContent = '‹'
    prev.setAttribute('aria-label', 'Vorherige Seite')
    prev.disabled = page <= 1
    prev.addEventListener('click', () => { this.page = page - 1; this.render() })

    const status = el('span', 'fav-page-status')
    status.textContent = `Seite ${page} / ${pages} · ${total}`

    const next = el('button', 'fav-page-btn')
    next.type = 'button'
    next.textContent = '›'
    next.setAttribute('aria-label', 'Nächste Seite')
    next.disabled = page >= pages
    next.addEventListener('click', () => { this.page = page + 1; this.render() })

    this.footer.append(prev, status, next)
  }
}
