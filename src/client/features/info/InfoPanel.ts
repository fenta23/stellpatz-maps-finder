import { clone, ref } from '@/core/template.js'
import panelHtml from './infoPanel.html?raw'
import changelogRaw from '../../../../CHANGELOG.md?raw'

const VERSION = '0.9.0'

/** Render the KAC-style markdown changelog into basic HTML. */
function renderChangelog(md: string): string {
  const html: string[] = []
  for (const line of md.split('\n')) {
    if (/^##\s/.test(line)) {
      const title = line.replace(/^##\s+/, '').replace(/[`*]/g, '')
      html.push(title ? `<h4>${title}</h4>` : '')
    } else if (/^###\s/.test(line)) {
      const title = line.replace(/^###\s+/, '')
      html.push(`<h5>${title}</h5>`)
      html.push('<ul>')
    } else if (/^-\s/.test(line)) {
      const item = line.replace(/^- /, '')
      html.push(`<li>${item}</li>`)
    } else if (/^#/.test(line)) {
      // skip top-level headings
    } else {
      if (html.at(-1) === '<ul>') {
        html.pop()
      }
    }
  }
  return html.join('\n')
}

export class InfoPanel {
  private readonly panel: HTMLElement

  constructor(container: HTMLElement) {
    this.panel = clone(panelHtml)
    ref(this.panel, 'version').textContent = `v${VERSION}`
    ref(this.panel, 'changelog').innerHTML = renderChangelog(changelogRaw)
    this.panel.querySelector('.fav-close')?.addEventListener('click', () => this.close())
    container.appendChild(this.panel)

    document.addEventListener('keydown', e => { if (e.key === 'Escape' && this.isOpen()) this.close() })
  }

  isOpen(): boolean { return this.panel.classList.contains('open') }

  open(): void { this.panel.classList.add('open') }

  close(): void { this.panel.classList.remove('open') }
}
