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
import { aiDebugBlock, aiDebugErrorMessageBlock, aiDebugWarnBlock } from './aiDebugBlock'

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

type ProviderAvailabilityMap = Partial<Record<AiProvider, boolean>>

type ProviderMetadataMap = Partial<Record<AiProvider, {
  label?: string
  model?: string
}>>

export interface ListProvidersBlockOptions {
  forceBackendRefresh?: boolean
}

let _backendProvidersCache: AiProviderStatus[] | null = null
let _backendProvidersInflight: Promise<AiProviderStatus[] | null> | null = null

const BACKEND_PROVIDER_FETCH_TIMEOUT_MS = 4000
const BACKEND_PROVIDER_FETCH_RETRIES = 1

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

function toProviderStatusRows(
  availability: ProviderAvailabilityMap,
  metadata?: ProviderMetadataMap,
): AiProviderStatus[] {
  return AI_PROVIDER_ORDER.map((provider) => {
    const row = metadata?.[provider]
    const knownModels = listProviderModelsBlock(provider)
    const fallbackModel = defaultProviderModelBlock(provider)
    const model = row?.model || fallbackModel
    const models = model && !knownModels.includes(model) ? [model, ...knownModels] : knownModels
    return {
      provider,
      available: !!availability[provider],
      label: row?.label || PROVIDER_LABELS[provider],
      model,
      models,
    }
  })
}

function readLocalCredentialAvailabilityBlock(): ProviderAvailabilityMap {
  const manualClaude = !!getManualClaudeApiKeyBlock()
  const manualCodex = !!getManualOpenAiApiKeyBlock()
  const manualAzure = !!getManualAzureCredentialsBlock()
  const oauthClaude = !!getNativeClaudeOauthCredentialsBlock()
  const oauthCodex = !!getNativeCodexOauthCredentialsBlock()

  return {
    claude: manualClaude || oauthClaude,
    'openai-codex': manualCodex || oauthCodex,
    'azure-gpt': manualAzure,
  }
}

function copyProviderRows(rows: AiProviderStatus[]): AiProviderStatus[] {
  return rows.map((row) => ({
    ...row,
    models: [...row.models],
  }))
}

function mapStatusRows(rows: AiProviderStatus[]): {
  availability: ProviderAvailabilityMap
  metadata: ProviderMetadataMap
} {
  const availability: ProviderAvailabilityMap = {}
  const metadata: ProviderMetadataMap = {}

  for (const row of rows) {
    availability[row.provider] = !!row.available
    metadata[row.provider] = {
      label: row.label,
      model: row.model,
    }
  }

  return { availability, metadata }
}

async function fetchBackendProvidersOnceBlock(forceRefresh = false): Promise<AiProviderStatus[]> {
  const responsePromise = forceRefresh
    ? fetch('/api/ai/providers', { cache: 'no-store' })
    : fetch('/api/ai/providers')
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      reject(new Error(`Timed out fetching AI providers after ${BACKEND_PROVIDER_FETCH_TIMEOUT_MS}ms`))
    }, BACKEND_PROVIDER_FETCH_TIMEOUT_MS)
    responsePromise.finally(() => {
      globalThis.clearTimeout(timeoutId)
    }).catch(() => {
      globalThis.clearTimeout(timeoutId)
    })
  })

  const res = await Promise.race([responsePromise, timeoutPromise])
  if (!res.ok) throw new Error(`Failed to list AI providers (HTTP ${res.status})`)
  const payload = await res.json() as unknown
  if (!Array.isArray(payload)) throw new Error('Invalid AI providers payload')

  const availability: ProviderAvailabilityMap = {}
  const metadata: ProviderMetadataMap = {}

  for (const row of payload) {
    if (!row || typeof row !== 'object') continue
    const record = row as {
      provider?: unknown
      available?: unknown
      label?: unknown
      model?: unknown
    }
    if (!isAiProvider(record.provider)) continue
    availability[record.provider] = !!record.available
    metadata[record.provider] = {
      label: typeof record.label === 'string' ? record.label.trim() : undefined,
      model: typeof record.model === 'string' ? record.model.trim() : undefined,
    }
  }

  return toProviderStatusRows(availability, metadata)
}

async function fetchBackendProvidersBlock(forceRefresh = false): Promise<AiProviderStatus[] | null> {
  if (!forceRefresh && _backendProvidersInflight) return _backendProvidersInflight

  _backendProvidersInflight = (async () => {
    if (forceRefresh) {
      aiDebugBlock('backend_provider_hard_refresh_requested')
    }
    for (let attempt = 0; attempt <= BACKEND_PROVIDER_FETCH_RETRIES; attempt += 1) {
      try {
        const rows = await fetchBackendProvidersOnceBlock(forceRefresh)
        _backendProvidersCache = copyProviderRows(rows)
        aiDebugBlock('backend_provider_probe_success', {
          attempt: attempt + 1,
          forceRefresh,
          providers: rows.map((row) => ({
            provider: row.provider,
            available: row.available,
            model: row.model,
          })),
        })
        return copyProviderRows(rows)
      } catch (error) {
        aiDebugWarnBlock('backend_provider_probe_failure', {
          attempt: attempt + 1,
          forceRefresh,
          error: aiDebugErrorMessageBlock(error),
        })
        // Retry a transient failure once, then return cached result if available.
      }
    }
    if (_backendProvidersCache) {
      aiDebugWarnBlock('backend_provider_probe_using_cached_status')
    } else {
      aiDebugWarnBlock('backend_provider_probe_no_cache_available')
    }
    return _backendProvidersCache ? copyProviderRows(_backendProvidersCache) : null
  })()

  try {
    return await _backendProvidersInflight
  } finally {
    _backendProvidersInflight = null
  }
}

async function readElectronCredentialAvailabilityBlock(): Promise<ProviderAvailabilityMap> {
  if (!isElectron()) return {}
  const api = (
    typeof window !== 'undefined'
      ? window.electronAPI
      : (globalThis as typeof globalThis & { electronAPI?: Window['electronAPI'] }).electronAPI
  )
  if (!api) return {}

  const [claude, codex, azure] = await Promise.all([
    api.aiGetClaudeCredentials().then(Boolean).catch(() => false),
    api.aiGetCodexCredentials().then(Boolean).catch(() => false),
    api.aiGetAzureCredentials().then(Boolean).catch(() => false),
  ])

  return {
    claude,
    'openai-codex': codex,
    'azure-gpt': azure,
  }
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

// ── Provider listing ──

export async function listProvidersBlock(options?: ListProvidersBlockOptions): Promise<AiProviderStatus[]> {
  const localAvailability = readLocalCredentialAvailabilityBlock()
  const nativeRuntime = isElectron() || isCapacitorNative()
  const backendRows = await fetchBackendProvidersBlock(!!options?.forceBackendRefresh)
  const backend = backendRows ? mapStatusRows(backendRows) : { availability: {}, metadata: {} }
  if (nativeRuntime) {
    const electronAvailability = await readElectronCredentialAvailabilityBlock()
    const rows = toProviderStatusRows({
      'codex-cli': isElectron() ? !!backend.availability['codex-cli'] : false,
      claude: !!localAvailability.claude || !!electronAvailability.claude || !!backend.availability.claude,
      'openai-codex':
        !!localAvailability['openai-codex']
        || !!electronAvailability['openai-codex']
        || !!backend.availability['openai-codex'],
      'azure-gpt':
        !!localAvailability['azure-gpt']
        || !!electronAvailability['azure-gpt']
        || !!backend.availability['azure-gpt'],
    }, backend.metadata)
    aiDebugBlock('provider_status_rows_native_runtime', {
      runtime: isElectron() ? 'electron' : 'capacitor',
      localAvailability,
      electronAvailability,
      backendAvailability: backend.availability,
      rows: rows.map((row) => ({
        provider: row.provider,
        available: row.available,
        model: row.model,
      })),
    })
    return rows
  }

  // Web: ask backend, but never hard-fail provider rendering if unavailable.
  if (backendRows) {
    aiDebugBlock('provider_status_rows_web_backend', {
      rows: backendRows.map((row) => ({
        provider: row.provider,
        available: row.available,
        model: row.model,
      })),
    })
    return backendRows
  }
  const fallbackRows = toProviderStatusRows({
    'codex-cli': false,
    claude: !!localAvailability.claude,
    'openai-codex': !!localAvailability['openai-codex'],
    'azure-gpt': !!localAvailability['azure-gpt'],
  })
  aiDebugWarnBlock('provider_status_rows_web_local_fallback', {
    localAvailability,
    rows: fallbackRows.map((row) => ({
      provider: row.provider,
      available: row.available,
      model: row.model,
    })),
  })
  return fallbackRows
}
