import './responsibility.css'
import { clone } from '@/core/template.js'
import { createEventScope, type EventScope } from '@/core/events.js'
import panelHtml from './responsibilityPanel.html?raw'

/**
 * Statische, gestaltete Inhaltsseite „Verantwortungsvoll unterwegs":
 * Kodex für respektvollen Umgang mit Natur, Umwelt und Mitmenschen.
 * Schließen über die Close-Pill, den CTA-Button (beide `[data-close]`) oder Escape.
 */
export class ResponsibilityPanel {
  private readonly panel: HTMLElement
  private readonly events: EventScope = createEventScope()

  constructor(container: HTMLElement) {
    this.panel = clone(panelHtml)
    this.panel.querySelectorAll('[data-close]').forEach(el =>
      el.addEventListener('click', () => this.close()))
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
