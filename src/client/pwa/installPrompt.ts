// Add-to-home-screen UX.
//
// Chrome/Android fire `beforeinstallprompt` → we stash it and show an install
// button that triggers the native prompt. iOS Safari has no such event, so we
// show a short hint telling the user to use Share → "Zum Home-Bildschirm".
// Already-installed (standalone) → no affordance.

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIos(ua: string = navigator.userAgent): boolean {
  return /iphone|ipad|ipod/i.test(ua)
}

export type InstallAffordance = 'none' | 'button' | 'ios-hint'

/** Pure decision: which install affordance (if any) to surface. */
export function chooseAffordance(s: {
  standalone: boolean
  ios: boolean
  hasPromptEvent: boolean
}): InstallAffordance {
  if (s.standalone) return 'none' // already installed
  if (s.hasPromptEvent) return 'button' // Chrome/Android native prompt available
  if (s.ios) return 'ios-hint' // iOS Safari: manual add-to-home
  return 'none'
}

function showIosHint(): void {
  const existing = document.getElementById('install-hint')
  if (existing) return
  const hint = document.createElement('div')
  hint.id = 'install-hint'
  hint.className = 'install-hint'
  hint.textContent = 'Installieren: Teilen-Symbol → „Zum Home-Bildschirm"'
  document.body.appendChild(hint)
  setTimeout(() => hint.remove(), 6000)
}

/** Wire an install button: show/hide by affordance, trigger native prompt or iOS hint. */
export function setupInstall(button: HTMLElement): void {
  let deferred: BeforeInstallPromptEvent | null = null

  const refresh = () => {
    const affordance = chooseAffordance({
      standalone: isStandalone(),
      ios: isIos(),
      hasPromptEvent: deferred !== null,
    })
    button.hidden = affordance === 'none'
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    refresh()
  })

  window.addEventListener('appinstalled', () => {
    deferred = null
    refresh()
  })

  button.addEventListener('click', async () => {
    if (deferred) {
      await deferred.prompt()
      const { outcome } = await deferred.userChoice
      if (outcome === 'accepted') deferred = null
      refresh()
    } else if (isIos()) {
      showIosHint()
    }
  })

  refresh()
}
