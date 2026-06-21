import './help.css'
import { clone, ref } from '@/core/template.js'
import { createEventScope, type EventScope } from '@/core/events.js'
import panelHtml from './helpPanel.html?raw'

export class HelpPanel {
  private readonly panel: HTMLElement
  private readonly events: EventScope = createEventScope()

  constructor(container: HTMLElement, private readonly onDismiss: () => void) {
    this.panel = clone(panelHtml)

    // Both explicit close paths (X and CTA) trigger onDismiss
    this.panel.querySelector('.help-skip')?.addEventListener('click', () => this.dismiss())
    ref(this.panel, 'start').addEventListener('click', () => this.dismiss())

    container.appendChild(this.panel)
    this.events.on(document, 'keydown', e => { if (e.key === 'Escape' && this.isOpen()) this.dismiss() })
  }

  isOpen(): boolean { return this.panel.classList.contains('open') }

  open(): void { this.panel.classList.add('open') }

  /** Programmatic close — does NOT call onDismiss. Used by closeAll() in menu coordination. */
  close(): void { this.panel.classList.remove('open') }

  destroy(): void { this.events.dispose() }

  private dismiss(): void {
    this.panel.classList.remove('open')
    this.onDismiss()
  }
}
