/**
 * AI provider abstraction — credential sourcing per platform.
 *
 * Electron: reads credentials via IPC (Keychain / az CLI).
 * Capacitor: reads locally saved API-key logins.
 * Web: no client-side credentials; backend handles everything.
 */

import { isCapacitorNative, isElectron } from './fsBlock'
import {
  getManualAzureCredentialsBlock,
  getManualClaudeApiKeyBlock,
  getManualOpenAiApiKeyBlock,
} from './aiCredentialStoreBlock'
import {
  getNativeClaudeOauthCredentialsBlock,
  getNativeCodexOauthCredentialsBlock,
} from './aiOauthCredentialStoreBlock'

// ── Types ──

export type AiProvider = 'claude' | 'openai-codex' | 'codex-cli' | 'azure-gpt'

export interface AiProviderStatus {
  provider: AiProvider
  available: boolean
  label: string
  model: string
  models: string[]
}

export const AI_PROVIDER_ORDER: AiProvider[] = ['codex-cli', 'claude', 'openai-codex', 'azure-gpt']

const PROVIDER_LABELS: Record<AiProvider, string> = {
  claude: 'Claude',
  'openai-codex': 'Codex',
  'codex-cli': 'Codex CLI',
  'azure-gpt': 'Azure GPT',
}

const PROVIDER_MODELS: Record<AiProvider, string[]> = {
  claude: ['claude-sonnet-4-5-20250929'],
  'openai-codex': ['gpt-5.3-codex', 'gpt-5-codex'],
  'codex-cli': ['gpt-5.3-codex', 'gpt-5-codex'],
  'azure-gpt': ['gpt-5'],
}

export interface ClaudeCredentials {
  accessToken: string
  refreshToken: string
  expiresAt: string
}

export interface CodexCredentials {
  accessToken: string
  refreshToken: string
  expiresAt: string
  accountId?: string
}

export interface AzureCredentials {
  accessToken: string
  expiresOn: string
}

export function isAiProvider(value: unknown): value is AiProvider {
  return value === 'claude' || value === 'openai-codex' || value === 'codex-cli' || value === 'azure-gpt'
}

export function listProviderModelsBlock(provider: AiProvider): string[] {
  return [...PROVIDER_MODELS[provider]]
}

export function defaultProviderModelBlock(provider: AiProvider): string {
  return PROVIDER_MODELS[provider][0]
}

// ── Credential cache (Electron only) ──

let _claudeCache: ClaudeCredentials | null = null
let _codexCache: CodexCredentials | null = null
let _azureCache: { creds: AzureCredentials; fetchedAt: number } | null = null

const AZURE_CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const TOKEN_EXPIRY_BUFFER_MS = 60_000

// ── Electron credential helpers ──

function parseExpiresAt(value: string): number {
  if (!value) return NaN
  // Handle numeric strings (ms timestamps) that slipped through
  if (/^\d+$/.test(value)) return Number(value)
  return new Date(value).getTime()
}

function isTokenExpired(expiresAt: string, bufferMs = TOKEN_EXPIRY_BUFFER_MS): boolean {
  const ts = parseExpiresAt(expiresAt)
  // If we can't parse the expiry, assume expired to force refresh
  if (isNaN(ts)) return true
  return Date.now() >= ts - bufferMs
}

export async function getClaudeCredentialsBlock(): Promise<ClaudeCredentials | null> {
  if (!isElectron()) return null
  const api = window.electronAPI!

  // Return cached if not expired
  if (_claudeCache) {
    if (!isTokenExpired(_claudeCache.expiresAt)) return _claudeCache
    if (_claudeCache.refreshToken) {
      try {
        _claudeCache = await api.aiRefreshClaudeToken(_claudeCache.refreshToken)
        return _claudeCache
      } catch {
        _claudeCache = null
      }
    }
    _claudeCache = null
  }

  // Fresh read
  const creds = await api.aiGetClaudeCredentials()
  if (!creds) return null

  // Check if token expired and needs refresh
  if (isTokenExpired(creds.expiresAt)) {
    if (!creds.refreshToken) return null
    try {
      _claudeCache = await api.aiRefreshClaudeToken(creds.refreshToken)
      return _claudeCache
    } catch {
      // Token expired and refresh failed
      return null
    }
  }

  _claudeCache = creds
  return creds
}

export async function getCodexCredentialsBlock(): Promise<CodexCredentials | null> {
  if (!isElectron()) return null
  const api = window.electronAPI!

  // Return cached if not expired
  if (_codexCache) {
    if (!isTokenExpired(_codexCache.expiresAt)) return _codexCache
    try {
      _codexCache = await api.aiRefreshCodexToken(_codexCache.refreshToken)
      return _codexCache
    } catch {
      _codexCache = null
    }
  }

  // Fresh read
  const creds = await api.aiGetCodexCredentials()
  if (!creds) return null

  // Check if token expired and needs refresh
  if (isTokenExpired(creds.expiresAt)) {
    try {
      _codexCache = await api.aiRefreshCodexToken(creds.refreshToken)
      return _codexCache
    } catch {
      return null
    }
  }

  _codexCache = creds
  return creds
}

export async function getAzureCredentialsBlock(): Promise<AzureCredentials | null> {
  if (!isElectron()) return null

  // Return cached if fresh
  if (_azureCache && Date.now() - _azureCache.fetchedAt < AZURE_CACHE_TTL_MS) {
    const expiresOn = new Date(_azureCache.creds.expiresOn).getTime()
    if (Date.now() < expiresOn - 60_000) return _azureCache.creds
  }

  const creds = await window.electronAPI!.aiGetAzureCredentials()
  if (!creds) return null

  _azureCache = { creds, fetchedAt: Date.now() }
  return creds
}

async function getCodexCliAvailabilityBlock(): Promise<boolean> {
  try {
    const res = await fetch('/api/ai/providers')
    if (!res.ok) return false
    const providers = await res.json() as Array<{ provider?: string; available?: boolean }>
    return providers.some((p) => p.provider === 'codex-cli' && !!p.available)
  } catch {
    return false
  }
}

// ── Provider listing ──

export async function listProvidersBlock(): Promise<AiProviderStatus[]> {
  const nativeRuntime = isElectron() || isCapacitorNative()
  if (nativeRuntime) {
    const manualClaude = !!getManualClaudeApiKeyBlock()
    const manualCodex = !!getManualOpenAiApiKeyBlock()
    const manualAzure = !!getManualAzureCredentialsBlock()
    const oauthClaude = !isElectron() && !!getNativeClaudeOauthCredentialsBlock()
    const oauthCodex = !isElectron() && !!getNativeCodexOauthCredentialsBlock()
    const [claude, codex, codexCli, azure] = await Promise.all([
      isElectron() ? getClaudeCredentialsBlock().then(c => !!c).catch(() => false) : Promise.resolve(false),
      isElectron() ? getCodexCredentialsBlock().then(c => !!c).catch(() => false) : Promise.resolve(false),
      isElectron() ? getCodexCliAvailabilityBlock() : Promise.resolve(false),
      isElectron() ? getAzureCredentialsBlock().then(c => !!c).catch(() => false) : Promise.resolve(false),
    ])
    return [
      {
        provider: 'codex-cli',
        available: codexCli,
        label: PROVIDER_LABELS['codex-cli'],
        model: defaultProviderModelBlock('codex-cli'),
        models: listProviderModelsBlock('codex-cli'),
      },
      {
        provider: 'claude',
        available: manualClaude || oauthClaude || claude,
        label: PROVIDER_LABELS.claude,
        model: defaultProviderModelBlock('claude'),
        models: listProviderModelsBlock('claude'),
      },
      {
        provider: 'openai-codex',
        available: manualCodex || oauthCodex || codex,
        label: PROVIDER_LABELS['openai-codex'],
        model: defaultProviderModelBlock('openai-codex'),
        models: listProviderModelsBlock('openai-codex'),
      },
      {
        provider: 'azure-gpt',
        available: manualAzure || azure,
        label: PROVIDER_LABELS['azure-gpt'],
        model: defaultProviderModelBlock('azure-gpt'),
        models: listProviderModelsBlock('azure-gpt'),
      },
    ]
  }

  // Web: ask backend
  const res = await fetch('/api/ai/providers')
  if (!res.ok) throw new Error('Failed to list AI providers')
  const raw = await res.json() as Array<{
    provider?: string
    available?: boolean
    label?: string
    model?: string
  }>

  const byProvider = new Map<AiProvider, {
    available: boolean
    label?: string
    model?: string
  }>()

  for (const row of raw) {
    if (!isAiProvider(row?.provider)) continue
    byProvider.set(row.provider, {
      available: !!row.available,
      label: typeof row.label === 'string' ? row.label.trim() : undefined,
      model: typeof row.model === 'string' ? row.model.trim() : undefined,
    })
  }

  return AI_PROVIDER_ORDER.map((provider) => {
    const knownModels = listProviderModelsBlock(provider)
    const row = byProvider.get(provider)
    const fallbackModel = defaultProviderModelBlock(provider)
    const model = row?.model || fallbackModel
    const models = model && !knownModels.includes(model) ? [model, ...knownModels] : knownModels

    return {
      provider,
      available: !!row?.available,
      label: row?.label || PROVIDER_LABELS[provider],
      model,
      models,
    }
  })
}
