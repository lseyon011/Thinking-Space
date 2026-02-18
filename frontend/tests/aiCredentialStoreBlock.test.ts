import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAiManualCredentialsBlock,
  getManualAzureCredentialsBlock,
  getManualClaudeApiKeyBlock,
  getManualOpenAiApiKeyBlock,
  readAiManualCredentialsBlock,
  setManualAzureCredentialsBlock,
  setManualClaudeCredentialsBlock,
  setManualOpenAiCredentialsBlock,
} from '@/services/lego_blocks/aiCredentialStoreBlock'

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

describe('aiCredentialStoreBlock', () => {
  beforeEach(() => {
    installLocalStorageMock()
    localStorage.clear()
    clearAiManualCredentialsBlock()
  })

  it('stores and reads manual provider credentials', () => {
    setManualClaudeCredentialsBlock(' claude-key ')
    setManualOpenAiCredentialsBlock(' openai-key ')
    setManualAzureCredentialsBlock({
      apiKey: ' azure-key ',
      endpoint: ' https://example.openai.azure.com/ ',
      deployment: ' gpt-5o ',
      apiVersion: ' 2024-12-01-preview ',
    })

    expect(getManualClaudeApiKeyBlock()).toBe('claude-key')
    expect(getManualOpenAiApiKeyBlock()).toBe('openai-key')
    expect(getManualAzureCredentialsBlock()).toEqual({
      apiKey: 'azure-key',
      endpoint: 'https://example.openai.azure.com/',
      deployment: 'gpt-5o',
      apiVersion: '2024-12-01-preview',
    })
  })

  it('clears provider credentials when blank values are saved', () => {
    setManualClaudeCredentialsBlock('claude-key')
    setManualOpenAiCredentialsBlock('openai-key')
    setManualAzureCredentialsBlock({ apiKey: 'azure-key' })

    setManualClaudeCredentialsBlock('')
    setManualOpenAiCredentialsBlock('   ')
    setManualAzureCredentialsBlock({ apiKey: '' })

    expect(readAiManualCredentialsBlock()).toEqual({})
  })
})
