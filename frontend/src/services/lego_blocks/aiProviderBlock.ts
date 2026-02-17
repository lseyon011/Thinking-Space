/**
 * AI provider abstraction — credential sourcing per platform.
 *
 * Electron: reads credentials via IPC (Keychain / az CLI).
 * Web: no client-side credentials; backend handles everything.
 */

import { isElectron } from './fsBlock'

// ── Types ──

export type AiProvider = 'claude' | 'openai-codex' | 'azure-gpt'

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

export async function listProvidersBlock(): Promise<AiProviderStatus[]> {
  if (isElectron()) {
    const [claude, codex, azure] = await Promise.all([
      getClaudeCredentialsBlock().then(c => !!c).catch(() => false),
      getCodexCredentialsBlock().then(c => !!c).catch(() => false),
      getAzureCredentialsBlock().then(c => !!c).catch(() => false),
    ])
    return [
      { provider: 'claude', available: claude, label: 'Claude', model: 'claude-sonnet-4-5-20250929' },
      { provider: 'openai-codex', available: codex, label: 'Codex', model: 'gpt-5.3-codex' },
      { provider: 'azure-gpt', available: azure, label: 'Azure GPT', model: 'gpt-5' },
    ]
  }

  // Web: ask backend
  const res = await fetch('/api/ai/providers')
  if (!res.ok) throw new Error('Failed to list AI providers')
  return res.json()
}
