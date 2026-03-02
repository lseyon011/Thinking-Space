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
      pending: 2,
      accepted: 0,
      rejected: 0,
      total: 2,
    })

    const accepted = renderInlineTextDiffBlock(session, {
      [session.hunks[0].id]: 'accepted',
      [session.hunks[1].id]: 'accepted',
    })
    expect(accepted.content).toBe('line one\nline 3')
    expect(accepted.summary).toEqual({
      pending: 0,
      accepted: 2,
      rejected: 0,
      total: 2,
    })

    const rejected = renderInlineTextDiffBlock(session, {
      [session.hunks[0].id]: 'rejected',
      [session.hunks[1].id]: 'rejected',
    })
    expect(rejected.content).toBe('line 1\nline 2\nline 3')
    expect(rejected.summary).toEqual({
      pending: 0,
      accepted: 0,
      rejected: 2,
      total: 2,
    })
  })

  it('groups mixed-run tails into block hunks and preserves exact suggested output when accepted', () => {
    const original = [
      'alpha',
      'beta',
      'gamma',
      'delta',
    ].join('\n')
    const suggested = [
      'alpha',
      'beta updated',
      'delta',
      'inserted tail',
    ].join('\n')

    const session = buildInlineTextDiffSessionBlock(original, suggested)
    expect(session.hunks).toHaveLength(3)
    expect(session.hunks.map(hunk => hunk.kind)).toEqual(['changed', 'removed', 'added'])

    const acceptedAll = renderInlineTextDiffBlock(
      session,
      Object.fromEntries(session.hunks.map(hunk => [hunk.id, 'accepted' as const])),
    )
    expect(acceptedAll.content).toBe(suggested)

    const rejectedAll = renderInlineTextDiffBlock(
      session,
      Object.fromEntries(session.hunks.map(hunk => [hunk.id, 'rejected' as const])),
    )
    expect(rejectedAll.content).toBe(original)
  })

  it('keeps insertion order for multiple added lines at the same anchor', () => {
    const session = buildInlineTextDiffSessionBlock(
      'line 1\nline 2',
      'line 1\ninserted a\ninserted b\nline 2',
    )
    expect(session.hunks.map(hunk => hunk.kind)).toEqual(['added'])
    expect(session.hunks[0].afterLines).toEqual(['inserted a', 'inserted b'])

    const accepted = renderInlineTextDiffBlock(
      session,
      Object.fromEntries(session.hunks.map(hunk => [hunk.id, 'accepted' as const])),
    )
    expect(accepted.content).toBe('line 1\ninserted a\ninserted b\nline 2')
  })

  it('retains preview-diff row ordering for mixed add/remove tails', () => {
    const session = buildInlineTextDiffSessionBlock(
      'line 1\nline 2\nline 3',
      'line one\nline 3\nline 4\nline 5',
    )
    expect(session.hunks.map(hunk => hunk.kind)).toEqual(['changed', 'removed', 'added'])
    const accepted = renderInlineTextDiffBlock(
      session,
      Object.fromEntries(session.hunks.map(hunk => [hunk.id, 'accepted' as const])),
    )
    expect(accepted.content).toBe('line one\nline 3\nline 4\nline 5')
    const pending = renderInlineTextDiffBlock(session, {})
    expect(pending.content).toBe('line 1\nline 2\nline 3')
  })

  it('supports partially accepting changes while rejecting others', () => {
    const session = buildInlineTextDiffSessionBlock(
      'first\nsecond\nthird',
      'first updated\nthird',
    )
    const partiallyAccepted = renderInlineTextDiffBlock(session, {
      [session.hunks[0].id]: 'accepted',
      [session.hunks[1].id]: 'rejected',
    })
    expect(partiallyAccepted.content).toBe('first updated\nsecond\nthird')

    const fullyAccepted = renderInlineTextDiffBlock(session, {
      [session.hunks[0].id]: 'accepted',
      [session.hunks[1].id]: 'accepted',
    })
    expect(fullyAccepted.content).toBe('first updated\nthird')
  })
})
