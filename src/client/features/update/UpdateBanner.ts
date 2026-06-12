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

export async function watchServiceWorkerUpdates(banner: UpdateBanner): Promise<void> {
  if (!('serviceWorker' in navigator)) return

  const swUrl = `${import.meta.env.BASE_URL}sw.js`
  const reg = await navigator.serviceWorker.register(swUrl)

  if (reg.waiting) {
    banner.show()
  }

  reg.addEventListener('updatefound', () => {
    const installing = reg.installing
    if (!installing) return
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed' && navigator.serviceWorker.controller) {
        banner.show()
      }
    })
  })

  let checkInterval: ReturnType<typeof setInterval> | undefined

  function poll(): void {
    void reg.update()
  }

  // Immediate check on page load (PWA cold open)
  poll()

  function restartInterval(): void {
    clearInterval(checkInterval)
    checkInterval = setInterval(poll, 3 * 60 * 1000)
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      poll()
      restartInterval()
    } else {
      clearInterval(checkInterval)
    }
  })

  // iOS PWA: focus event fires when app comes to foreground (reliable fallback)
  window.addEventListener('focus', () => {
    poll()
    restartInterval()
  })

  checkInterval = setInterval(poll, 3 * 60 * 1000)

  banner.setUpdateHandler(() => {
    reg.waiting?.postMessage({ type: 'SKIP_WAITING' })
    window.location.reload()
  })
}
