/** Pragmatic email check — good enough to avoid obviously-bad input before
 *  hitting the auth backend (which does the authoritative validation). */
export function isValidEmail(value: string): boolean {
  const v = value.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}
