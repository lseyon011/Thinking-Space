import { describe, expect, it } from 'vitest'
import {
  buildFreedrawInkGeometryBlock,
  createInkStrokeIdBlock,
  deserializeInkStrokeBlock,
  hashAnchorContextBlock,
  quantizeInkPointsBlock,
  quantizeInkPressuresBlock,
  serializeInkStrokeBlock,
  type InkStroke,
} from '@/services/lego_blocks/units/inkStrokeBlock'

const sample: InkStroke = {
  id: 's_test000001',
  anchorText: 'Bought milk today',
  anchorContext: 'abc',
  type: 'freedraw',
  x: -20.4,
  y: 10.2,
  width: 30.8,
  height: 12.1,
  strokeColor: '#000',
  strokeWidth: 2,
  opacity: 100,
  simulatePressure: false,
  createdAt: 1700000000000,
  points: [
    [0.2, 1.7],
    [11.1, 20.9],
  ],
  pressures: [0.5123, 0.6789],
}

describe('inkStrokeBlock', () => {
  it('round-trips a freedraw stroke through serialize/deserialize', () => {
    const out = deserializeInkStrokeBlock(
      serializeInkStrokeBlock(sample, 'a_1'),
      { anchorText: sample.anchorText, anchorContext: sample.anchorContext },
    )
    expect(out).not.toBeNull()
    expect(out?.id).toBe(sample.id)
    expect(out?.anchorText).toBe(sample.anchorText)
    expect(out?.type).toBe('freedraw')
    expect(out?.points).toHaveLength(2)
    expect(out?.pressures).toHaveLength(2)
  })

  it('quantizes points and pressures for compact storage', () => {
    expect(quantizeInkPointsBlock(sample.points)).toEqual([[0, 2], [11, 21]])
    expect(quantizeInkPressuresBlock(sample.pressures)).toEqual([0.51, 0.68])
  })

  it('builds an Excalidraw-style local freedraw box from raw block-local samples', () => {
    const geometry = buildFreedrawInkGeometryBlock([
      [-10.2, 5.1, 0.111],
      [-10.2, 5.1, 0.111],
      [20.6, 17.4, 0.567],
    ])
    expect(geometry).not.toBeNull()
    expect(geometry?.x).toBe(-10)
    expect(geometry?.y).toBe(5)
    expect(geometry?.width).toBe(31)
    expect(geometry?.height).toBe(12)
    expect(geometry?.points).toEqual([[0, 0], [31, 12]])
    expect(geometry?.pressures).toEqual([0.11, 0.57])
  })

  it('rejects malformed payloads', () => {
    expect(deserializeInkStrokeBlock(null, null)).toBeNull()
    expect(deserializeInkStrokeBlock({}, { anchorText: 'x', anchorContext: 'ctx' })).toBeNull()
    expect(deserializeInkStrokeBlock({ ...serializeInkStrokeBlock(sample, 'a_1'), points: [[1, 2, 3]] }, { anchorText: 'x', anchorContext: 'ctx' })).toBeNull()
    expect(deserializeInkStrokeBlock({ ...serializeInkStrokeBlock(sample, 'a_1'), pressures: [0.5] }, { anchorText: 'x', anchorContext: 'ctx' })).toBeNull()
  })

  it('hashAnchorContextBlock is deterministic and order-sensitive', () => {
    const a = hashAnchorContextBlock(['prev', 'line', 'next'])
    const b = hashAnchorContextBlock(['prev', 'line', 'next'])
    const c = hashAnchorContextBlock(['next', 'line', 'prev'])
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })

  it('hashAnchorContextBlock distinguishes empty vs missing neighbors', () => {
    const a = hashAnchorContextBlock([null, 'line', null])
    const b = hashAnchorContextBlock(['', 'line', ''])
    expect(a).toBe(b)
  })

  it('createInkStrokeIdBlock produces distinct ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createInkStrokeIdBlock()))
    expect(ids.size).toBe(100)
  })
})
