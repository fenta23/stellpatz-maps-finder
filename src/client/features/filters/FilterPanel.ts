import { filterIconSvg } from './filterModel.js'
import type { IFilterStore } from './FilterStore.js'

const SVG_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>'

const SVG_GEAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>'

export interface FilterPanelDeps {
  /** Open the custom-POI placement flow ("+" button). */
  onAdd: () => void
  /** Open the filter configuration page (gear button). */
  onOpenConfig: () => void
}

/**
 * The on-map filter bar. Renders one chip per configured filter (driven by the
 * FilterStore), toggling a chip flips that filter's `enabled` flag in the store.
 * Re-renders itself on any store change so added/edited filters appear live.
 */
export class FilterPanel {
  constructor(
    private readonly container: HTMLElement,
    private readonly store: IFilterStore,
    private readonly deps: FilterPanelDeps,
  ) {
    this.render()
    this.store.onChange(() => this.render())
  }

  private render(): void {
    this.container.innerHTML = ''

    this.container.appendChild(this.iconButton({
      className: 'filter-btn filter-add',
      svg: SVG_PLUS,
      title: 'Eigenen POI hinzufügen',
      onClick: () => this.deps.onAdd(),
    }))

    this.container.appendChild(this.separator())

    for (const f of this.store.list()) {
      if (f.hidden) continue
      const btn = this.iconButton({
        className: `filter-btn ${f.enabled ? 'active' : ''}`,
        svg: filterIconSvg(f.iconId),
        title: f.name,
        onClick: () => this.store.setEnabled(f.id, !f.enabled),
      })
      btn.dataset['filterId'] = f.id
      btn.style.setProperty('--chip-color', f.color)
      btn.setAttribute('aria-pressed', String(f.enabled))
      this.container.appendChild(btn)
    }

    this.container.appendChild(this.separator())

    this.container.appendChild(this.iconButton({
      className: 'filter-btn filter-config',
      svg: SVG_GEAR,
      title: 'Filter verwalten',
      onClick: () => this.deps.onOpenConfig(),
    }))
  }

  private iconButton(opts: { className: string; svg: string; title: string; onClick: () => void }): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = opts.className
    btn.innerHTML = opts.svg
    btn.title = opts.title
    btn.setAttribute('aria-label', opts.title)
    btn.addEventListener('click', opts.onClick)
    return btn
  }

  private separator(): HTMLElement {
    const sep = document.createElement('span')
    sep.className = 'filter-sep'
    return sep
  }
}
