import type { PoiType } from './OverpassClient.js'
import { DEFAULT_FILTERS, filterIconSvg } from '@/features/filters/filterModel.js'

/**
 * Optional live registry (backed by the FilterStore) so labels/icons reflect
 * user-configured and user-created filters. Falls back to the built-in defaults
 * when unset — keeps poiMeta usable standalone (and in tests).
 */
export interface PoiMetaRegistry {
  label(id: string): string | undefined
  iconId(id: string): string | undefined
}

let registry: PoiMetaRegistry | null = null
export function setPoiMetaRegistry(r: PoiMetaRegistry | null): void {
  registry = r
}

const DEFAULT_LABEL = new Map(DEFAULT_FILTERS.map(f => [f.id, f.name]))
const DEFAULT_ICON_ID = new Map(DEFAULT_FILTERS.map(f => [f.id, f.iconId]))

export function typeLabel(type: PoiType): string {
  return registry?.label(type) ?? DEFAULT_LABEL.get(type) ?? 'Ort'
}

export function typeIcon(type: PoiType): string {
  const iconId = registry?.iconId(type) ?? DEFAULT_ICON_ID.get(type) ?? 'parking'
  return filterIconSvg(iconId)
}
