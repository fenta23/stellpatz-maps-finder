// Declarative list rendering — the iteration lives in the HTML, not in TS.
//
// A list container carries `data-list` and holds a `<template data-row>` (the
// repeating unit) plus an optional `[data-empty]` element. For each data item
// the row template is cloned and bound:
//   • `data-text="key"`  → element.textContent = row(item)[key]
//   • `data-on="name"`   → click handler opts.on[name](item)
// No dependency, no eval — CSP-safe.

export type Row = Record<string, string>

export interface RenderListOptions<T> {
  /** Map a domain item to the row's `data-text` values. */
  row: (item: T) => Row
  /** Click handlers keyed by `data-on` name; each receives the source item. */
  on?: Record<string, (item: T) => void>
  /** Optional per-row tweak after binding (e.g. aria-labels). */
  decorate?: (rowEl: HTMLElement, item: T) => void
}

export function renderList<T>(
  container: HTMLElement,
  items: readonly T[],
  opts: RenderListOptions<T>,
): void {
  const tpl = container.querySelector<HTMLTemplateElement>('template[data-row]')
  if (!tpl) throw new Error('renderList: missing <template data-row>')
  const root = tpl.content.firstElementChild
  if (!root) throw new Error('renderList: <template data-row> is empty')
  const empty = container.querySelector<HTMLElement>('[data-empty]')

  // Drop previously rendered rows (keep the template + empty marker).
  for (const child of [...container.children]) {
    if (child !== tpl && child !== empty) child.remove()
  }

  if (empty) empty.hidden = items.length > 0
  if (items.length === 0) return

  const frag = document.createDocumentFragment()
  for (const item of items) {
    const rowEl = root.cloneNode(true) as HTMLElement
    const data = opts.row(item)
    for (const el of rowEl.querySelectorAll<HTMLElement>('[data-text]')) {
      el.textContent = data[el.dataset['text'] as string] ?? ''
    }
    if (opts.on) {
      for (const el of rowEl.querySelectorAll<HTMLElement>('[data-on]')) {
        const handler = opts.on[el.dataset['on'] as string]
        if (handler) el.addEventListener('click', () => handler(item))
      }
    }
    opts.decorate?.(rowEl, item)
    frag.appendChild(rowEl)
  }
  if (empty) container.insertBefore(frag, empty)
  else container.appendChild(frag)
}
