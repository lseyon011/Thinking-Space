import {
  STORAGE_KEYS,
  getJsonStorageItem,
  getStorageItem,
  setJsonStorageItem,
  setStorageItem,
} from '@/services/orchestrators/storageOrch'
import { openExternalUrlOrch } from '@/services/orchestrators/fileSystemOrch'

const GOOGLE_DEVICE_CODE_ENDPOINT_BLOCK = 'https://oauth2.googleapis.com/device/code'
const GOOGLE_TOKEN_ENDPOINT_BLOCK = 'https://oauth2.googleapis.com/token'
const GOOGLE_DRIVE_SCOPE_BLOCK = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets'
const GOOGLE_TOKEN_REFRESH_SKEW_MS_BLOCK = 60_000

export interface GoogleDriveAuthStateOrch {
  accessToken: string
  refreshToken?: string
  expiresAt: number
  scope?: string
  tokenType?: string
}

export interface GoogleDeviceFlowStartOrch {
  deviceCode: string
  userCode: string
  verificationUrl: string
  verificationUrlComplete?: string
  expiresIn: number
  interval: number
}

interface GoogleTokenResponseBlock {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  scope?: string
  token_type?: string
  error?: string
  error_description?: string
}

export function getGoogleOauthClientIdOrch(): string | null {
  const stored = (getStorageItem(STORAGE_KEYS.googleDriveOauthClientId) ?? '').trim()
  if (stored) return stored
  const fromEnv = (import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID ?? '').trim()
  return fromEnv || null
}

export function setGoogleOauthClientIdOrch(value: string): void {
  setStorageItem(STORAGE_KEYS.googleDriveOauthClientId, value.trim())
}

export function readGoogleDriveAuthOrch(): GoogleDriveAuthStateOrch | null {
  const raw = getJsonStorageItem<unknown>(STORAGE_KEYS.googleDriveAuth, null)
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const accessToken = typeof record.accessToken === 'string' ? record.accessToken.trim() : ''
  const refreshToken = typeof record.refreshToken === 'string' ? record.refreshToken.trim() : ''
  const expiresAt = typeof record.expiresAt === 'number' ? record.expiresAt : 0
  const scope = typeof record.scope === 'string' ? record.scope : undefined
  const tokenType = typeof record.tokenType === 'string' ? record.tokenType : undefined
  if (!accessToken || !expiresAt) return null
  return {
    accessToken,
    ...(refreshToken ? { refreshToken } : {}),
    expiresAt,
    ...(scope ? { scope } : {}),
    ...(tokenType ? { tokenType } : {}),
  }
}

export function writeGoogleDriveAuthOrch(input: GoogleDriveAuthStateOrch | null): GoogleDriveAuthStateOrch | null {
  if (!input) {
    setJsonStorageItem(STORAGE_KEYS.googleDriveAuth, null)
    return null
  }
  const normalized: GoogleDriveAuthStateOrch = {
    accessToken: input.accessToken.trim(),
    expiresAt: input.expiresAt,
    ...(input.refreshToken?.trim() ? { refreshToken: input.refreshToken.trim() } : {}),
    ...(input.scope?.trim() ? { scope: input.scope.trim() } : {}),
    ...(input.tokenType?.trim() ? { tokenType: input.tokenType.trim() } : {}),
  }
  setJsonStorageItem(STORAGE_KEYS.googleDriveAuth, normalized)
  return normalized
}

export function clearGoogleDriveAuthOrch(): void {
  writeGoogleDriveAuthOrch(null)
}

export async function startGoogleDeviceFlowOrch(input?: {
  clientId?: string
  scope?: string
}): Promise<GoogleDeviceFlowStartOrch> {
  const clientId = (input?.clientId ?? getGoogleOauthClientIdOrch() ?? '').trim()
  if (!clientId) throw new Error('Google OAuth client ID is required.')
  const scope = (input?.scope ?? GOOGLE_DRIVE_SCOPE_BLOCK).trim()
  const body = new URLSearchParams({
    client_id: clientId,
    scope,
  })
  const payload = await requestGoogleJsonBlock<{
    device_code?: string
    user_code?: string
    verification_url?: string
    verification_uri?: string
    verification_url_complete?: string
    verification_uri_complete?: string
    expires_in?: number
    interval?: number
    error?: string
    error_description?: string
  }>({
    method: 'POST',
    url: GOOGLE_DEVICE_CODE_ENDPOINT_BLOCK,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (payload.error) {
    throw new Error(payload.error_description || payload.error)
  }

  const deviceCode = (payload.device_code ?? '').trim()
  const userCode = (payload.user_code ?? '').trim()
  const verificationUrl = (payload.verification_uri ?? payload.verification_url ?? '').trim()
  const verificationUrlComplete = (payload.verification_uri_complete ?? payload.verification_url_complete ?? '').trim()
  if (!deviceCode || !userCode || !verificationUrl) {
    throw new Error('Google device authorization response was incomplete.')
  }

  return {
    deviceCode,
    userCode,
    verificationUrl,
    ...(verificationUrlComplete ? { verificationUrlComplete } : {}),
    expiresIn: typeof payload.expires_in === 'number' ? payload.expires_in : 1800,
    interval: typeof payload.interval === 'number' ? payload.interval : 5,
  }
}

export async function completeGoogleDeviceFlowOrch(input: {
  start: GoogleDeviceFlowStartOrch
  clientId?: string
}): Promise<GoogleDriveAuthStateOrch> {
  const clientId = (input.clientId ?? getGoogleOauthClientIdOrch() ?? '').trim()
  if (!clientId) throw new Error('Google OAuth client ID is required.')

  const startedAt = Date.now()
  const expiresAt = startedAt + Math.max(30, input.start.expiresIn) * 1000
  let pollIntervalMs = Math.max(2, input.start.interval) * 1000

  while (Date.now() < expiresAt) {
    const body = new URLSearchParams({
      client_id: clientId,
      device_code: input.start.deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    })
    const token = await requestGoogleJsonBlock<GoogleTokenResponseBlock>({
      method: 'POST',
      url: GOOGLE_TOKEN_ENDPOINT_BLOCK,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (token.error === 'authorization_pending') {
      await delayBlock(pollIntervalMs)
      continue
    }
    if (token.error === 'slow_down') {
      pollIntervalMs += 1000
      await delayBlock(pollIntervalMs)
      continue
    }
    if (token.error) {
      throw new Error(token.error_description || token.error)
    }
    if (!token.access_token || !token.expires_in) {
      throw new Error('Google token response was incomplete.')
    }

    const next = writeGoogleDriveAuthOrch({
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + (token.expires_in * 1000),
      scope: token.scope,
      tokenType: token.token_type,
    })
    if (!next) throw new Error('Failed to store Google auth state.')
    return next
  }

  throw new Error('Google sign-in timed out. Please try again.')
}

export async function connectGoogleDriveAuthOrch(input?: {
  clientId?: string
  scope?: string
  openVerificationUrl?: boolean
}): Promise<GoogleDriveAuthStateOrch> {
  const start = await startGoogleDeviceFlowOrch({
    clientId: input?.clientId,
    scope: input?.scope,
  })
  if (input?.openVerificationUrl !== false) {
    const launchUrl = start.verificationUrlComplete || start.verificationUrl
    await openExternalUrlOrch(launchUrl)
  }
  return completeGoogleDeviceFlowOrch({
    start,
    clientId: input?.clientId,
  })
}

export async function getGoogleDriveAccessTokenOrch(): Promise<string | null> {
  const current = readGoogleDriveAuthOrch()
  if (!current) return null
  if ((current.expiresAt - GOOGLE_TOKEN_REFRESH_SKEW_MS_BLOCK) > Date.now()) {
    return current.accessToken
  }
  if (!current.refreshToken) return null
  const refreshed = await refreshGoogleDriveAccessTokenOrch(current.refreshToken)
  return refreshed.accessToken
}

export async function refreshGoogleDriveAccessTokenOrch(refreshToken: string, clientId?: string): Promise<GoogleDriveAuthStateOrch> {
  const resolvedClientId = (clientId ?? getGoogleOauthClientIdOrch() ?? '').trim()
  if (!resolvedClientId) throw new Error('Google OAuth client ID is required to refresh access token.')
  const body = new URLSearchParams({
    client_id: resolvedClientId,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
  const token = await requestGoogleJsonBlock<GoogleTokenResponseBlock>({
    method: 'POST',
    url: GOOGLE_TOKEN_ENDPOINT_BLOCK,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (token.error) throw new Error(token.error_description || token.error)
  if (!token.access_token || !token.expires_in) {
    throw new Error('Google refresh response was incomplete.')
  }
  const existing = readGoogleDriveAuthOrch()
  const next = writeGoogleDriveAuthOrch({
    accessToken: token.access_token,
    refreshToken: refreshToken || existing?.refreshToken,
    expiresAt: Date.now() + (token.expires_in * 1000),
    scope: token.scope || existing?.scope,
    tokenType: token.token_type || existing?.tokenType,
  })
  if (!next) throw new Error('Failed to store refreshed Google token.')
  return next
}

async function requestGoogleJsonBlock<T>(request: {
  method: 'GET' | 'POST'
  url: string
  headers?: Record<string, string>
  body?: string
}): Promise<T> {
  if (window.electronAPI?.isElectron && window.electronAPI.googleOauthRequest) {
    const response = await window.electronAPI.googleOauthRequest({
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body,
    })
    if (response.status < 200 || response.status >= 300) {
      const parsed = safeParseJsonBlock<Record<string, unknown>>(response.body)
      const detail = typeof parsed?.error_description === 'string'
        ? parsed.error_description
        : typeof parsed?.error === 'string'
          ? parsed.error
          : `Request failed (${response.status})`
      throw new Error(detail)
    }
    return safeParseJsonBlock<T>(response.body) as T
  }

  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  })
  const text = await response.text()
  if (!response.ok) {
    const parsed = safeParseJsonBlock<Record<string, unknown>>(text)
    const detail = typeof parsed?.error_description === 'string'
      ? parsed.error_description
      : typeof parsed?.error === 'string'
        ? parsed.error
        : `Request failed (${response.status})`
    throw new Error(detail)
  }
  return safeParseJsonBlock<T>(text) as T
}

function safeParseJsonBlock<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

function delayBlock(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}
