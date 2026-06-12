export function parseOpenHours(value: string): { open: boolean; hint: string } | null {
  const v = value.trim()
  if (!v) return null
  if (v === '24/7') return { open: true, hint: 'Immer geöffnet' }

  const now = new Date()
  const todayDow = now.getDay()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const DOW: Record<string, number> = { Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6, Su: 0 }

  function dayApplies(spec: string): boolean {
    if (!spec) return true
    if (spec.includes('-')) {
      const [a, b] = spec.split('-').map(d => DOW[d.trim()] ?? -1)
      if (a === undefined || b === undefined || a < 0 || b < 0) return true
      return a <= b ? todayDow >= a && todayDow <= b : todayDow >= a || todayDow <= b
    }
    const days = spec.split(',').map(d => DOW[d.trim()] ?? -1).filter(d => d >= 0)
    return days.length ? days.includes(todayDow) : true
  }

  for (const rule of v.split(';').map(r => r.trim()).filter(Boolean)) {
    const tms = [...rule.matchAll(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/g)]
    if (!tms.length) continue
    const daySpec = rule.slice(0, tms[0]!.index).trim().replace(/[,\s]+$/, '')
    if (!dayApplies(daySpec)) continue

    for (const m of tms) {
      const start = parseInt(m[1]!) * 60 + parseInt(m[2]!)
      const end = parseInt(m[3]!) * 60 + parseInt(m[4]!)
      if (nowMin >= start && nowMin < end)
        return { open: true, hint: `Geöffnet · schließt ${m[3]!.padStart(2, '0')}:${m[4]}` }
    }
    const f = tms[0]!
    return { open: false, hint: `Geschlossen · öffnet ${f[1]!.padStart(2, '0')}:${f[2]}` }
  }
  return null
}
