import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatResponse } from '@/services/lego_blocks/aiChatBlock'
import { sendChatBlock } from '@/services/lego_blocks/aiChatBlock'

vi.mock('@/services/lego_blocks/aiChatBlock', () => ({
  sendChatBlock: vi.fn(),
}))

const sendChatBlockMock = vi.mocked(sendChatBlock)

function nowIso(): string {
  return new Date().toISOString()
}

beforeEach(async () => {
  const fakeIdb = await import('fake-indexeddb')
  globalThis.indexedDB = fakeIdb.default
  globalThis.IDBKeyRange = fakeIdb.IDBKeyRange as any
  vi.clearAllMocks()
})

afterEach(async () => {
  const { deleteDb } = await import('@/services/lego_blocks/dbBlock')
  await deleteDb()
})

describe('aiBlock.findRelated', () => {
  it('returns lexical thought matches from cache', async () => {
    const { upsertNode } = await import('@/services/lego_blocks/dbBlock')
    const { findRelated } = await import('@/services/lego_blocks/aiBlock')
    const now = nowIso()
    await upsertNode({
      uuid: 'thought-1',
      key: 'oauth-token-refresh-flow',
      title: 'OAuth token refresh flow',
      type: 'thought',
      level: 5,
      filePath: 'lifeblood/thoughts/oauth-refresh.md',
      tags: ['auth', 'oauth'],
      status: 'active',
      createdAt: now,
      updatedAt: now,
      bodyExcerpt: 'Refresh tokens must rotate when credentials expire.',
    })
    await upsertNode({
      uuid: 'thought-2',
      key: 'meeting-notes',
      title: 'Weekly meeting notes',
      type: 'thought',
      level: 5,
      filePath: 'lifeblood/thoughts/weekly-notes.md',
      tags: ['notes'],
      status: 'active',
      createdAt: now,
      updatedAt: now,
      bodyExcerpt: 'Roadmap planning and staffing updates.',
    })

    const matches = await findRelated({
      text: 'oauth refresh token expiry strategy',
      sourceFilePath: 'lifeblood/thoughts/draft.md',
      limit: 5,
    })

    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0].node.key).toBe('oauth-token-refresh-flow')
    expect(matches[0].engine).toBe('lexical-v1')
  })
})

describe('aiBlock text actions', () => {
  it('summarize sends summarize prompt and strips markdown fence response', async () => {
    const { summarize } = await import('@/services/lego_blocks/aiBlock')
    sendChatBlockMock.mockResolvedValue({
      role: 'assistant',
      content: '```markdown\n- concise summary\n```',
      provider: 'openai-codex',
      model: 'gpt-5-codex',
    } as ChatResponse)

    const result = await summarize({
      content: 'Large markdown content for summary.',
      provider: 'openai-codex',
      model: 'gpt-5-codex',
    })

    expect(sendChatBlockMock).toHaveBeenCalledOnce()
    const [provider, messages] = sendChatBlockMock.mock.calls[0]
    expect(provider).toBe('openai-codex')
    expect(messages[0].content).toContain('Summarize the following markdown content')
    expect(result.content).toBe('- concise summary')
  })

  it('cleanup sends cleanup prompt and returns cleaned text', async () => {
    const { cleanup } = await import('@/services/lego_blocks/aiBlock')
    sendChatBlockMock.mockResolvedValue({
      role: 'assistant',
      content: 'Cleaned markdown output.',
      provider: 'openai-codex',
      model: 'gpt-5-codex',
    } as ChatResponse)

    const result = await cleanup({
      content: 'messy markdown output',
      provider: 'openai-codex',
      model: 'gpt-5-codex',
    })

    expect(sendChatBlockMock).toHaveBeenCalledOnce()
    const [provider, messages] = sendChatBlockMock.mock.calls[0]
    expect(provider).toBe('openai-codex')
    expect(messages[0].content).toContain('Clean up the following markdown content')
    expect(result.content).toBe('Cleaned markdown output.')
  })
})
