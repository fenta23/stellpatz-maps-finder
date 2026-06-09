import type { PoiType } from './OverpassClient.js'

const TYPE_META: Record<PoiType, { icon: string; label: string }> = {
  parking: { icon: '🅿️', label: 'Parkplatz' },
  camper: { icon: '🚐', label: 'Camper-Stellplatz' },
  campsite: { icon: '⛺', label: 'Campingplatz' },
  dump: { icon: '🚿', label: 'Entsorgung' },
  water: { icon: '🚰', label: 'Wasser' },
}

export function typeIcon(type: PoiType): string {
  return TYPE_META[type]?.icon ?? '📍'
}

export function typeLabel(type: PoiType): string {
  return TYPE_META[type]?.label ?? 'Ort'
}
