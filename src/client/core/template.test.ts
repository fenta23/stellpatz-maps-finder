import { describe, it, expect } from 'vitest'
import { clone, cloneFragment, ref, refOpt } from './template.js'

describe('clone', () => {
  it('clones the single root element of a raw HTML string', () => {
    const el = clone('<li class="x">hi</li>')
    expect(el.tagName).toBe('LI')
    expect(el.className).toBe('x')
    expect(el.textContent).toBe('hi')
  })

  it('tolerates surrounding whitespace', () => {
    expect(clone('\n  <span></span>\n').tagName).toBe('SPAN')
  })

  it('throws when there is no root element', () => {
    expect(() => clone('   ')).toThrow(/no root element/)
  })
})

describe('cloneFragment', () => {
  it('clones multiple sibling roots into a fragment', () => {
    const frag = cloneFragment('<b>1</b><i>2</i>')
    expect(frag.children).toHaveLength(2)
  })
})

describe('ref / refOpt', () => {
  it('finds a data-ref element', () => {
    const root = clone('<div><span data-ref="label">x</span></div>')
    expect(ref(root, 'label').textContent).toBe('x')
  })

  it('ref throws when the ref is missing', () => {
    const root = clone('<div></div>')
    expect(() => ref(root, 'nope')).toThrow(/missing \[data-ref="nope"\]/)
  })

  it('refOpt returns null when missing', () => {
    expect(refOpt(clone('<div></div>'), 'nope')).toBeNull()
  })
})
