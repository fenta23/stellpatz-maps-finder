import { clone, ref } from '@/core/template.js'
import { createEventScope, type EventScope } from '@/core/events.js'
import panelHtml from './datenschutzPanel.html?raw'

const CONTROLLER = import.meta.env.VITE_DSGVO_VERANTWORTLICHER ?? 'der Betreiber dieser App'

export class DatenschutzPanel {
  private readonly panel: HTMLElement
  private readonly events: EventScope = createEventScope()

  constructor(container: HTMLElement) {
    this.panel = clone(panelHtml)
    ref(this.panel, 'controller').textContent = CONTROLLER
    this.panel.querySelector('.fav-close')?.addEventListener('click', () => this.close())
    // Klick auf den Backdrop (nur im Desktop-Modal sichtbar) schließt ebenfalls.
    this.panel.addEventListener('click', e => { if (e.target === this.panel) this.close() })
    container.appendChild(this.panel)

    this.events.on(document, 'keydown', e => { if (e.key === 'Escape' && this.isOpen()) this.close() })
  }

  isOpen(): boolean { return this.panel.classList.contains('open') }
  open(): void { this.panel.classList.add('open') }
  close(): void { this.panel.classList.remove('open') }
  destroy(): void { this.events.dispose() }
}
