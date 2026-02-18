import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearNativeAiOauthCredentialsBlock,
  createNativeAiOauthTransferCodeBlock,
  getNativeClaudeOauthCredentialsBlock,
  getNativeCodexOauthCredentialsBlock,
  importNativeAiOauthTransferCodeBlock,
  readNativeAiOauthCredentialsBlock,
} from '@/services/lego_blocks/aiOauthCredentialStoreBlock'

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

describe('aiOauthCredentialStoreBlock', () => {
  beforeEach(() => {
    installLocalStorageMock()
    localStorage.clear()
    clearNativeAiOauthCredentialsBlock()
  })

  it('exports and imports transfer code for Claude/Codex OAuth credentials', () => {
    const code = createNativeAiOauthTransferCodeBlock({
      claude: {
        accessToken: ' claude-access ',
        refreshToken: ' claude-refresh ',
        expiresAt: ' 2026-02-19T00:00:00Z ',
      },
      openaiCodex: {
        accessToken: ' codex-access ',
        refreshToken: ' codex-refresh ',
        expiresAt: ' 2026-02-19T00:00:00Z ',
        accountId: ' account-123 ',
      },
    })

    clearNativeAiOauthCredentialsBlock()
    expect(readNativeAiOauthCredentialsBlock()).toEqual({})

    const imported = importNativeAiOauthTransferCodeBlock(code)
    expect(imported).toEqual({
      claude: {
        accessToken: 'claude-access',
        refreshToken: 'claude-refresh',
        expiresAt: '2026-02-19T00:00:00Z',
      },
      openaiCodex: {
        accessToken: 'codex-access',
        refreshToken: 'codex-refresh',
        expiresAt: '2026-02-19T00:00:00Z',
        accountId: 'account-123',
      },
    })
    expect(getNativeClaudeOauthCredentialsBlock()?.accessToken).toBe('claude-access')
    expect(getNativeCodexOauthCredentialsBlock()?.accessToken).toBe('codex-access')
  })

  it('rejects malformed transfer code payloads', () => {
    expect(() => importNativeAiOauthTransferCodeBlock('invalid-code')).toThrowError('Invalid transfer code')
    expect(() => importNativeAiOauthTransferCodeBlock('ltm-ai-xfer-v1.not-json')).toThrowError(
      'Invalid transfer code payload',
    )
  })
})
