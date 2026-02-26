import { describe, expect, it } from 'vitest'
import { buildAiAssistDiffBlock } from '@/services/lego_blocks/units/aiAssistDiffBlock'

describe('aiAssistDiffBlock', () => {
  it('returns no rows for identical text', () => {
    const result = buildAiAssistDiffBlock('a\nb\nc', 'a\nb\nc')
    expect(result.rows).toHaveLength(0)
    expect(result.summary).toEqual({ changed: 0, added: 0, removed: 0, total: 0 })
    expect(result.truncated).toBe(false)
  })

  it('classifies changed, added, and removed rows', () => {
    const changedAndAdded = buildAiAssistDiffBlock(
      'line 1\nline 2\nline 3',
      'line 1\nline two\nline 3\nline 4',
    )
    expect(changedAndAdded.summary).toEqual({ changed: 1, added: 1, removed: 0, total: 2 })
    expect(changedAndAdded.rows[0]).toMatchObject({ lineNumber: 2, kind: 'changed' })
    expect(changedAndAdded.rows[1]).toMatchObject({ lineNumber: 4, kind: 'added' })

    const removed = buildAiAssistDiffBlock(
      'line 1\nline 2\nline 3',
      'line 1\nline 3',
    )
    expect(removed.summary.total).toBeGreaterThan(0)
    expect(removed.rows.some(row => row.kind === 'removed')).toBe(true)
  })

  it('truncates diff rows when maxRows is hit', () => {
    const before = Array.from({ length: 20 }, (_, i) => `before-${i}`).join('\n')
    const after = Array.from({ length: 20 }, (_, i) => `after-${i}`).join('\n')
    const result = buildAiAssistDiffBlock(before, after, 5)
    expect(result.rows).toHaveLength(5)
    expect(result.summary.total).toBe(20)
    expect(result.truncated).toBe(true)
  })
})
