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
    Object.defineProperty(globalThis, 'electronAPI', {
      configurable: true,
      value: undefined,
    })
  })

  it('uses manual credentials for Capacitor-native provider availability', async () => {
    vi.doMock('@/services/lego_blocks/integrations/fsBlock', () => ({
      isElectron: () => false,
      isCapacitorNative: () => true,
    }))

    const credentials = await import('@/services/lego_blocks/integrations/aiCredentialStoreBlock')
    credentials.setManualClaudeCredentialsBlock('claude-key')
    credentials.setManualOpenAiCredentialsBlock('openai-key')
    credentials.setManualAzureCredentialsBlock({ apiKey: 'azure-key' })

    const { listProvidersBlock } = await import('@/services/lego_blocks/integrations/aiProviderBlock')
    const providers = await listProvidersBlock()
    const byProvider = new Map(providers.map((item) => [item.provider, item.available]))

    expect(byProvider.get('claude')).toBe(true)
    expect(byProvider.get('openai-codex')).toBe(true)
    expect(byProvider.get('azure-gpt')).toBe(true)
    expect(byProvider.get('codex-cli')).toBe(false)
  })

  it('uses imported OAuth credentials for Capacitor-native provider availability', async () => {
    vi.doMock('@/services/lego_blocks/integrations/fsBlock', () => ({
      isElectron: () => false,
      isCapacitorNative: () => true,
    }))

    const oauth = await import('@/services/lego_blocks/integrations/aiOauthCredentialStoreBlock')
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

    const { listProvidersBlock } = await import('@/services/lego_blocks/integrations/aiProviderBlock')
    const providers = await listProvidersBlock()
    const byProvider = new Map(providers.map((item) => [item.provider, item.available]))

    expect(byProvider.get('claude')).toBe(true)
    expect(byProvider.get('openai-codex')).toBe(true)
    expect(byProvider.get('codex-cli')).toBe(false)
  })

  it('uses backend provider listing in web mode', async () => {
    vi.doMock('@/services/lego_blocks/integrations/fsBlock', () => ({
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

    const { listProvidersBlock } = await import('@/services/lego_blocks/integrations/aiProviderBlock')
    const providers = await listProvidersBlock()
    const byProvider = new Map(providers.map((item) => [item.provider, item.available]))

    expect(fetchMock).toHaveBeenCalledWith('/api/ai/providers')
    expect(byProvider.get('claude')).toBe(true)
    expect(byProvider.get('openai-codex')).toBe(false)
  })

  it('falls back to local credential availability when backend provider listing fails', async () => {
    vi.doMock('@/services/lego_blocks/integrations/fsBlock', () => ({
      isElectron: () => false,
      isCapacitorNative: () => false,
    }))

    const credentials = await import('@/services/lego_blocks/integrations/aiCredentialStoreBlock')
    credentials.setManualClaudeCredentialsBlock('claude-key')

    const oauth = await import('@/services/lego_blocks/integrations/aiOauthCredentialStoreBlock')
    oauth.writeNativeAiOauthCredentialsBlock({
      openaiCodex: {
        accessToken: 'codex-access',
        refreshToken: 'codex-refresh',
        expiresAt: '2026-02-19T00:00:00Z',
        accountId: 'acct-123',
      },
    })

    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
    ;(globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { listProvidersBlock } = await import('@/services/lego_blocks/integrations/aiProviderBlock')
    const providers = await listProvidersBlock()
    const byProvider = new Map(providers.map((item) => [item.provider, item.available]))

    expect(fetchMock).toHaveBeenCalledWith('/api/ai/providers')
    expect(byProvider.get('claude')).toBe(true)
    expect(byProvider.get('openai-codex')).toBe(true)
    expect(byProvider.get('codex-cli')).toBe(false)
  })

  it('reuses last known backend provider statuses when the next backend probe fails', async () => {
    vi.doMock('@/services/lego_blocks/integrations/fsBlock', () => ({
      isElectron: () => false,
      isCapacitorNative: () => false,
    }))

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { provider: 'codex-cli', available: true, model: 'gpt-5.3-codex' },
          { provider: 'claude', available: false, model: 'claude-sonnet-4-5-20250929' },
        ],
      })
      .mockRejectedValue(new Error('network down'))
    ;(globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { listProvidersBlock } = await import('@/services/lego_blocks/integrations/aiProviderBlock')
    const first = await listProvidersBlock()
    const second = await listProvidersBlock()

    const firstByProvider = new Map(first.map((item) => [item.provider, item.available]))
    const secondByProvider = new Map(second.map((item) => [item.provider, item.available]))

    expect(firstByProvider.get('codex-cli')).toBe(true)
    expect(secondByProvider.get('codex-cli')).toBe(true)
  })

  it('supports forced backend hard refresh that bypasses cached provider statuses', async () => {
    vi.doMock('@/services/lego_blocks/integrations/fsBlock', () => ({
      isElectron: () => false,
      isCapacitorNative: () => false,
    }))

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { provider: 'codex-cli', available: true, model: 'gpt-5.3-codex' },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { provider: 'codex-cli', available: false, model: 'gpt-5.3-codex' },
        ],
      })
    ;(globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { listProvidersBlock } = await import('@/services/lego_blocks/integrations/aiProviderBlock')
    const first = await listProvidersBlock()
    const refreshed = await listProvidersBlock({ forceBackendRefresh: true })

    const firstByProvider = new Map(first.map((item) => [item.provider, item.available]))
    const refreshedByProvider = new Map(refreshed.map((item) => [item.provider, item.available]))

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/ai/providers')
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/ai/providers', { cache: 'no-store' })
    expect(firstByProvider.get('codex-cli')).toBe(true)
    expect(refreshedByProvider.get('codex-cli')).toBe(false)
  })

  it('uses Electron credential reads for availability without requiring token refresh', async () => {
    vi.doMock('@/services/lego_blocks/integrations/fsBlock', () => ({
      isElectron: () => true,
      isCapacitorNative: () => false,
    }))

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { provider: 'codex-cli', available: true, model: 'gpt-5.3-codex' },
      ],
    })
    ;(globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const aiRefreshClaudeToken = vi.fn()
    const aiRefreshCodexToken = vi.fn()

    Object.defineProperty(globalThis, 'electronAPI', {
      configurable: true,
      value: {
        isElectron: true,
        aiGetClaudeCredentials: vi.fn().mockResolvedValue({
          accessToken: 'claude-access',
          refreshToken: 'claude-refresh',
          expiresAt: '2026-02-21T00:00:00Z',
        }),
        aiGetCodexCredentials: vi.fn().mockResolvedValue({
          accessToken: 'codex-access',
          refreshToken: 'codex-refresh',
          expiresAt: '2026-02-21T00:00:00Z',
        }),
        aiGetAzureCredentials: vi.fn().mockResolvedValue({
          accessToken: 'azure-access',
          expiresOn: '2026-02-21T00:00:00Z',
        }),
        aiRefreshClaudeToken,
        aiRefreshCodexToken,
      },
    })

    const { listProvidersBlock } = await import('@/services/lego_blocks/integrations/aiProviderBlock')
    const providers = await listProvidersBlock()
    const byProvider = new Map(providers.map((item) => [item.provider, item.available]))

    expect(byProvider.get('claude')).toBe(true)
    expect(byProvider.get('openai-codex')).toBe(true)
    expect(byProvider.get('azure-gpt')).toBe(true)
    expect(byProvider.get('codex-cli')).toBe(true)
    expect(aiRefreshClaudeToken).not.toHaveBeenCalled()
    expect(aiRefreshCodexToken).not.toHaveBeenCalled()
  })
})
