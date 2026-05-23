import { describe, expect, it } from 'vitest'
import {
  joinInkFencedBlock,
  replaceInkFencedBlock,
  splitInkFencedBlock,
} from '@/services/lego_blocks/units/inkFencedBlock'
import type { InkStroke } from '@/services/lego_blocks/units/inkStrokeBlock'

const stroke = (id: string, anchor: string): InkStroke => ({
  id,
  anchorText: anchor,
  anchorContext: 'ctx',
  type: 'freedraw',
  x: -10,
  y: 20,
  width: 12,
  height: 8,
  strokeColor: '#000',
  strokeWidth: 2,
  opacity: 100,
  simulatePressure: false,
  createdAt: 1700000000000,
  points: [
    [0, 0],
    [12, 8],
  ],
  pressures: [0.5, 0.6],
})

describe('inkFencedBlock', () => {
  it('returns body unchanged when no ink fence present', () => {
    const md = '# Title\n\nA paragraph.\n'
    const { body, strokes } = splitInkFencedBlock(md)
    expect(strokes).toHaveLength(0)
    expect(body).toBe(md) // no fence → source returned byte-for-byte
  })

  it('extracts strokes from a trailing ```ink``` fence', () => {
    const s = stroke('s_1', 'A line')
    const md = joinInkFencedBlock('# Title\n\nA line', [s])
    const { body, strokes } = splitInkFencedBlock(md)
    expect(body).toBe('# Title\n\nA line')
    expect(strokes).toHaveLength(1)
    expect(strokes[0].id).toBe('s_1')
    expect(strokes[0].anchorText).toBe('A line')
  })

  it('round-trips multiple strokes', () => {
    const a = stroke('s_a', 'first')
    const b = stroke('s_b', 'second')
    const md = joinInkFencedBlock('body', [a, b])
    const { strokes } = splitInkFencedBlock(md)
    expect(strokes.map((s) => s.id)).toEqual(['s_a', 's_b'])
  })

  it('stores anchors once and each stroke on its own line for clean diffs', () => {
    const md = joinInkFencedBlock('body', [stroke('s_a', 'x'), stroke('s_b', 'y')])
    const fenceMatch = md.match(/```ink\n([\s\S]*?)\n```/)
    expect(fenceMatch).not.toBeNull()
    const inner = fenceMatch![1]
    expect(inner).toContain('"version":2')
    expect(inner).toContain('"anchors"')
    expect(inner).toContain('"anchorId":"a_1"')
    expect(inner.split('\n').length).toBe(7)
  })

  it('omits the fence entirely when strokes are empty', () => {
    const md = joinInkFencedBlock('# Title\n\nBody', [])
    expect(md).not.toContain('```ink')
    expect(md).toBe('# Title\n\nBody\n')
  })

  it('ignores a malformed ink payload (returns body without strokes)', () => {
    const md = '# Title\n\nBody\n\n```ink\n{not json\n```\n'
    const { body, strokes } = splitInkFencedBlock(md)
    expect(strokes).toHaveLength(0)
    expect(body).toBe('# Title\n\nBody')
  })

  it('does not strip a mid-document ```ink``` block', () => {
    const md = '# Title\n\n```ink\n{"strokes":[]}\n```\n\nTrailing prose.\n'
    const { body, strokes } = splitInkFencedBlock(md)
    expect(strokes).toHaveLength(0)
    expect(body).toContain('```ink')
    expect(body).toContain('Trailing prose.')
  })

  it('replaceInkFencedBlock preserves body and swaps payload', () => {
    const md = joinInkFencedBlock('# Title\n\nBody', [stroke('s_old', 'x')])
    const updated = replaceInkFencedBlock(md, [stroke('s_new', 'y')])
    const { body, strokes } = splitInkFencedBlock(updated)
    expect(body).toBe('# Title\n\nBody')
    expect(strokes).toHaveLength(1)
    expect(strokes[0].id).toBe('s_new')
  })
})
