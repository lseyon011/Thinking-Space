import { describe, expect, it } from 'vitest'
import { buildInlineTextDiffSessionBlock, renderInlineTextDiffBlock } from '@/services/lego_blocks/units/inlineTextDiffBlock'

describe('inlineTextDiffBlock', () => {
  it('builds hunks for changed and added runs', () => {
    const session = buildInlineTextDiffSessionBlock(
      'alpha\nbeta\ngamma',
      'alpha\nbeta changed\ngamma\ndelta',
    )
    expect(session.hunks).toHaveLength(2)
    expect(session.hunks[0]).toMatchObject({
      kind: 'changed',
      beforeStart: 1,
      beforeLines: ['beta'],
      afterLines: ['beta changed'],
    })
    expect(session.hunks[1]).toMatchObject({
      kind: 'added',
      beforeStart: 3,
      beforeLines: [],
      afterLines: ['delta'],
    })
  })

  it('renders accepted and rejected decisions into final content', () => {
    const session = buildInlineTextDiffSessionBlock(
      'line 1\nline 2\nline 3',
      'line one\nline 3',
    )
    const initial = renderInlineTextDiffBlock(session, {})
    expect(initial.content).toBe('line 1\nline 2\nline 3')
    expect(initial.summary).toEqual({
      pending: 1,
      accepted: 0,
      rejected: 0,
      total: 1,
    })

    const accepted = renderInlineTextDiffBlock(session, {
      [session.hunks[0].id]: 'accepted',
    })
    expect(accepted.content).toBe('line one\nline 3')
    expect(accepted.summary).toEqual({
      pending: 0,
      accepted: 1,
      rejected: 0,
      total: 1,
    })

    const rejected = renderInlineTextDiffBlock(session, {
      [session.hunks[0].id]: 'rejected',
    })
    expect(rejected.content).toBe('line 1\nline 2\nline 3')
    expect(rejected.summary).toEqual({
      pending: 0,
      accepted: 0,
      rejected: 1,
      total: 1,
    })
  })
})
