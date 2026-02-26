import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('aiChatBlock native routing', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('uses direct Claude call on Capacitor when manual key exists', async () => {
    const fetchMock = vi.fn()
    ;(globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    vi.doMock('@/services/lego_blocks/integrations/fsBlock', () => ({
      isElectron: () => false,
      isCapacitorNative: () => true,
    }))
    vi.doMock('@/services/lego_blocks/integrations/aiCredentialStoreBlock', () => ({
      getManualClaudeApiKeyBlock: () => 'claude-key',
      getManualOpenAiApiKeyBlock: () => null,
      getManualAzureCredentialsBlock: () => null,
    }))
    vi.doMock('@/services/lego_blocks/integrations/aiProviderBlock', () => ({
      defaultProviderModelBlock: () => 'claude-sonnet-4-5-20250929',
      getClaudeCredentialsBlock: async () => null,
      getCodexCredentialsBlock: async () => null,
      getAzureCredentialsBlock: async () => null,
    }))
    vi.doMock('@anthropic-ai/sdk', () => ({
      default: class Anthropic {
        messages = {
          create: async () => ({
            content: [{ type: 'text', text: 'claude-native-ok' }],
            usage: { input_tokens: 5, output_tokens: 3 },
          }),
        }
      },
    }))

    const { sendChatBlock } = await import('@/services/lego_blocks/integrations/aiChatBlock')
    const response = await sendChatBlock('claude', [{ role: 'user', content: 'hello' }])

    expect(response.provider).toBe('claude')
    expect(response.content).toContain('claude-native-ok')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses direct OpenAI call on Capacitor when manual key exists', async () => {
    const fetchMock = vi.fn()
    ;(globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    vi.doMock('@/services/lego_blocks/integrations/fsBlock', () => ({
      isElectron: () => false,
      isCapacitorNative: () => true,
    }))
    vi.doMock('@/services/lego_blocks/integrations/aiCredentialStoreBlock', () => ({
      getManualClaudeApiKeyBlock: () => null,
      getManualOpenAiApiKeyBlock: () => 'openai-key',
      getManualAzureCredentialsBlock: () => null,
    }))
    vi.doMock('@/services/lego_blocks/integrations/aiProviderBlock', () => ({
      defaultProviderModelBlock: () => 'gpt-5.3-codex',
      getClaudeCredentialsBlock: async () => null,
      getCodexCredentialsBlock: async () => null,
      getAzureCredentialsBlock: async () => null,
    }))
    vi.doMock('openai', () => ({
      default: class OpenAI {
        chat = {
          completions: {
            create: async () => ({
              model: 'gpt-5.3-codex',
              choices: [{ message: { content: 'openai-native-ok' } }],
              usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
            }),
          },
        }
      },
    }))

    const { sendChatBlock } = await import('@/services/lego_blocks/integrations/aiChatBlock')
    const response = await sendChatBlock('openai-codex', [{ role: 'user', content: 'hello' }])

    expect(response.provider).toBe('openai-codex')
    expect(response.content).toContain('openai-native-ok')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses imported Codex OAuth credentials on Capacitor when API key is missing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => [
        'data: {"type":"response.output_text.delta","delta":"oauth-"}',
        'data: {"type":"response.output_text.delta","delta":"codex-ok"}',
        'data: {"type":"response.completed","response":{"model":"gpt-5.3-codex","usage":{"input_tokens":3,"output_tokens":2,"total_tokens":5}}}',
      ].join('\n'),
    })
    ;(globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    vi.doMock('@/services/lego_blocks/integrations/fsBlock', () => ({
      isElectron: () => false,
      isCapacitorNative: () => true,
    }))
    vi.doMock('@/services/lego_blocks/integrations/aiCredentialStoreBlock', () => ({
      getManualClaudeApiKeyBlock: () => null,
      getManualOpenAiApiKeyBlock: () => null,
      getManualAzureCredentialsBlock: () => null,
    }))
    vi.doMock('@/services/lego_blocks/integrations/aiOauthCredentialStoreBlock', () => ({
      getNativeClaudeOauthCredentialsBlock: () => null,
      getNativeCodexOauthCredentialsBlock: () => ({
        accessToken: 'codex-access',
        refreshToken: 'codex-refresh',
        expiresAt: '2026-02-19T00:00:00Z',
        accountId: 'acct-123',
      }),
    }))
    vi.doMock('@/services/lego_blocks/integrations/aiProviderBlock', () => ({
      defaultProviderModelBlock: () => 'gpt-5.3-codex',
      getClaudeCredentialsBlock: async () => null,
      getCodexCredentialsBlock: async () => null,
      getAzureCredentialsBlock: async () => null,
    }))

    const { sendChatBlock } = await import('@/services/lego_blocks/integrations/aiChatBlock')
    const response = await sendChatBlock('openai-codex', [{ role: 'user', content: 'hello' }])

    expect(response.provider).toBe('openai-codex')
    expect(response.content).toContain('oauth-codex-ok')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://chatgpt.com/backend-api/codex/responses')
  })

  it('uses imported Codex OAuth credentials on Electron when keychain credentials are unavailable', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => [
        'data: {"type":"response.output_text.delta","delta":"electron-"}',
        'data: {"type":"response.output_text.delta","delta":"oauth-ok"}',
        'data: {"type":"response.completed","response":{"model":"gpt-5.3-codex","usage":{"input_tokens":4,"output_tokens":3,"total_tokens":7}}}',
      ].join('\n'),
    })
    ;(globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    vi.doMock('@/services/lego_blocks/integrations/fsBlock', () => ({
      isElectron: () => true,
      isCapacitorNative: () => false,
    }))
    vi.doMock('@/services/lego_blocks/integrations/aiCredentialStoreBlock', () => ({
      getManualClaudeApiKeyBlock: () => null,
      getManualOpenAiApiKeyBlock: () => null,
      getManualAzureCredentialsBlock: () => null,
    }))
    vi.doMock('@/services/lego_blocks/integrations/aiOauthCredentialStoreBlock', () => ({
      getNativeClaudeOauthCredentialsBlock: () => null,
      getNativeCodexOauthCredentialsBlock: () => ({
        accessToken: 'codex-access',
        refreshToken: 'codex-refresh',
        expiresAt: '2026-02-19T00:00:00Z',
        accountId: 'acct-electron',
      }),
    }))
    vi.doMock('@/services/lego_blocks/integrations/aiProviderBlock', () => ({
      defaultProviderModelBlock: () => 'gpt-5.3-codex',
      getClaudeCredentialsBlock: async () => null,
      getCodexCredentialsBlock: async () => null,
      getAzureCredentialsBlock: async () => null,
    }))

    const { sendChatBlock } = await import('@/services/lego_blocks/integrations/aiChatBlock')
    const response = await sendChatBlock('openai-codex', [{ role: 'user', content: 'hello' }])

    expect(response.provider).toBe('openai-codex')
    expect(response.content).toContain('electron-oauth-ok')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://chatgpt.com/backend-api/codex/responses')
  })
})
