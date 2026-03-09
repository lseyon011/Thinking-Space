import { describe, expect, it } from 'vitest'
import {
  collectExpandedBacklogNodesNeedingLoadBlock,
  collectProgramsNeedingLoadBlock,
  shouldRequestBacklogChildrenLoadBlock,
} from '@/components/lego_blocks/integrations/BacklogListBlock'
import type { ChildStateBlock } from '@/components/lego_blocks/units/BacklogListDomainBlock'
import type { NodeRecord } from '@/services/lego_blocks/integrations/dbBlock'

function makeNode(overrides: Partial<NodeRecord> & Pick<NodeRecord, 'uuid' | 'key' | 'title' | 'type'>): NodeRecord {
  return {
    uuid: overrides.uuid,
    key: overrides.key,
    title: overrides.title,
    type: overrides.type,
    level: overrides.level ?? 0,
    filePath: overrides.filePath ?? `${overrides.key}.md`,
    tags: overrides.tags ?? [],
    status: overrides.status ?? 'active',
    createdAt: overrides.createdAt ?? '2026-03-09T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-09T00:00:00.000Z',
    ...overrides,
  }
}

function makeChildState(overrides?: Partial<ChildStateBlock>): ChildStateBlock {
  return {
    loading: overrides?.loading ?? false,
    loaded: overrides?.loaded ?? false,
    nodes: overrides?.nodes ?? [],
    error: overrides?.error ?? null,
  }
}

describe('BacklogListBlock load planning helpers', () => {
  it('requests child loads only for missing or idle child state', () => {
    expect(shouldRequestBacklogChildrenLoadBlock(undefined)).toBe(true)
    expect(shouldRequestBacklogChildrenLoadBlock(makeChildState())).toBe(true)
    expect(shouldRequestBacklogChildrenLoadBlock(makeChildState({ loading: true }))).toBe(false)
    expect(shouldRequestBacklogChildrenLoadBlock(makeChildState({ loaded: true }))).toBe(false)
  })

  it('collects only programs that still need their first child load', () => {
    const programA = makeNode({ uuid: 'program-a', key: 'program-a', title: 'Program A', type: 'program' })
    const programB = makeNode({ uuid: 'program-b', key: 'program-b', title: 'Program B', type: 'program' })
    const programC = makeNode({ uuid: 'program-c', key: 'program-c', title: 'Program C', type: 'program' })

    const result = collectProgramsNeedingLoadBlock(
      [programA, programB, programC],
      {
        [programB.uuid]: makeChildState({ loading: true }),
        [programC.uuid]: makeChildState({ loaded: true }),
      },
    )

    expect(result).toEqual([programA])
  })

  it('collects only expanded descendants whose children still need loading', () => {
    const program = makeNode({ uuid: 'program-a', key: 'program-a', title: 'Program A', type: 'program' })
    const epic = makeNode({ uuid: 'epic-a', key: 'epic-a', title: 'Epic A', type: 'epic', parent: program.key, level: 1 })
    const loadedIdeaBucket = makeNode({
      uuid: 'idea-bucket-a',
      key: 'idea-bucket-a',
      title: 'Idea Bucket A',
      type: 'idea_bucket',
      parent: epic.key,
      level: 2,
    })
    const unloadedIdea = makeNode({
      uuid: 'idea-a',
      key: 'idea-a',
      title: 'Idea A',
      type: 'idea',
      parent: loadedIdeaBucket.key,
      level: 3,
    })
    const collapsedThoughtBucket = makeNode({
      uuid: 'thought-bucket-a',
      key: 'thought-bucket-a',
      title: 'Thought Bucket A',
      type: 'thought_bucket',
      parent: epic.key,
      level: 2,
    })

    const result = collectExpandedBacklogNodesNeedingLoadBlock(
      [program],
      {
        [program.uuid]: makeChildState({ loaded: true, nodes: [epic] }),
        [epic.uuid]: makeChildState({ loaded: true, nodes: [loadedIdeaBucket, collapsedThoughtBucket] }),
        [loadedIdeaBucket.uuid]: makeChildState({ loaded: true, nodes: [unloadedIdea] }),
      },
      {
        [epic.uuid]: true,
        [loadedIdeaBucket.uuid]: true,
        [unloadedIdea.uuid]: true,
      },
    )

    expect(result).toEqual([unloadedIdea])
  })
})
