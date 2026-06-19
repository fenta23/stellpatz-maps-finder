const KEY = 'stellplatz:help-seen'

export class HelpSeenStore {
  isSeen(): boolean {
    try { return localStorage.getItem(KEY) === 'true' } catch { return false }
  }

  markSeen(): void {
    try { localStorage.setItem(KEY, 'true') } catch { /* quota */ }
  }
}
