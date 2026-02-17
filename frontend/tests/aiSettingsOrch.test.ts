import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getAiSettingsOrch,
  resolveAiModelForProviderOrch,
  resolveAiSelectionOrch,
  setAiProviderModelOrch,
  setAiSelectedProviderOrch,
} from '@/services/orchestrators/aiSettingsOrch'

const listProvidersBlockMock = vi.fn()

vi.mock('@/services/lego_blocks/aiProviderBlock', async () => {
  const actual = await vi.importActual<typeof import('@/services/lego_blocks/aiProviderBlock')>(
    '@/services/lego_blocks/aiProviderBlock',
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
})
