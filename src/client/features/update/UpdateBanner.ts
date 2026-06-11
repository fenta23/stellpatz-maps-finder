import { clearAppCache } from '@/features/menu/clearAppCache.js'

const SVG_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'

export class UpdateBanner {
  private readonly el: HTMLElement

  constructor() {
    this.el = document.createElement('div')
    this.el.className = 'update-banner'
    this.el.innerHTML = `<span class="update-banner-text">Neue Version verf\u00fcgbar</span><button class="update-banner-btn" type="button">Jetzt aktualisieren</button><button class="update-banner-close" type="button" aria-label="Schlie\u00dfen">${SVG_CLOSE}</button>`
    this.el.querySelector('.update-banner-btn')!.addEventListener('click', () => {
      void clearAppCache().then(() => location.reload())
    })
    this.el.querySelector('.update-banner-close')!.addEventListener('click', () => {
      this.hide()
    })
  }

  show(): void {
    document.getElementById('topbar')!.after(this.el)
    this.el.classList.add('visible')
  }

  hide(): void {
    this.el.classList.remove('visible')
  }
}

/**
 * Listen for service-worker updates and show the banner when a new version is
 * found. Only activates when the browser supports SW (i.e. in production PWA).
 */
export function watchServiceWorkerUpdates(banner: UpdateBanner): void {
  if (!('serviceWorker' in navigator)) return

  navigator.serviceWorker.ready.then(reg => {
    let seen = false
    reg.addEventListener('updatefound', () => {
      if (seen) return
      seen = true
      banner.show()
    })
  })
}
