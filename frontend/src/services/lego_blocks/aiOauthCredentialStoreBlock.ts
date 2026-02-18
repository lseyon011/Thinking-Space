import { getJsonStorageItem, setJsonStorageItem, STORAGE_KEYS } from './storageKeyBlock'

export interface NativeClaudeOauthCredentials {
  accessToken: string
  refreshToken: string
  expiresAt: string
}

export interface NativeCodexOauthCredentials {
  accessToken: string
  refreshToken: string
  expiresAt: string
  accountId?: string
}

export interface NativeAiOauthCredentials {
  claude?: NativeClaudeOauthCredentials
  openaiCodex?: NativeCodexOauthCredentials
}

interface AiOauthTransferPayloadV1 {
  version: 1
  createdAt: string
  credentials: NativeAiOauthCredentials
}

const TRANSFER_PREFIX = 'ltm-ai-xfer-v1.'

function sanitizeValue(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function sanitizeClaude(raw: unknown): NativeClaudeOauthCredentials | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const record = raw as Record<string, unknown>
  const accessToken = sanitizeValue(record.accessToken)
  const refreshToken = sanitizeValue(record.refreshToken)
  const expiresAt = sanitizeValue(record.expiresAt)
  if (!accessToken || !refreshToken || !expiresAt) return undefined
  return { accessToken, refreshToken, expiresAt }
}

function sanitizeCodex(raw: unknown): NativeCodexOauthCredentials | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const record = raw as Record<string, unknown>
  const accessToken = sanitizeValue(record.accessToken)
  const refreshToken = sanitizeValue(record.refreshToken)
  const expiresAt = sanitizeValue(record.expiresAt)
  if (!accessToken || !refreshToken || !expiresAt) return undefined
  const accountId = sanitizeValue(record.accountId)
  return {
    accessToken,
    refreshToken,
    expiresAt,
    ...(accountId ? { accountId } : {}),
  }
}

function sanitizeOauthCredentials(raw: unknown): NativeAiOauthCredentials {
  if (!raw || typeof raw !== 'object') return {}
  const record = raw as Record<string, unknown>
  const claude = sanitizeClaude(record.claude)
  const openaiCodex = sanitizeCodex(record.openaiCodex)
  return {
    ...(claude ? { claude } : {}),
    ...(openaiCodex ? { openaiCodex } : {}),
  }
}

function encodeBase64UrlBlock(value: string): string {
  let base64 = ''
  if (typeof globalThis.btoa === 'function') {
    const utf8 = encodeURIComponent(value).replace(
      /%([0-9A-F]{2})/g,
      (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)),
    )
    base64 = globalThis.btoa(utf8)
  } else {
    const maybeBuffer = (globalThis as {
      Buffer?: { from(input: string, encoding: string): { toString(encoding: string): string } }
    }).Buffer
    if (!maybeBuffer) throw new Error('Base64 encoding unavailable in this runtime')
    base64 = maybeBuffer.from(value, 'utf8').toString('base64')
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeBase64UrlBlock(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(padded)
    const escaped = Array.from(binary)
      .map(char => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join('')
    return decodeURIComponent(escaped)
  }
  const maybeBuffer = (globalThis as {
    Buffer?: { from(input: string, encoding: string): { toString(encoding: string): string } }
  }).Buffer
  if (!maybeBuffer) throw new Error('Base64 decoding unavailable in this runtime')
  return maybeBuffer.from(padded, 'base64').toString('utf8')
}

export function readNativeAiOauthCredentialsBlock(): NativeAiOauthCredentials {
  const raw = getJsonStorageItem<unknown>(STORAGE_KEYS.aiOauthCredentials, {})
  return sanitizeOauthCredentials(raw)
}

export function writeNativeAiOauthCredentialsBlock(
  next: NativeAiOauthCredentials,
): NativeAiOauthCredentials {
  const normalized = sanitizeOauthCredentials(next)
  setJsonStorageItem(STORAGE_KEYS.aiOauthCredentials, normalized)
  return normalized
}

export function clearNativeAiOauthCredentialsBlock(): NativeAiOauthCredentials {
  return writeNativeAiOauthCredentialsBlock({})
}

export function getNativeClaudeOauthCredentialsBlock(): NativeClaudeOauthCredentials | null {
  return readNativeAiOauthCredentialsBlock().claude ?? null
}

export function getNativeCodexOauthCredentialsBlock(): NativeCodexOauthCredentials | null {
  return readNativeAiOauthCredentialsBlock().openaiCodex ?? null
}

export function createNativeAiOauthTransferCodeBlock(
  credentials: NativeAiOauthCredentials,
): string {
  const normalized = sanitizeOauthCredentials(credentials)
  if (!normalized.claude && !normalized.openaiCodex) {
    throw new Error('No OAuth credentials available to export')
  }
  const payload: AiOauthTransferPayloadV1 = {
    version: 1,
    createdAt: new Date().toISOString(),
    credentials: normalized,
  }
  const encoded = encodeBase64UrlBlock(JSON.stringify(payload))
  return `${TRANSFER_PREFIX}${encoded}`
}

export function importNativeAiOauthTransferCodeBlock(
  transferCode: string,
): NativeAiOauthCredentials {
  const normalizedCode = sanitizeValue(transferCode)
  if (!normalizedCode || !normalizedCode.startsWith(TRANSFER_PREFIX)) {
    throw new Error('Invalid transfer code')
  }
  let payloadText = ''
  try {
    payloadText = decodeBase64UrlBlock(normalizedCode.slice(TRANSFER_PREFIX.length))
  } catch {
    throw new Error('Invalid transfer code payload')
  }
  let payload: unknown
  try {
    payload = JSON.parse(payloadText)
  } catch {
    throw new Error('Invalid transfer code payload')
  }
  if (!payload || typeof payload !== 'object') throw new Error('Invalid transfer code payload')
  const record = payload as Record<string, unknown>
  if (record.version !== 1) throw new Error('Unsupported transfer code version')
  const credentials = sanitizeOauthCredentials(record.credentials)
  if (!credentials.claude && !credentials.openaiCodex) {
    throw new Error('Transfer code did not include supported credentials')
  }
  return writeNativeAiOauthCredentialsBlock(credentials)
}
