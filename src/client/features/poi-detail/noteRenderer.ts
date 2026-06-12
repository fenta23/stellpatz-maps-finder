import { strEllipsisLen } from '@shared/str.js'
import { esc } from './poiLabels.js'

export interface OsmNote {
  readonly id: number
  readonly date: string
  readonly text: string
}

const SVG_NOTE_HEADING = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 9a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"/><path d="M15 3v5a1 1 0 0 0 1 1h5"/></svg>'

export function renderNotes(notes: OsmNote[]): string {
  if (notes.length === 0) return ''
  const items = notes.map(n => `
    <div class="note-item">
      <div class="note-text">${renderNoteText(n.text)}</div>
      <div class="note-meta">${esc(n.date)}</div>
    </div>`).join('')
  return `<h3 class="notes-heading">${SVG_NOTE_HEADING} Community-Hinweise</h3>${items}`
}

const URL_RE = /https?:\/\/\S+/g
const IMG_EXT_RE = /\.(?:jpe?g|png|gif|webp)(?:\?.*)?$/i

export function renderNoteText(text: string): string {
  const parts: string[] = []
  let last = 0
  let m: RegExpExecArray | null
  URL_RE.lastIndex = 0
  while ((m = URL_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(esc(text.slice(last, m.index)))
    const raw = m[0].replace(/[.,;:!?)]+$/, '')
    if (IMG_EXT_RE.test(raw)) {
      parts.push(`<a href="${esc(raw)}" data-lightbox="${esc(raw)}"><img src="${esc(raw)}" class="note-img" alt="" loading="lazy" /></a>`)
    } else {
      const label = strEllipsisLen(45)(raw) ?? raw
      parts.push(`<a href="${esc(raw)}" target="_blank" rel="noopener">${esc(label)}</a>`)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(esc(text.slice(last)))
  return parts.join('')
}
