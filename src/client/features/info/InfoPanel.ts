import { clone, ref } from '@/core/template.js'
import panelHtml from './infoPanel.html?raw'
import changelogRaw from '../../../../CHANGELOG.md?raw'

const VERSION = '0.9.0'

/** Render the KAC-style markdown changelog into basic HTML. */
function renderChangelog(md: string): string {
  const out: string[] = []
  let inUl = false

  const closeUl = () => {
    if (inUl) { out.push('</ul>'); inUl = false }
  }

  for (const line of md.split('\n')) {
    if (/^##\s/.test(line)) {
      closeUl()
      const title = line.replace(/^##\s+/, '').replace(/[`*]/g, '')
      if (title) out.push(`<h4>${title === '[Unreleased]' ? 'Aktuelle Version' : title}</h4>`)
    } else if (/^###\s/.test(line)) {
      closeUl()
      out.push(`<h5>${line.replace(/^###\s+/, '')}</h5>`)
      out.push('<ul>')
      inUl = true
    } else if (/^-\s/.test(line)) {
      out.push(`<li>${line.replace(/^- /, '')}</li>`)
    }
  }
  closeUl()
  return out.join('\n')
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
