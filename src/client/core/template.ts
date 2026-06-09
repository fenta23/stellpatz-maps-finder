// Tiny helpers for the native <template> approach: author markup in .html
// files (imported via Vite's `?raw`), clone it, and fill `data-ref` points.
// No dependency, no templating runtime — just the DOM.

/** Clone a raw HTML string's single root element into a live element. */
export function clone<T extends HTMLElement = HTMLElement>(rawHtml: string): T {
  const t = document.createElement('template')
  t.innerHTML = rawHtml.trim()
  const el = t.content.firstElementChild
  if (!el) throw new Error('template has no root element')
  return el.cloneNode(true) as T
}

/** Clone a raw HTML string into a fragment (for markup with multiple roots). */
export function cloneFragment(rawHtml: string): DocumentFragment {
  const t = document.createElement('template')
  t.innerHTML = rawHtml.trim()
  return t.content.cloneNode(true) as DocumentFragment
}

/** Find a `[data-ref="name"]` element within a root (throws if missing). */
export function ref<T extends HTMLElement = HTMLElement>(root: ParentNode, name: string): T {
  const el = root.querySelector<T>(`[data-ref="${name}"]`)
  if (!el) throw new Error(`missing [data-ref="${name}"]`)
  return el
}

/** Optional variant of `ref` — returns null instead of throwing. */
export function refOpt<T extends HTMLElement = HTMLElement>(root: ParentNode, name: string): T | null {
  return root.querySelector<T>(`[data-ref="${name}"]`)
}
