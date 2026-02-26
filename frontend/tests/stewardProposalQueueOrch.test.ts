import { beforeEach, describe, expect, it } from 'vitest'
import type { NodeRecord } from '@/services/lego_blocks/integrations/dbBlock'
import {
  buildStewardProposalsForNodeOrch,
  clearResolvedStewardProposalsOrch,
  createStewardFileYamlMetadataProposalOrch,
  enqueueStewardProposalsOrch,
  markStewardProposalAcceptedOrch,
  markStewardProposalRejectedOrch,
  parseStewardTagDraftOrch,
  readStewardProposalQueueOrch,
  writeStewardProposalQueueOrch,
} from '@/services/orchestrators/stewardProposalQueueOrch'

function makeNode(overrides: Partial<NodeRecord> = {}): NodeRecord {
  return {
    uuid: 'node-1',
    key: 'node-1',
    title: 'Write DEV-015B UI',
    type: 'task',
    level: 5,
    filePath: 'thinking-organizer/tasks/task-node-1.md',
    tags: [],
    status: 'active',
    priority: 'high',
    createdAt: '2026-02-17T00:00:00.000Z',
    updatedAt: '2026-02-17T00:00:00.000Z',
    ...overrides,
  }
}

function installLocalStorageMock(): void {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value) },
      removeItem: (key: string) => { store.delete(key) },
      clear: () => { store.clear() },
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() { return store.size },
    },
  })
}

describe('stewardProposalQueueOrch', () => {
  beforeEach(() => {
    installLocalStorageMock()
    localStorage.clear()
  })

  it('builds description and tag proposals for underspecified node metadata', () => {
    const node = makeNode({ description: '' })
    const proposals = buildStewardProposalsForNodeOrch(node, null)
    const actions = proposals.map(item => item.action).sort()
    expect(actions).toEqual(['update_description', 'update_tags'])
  })

  it('dedupes identical pending proposals while enqueueing', () => {
    const node = makeNode()
    const proposals = buildStewardProposalsForNodeOrch(node, null)
    const first = enqueueStewardProposalsOrch([], proposals)
    const second = enqueueStewardProposalsOrch(first.queue, proposals)
    expect(first.added).toBeGreaterThan(0)
    expect(second.added).toBe(0)
    expect(second.queue).toHaveLength(first.queue.length)
  })

  it('dedupes equivalent file YAML metadata proposals after normalization', () => {
    const first = createStewardFileYamlMetadataProposalOrch({
      filePath: 'notes/sample.md',
      node: makeNode({ type: 'thought', filePath: 'notes/sample.md' }),
      summary: '  Summary text. ',
      tags: ['Topic/One', 'topic/one', 'topic/two'],
      suggestedEpicKey: '  tp-da-e-1  ',
      suggestedIdeaKey: 'tp-da-i-2',
      rationale: 'AI suggestion',
    })
    const second = createStewardFileYamlMetadataProposalOrch({
      filePath: 'notes/sample.md',
      node: makeNode({ type: 'thought', filePath: 'notes/sample.md' }),
      summary: 'Summary text.',
      tags: ['topic/two', 'topic/one'],
      suggestedEpicKey: 'tp-da-e-1',
      suggestedIdeaKey: 'tp-da-i-2',
      rationale: 'AI suggestion',
    })

    const firstQueue = enqueueStewardProposalsOrch([], [first])
    const secondQueue = enqueueStewardProposalsOrch(firstQueue.queue, [second])
    expect(firstQueue.added).toBe(1)
    expect(secondQueue.added).toBe(0)
    expect(secondQueue.queue).toHaveLength(1)
  })

  it('marks proposals accepted/rejected and clears resolved entries', () => {
    const node = makeNode()
    const proposals = buildStewardProposalsForNodeOrch(node, null)
    const target = proposals[0]
    const accepted = markStewardProposalAcceptedOrch(proposals, target.id, target.payload)
    expect(accepted.find(item => item.id === target.id)?.status).toBe('accepted')

    const other = accepted.find(item => item.id !== target.id)!
    const rejected = markStewardProposalRejectedOrch(accepted, other.id)
    expect(rejected.find(item => item.id === other.id)?.status).toBe('rejected')

    const pendingOnly = clearResolvedStewardProposalsOrch(rejected)
    expect(pendingOnly).toHaveLength(0)
  })

  it('parses and normalizes tag drafts', () => {
    expect(parseStewardTagDraftOrch(' Organizer/Task , status/ACTIVE, status/active, ,priority/high '))
      .toEqual(['organizer/task', 'priority/high', 'status/active'])
  })

  it('roundtrips queue through storage helpers', () => {
    const node = makeNode()
    const proposals = buildStewardProposalsForNodeOrch(node, null)
    writeStewardProposalQueueOrch(proposals)
    const loaded = readStewardProposalQueueOrch()
    expect(loaded).toHaveLength(proposals.length)
    expect(loaded[0].id).toBe(proposals[0].id)
  })
})
