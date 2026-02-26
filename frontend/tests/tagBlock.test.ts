import { describe, expect, it } from 'vitest'
import {
  normalizeHexColorBlock,
  tagColorClassBlock,
  tagColorStyleBlock,
  tagPaletteBlock,
} from '@/services/lego_blocks/tagBlock'

describe('tagBlock color helpers', () => {
  it('returns stable palette classes for the same tag', () => {
    const first = tagPaletteBlock('ops/backlog')
    const second = tagPaletteBlock('ops/backlog')
    expect(first).toEqual(second)
  })

  it('normalizes tag whitespace before choosing a palette', () => {
    const normalized = tagPaletteBlock('ops backlog')
    const spaced = tagPaletteBlock('  ops    backlog   ')
    expect(spaced).toEqual(normalized)
  })

  it('exposes supported color variants', () => {
    const solid = tagColorClassBlock('alpha', 'solid')
    const subtle = tagColorClassBlock('alpha', 'subtle')
    const selected = tagColorClassBlock('alpha', 'selected')
    const unselected = tagColorClassBlock('alpha', 'unselected')

    expect(solid).toContain('border-')
    expect(subtle).toContain('border-')
    expect(selected).toContain('border-')
    expect(unselected).toContain('hover:bg-')
  })

  it('normalizes hex color input for picker persistence', () => {
    expect(normalizeHexColorBlock('#abc')).toBe('#aabbcc')
    expect(normalizeHexColorBlock('AABBCC')).toBe('#aabbcc')
    expect(normalizeHexColorBlock('oops')).toBeNull()
  })

  it('builds inline styles when a custom color override is provided', () => {
    const style = tagColorStyleBlock('alpha', 'solid', '#22c55e')
    expect(style).toBeTruthy()
    expect(style?.backgroundColor).toContain('rgba(')
    expect(style?.borderColor).toContain('rgba(')
    expect(style?.color).toContain('rgba(')
  })
})
