import { describe, it, expect, beforeEach } from 'vitest'
import { HelpSeenStore } from './HelpSeenStore.js'

beforeEach(() => localStorage.clear())

describe('HelpSeenStore', () => {
  it('isSeen() returns false on first use', () => {
    expect(new HelpSeenStore().isSeen()).toBe(false)
  })

  it('isSeen() returns true after markSeen()', () => {
    const store = new HelpSeenStore()
    store.markSeen()
    expect(store.isSeen()).toBe(true)
  })

  it('persists across instances', () => {
    new HelpSeenStore().markSeen()
    expect(new HelpSeenStore().isSeen()).toBe(true)
  })
})
