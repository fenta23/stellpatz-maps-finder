import { describe, it, expect } from 'vitest'
import { BASE_LAYER_CONFIGS, buildBaseLayers } from './MapService.js'

describe('BASE_LAYER_CONFIGS', () => {
  it('offers exactly a map and a satellite layer', () => {
    const labels = BASE_LAYER_CONFIGS.map(c => c.label)
    expect(labels).toEqual(['Karte', 'Satellit'])
  })

  it('uses CARTO Voyager tiles for the map layer', () => {
    const map = BASE_LAYER_CONFIGS.find(c => c.label === 'Karte')
    expect(map?.url).toContain('basemaps.cartocdn.com')
    expect(map?.url).toContain('voyager')
  })

  it('credits OpenStreetMap and CARTO on the map layer', () => {
    const map = BASE_LAYER_CONFIGS.find(c => c.label === 'Karte')
    expect(map?.attribution).toContain('OpenStreetMap')
    expect(map?.attribution).toContain('CARTO')
  })

  it('uses Esri World Imagery for the satellite layer', () => {
    const sat = BASE_LAYER_CONFIGS.find(c => c.label === 'Satellit')
    expect(sat?.url).toContain('server.arcgisonline.com')
    expect(sat?.url).toContain('World_Imagery')
  })

  it('every layer carries an attribution (free-tier requirement)', () => {
    for (const cfg of BASE_LAYER_CONFIGS) {
      expect(cfg.attribution.length).toBeGreaterThan(0)
    }
  })

  it('satellite attribution credits Esri', () => {
    const sat = BASE_LAYER_CONFIGS.find(c => c.label === 'Satellit')
    expect(sat?.attribution).toContain('Esri')
  })
})

describe('buildBaseLayers', () => {
  it('creates one tile layer per config, keyed by label', () => {
    const layers = buildBaseLayers()
    expect(Object.keys(layers)).toEqual(['Karte', 'Satellit'])
  })

  it('wires the configured url into each tile layer', () => {
    const layers = buildBaseLayers()
    // Leaflet stores the template URL on the layer instance as _url
    expect((layers['Karte'] as unknown as { _url: string })._url).toContain('cartocdn.com')
    expect((layers['Satellit'] as unknown as { _url: string })._url).toContain('arcgisonline.com')
  })
})
