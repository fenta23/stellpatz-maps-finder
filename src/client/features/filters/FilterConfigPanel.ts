import { clone, ref } from '@/core/template.js'
import { generateCustomId } from '@/features/custom-pois/CustomPoi.js'
import {
  FILTER_ICONS, FILTER_COLORS, FILTER_TEMPLATES, ALL_ELEMENT_KINDS,
  filterIconSvg, isValidSelector,
  type FilterDef, type OsmElementKind, type TagCondition,
} from './filterModel.js'
import type { IFilterStore } from './FilterStore.js'
import panelHtml from './filterConfigPanel.html?raw'

const ICON = (paths: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`
const PENCIL = ICON('<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>')
const TRASH = ICON('<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>')
const RESET = ICON('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>')
const XMARK = ICON('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>')
const PLUS = ICON('<path d="M5 12h14"/><path d="M12 5v14"/>')

const ELEMENT_LABEL: Record<OsmElementKind, string> = { node: 'Punkt', way: 'Fläche', relation: 'Relation' }
const COMMON_KEYS = ['amenity', 'shop', 'tourism', 'leisure', 'sport', 'natural', 'highway', 'man_made', 'historic']

interface EditorState {
  name: string
  iconId: string
  color: string
  elements: Set<OsmElementKind>
  tags: TagCondition[]
}

/** Full-screen overlay to list, toggle, edit, add and delete POI filters. */
export class FilterConfigPanel {
  private readonly panel: HTMLElement
  private readonly body: HTMLElement

  constructor(container: HTMLElement, private readonly store: IFilterStore) {
    this.panel = clone(panelHtml)
    this.body = ref(this.panel, 'body')
    this.panel.querySelector('.fav-close')?.addEventListener('click', () => this.close())
    container.appendChild(this.panel)
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && this.isOpen()) this.close() })
    this.store.onChange(() => { if (this.isOpen() && this.mode === 'list') this.renderList() })
  }

  private mode: 'list' | 'editor' = 'list'

  isOpen(): boolean { return this.panel.classList.contains('open') }
  open(): void { this.renderList(); this.panel.classList.add('open') }
  close(): void { this.panel.classList.remove('open') }

  // ── List view ──────────────────────────────────────────────────────────────

  private renderList(): void {
    this.mode = 'list'
    this.body.innerHTML = ''
    const list = document.createElement('div')
    list.className = 'fc-list'

    for (const f of this.store.list()) {
      const row = document.createElement('div')
      row.className = 'fc-row'
      row.dataset['filterId'] = f.id

      const swatch = document.createElement('span')
      swatch.className = 'fc-swatch'
      swatch.style.background = f.color
      swatch.innerHTML = filterIconSvg(f.iconId)
      row.appendChild(swatch)

      const name = document.createElement('span')
      name.className = 'fc-name'
      name.textContent = f.name
      if (!f.builtin) {
        const badge = document.createElement('span')
        badge.className = 'fc-badge'
        badge.textContent = 'eigen'
        name.appendChild(badge)
      }
      row.appendChild(name)

      // hidden toggle (show/hide in chip bar)
      const toggle = document.createElement('label')
      toggle.className = 'fc-switch'
      toggle.title = 'In Filterleiste anzeigen'
      const cb = document.createElement('input')
      cb.type = 'checkbox'
      cb.checked = !f.hidden
      cb.setAttribute('aria-label', `${f.name} in Leiste anzeigen`)
      cb.addEventListener('change', () => this.store.setHidden(f.id, !cb.checked))
      const slider = document.createElement('span')
      slider.className = 'fc-slider'
      toggle.append(cb, slider)
      row.appendChild(toggle)

      // edit (appearance for built-ins / personal; full for user filters)
      const edit = document.createElement('button')
      edit.type = 'button'
      edit.className = 'fc-icon-btn'
      edit.innerHTML = PENCIL
      edit.title = 'Bearbeiten'
      edit.setAttribute('aria-label', `${f.name} bearbeiten`)
      edit.addEventListener('click', () => this.openEditor(f))
      row.appendChild(edit)

      // delete (user) / reset (built-in, only when customised)
      const del = document.createElement('button')
      del.type = 'button'
      del.className = 'fc-icon-btn fc-danger'
      if (f.builtin) {
        del.innerHTML = RESET
        del.title = 'Auf Standard zurücksetzen'
        del.addEventListener('click', () => this.store.remove(f.id))
      } else {
        del.innerHTML = TRASH
        del.title = 'Filter löschen'
        del.addEventListener('click', () => {
          if (confirm(`Filter „${f.name}" löschen?`)) this.store.remove(f.id)
        })
      }
      del.setAttribute('aria-label', del.title)
      row.appendChild(del)

      list.appendChild(row)
    }
    this.body.appendChild(list)

    const addBtn = document.createElement('button')
    addBtn.type = 'button'
    addBtn.className = 'fc-add-btn'
    addBtn.innerHTML = `${PLUS} <span>Neuen Filter anlegen</span>`
    addBtn.addEventListener('click', () => this.openEditor(null))
    this.body.appendChild(addBtn)
  }

  // ── Editor view ──────────────────────────────────────────────────────────────

  private openEditor(existing: FilterDef | null): void {
    this.mode = 'editor'
    const sel = existing?.selectors[0]
    const state: EditorState = {
      name: existing?.name ?? '',
      iconId: existing?.iconId ?? FILTER_ICONS[0]!.id,
      color: existing?.color ?? FILTER_COLORS[0]!,
      elements: new Set<OsmElementKind>(sel?.elements ?? ['node', 'way']),
      tags: sel ? sel.tags.map(t => ({ ...t })) : [{ key: '', value: '' }],
    }
    // Tags are editable only for new or user-created OSM filters.
    const tagsEditable = (!existing || (!existing.builtin && existing.kind === 'osm'))
    this.buildEditorForm(existing, state, tagsEditable)
  }

  /** (Re)build the editor DOM from the given mutable state. */
  private buildEditorForm(existing: FilterDef | null, state: EditorState, tagsEditable: boolean): void {
    this.body.innerHTML = ''
    const form = document.createElement('div')
    form.className = 'fc-editor'

    const heading = document.createElement('h3')
    heading.className = 'fc-editor-title'
    heading.textContent = existing ? `„${existing.name}" bearbeiten` : 'Neuer Filter'
    form.appendChild(heading)

    const error = document.createElement('p')
    error.className = 'fc-error'
    error.hidden = true
    form.appendChild(error)

    // Templates (new only)
    if (!existing) {
      const tmplWrap = document.createElement('div')
      tmplWrap.className = 'fc-field'
      tmplWrap.innerHTML = '<label>Vorlage (optional)</label>'
      const gallery = document.createElement('div')
      gallery.className = 'fc-templates'
      for (const t of FILTER_TEMPLATES) {
        const b = document.createElement('button')
        b.type = 'button'
        b.className = 'fc-template'
        b.innerHTML = `<span class="fc-swatch" style="background:${t.color}">${filterIconSvg(t.iconId)}</span><span>${t.name}</span>`
        b.addEventListener('click', () => {
          state.name = t.name; state.iconId = t.iconId; state.color = t.color
          state.elements = new Set(t.selectors[0]!.elements)
          state.tags = t.selectors[0]!.tags.map(x => ({ ...x }))
          this.buildEditorForm(existing, state, tagsEditable)
        })
        gallery.appendChild(b)
      }
      tmplWrap.appendChild(gallery)
      form.appendChild(tmplWrap)
    }

    // Name
    const nameField = document.createElement('div')
    nameField.className = 'fc-field'
    nameField.innerHTML = '<label for="fc-name">Name</label>'
    const nameInput = document.createElement('input')
    nameInput.id = 'fc-name'
    nameInput.type = 'text'
    nameInput.className = 'fc-input'
    nameInput.value = state.name
    nameInput.placeholder = 'z. B. Tankstelle'
    nameInput.addEventListener('input', () => { state.name = nameInput.value })
    nameField.appendChild(nameInput)
    form.appendChild(nameField)

    // Preview + Icon + Color row
    const appearance = document.createElement('div')
    appearance.className = 'fc-appearance'

    const preview = document.createElement('span')
    preview.className = 'fc-preview fc-swatch'
    const updatePreview = () => { preview.style.background = state.color; preview.innerHTML = filterIconSvg(state.iconId) }
    updatePreview()
    appearance.appendChild(preview)

    // Icon picker
    const iconWrap = document.createElement('div')
    iconWrap.className = 'fc-field fc-grow'
    iconWrap.innerHTML = '<label>Icon</label>'
    const iconGrid = document.createElement('div')
    iconGrid.className = 'fc-icon-grid'
    for (const ic of FILTER_ICONS) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = `fc-icon-opt ${ic.id === state.iconId ? 'selected' : ''}`
      b.dataset['iconId'] = ic.id
      b.title = ic.label
      b.innerHTML = filterIconSvg(ic.id)
      b.addEventListener('click', () => {
        state.iconId = ic.id
        iconGrid.querySelectorAll('.fc-icon-opt').forEach(x => x.classList.remove('selected'))
        b.classList.add('selected')
        updatePreview()
      })
      iconGrid.appendChild(b)
    }
    iconWrap.appendChild(iconGrid)
    appearance.appendChild(iconWrap)
    form.appendChild(appearance)

    // Colours
    const colorField = document.createElement('div')
    colorField.className = 'fc-field'
    colorField.innerHTML = '<label>Farbe</label>'
    const colorRow = document.createElement('div')
    colorRow.className = 'fc-colors'
    for (const c of FILTER_COLORS) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = `fc-color ${c === state.color ? 'selected' : ''}`
      b.style.background = c
      b.dataset['color'] = c
      b.setAttribute('aria-label', c)
      b.addEventListener('click', () => {
        state.color = c
        colorRow.querySelectorAll('.fc-color').forEach(x => x.classList.remove('selected'))
        b.classList.add('selected')
        updatePreview()
      })
      colorRow.appendChild(b)
    }
    colorField.appendChild(colorRow)
    form.appendChild(colorField)

    // Tags / OSM query (editable filters only)
    if (tagsEditable) {
      const tagsField = document.createElement('div')
      tagsField.className = 'fc-field'
      tagsField.innerHTML = '<label>OSM-Objekte</label>'
      const kinds = document.createElement('div')
      kinds.className = 'fc-kinds'
      for (const k of ALL_ELEMENT_KINDS) {
        const lab = document.createElement('label')
        lab.className = 'fc-kind'
        const cb = document.createElement('input')
        cb.type = 'checkbox'
        cb.checked = state.elements.has(k)
        cb.addEventListener('change', () => { cb.checked ? state.elements.add(k) : state.elements.delete(k) })
        lab.append(cb, document.createTextNode(' ' + ELEMENT_LABEL[k]))
        kinds.appendChild(lab)
      }
      tagsField.appendChild(kinds)

      const tagsLabel = document.createElement('label')
      tagsLabel.textContent = 'Tag-Bedingungen'
      tagsField.appendChild(tagsLabel)
      const rows = document.createElement('div')
      rows.className = 'fc-tags'
      tagsField.appendChild(rows)
      const renderRows = () => {
        rows.innerHTML = ''
        state.tags.forEach((cond, i) => {
          const r = document.createElement('div')
          r.className = 'fc-tag-row'
          const key = document.createElement('input')
          key.className = 'fc-input'; key.placeholder = 'Schlüssel (z. B. amenity)'; key.value = cond.key
          key.setAttribute('list', 'fc-keys')
          key.addEventListener('input', () => { cond.key = key.value.trim() })
          const op = document.createElement('button')
          op.type = 'button'; op.className = 'fc-op'; op.textContent = cond.negate ? '≠' : '='
          op.title = 'Gleich / ungleich umschalten'
          op.addEventListener('click', () => { cond.negate = !cond.negate; op.textContent = cond.negate ? '≠' : '=' })
          const val = document.createElement('input')
          val.className = 'fc-input'; val.placeholder = 'Wert (leer = beliebig)'; val.value = cond.value
          val.addEventListener('input', () => { cond.value = val.value.trim() })
          const rm = document.createElement('button')
          rm.type = 'button'; rm.className = 'fc-icon-btn fc-danger'; rm.innerHTML = XMARK; rm.title = 'Bedingung entfernen'
          rm.addEventListener('click', () => { state.tags.splice(i, 1); if (state.tags.length === 0) state.tags.push({ key: '', value: '' }); renderRows() })
          r.append(key, op, val, rm)
          rows.appendChild(r)
        })
      }
      renderRows()

      const addRow = document.createElement('button')
      addRow.type = 'button'
      addRow.className = 'fc-add-row'
      addRow.innerHTML = `${PLUS} <span>Bedingung</span>`
      addRow.addEventListener('click', () => { if (state.tags.length < 6) { state.tags.push({ key: '', value: '' }); renderRows() } })
      tagsField.appendChild(addRow)
      form.appendChild(tagsField)
    } else {
      const note = document.createElement('p')
      note.className = 'fc-note'
      note.textContent = 'Name, Icon und Farbe sind anpassbar. Die OSM-Tags dieses Filters sind fest.'
      form.appendChild(note)
    }

    // Actions
    const actions = document.createElement('div')
    actions.className = 'fc-actions'
    const cancel = document.createElement('button')
    cancel.type = 'button'; cancel.className = 'fc-btn'; cancel.textContent = 'Abbrechen'
    cancel.addEventListener('click', () => this.renderList())
    const save = document.createElement('button')
    save.type = 'button'; save.className = 'fc-btn fc-btn-primary'; save.textContent = 'Speichern'
    save.addEventListener('click', () => this.save(existing, state, tagsEditable, error))
    actions.append(cancel, save)
    form.appendChild(actions)

    // keys datalist
    const datalist = document.createElement('datalist')
    datalist.id = 'fc-keys'
    for (const k of COMMON_KEYS) { const o = document.createElement('option'); o.value = k; datalist.appendChild(o) }
    form.appendChild(datalist)

    this.body.appendChild(form)
  }

  private save(existing: FilterDef | null, state: EditorState, tagsEditable: boolean, error: HTMLElement): void {
    const fail = (msg: string) => { error.textContent = msg; error.hidden = false }
    if (!state.name.trim()) return fail('Bitte einen Namen eingeben.')

    let selectors = existing?.selectors ?? []
    if (tagsEditable) {
      const tags = state.tags.filter(t => t.key.length > 0)
      const selector = { elements: [...state.elements], tags }
      if (!isValidSelector(selector)) {
        return fail('Bitte mindestens ein OSM-Objekt und eine gültige Tag-Bedingung angeben (Schlüssel/Werte ohne Leerzeichen).')
      }
      selectors = [selector]
    }

    const def: FilterDef = {
      id: existing?.id ?? generateCustomId(),
      name: state.name.trim(),
      iconId: state.iconId,
      color: state.color,
      enabled: existing?.enabled ?? true,
      kind: existing?.kind ?? 'osm',
      builtin: existing?.builtin ?? false,
      order: existing?.order ?? this.nextOrder(),
      selectors,
    }
    this.store.put(def)
    this.renderList()
  }

  private nextOrder(): number {
    return Math.max(0, ...this.store.list().map(f => f.order)) + 1
  }
}
