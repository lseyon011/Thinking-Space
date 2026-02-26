import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getAiSettingsOrch,
  resolveAiProviderForScopeOrch,
  resolveAiModelForScopeProviderOrch,
  resolveAiModelForProviderOrch,
  resolveAiSelectionOrch,
  setAiProviderModelOrch,
  setAiScopeProviderOrch,
  setAiScopeProviderModelOrch,
  setAiSelectedProviderOrch,
} from '@/services/orchestrators/aiSettingsOrch'

const listProvidersBlockMock = vi.fn()

vi.mock('@/services/lego_blocks/integrations/aiProviderBlock', async () => {
  const actual = await vi.importActual<typeof import('@/services/lego_blocks/integrations/aiProviderBlock')>(
    '@/services/lego_blocks/integrations/aiProviderBlock',
  )
  return {
    ...actual,
    listProvidersBlock: (...args: unknown[]) => listProvidersBlockMock(...args),
  }
})

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

describe('aiSettingsOrch', () => {
  beforeEach(() => {
    installLocalStorageMock()
    localStorage.clear()
    listProvidersBlockMock.mockReset()
  })

  it('resolves selected provider/model from persisted settings', async () => {
    setAiSelectedProviderOrch('codex-cli')
    setAiProviderModelOrch('codex-cli', 'gpt-5-codex')

    listProvidersBlockMock.mockResolvedValue([
      { provider: 'codex-cli', available: true, label: 'Codex CLI', model: 'gpt-5.3-codex', models: ['gpt-5.3-codex', 'gpt-5-codex'] },
      { provider: 'claude', available: true, label: 'Claude', model: 'claude-sonnet-4-5-20250929', models: ['claude-sonnet-4-5-20250929'] },
      { provider: 'openai-codex', available: true, label: 'Codex', model: 'gpt-5.3-codex', models: ['gpt-5.3-codex'] },
      { provider: 'azure-gpt', available: true, label: 'Azure GPT', model: 'gpt-5', models: ['gpt-5'] },
    ])

    const selection = await resolveAiSelectionOrch()
    expect(selection?.provider).toBe('codex-cli')
    expect(selection?.model).toBe('gpt-5-codex')
  })

  it('falls back to available provider when configured provider is unavailable', async () => {
    setAiSelectedProviderOrch('claude')

    listProvidersBlockMock.mockResolvedValue([
      { provider: 'codex-cli', available: false, label: 'Codex CLI', model: 'gpt-5.3-codex', models: ['gpt-5.3-codex'] },
      { provider: 'claude', available: false, label: 'Claude', model: 'claude-sonnet-4-5-20250929', models: ['claude-sonnet-4-5-20250929'] },
      { provider: 'openai-codex', available: false, label: 'Codex', model: 'gpt-5.3-codex', models: ['gpt-5.3-codex'] },
      { provider: 'azure-gpt', available: true, label: 'Azure GPT', model: 'gpt-5', models: ['gpt-5'] },
    ])

    const selection = await resolveAiSelectionOrch()
    expect(selection?.provider).toBe('azure-gpt')
    expect(selection?.model).toBe('gpt-5')
    expect(getAiSettingsOrch().selectedProvider).toBe('azure-gpt')
  })

  it('stores explicit model overrides while resolving', async () => {
    listProvidersBlockMock.mockResolvedValue([
      { provider: 'codex-cli', available: true, label: 'Codex CLI', model: 'gpt-5.3-codex', models: ['gpt-5.3-codex', 'gpt-5-codex'] },
      { provider: 'claude', available: false, label: 'Claude', model: 'claude-sonnet-4-5-20250929', models: ['claude-sonnet-4-5-20250929'] },
      { provider: 'openai-codex', available: false, label: 'Codex', model: 'gpt-5.3-codex', models: ['gpt-5.3-codex'] },
      { provider: 'azure-gpt', available: false, label: 'Azure GPT', model: 'gpt-5', models: ['gpt-5'] },
    ])

    const selection = await resolveAiSelectionOrch({ provider: 'codex-cli', model: 'gpt-5-codex' })
    expect(selection?.provider).toBe('codex-cli')
    expect(selection?.model).toBe('gpt-5-codex')
    expect(resolveAiModelForProviderOrch('codex-cli')).toBe('gpt-5-codex')
  })

  it('supports per-scope model overrides with fallback to provider default', async () => {
    setAiSelectedProviderOrch('codex-cli')
    setAiProviderModelOrch('codex-cli', 'gpt-5.3-codex')
    setAiScopeProviderModelOrch('new_thought', 'codex-cli', 'gpt-5-codex')

    listProvidersBlockMock.mockResolvedValue([
      { provider: 'codex-cli', available: true, label: 'Codex CLI', model: 'gpt-5.3-codex', models: ['gpt-5.3-codex', 'gpt-5-codex'] },
      { provider: 'claude', available: false, label: 'Claude', model: 'claude-sonnet-4-5-20250929', models: ['claude-sonnet-4-5-20250929'] },
      { provider: 'openai-codex', available: false, label: 'Codex', model: 'gpt-5.3-codex', models: ['gpt-5.3-codex'] },
      { provider: 'azure-gpt', available: false, label: 'Azure GPT', model: 'gpt-5', models: ['gpt-5'] },
    ])

    const scoped = await resolveAiSelectionOrch({ scope: 'new_thought' })
    const global = await resolveAiSelectionOrch({ scope: 'chat' })

    expect(scoped?.provider).toBe('codex-cli')
    expect(scoped?.model).toBe('gpt-5-codex')
    expect(global?.model).toBe('gpt-5.3-codex')
    expect(resolveAiModelForScopeProviderOrch('new_thought', 'codex-cli')).toBe('gpt-5-codex')
    expect(resolveAiModelForScopeProviderOrch('chat', 'codex-cli')).toBe('gpt-5.3-codex')

    setAiScopeProviderModelOrch('new_thought', 'codex-cli', '')
    expect(resolveAiModelForScopeProviderOrch('new_thought', 'codex-cli')).toBe('gpt-5.3-codex')
    expect(getAiSettingsOrch().selectedProvider).toBe('codex-cli')
  })

  it('supports per-scope provider override with global fallback', async () => {
    setAiSelectedProviderOrch('codex-cli')
    setAiProviderModelOrch('codex-cli', 'gpt-5.3-codex')
    setAiProviderModelOrch('claude', 'claude-sonnet-4-5-20250929')
    setAiScopeProviderOrch('new_thought', 'claude')

    listProvidersBlockMock.mockResolvedValue([
      { provider: 'codex-cli', available: true, label: 'Codex CLI', model: 'gpt-5.3-codex', models: ['gpt-5.3-codex'] },
      { provider: 'claude', available: true, label: 'Claude', model: 'claude-sonnet-4-5-20250929', models: ['claude-sonnet-4-5-20250929'] },
      { provider: 'openai-codex', available: false, label: 'Codex', model: 'gpt-5.3-codex', models: ['gpt-5.3-codex'] },
      { provider: 'azure-gpt', available: false, label: 'Azure GPT', model: 'gpt-5', models: ['gpt-5'] },
    ])

    const newThoughtSelection = await resolveAiSelectionOrch({ scope: 'new_thought' })
    const chatSelection = await resolveAiSelectionOrch({ scope: 'chat' })

    expect(newThoughtSelection?.provider).toBe('claude')
    expect(newThoughtSelection?.model).toBe('claude-sonnet-4-5-20250929')
    expect(chatSelection?.provider).toBe('codex-cli')
    expect(chatSelection?.model).toBe('gpt-5.3-codex')
    expect(resolveAiProviderForScopeOrch('new_thought')).toBe('claude')

    setAiScopeProviderOrch('new_thought', null)

    const resetSelection = await resolveAiSelectionOrch({ scope: 'new_thought' })
    expect(resetSelection?.provider).toBe('codex-cli')
    expect(resolveAiProviderForScopeOrch('new_thought')).toBeNull()
  })
})
