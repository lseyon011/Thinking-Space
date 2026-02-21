import { describe, expect, it } from 'vitest'
import { fuzzyMatchScoreBlock, rankFuzzyItemsBlock } from '@/services/lego_blocks/fuzzySearchBlock'

describe('fuzzySearchBlock', () => {
  it('scores matching candidates above non-matches', () => {
    const match = fuzzyMatchScoreBlock('pln', 'Project Plan')
    const noMatch = fuzzyMatchScoreBlock('pln', 'Archive')
    expect(match).toBeGreaterThan(0)
    expect(noMatch).toBe(-1)
  })

  it('handles multi-term query matching', () => {
    const score = fuzzyMatchScoreBlock('project plan', 'projects/alpha/Project Plan.md')
    expect(score).toBeGreaterThan(0)
  })

  it('ranks results by score and respects limit', () => {
    const ranked = rankFuzzyItemsBlock({
      items: ['Archive', 'Project Plan', 'Planning Notes'],
      query: 'prjpln',
      limit: 2,
      getCandidates: (item) => item,
    })
    expect(ranked.length).toBeGreaterThan(0)
    expect(ranked.length).toBeLessThanOrEqual(2)
    expect(ranked[0]?.item).toBe('Project Plan')
  })
})
