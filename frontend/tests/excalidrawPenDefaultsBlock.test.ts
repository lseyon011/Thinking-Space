import { describe, expect, it } from 'vitest'
import { normalizeExcalidrawPenDefaultsBlock } from '@/services/lego_blocks/units/excalidrawPenDefaultsBlock'

describe('excalidrawPenDefaultsBlock', () => {
  it('preserves sub-1 stroke widths to one decimal place', () => {
    const normalized = normalizeExcalidrawPenDefaultsBlock({
      strokeColor: '#111111',
      strokeWidth: 0.34,
      opacity: 100,
      pressureSensitive: true,
    })

    expect(normalized.strokeWidth).toBe(0.3)
  })

  it('clamps stroke width to the new sub-1 minimum', () => {
    const normalized = normalizeExcalidrawPenDefaultsBlock({
      strokeColor: '#111111',
      strokeWidth: 0.01,
      opacity: 100,
      pressureSensitive: true,
    })

    expect(normalized.strokeWidth).toBe(0.1)
  })
})
