import footerHtml from './paginationFooter.html?raw'
import { cloneFragment, ref } from './template.js'

/**
 * Fill a footer container with ‹ prev · "Seite x / y · total" · next › controls.
 * Leaves the container empty for a single page (so `:empty { display:none }`
 * hides it). `onGo` receives the target page (already in range).
 */
export function renderPagination(
  container: HTMLElement,
  page: number,
  pages: number,
  total: number,
  onGo: (page: number) => void,
): void {
  container.innerHTML = ''
  if (pages <= 1) return

  container.append(cloneFragment(footerHtml))
  const prev = ref<HTMLButtonElement>(container, 'prev')
  const next = ref<HTMLButtonElement>(container, 'next')
  ref(container, 'status').textContent = `Seite ${page} / ${pages} · ${total}`

  prev.disabled = page <= 1
  prev.addEventListener('click', () => onGo(page - 1))
  next.disabled = page >= pages
  next.addEventListener('click', () => onGo(page + 1))
}
