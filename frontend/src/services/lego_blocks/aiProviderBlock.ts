/**
 * AI provider abstraction — credential sourcing per platform.
 *
 * Electron: reads credentials via IPC (Keychain / az CLI).
 * Web: no client-side credentials; backend handles everything.
 */

import { isElectron } from './fsBlock'

// ── Types ──

export type AiProvider = 'claude' | 'azure-gpt'

export interface AiProviderStatus {
  provider: AiProvider
  available: boolean
  label: string
  model: string
}

export interface ClaudeCredentials {
  accessToken: string
  refreshToken: string
  expiresAt: string
}

export interface AzureCredentials {
  accessToken: string
  expiresOn: string
}

// ── Credential cache (Electron only) ──

let _claudeCache: ClaudeCredentials | null = null
let _azureCache: { creds: AzureCredentials; fetchedAt: number } | null = null

const AZURE_CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

// ── Electron credential helpers ──

export async function getClaudeCredentialsBlock(): Promise<ClaudeCredentials | null> {
  if (!isElectron()) return null
  const api = window.electronAPI!

  // Return cached if not expired
  if (_claudeCache) {
    const expiresAt = new Date(_claudeCache.expiresAt).getTime()
    if (Date.now() < expiresAt - 60_000) return _claudeCache
    // Try refresh
    try {
      _claudeCache = await api.aiRefreshClaudeToken(_claudeCache.refreshToken)
      return _claudeCache
    } catch {
      _claudeCache = null
    }
  }

  // Fresh read
  const creds = await api.aiGetClaudeCredentials()
  if (!creds) return null

  // Check if token expired and needs refresh
  const expiresAt = new Date(creds.expiresAt).getTime()
  if (expiresAt && Date.now() >= expiresAt - 60_000) {
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

export async function listProvidersBlock(): Promise<AiProviderStatus[]> {
  if (isElectron()) {
    const [claude, azure] = await Promise.all([
      getClaudeCredentialsBlock().then(c => !!c).catch(() => false),
      getAzureCredentialsBlock().then(c => !!c).catch(() => false),
    ])
    return [
      { provider: 'claude', available: claude, label: 'Claude', model: 'claude-sonnet-4-5-20250929' },
      { provider: 'azure-gpt', available: azure, label: 'Azure GPT', model: 'gpt-5' },
    ]
  }

  // Web: ask backend
  const res = await fetch('/api/ai/providers')
  if (!res.ok) throw new Error('Failed to list AI providers')
  return res.json()
}
