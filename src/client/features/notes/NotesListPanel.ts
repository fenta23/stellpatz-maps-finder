import type { PoiNote } from './NotesStore.js'
import { typeIcon, typeLabel } from '@/features/pois/poiMeta.js'
import { paginate } from '@shared/paginate.js'

export interface NotesListPanelDeps {
  getNotes: () => readonly PoiNote[]
  onSelect: (note: PoiNote) => void
  onRemove: (note: PoiNote) => void
}

const PAGE_SIZE = 8

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = cls
  return node
}

// Reuses the `.fav-*` list-overlay styles (shared visual language for the
// menu's full-screen list views).
export class NotesListPanel {
  private readonly panel: HTMLElement
  private readonly listEl: HTMLElement
  private readonly footer: HTMLElement
  private page = 1

  constructor(container: HTMLElement, private readonly deps: NotesListPanelDeps) {
    this.panel = el('div', 'fav-panel')
    this.panel.setAttribute('role', 'dialog')
    this.panel.setAttribute('aria-label', 'Notizen')

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

  refresh(): void { if (this.isOpen()) this.render() }

  private buildHeader(): HTMLElement {
    const header = el('div', 'fav-header')
    const title = el('span', 'fav-title')
    title.textContent = '📝 Notizen'
    const close = el('button', 'fav-close')
    close.type = 'button'
    close.textContent = '✕'
    close.setAttribute('aria-label', 'Schließen')
    close.addEventListener('click', () => this.close())
    header.append(title, close)
    return header
  }

  private render(): void {
    const all = this.deps.getNotes()
    const { items, page, pages, total } = paginate(all, this.page, PAGE_SIZE)
    this.page = page

    this.listEl.innerHTML = ''
    if (total === 0) {
      const empty = el('li', 'fav-empty')
      empty.textContent = 'Noch keine Notizen. Öffne einen Ort und schreib unter „📝 Meine Notiz".'
      this.listEl.appendChild(empty)
    } else {
      for (const note of items) this.listEl.appendChild(this.buildRow(note))
    }

    this.renderFooter(page, pages, total)
  }

  private buildRow(note: PoiNote): HTMLElement {
    const li = el('li', 'fav-item')

    const main = el('button', 'fav-item-main')
    main.type = 'button'
    const icon = el('span', 'fav-item-icon')
    icon.textContent = typeIcon(note.type)
    const text = el('span', 'fav-item-text')
    const name = el('span', 'fav-item-name')
    name.textContent = note.name.trim() || typeLabel(note.type)
    const sub = el('span', 'fav-item-sub')
    sub.textContent = note.text
    text.append(name, sub)
    main.append(icon, text)
    main.addEventListener('click', () => { this.close(); this.deps.onSelect(note) })

    const remove = el('button', 'fav-item-remove')
    remove.type = 'button'
    remove.textContent = '🗑️'
    remove.title = 'Notiz löschen'
    remove.setAttribute('aria-label', `Notiz zu ${name.textContent} löschen`)
    remove.addEventListener('click', () => { this.deps.onRemove(note); this.refresh() })

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
