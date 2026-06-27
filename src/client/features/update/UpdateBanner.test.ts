import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { UpdateBanner, watchServiceWorkerUpdates } from './UpdateBanner.js'

let reloadMock: ReturnType<typeof vi.fn>

const SW_UPDATE_FLAG = 'sw-update-in-progress'

beforeEach(() => {
  sessionStorage.clear()
  document.body.innerHTML = '<header id="topbar"></header>'
  reloadMock = vi.fn()
  Object.defineProperty(window, 'location', {
    value: { reload: reloadMock, href: 'http://localhost/' },
    configurable: true,
    writable: true,
  })
})

describe('UpdateBanner', () => {
  it('is hidden until show() and appears right after the topbar', () => {
    const banner = new UpdateBanner()
    expect(document.querySelector('.update-banner')).toBeNull()
    banner.show()
    const el = document.querySelector('.update-banner')!
    expect(el).not.toBeNull()
    expect(el.classList.contains('visible')).toBe(true)
    expect(document.getElementById('topbar')!.nextElementSibling).toBe(el)
  })

  it('the "update now" button runs the wired handler', () => {
    const banner = new UpdateBanner()
    const onUpdate = vi.fn()
    banner.setUpdateHandler(onUpdate)
    banner.show()
    document.querySelector<HTMLButtonElement>('.update-banner-btn')!.click()
    expect(onUpdate).toHaveBeenCalledOnce()
  })

  it('does nothing on click before a handler is wired (no throw)', () => {
    const banner = new UpdateBanner()
    banner.show()
    expect(() => document.querySelector<HTMLButtonElement>('.update-banner-btn')!.click()).not.toThrow()
  })

  it('the close button hides the banner', () => {
    const banner = new UpdateBanner()
    banner.show()
    const el = document.querySelector('.update-banner')!
    expect(el.classList.contains('visible')).toBe(true)
    document.querySelector<HTMLButtonElement>('.update-banner-close')!.click()
    expect(el.classList.contains('visible')).toBe(false)
  })
})

describe('watchServiceWorkerUpdates', () => {
  it('skips in DEV mode', async () => {
    vi.stubEnv('DEV', true)
    const banner = new UpdateBanner()
    const spy = vi.spyOn(banner, 'show')
    await watchServiceWorkerUpdates(banner)
    expect(spy).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })

  it('shows banner immediately if a waiting SW already exists', async () => {
    vi.stubEnv('DEV', false)
    const banner = new UpdateBanner()
    const showSpy = vi.spyOn(banner, 'show')
    const fakeReg = createFakeRegistration({ hasWaiting: true })
    setupServiceWorkerMock({ register: () => Promise.resolve(fakeReg) })
    await watchServiceWorkerUpdates(banner)
    expect(showSpy).toHaveBeenCalledOnce()
    vi.unstubAllEnvs()
  })

  it('update handler hides banner, sends SKIP_WAITING and waits for controllerchange then reloads', async () => {
    vi.stubEnv('DEV', false)
    vi.useFakeTimers()
    const banner = new UpdateBanner()
    banner.show()
    const hideSpy = vi.spyOn(banner, 'hide')
    const fakeReg = createFakeRegistration()
    const { controllerChangeListeners } = setupServiceWorkerMock({
      register: () => Promise.resolve(fakeReg),
    })

    const handlerSpy = vi.spyOn(banner, 'setUpdateHandler')
    await watchServiceWorkerUpdates(banner)

    const handler = handlerSpy.mock.calls[0]?.[0] as (() => void) | undefined
    expect(handler).toBeDefined()

    const fakeWaiting = createFakeSW()
    fakeReg.waiting = fakeWaiting
    reloadMock.mockClear()
    handler!()

    expect(hideSpy).toHaveBeenCalled() // banner hides immediately on click
    expect(fakeWaiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    // Reload should NOT have happened yet (waiting for controllerchange or timeout)
    expect(reloadMock).not.toHaveBeenCalled()

    // Fire controllerchange
    controllerChangeListeners.forEach(fn => fn())
    expect(reloadMock).toHaveBeenCalledOnce()
    expect(sessionStorage.getItem('sw-update-in-progress')).toBe('1')
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('update handler falls back to reload after 3s timeout without controllerchange', async () => {
    vi.stubEnv('DEV', false)
    vi.useFakeTimers()
    const banner = new UpdateBanner()
    const fakeReg = createFakeRegistration()
    setupServiceWorkerMock({ register: () => Promise.resolve(fakeReg) })

    const handlerSpy = vi.spyOn(banner, 'setUpdateHandler')
    await watchServiceWorkerUpdates(banner)

    const handler = handlerSpy.mock.calls[0]?.[0] as (() => void) | undefined
    expect(handler).toBeDefined()

    const fakeWaiting = createFakeSW()
    fakeReg.waiting = fakeWaiting
    reloadMock.mockClear()
    handler!()

    // NOT reloaded yet
    expect(reloadMock).not.toHaveBeenCalled()
    // Advance 3 seconds
    vi.advanceTimersByTime(3000)
    expect(reloadMock).toHaveBeenCalledOnce()
    expect(sessionStorage.getItem('sw-update-in-progress')).toBe('1')
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('update handler hides banner, sets sessionStorage flag and reloads immediately when no waiting SW', async () => {
    vi.stubEnv('DEV', false)
    const banner = new UpdateBanner()
    const hideSpy = vi.spyOn(banner, 'hide')
    const fakeReg = createFakeRegistration()
    fakeReg.waiting = null
    setupServiceWorkerMock({ register: () => Promise.resolve(fakeReg) })

    const handlerSpy = vi.spyOn(banner, 'setUpdateHandler')
    await watchServiceWorkerUpdates(banner)

    const handler = handlerSpy.mock.calls[0]?.[0] as (() => void) | undefined
    expect(handler).toBeDefined()

    reloadMock.mockClear()
    handler!()
    expect(hideSpy).toHaveBeenCalled()
    expect(sessionStorage.getItem('sw-update-in-progress')).toBe('1')
    expect(reloadMock).toHaveBeenCalledOnce()
    vi.unstubAllEnvs()
  })

  it('does not show banner on page load when sessionStorage flag is set (regression: banner appeared twice)', async () => {
    vi.stubEnv('DEV', false)
    sessionStorage.setItem(SW_UPDATE_FLAG, '1')
    const banner = new UpdateBanner()
    const showSpy = vi.spyOn(banner, 'show')
    const fakeReg = createFakeRegistration({ hasWaiting: true })
    setupServiceWorkerMock({ register: () => Promise.resolve(fakeReg) })
    await watchServiceWorkerUpdates(banner)
    expect(showSpy).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(SW_UPDATE_FLAG)).toBeNull()
    vi.unstubAllEnvs()
  })

  it('shows banner on page load when sessionStorage flag is not set', async () => {
    vi.stubEnv('DEV', false)
    const banner = new UpdateBanner()
    const showSpy = vi.spyOn(banner, 'show')
    const fakeReg = createFakeRegistration({ hasWaiting: true })
    setupServiceWorkerMock({ register: () => Promise.resolve(fakeReg) })
    await watchServiceWorkerUpdates(banner)
    expect(showSpy).toHaveBeenCalledOnce()
    vi.unstubAllEnvs()
  })

  it('handler does not double-reload (resolved guard)', async () => {
    vi.stubEnv('DEV', false)
    vi.useFakeTimers()
    const banner = new UpdateBanner()
    const fakeReg = createFakeRegistration()
    const { controllerChangeListeners } = setupServiceWorkerMock({
      register: () => Promise.resolve(fakeReg),
    })

    const handlerSpy = vi.spyOn(banner, 'setUpdateHandler')
    await watchServiceWorkerUpdates(banner)

    const handler = handlerSpy.mock.calls[0]?.[0] as (() => void) | undefined
    expect(handler).toBeDefined()

    const fakeWaiting = createFakeSW()
    fakeReg.waiting = fakeWaiting
    reloadMock.mockClear()
    handler!()

    controllerChangeListeners.forEach(fn => fn())
    expect(reloadMock).toHaveBeenCalledOnce()
    expect(sessionStorage.getItem('sw-update-in-progress')).toBe('1')
    vi.advanceTimersByTime(3000)
    // Still only called once (not doubled by timeout)
    expect(reloadMock).toHaveBeenCalledOnce()
    expect(sessionStorage.getItem('sw-update-in-progress')).toBe('1')
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })
})

function createFakeSW(state = 'installing') {
  const listeners: Record<string, Array<() => void>> = {}
  return {
    state,
    addEventListener: vi.fn((event: string, fn: () => void) => {
      (listeners[event] ??= []).push(fn)
    }),
    removeEventListener: vi.fn(),
    postMessage: vi.fn(),
    dispatchEvent(event: Event) {
      listeners[event.type]?.forEach(fn => fn())
    },
  }
}

function createFakeRegistration(opts?: { hasWaiting?: boolean }) {
  const listeners: Record<string, Array<() => void>> = {}
  const reg = {
    waiting: opts?.hasWaiting ? createFakeSW('installed') : null,
    installing: null as ReturnType<typeof createFakeSW> | null,
    active: null,
    update: vi.fn(),
    addEventListener: vi.fn((event: string, fn: () => void) => {
      (listeners[event] ??= []).push(fn)
    }),
    removeEventListener: vi.fn(),
    dispatchEvent(event: Event) {
      listeners[event.type]?.forEach(fn => fn())
    },
  }
  return reg
}

function setupServiceWorkerMock(opts?: { register?: () => Promise<unknown> }) {
  const controllerChangeListeners: Array<() => void> = []
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      register: opts?.register ?? vi.fn().mockResolvedValue(undefined),
      controller: null,
      addEventListener: vi.fn((event: string, fn: () => void) => {
        if (event === 'controllerchange') controllerChangeListeners.push(fn)
      }),
      removeEventListener: vi.fn(),
    },
    configurable: true,
    writable: true,
  })
  return { controllerChangeListeners }
}
