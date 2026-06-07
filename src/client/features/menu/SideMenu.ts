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
    this.backdrop = document.createElement('div')
    this.backdrop.className = 'side-menu-backdrop'
    this.backdrop.addEventListener('click', () => this.close())

    this.panel = document.createElement('aside')
    this.panel.className = 'side-menu'
    this.panel.setAttribute('aria-label', 'Menü')
    this.panel.append(this.buildHeader(), this.buildList(items))

    container.append(this.backdrop, this.panel)

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.isOpen()) this.close()
    })
  }

  private buildHeader(): HTMLElement {
    const header = document.createElement('div')
    header.className = 'side-menu-header'
    const title = document.createElement('span')
    title.textContent = 'Menü'
    const close = document.createElement('button')
    close.className = 'side-menu-close'
    close.setAttribute('aria-label', 'Schließen')
    close.textContent = '✕'
    close.addEventListener('click', () => this.close())
    header.append(title, close)
    return header
  }

  private buildList(items: readonly MenuItem[]): HTMLElement {
    const list = document.createElement('ul')
    list.className = 'side-menu-list'
    for (const item of items) {
      const li = document.createElement('li')
      const btn = document.createElement('button')
      btn.className = 'side-menu-item'
      const icon = document.createElement('span')
      icon.className = 'side-menu-icon'
      icon.textContent = item.icon
      const label = document.createElement('span')
      label.textContent = item.label
      btn.append(icon, label)
      btn.addEventListener('click', () => { this.close(); item.onSelect() })
      li.appendChild(btn)
      list.appendChild(li)
    }
    return list
  }

  isOpen(): boolean { return this.panel.classList.contains('open') }
  open(): void { this.panel.classList.add('open'); this.backdrop.classList.add('open') }
  close(): void { this.panel.classList.remove('open'); this.backdrop.classList.remove('open') }
  toggle(): void { this.isOpen() ? this.close() : this.open() }
}
