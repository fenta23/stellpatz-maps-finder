/** Bundles addEventListener calls under a single AbortController for bulk cleanup via dispose(). */
export function createEventScope() {
  const ctrl = new AbortController()
  const { signal } = ctrl

  function on<K extends keyof DocumentEventMap>(
    target: Document, type: K, handler: (e: DocumentEventMap[K]) => void,
    options?: Omit<AddEventListenerOptions, 'signal'>
  ): void
  function on<K extends keyof WindowEventMap>(
    target: Window & typeof globalThis, type: K, handler: (e: WindowEventMap[K]) => void,
    options?: Omit<AddEventListenerOptions, 'signal'>
  ): void
  function on<K extends keyof HTMLElementEventMap>(
    target: HTMLElement, type: K, handler: (e: HTMLElementEventMap[K]) => void,
    options?: Omit<AddEventListenerOptions, 'signal'>
  ): void
  function on(target: EventTarget, type: string, handler: EventListenerOrEventListenerObject, options?: Omit<AddEventListenerOptions, 'signal'>): void {
    target.addEventListener(type, handler, { ...options, signal })
  }

  return {
    on,
    dispose(): void { ctrl.abort() },
  }
}

export type EventScope = ReturnType<typeof createEventScope>
