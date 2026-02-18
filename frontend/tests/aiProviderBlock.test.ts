import { beforeEach, describe, expect, it, vi } from 'vitest'

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

describe('aiProviderBlock', () => {
  beforeEach(() => {
    vi.resetModules()
    installLocalStorageMock()
    localStorage.clear()
  })

  it('uses manual credentials for Capacitor-native provider availability', async () => {
    vi.doMock('@/services/lego_blocks/fsBlock', () => ({
      isElectron: () => false,
      isCapacitorNative: () => true,
    }))

    const credentials = await import('@/services/lego_blocks/aiCredentialStoreBlock')
    credentials.setManualClaudeCredentialsBlock('claude-key')
    credentials.setManualOpenAiCredentialsBlock('openai-key')
    credentials.setManualAzureCredentialsBlock({ apiKey: 'azure-key' })

    const { listProvidersBlock } = await import('@/services/lego_blocks/aiProviderBlock')
    const providers = await listProvidersBlock()
    const byProvider = new Map(providers.map((item) => [item.provider, item.available]))

    expect(byProvider.get('claude')).toBe(true)
    expect(byProvider.get('openai-codex')).toBe(true)
    expect(byProvider.get('azure-gpt')).toBe(true)
    expect(byProvider.get('codex-cli')).toBe(false)
  })

  it('uses imported OAuth credentials for Capacitor-native provider availability', async () => {
    vi.doMock('@/services/lego_blocks/fsBlock', () => ({
      isElectron: () => false,
      isCapacitorNative: () => true,
    }))

    const oauth = await import('@/services/lego_blocks/aiOauthCredentialStoreBlock')
    oauth.writeNativeAiOauthCredentialsBlock({
      claude: {
        accessToken: 'claude-access',
        refreshToken: 'claude-refresh',
        expiresAt: '2026-02-19T00:00:00Z',
      },
      openaiCodex: {
        accessToken: 'codex-access',
        refreshToken: 'codex-refresh',
        expiresAt: '2026-02-19T00:00:00Z',
      },
    })

    const { listProvidersBlock } = await import('@/services/lego_blocks/aiProviderBlock')
    const providers = await listProvidersBlock()
    const byProvider = new Map(providers.map((item) => [item.provider, item.available]))

    expect(byProvider.get('claude')).toBe(true)
    expect(byProvider.get('openai-codex')).toBe(true)
    expect(byProvider.get('codex-cli')).toBe(false)
  })

  it('uses backend provider listing in web mode', async () => {
    vi.doMock('@/services/lego_blocks/fsBlock', () => ({
      isElectron: () => false,
      isCapacitorNative: () => false,
    }))

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { provider: 'claude', available: true, model: 'claude-sonnet-4-5-20250929' },
        { provider: 'openai-codex', available: false, model: 'gpt-5.3-codex' },
      ],
    })
    ;(globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { listProvidersBlock } = await import('@/services/lego_blocks/aiProviderBlock')
    const providers = await listProvidersBlock()
    const byProvider = new Map(providers.map((item) => [item.provider, item.available]))

    expect(fetchMock).toHaveBeenCalledWith('/api/ai/providers')
    expect(byProvider.get('claude')).toBe(true)
    expect(byProvider.get('openai-codex')).toBe(false)
  })
})
