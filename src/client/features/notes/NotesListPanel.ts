import type { PoiNote } from './NotesStore.js'
import { typeIcon, typeLabel } from '@/features/pois/poiMeta.js'
import { paginate } from '@shared/paginate.js'
import { clone, ref } from '@/core/template.js'
import { renderList } from '@/core/bind.js'
import { renderPagination } from '@/core/pagination.js'
import panelHtml from './notesPanel.html?raw'

export interface NotesListPanelDeps {
  getNotes: () => readonly PoiNote[]
  onSelect: (note: PoiNote) => void
  onRemove: (note: PoiNote) => void
}

const PAGE_SIZE = 8

// Reuses the `.fav-*` list-overlay styles (shared visual language for the
// menu's full-screen list views).
export class NotesListPanel {
  private readonly panel: HTMLElement
  private readonly listEl: HTMLElement
  private readonly footer: HTMLElement
  private page = 1

  constructor(container: HTMLElement, private readonly deps: NotesListPanelDeps) {
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

  refresh(): void { if (this.isOpen()) this.render() }

  private render(): void {
    const { items, page, pages, total } = paginate(this.deps.getNotes(), this.page, PAGE_SIZE)
    this.page = page

    renderList(this.listEl, items, {
      row: note => ({
        icon: typeIcon(note.type),
        name: note.name.trim() || typeLabel(note.type),
        sub: note.text,
      }),
      on: {
        select: note => { this.close(); this.deps.onSelect(note) },
        remove: note => { this.deps.onRemove(note); this.refresh() },
      },
      decorate: (row, note) => {
        const label = note.name.trim() || typeLabel(note.type)
        row.querySelector('[data-on="remove"]')?.setAttribute('aria-label', `Notiz zu ${label} löschen`)
      },
    })

    renderPagination(this.footer, page, pages, total, p => { this.page = p; this.render() })
  }
}
