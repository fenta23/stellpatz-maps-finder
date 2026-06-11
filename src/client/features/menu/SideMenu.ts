import { clone, ref } from '@/core/template.js'
import { renderList } from '@/core/bind.js'
import menuHtml from './sideMenu.html?raw'

export interface MenuItem {
  readonly icon: string
  readonly label: string
  readonly onSelect: () => void
}

/** Slide-in drawer menu with a backdrop. Items are data — add more later. */
export class SideMenu {
  private readonly panel: HTMLElement
  private readonly backdrop: HTMLElement

  constructor(container: HTMLElement, items: readonly MenuItem[]) {
    this.backdrop = clone('<div class="side-menu-backdrop"></div>')
    this.backdrop.addEventListener('click', () => this.close())

    this.panel = clone(menuHtml)
    this.panel.querySelector('.side-menu-close')?.addEventListener('click', () => this.close())
    renderList(ref(this.panel, 'list'), items, {
      row: item => ({ icon: item.icon, label: item.label }),
      on: { select: item => { this.close(); item.onSelect() } },
      decorate: (row, item) => {
        const iconEl = row.querySelector('.side-menu-icon')
        if (iconEl) iconEl.innerHTML = item.icon
      },
    })

    container.append(this.backdrop, this.panel)

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.isOpen()) this.close()
    })
  }

  isOpen(): boolean { return this.panel.classList.contains('open') }
  open(): void { this.panel.classList.add('open'); this.backdrop.classList.add('open') }
  close(): void { this.panel.classList.remove('open'); this.backdrop.classList.remove('open') }
  toggle(): void { this.isOpen() ? this.close() : this.open() }
}
