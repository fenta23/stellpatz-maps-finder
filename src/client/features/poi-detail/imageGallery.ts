import { esc, safeUrl } from './poiLabels.js'

export interface PoiImage {
  readonly src: string
  readonly link?: string
  readonly caption?: string
}

export function renderImages(images: PoiImage[]): string {
  const items = images.map(img => {
    const thumb = `<img src="${esc(img.src)}" alt="${esc(img.caption ?? '')}" loading="lazy" class="poi-img-thumb" />`
    const caption = img.caption ? `<div class="poi-img-caption">${esc(img.caption)}</div>` : ''
    return img.link
      ? `<a href="${esc(safeUrl(img.link))}" target="_blank" rel="noopener" class="poi-img-item">${thumb}${caption}</a>`
      : `<div class="poi-img-item">${thumb}${caption}</div>`
  }).join('')
  return `<div class="poi-img-strip">${items}</div>`
}

export function getLightbox(): HTMLElement {
  let lb = document.getElementById('poi-lightbox')
  if (!lb) {
    lb = document.createElement('div')
    lb.id = 'poi-lightbox'
    lb.className = 'lightbox hidden'
    lb.innerHTML = `
      <div class="lightbox-backdrop"></div>
      <button class="lightbox-close" aria-label="Schließen">✕</button>
      <img class="lightbox-img" src="" alt="" />
    `
    document.body.appendChild(lb)
    lb.querySelector('.lightbox-backdrop')!.addEventListener('click', hideLightbox)
    lb.querySelector('.lightbox-close')!.addEventListener('click', hideLightbox)
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideLightbox() })
  }
  return lb
}

export function showLightbox(src: string): void {
  const lb = getLightbox()
  lb.querySelector<HTMLImageElement>('.lightbox-img')!.src = src
  lb.classList.remove('hidden')
}

export function hideLightbox(): void {
  document.getElementById('poi-lightbox')?.classList.add('hidden')
}
