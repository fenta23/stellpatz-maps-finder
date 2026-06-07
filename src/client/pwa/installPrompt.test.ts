import { describe, it, expect } from 'vitest'
import { chooseAffordance, isIos } from './installPrompt.js'

describe('isIos', () => {
  it('detects iPhone', () => expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X)')).toBe(true))
  it('detects iPad', () => expect(isIos('Mozilla/5.0 (iPad; CPU OS 16_4 like Mac OS X)')).toBe(true))
  it('rejects Android', () => expect(isIos('Mozilla/5.0 (Linux; Android 13; Pixel 7)')).toBe(false))
  it('rejects desktop Chrome', () => expect(isIos('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false))
})

describe('chooseAffordance', () => {
  it('shows nothing when already installed (standalone)', () => {
    expect(chooseAffordance({ standalone: true, ios: true, hasPromptEvent: true })).toBe('none')
  })

  it('prefers the native button when the prompt event is available', () => {
    expect(chooseAffordance({ standalone: false, ios: false, hasPromptEvent: true })).toBe('button')
  })

  it('falls back to the iOS hint when no prompt event and on iOS', () => {
    expect(chooseAffordance({ standalone: false, ios: true, hasPromptEvent: false })).toBe('ios-hint')
  })

  it('shows nothing on a desktop browser without prompt support', () => {
    expect(chooseAffordance({ standalone: false, ios: false, hasPromptEvent: false })).toBe('none')
  })
})
