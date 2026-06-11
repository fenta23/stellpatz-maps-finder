import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CustomPoiEditor } from './CustomPoiEditor.js'
import type { CustomPoi } from './CustomPoi.js'

function makeContainer(): HTMLElement {
  return document.createElement('div')
}

function selectFirstIcon(container: HTMLElement): void {
  const firstIcon = container.querySelector<HTMLButtonElement>('.icon-opt')
  if (firstIcon) firstIcon.click()
}

function setName(container: HTMLElement, name: string): void {
  const input = container.querySelector<HTMLInputElement>('[data-ref="name"]')
  if (input) { input.value = name; input.dispatchEvent(new Event('input')) }
}

function clickSave(container: HTMLElement): void {
  container.querySelector<HTMLButtonElement>('[data-ref="saveBtn"]')?.click()
}

function clickCancel(container: HTMLElement): void {
  container.querySelector<HTMLButtonElement>('[data-ref="cancelBtn"]')?.click()
}

describe('CustomPoiEditor', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('openNew returns a new POI on save', async () => {
    const container = makeContainer()
    document.body.appendChild(container)
    const editor = new CustomPoiEditor(container)

    const promise = editor.openNew(52.52, 13.4)
    selectFirstIcon(container)
    setName(container, 'Test POI')
    clickSave(container)

    const result = await promise
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Test POI')
    expect(result!.lat).toBe(52.52)
    expect(result!.lon).toBe(13.4)
    expect(result!.iconId).toBe('parking')
    expect(result!.id).toBeTruthy()
    expect(result!.createdAt).toBeTruthy()
    expect(result!.updatedAt).toBeTruthy()
  })

  it('openNew returns null on cancel', async () => {
    const container = makeContainer()
    document.body.appendChild(container)
    const editor = new CustomPoiEditor(container)

    const promise = editor.openNew(52.52, 13.4)
    clickCancel(container)

    const result = await promise
    expect(result).toBeNull()
  })

  it('openNew returns null on Escape', async () => {
    const container = makeContainer()
    document.body.appendChild(container)
    const editor = new CustomPoiEditor(container)

    const promise = editor.openNew(52.52, 13.4)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    const result = await promise
    expect(result).toBeNull()
  })

  it('openNew returns null on backdrop click', async () => {
    const container = makeContainer()
    document.body.appendChild(container)
    const editor = new CustomPoiEditor(container)

    const promise = editor.openNew(52.52, 13.4)
    container.querySelector<HTMLElement>('.modal-backdrop')?.click()

    const result = await promise
    expect(result).toBeNull()
  })

  it('openNew shows validation error when no icon selected', async () => {
    const container = makeContainer()
    document.body.appendChild(container)
    const editor = new CustomPoiEditor(container)

    const promise = editor.openNew(52.52, 13.4)
    setName(container, 'Test')
    clickSave(container)

    expect(container.querySelector('.editor-error')?.textContent).toBe('Bitte ein Icon auswählen')
    // Cleanup and resolve
    clickCancel(container)
    await promise
  })

  it('openNew shows validation error when name is empty', async () => {
    const container = makeContainer()
    document.body.appendChild(container)
    const editor = new CustomPoiEditor(container)

    const promise = editor.openNew(52.52, 13.4)
    selectFirstIcon(container)
    clickSave(container)

    expect(container.querySelector('.editor-error')?.textContent).toBe('Bitte einen Namen eingeben')
    clickCancel(container)
    await promise
  })

  it('openEdit returns updated POI on save', async () => {
    const container = makeContainer()
    document.body.appendChild(container)
    const editor = new CustomPoiEditor(container)

    const existing: CustomPoi = {
      id: 'test-id',
      iconId: 'swimming',
      lat: 48.0,
      lon: 11.0,
      name: 'Old Name',
      street: 'Old Street',
      description: 'Old desc',
      createdAt: 500,
      updatedAt: 500,
    }

    const promise = editor.openEdit(existing)

    // Edit fields
    const nameInput = container.querySelector<HTMLInputElement>('[data-ref="name"]')
    if (nameInput) nameInput.value = 'Updated Name'
    const descInput = container.querySelector<HTMLTextAreaElement>('[data-ref="description"]')
    if (descInput) descInput.value = 'New desc'

    clickSave(container)

    const result = await promise
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Updated Name')
    expect(result!.lat).toBe(48.0)
    expect(result!.lon).toBe(11.0)
    expect(result!.id).toBe('test-id')
    expect(result!.iconId).toBe('swimming')
    expect(result!.street).toBe('Old Street')
    expect(result!.description).toBe('New desc')
    expect(result!.createdAt).toBe(500)
    expect(result!.updatedAt).toBeGreaterThan(500)
  })

  it('openEdit restores existing icon as selected', () => {
    const container = makeContainer()
    document.body.appendChild(container)
    const editor = new CustomPoiEditor(container)

    const existing: CustomPoi = {
      id: '1', iconId: 'dog', lat: 1, lon: 2, name: 'X',
      createdAt: 0, updatedAt: 0,
    }

    editor.openEdit(existing)
    const selected = container.querySelector<HTMLButtonElement>('.icon-opt.selected')
    expect(selected?.dataset['iconId']).toBe('dog')
  })

  it('renders position for new POI', async () => {
    const container = makeContainer()
    document.body.appendChild(container)
    const editor = new CustomPoiEditor(container)

    editor.openNew(51.5, 10.2)
    const pos = container.querySelector<HTMLElement>('.editor-position')
    expect(pos?.textContent).toContain('51.50000')
    expect(pos?.textContent).toContain('10.20000')

    clickCancel(container)
  })

  it('renders position for existing POI', async () => {
    const container = makeContainer()
    document.body.appendChild(container)
    const editor = new CustomPoiEditor(container)

    const existing: CustomPoi = {
      id: '1', iconId: 'parking', lat: 47.123, lon: 9.456, name: 'X',
      createdAt: 0, updatedAt: 0,
    }

    editor.openEdit(existing)
    const pos = container.querySelector<HTMLElement>('.editor-position')
    expect(pos?.textContent).toContain('47.12300')
    expect(pos?.textContent).toContain('9.45600')
  })

  it('cleans up DOM after cancel', async () => {
    const container = makeContainer()
    document.body.appendChild(container)
    const editor = new CustomPoiEditor(container)

    const promise = editor.openNew(1, 2)
    clickCancel(container)
    await promise

    expect(container.querySelector('.modal-backdrop')).toBeNull()
    expect(container.querySelector('.custom-poi-editor')).toBeNull()
  })

  it('cleans up DOM after save', async () => {
    const container = makeContainer()
    document.body.appendChild(container)
    const editor = new CustomPoiEditor(container)

    const promise = editor.openNew(1, 2)
    selectFirstIcon(container)
    setName(container, 'Test')
    clickSave(container)
    await promise

    expect(container.querySelector('.modal-backdrop')).toBeNull()
    expect(container.querySelector('.custom-poi-editor')).toBeNull()
  })

  it('all fields are present in the form', () => {
    const container = makeContainer()
    document.body.appendChild(container)
    const editor = new CustomPoiEditor(container)

    editor.openNew(1, 2)
    const fields = ['name', 'street', 'housenumber', 'postcode', 'city', 'phone', 'email', 'website', 'fee', 'capacity', 'openingHours', 'operator', 'description', 'note']
    for (const f of fields) {
      expect(container.querySelector(`[data-ref="${f}"]`)).toBeTruthy()
    }
  })
})
