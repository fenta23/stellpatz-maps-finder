import { registerSW } from 'virtual:pwa-register'

const SVG_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'

export class UpdateBanner {
  private readonly el: HTMLElement
  private onUpdate: () => void = () => {}

  constructor() {
    this.el = document.createElement('div')
    this.el.className = 'update-banner'
    this.el.innerHTML = `<span class="update-banner-text">Neue Version verf\u00fcgbar</span><button class="update-banner-btn" type="button">Jetzt aktualisieren</button><button class="update-banner-close" type="button" aria-label="Schlie\u00dfen">${SVG_CLOSE}</button>`
    this.el.querySelector('.update-banner-btn')!.addEventListener('click', () => this.onUpdate())
    this.el.querySelector('.update-banner-close')!.addEventListener('click', () => this.hide())
  }

  /** Wire what the "Jetzt aktualisieren" button does (the SW updater). */
  setUpdateHandler(fn: () => void): void {
    this.onUpdate = fn
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
 * Register the service worker in prompt mode and show the banner when a new
 * version is waiting. Uses vite-plugin-pwa's `registerSW`, whose `onNeedRefresh`
 * fires reliably both when an update is found *and* when one is already waiting
 * at load \u2014 avoiding the `updatefound` race the manual listener had.
 *
 * The "Jetzt aktualisieren" button calls `updateSW(true)` \u2192 skipWaiting + reload,
 * cleanly activating the waiting worker. No-op in dev (SW disabled) and in
 * browsers without SW support.
 */
export function watchServiceWorkerUpdates(banner: UpdateBanner): void {
  const updateSW = registerSW({
    onNeedRefresh() {
      banner.show()
    },
    onRegisteredSW(_swUrl, reg) {
      if (!reg) return
      // Re-check for a new version when the tab regains focus \u2014 covers
      // long-lived (installed) PWA sessions that rarely do a full reload.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg.update()
      })
    },
  })
  banner.setUpdateHandler(() => void updateSW(true))
}
