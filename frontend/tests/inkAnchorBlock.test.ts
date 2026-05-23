import { describe, expect, it } from 'vitest'
import {
  buildAnchorForBlockIndex,
  resolveInkAnchorsBlock,
  trigramSimilarityBlock,
} from '@/services/lego_blocks/units/inkAnchorBlock'
import type { InkStroke } from '@/services/lego_blocks/units/inkStrokeBlock'
import { hashAnchorContextBlock } from '@/services/lego_blocks/units/inkStrokeBlock'

const makeStroke = (overrides: Partial<InkStroke> = {}): InkStroke => ({
  id: 's_x',
  anchorText: 'Bought milk today',
  anchorContext: '',
  type: 'freedraw',
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  strokeColor: '#000',
  strokeWidth: 2,
  opacity: 100,
  simulatePressure: false,
  createdAt: 0,
  points: [],
  pressures: [],
  ...overrides,
})

describe('inkAnchorBlock', () => {
  it('exact-context: re-anchors when text and context both match', () => {
    const blocks = ['intro', 'Bought milk today', 'outro']
    const ctx = hashAnchorContextBlock(['intro', 'Bought milk today', 'outro'])
    const [res] = resolveInkAnchorsBlock([makeStroke({ anchorContext: ctx })], { blockTexts: blocks })
    expect(res.kind).toBe('exact-context')
    expect(res.blockIndex).toBe(1)
    expect(res.updatedAnchorContext).toBeUndefined()
  })

  it('exact-unique: refreshes context hash when neighbors changed', () => {
    const blocks = ['new intro', 'Bought milk today', 'new outro']
    const [res] = resolveInkAnchorsBlock(
      [makeStroke({ anchorContext: 'stale' })],
      { blockTexts: blocks },
    )
    expect(res.kind).toBe('exact-unique')
    expect(res.blockIndex).toBe(1)
    expect(res.updatedAnchorContext).toBeDefined()
  })

  it('exact-disambiguated: picks the duplicate matching the context hash', () => {
    const blocks = ['prev-a', 'follow up', 'mid', 'prev-b', 'follow up', 'tail']
    const ctxOfSecond = hashAnchorContextBlock(['prev-b', 'follow up', 'tail'])
    const [res] = resolveInkAnchorsBlock(
      [makeStroke({ anchorText: 'follow up', anchorContext: ctxOfSecond })],
      { blockTexts: blocks },
    )
    expect(res.kind).toBe('exact-disambiguated')
    expect(res.blockIndex).toBe(4)
  })

  it('fuzzy: re-anchors when the text was edited slightly', () => {
    const blocks = ['intro', 'Bought some milk today afternoon', 'outro']
    const [res] = resolveInkAnchorsBlock(
      [makeStroke({ anchorText: 'Bought milk today' })],
      { blockTexts: blocks },
    )
    expect(res.kind).toBe('fuzzy')
    expect(res.blockIndex).toBe(1)
    expect(res.updatedAnchorText).toBe('Bought some milk today afternoon')
  })

  it('orphan: returns null block index when nothing is close enough', () => {
    const blocks = ['totally unrelated paragraph about cars']
    const [res] = resolveInkAnchorsBlock(
      [makeStroke({ anchorText: 'Bought milk today' })],
      { blockTexts: blocks },
    )
    expect(res.kind).toBe('orphan')
    expect(res.blockIndex).toBeNull()
  })

  it('trigramSimilarityBlock returns 1 for identical strings and 0 for empties', () => {
    expect(trigramSimilarityBlock('hello world', 'hello world')).toBe(1)
    expect(trigramSimilarityBlock('', 'x')).toBe(0)
    expect(trigramSimilarityBlock('x', '')).toBe(0)
  })

  it('buildAnchorForBlockIndex emits matching text and context', () => {
    const blocks = ['a', 'b', 'c']
    const anchor = buildAnchorForBlockIndex(blocks, 1)
    expect(anchor.anchorText).toBe('b')
    expect(anchor.anchorContext).toBe(hashAnchorContextBlock(['a', 'b', 'c']))
  })
})
