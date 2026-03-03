import { getGoogleDriveAccessTokenOrch } from '@/services/orchestrators/googleDriveAuthOrch'

export interface GoogleDriveFilePickerItemOrch {
  id: string
  name: string
  mimeType: string
  webViewLink?: string
}

interface GoogleDriveFilesListResponseBlock {
  files?: Array<{
    id?: string
    name?: string
    mimeType?: string
    webViewLink?: string
  }>
}

export async function listGoogleDriveDocumentsOrch(input?: {
  query?: string
  pageSize?: number
}): Promise<GoogleDriveFilePickerItemOrch[]> {
  return listGoogleDriveFilesByMimeOrch({
    mimeTypes: ['application/vnd.google-apps.document'],
    query: input?.query,
    pageSize: input?.pageSize,
  })
}

export async function listGoogleDriveSheetsOrch(input?: {
  query?: string
  pageSize?: number
}): Promise<GoogleDriveFilePickerItemOrch[]> {
  return listGoogleDriveFilesByMimeOrch({
    mimeTypes: ['application/vnd.google-apps.spreadsheet'],
    query: input?.query,
    pageSize: input?.pageSize,
  })
}

export async function listGoogleDriveFilesByMimeOrch(input: {
  mimeTypes: string[]
  query?: string
  pageSize?: number
}): Promise<GoogleDriveFilePickerItemOrch[]> {
  const accessToken = await getGoogleDriveAccessTokenOrch()
  if (!accessToken) throw new Error('Google account is not connected.')
  if (!Array.isArray(input.mimeTypes) || input.mimeTypes.length === 0) {
    throw new Error('At least one Google Drive mime type is required.')
  }

  const pageSize = Math.max(1, Math.min(100, input.pageSize ?? 25))
  const mimeFilters = input.mimeTypes
    .map((mime) => `mimeType='${mime.replace(/'/g, "\\'")}'`)
    .join(' or ')
  const terms: string[] = ['trashed=false', `(${mimeFilters})`]
  const query = (input.query ?? '').trim()
  if (query) {
    const escaped = query.replace(/'/g, "\\'")
    terms.push(`name contains '${escaped}'`)
  }
  const driveQuery = terms.join(' and ')
  const params = new URLSearchParams({
    q: driveQuery,
    pageSize: String(pageSize),
    fields: 'files(id,name,mimeType,webViewLink)',
    orderBy: 'modifiedTime desc',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  })
  const response = await requestGoogleDriveTextBlock({
    method: 'GET',
    url: `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    accessToken,
  })
  if (response.status < 200 || response.status >= 300) {
    const payloadText = response.body
    const detail = extractGoogleApiErrorMessageBlock(payloadText)
    throw new Error(detail || `Google Drive request failed (${response.status})`)
  }
  const payload = safeParseJsonBlock<GoogleDriveFilesListResponseBlock>(response.body)
  const files = payload?.files ?? []
  return files
    .filter((item) => typeof item.id === 'string' && typeof item.name === 'string' && typeof item.mimeType === 'string')
    .map((item) => ({
      id: item.id!,
      name: item.name!,
      mimeType: item.mimeType!,
      ...(typeof item.webViewLink === 'string' ? { webViewLink: item.webViewLink } : {}),
    }))
}

async function requestGoogleDriveTextBlock(input: {
  method: 'GET'
  url: string
  accessToken: string
}): Promise<{ status: number; body: string }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${input.accessToken}`,
  }
  if (window.electronAPI?.isElectron && window.electronAPI.googleOauthRequest) {
    return window.electronAPI.googleOauthRequest({
      method: input.method,
      url: input.url,
      headers,
    })
  }
  const response = await fetch(input.url, {
    method: input.method,
    headers,
  })
  return {
    status: response.status,
    body: await response.text(),
  }
}

function extractGoogleApiErrorMessageBlock(payloadText: string): string {
  const payload = safeParseJsonBlock<Record<string, unknown>>(payloadText)
  const errorRecord = payload?.error as Record<string, unknown> | undefined
  if (!errorRecord || typeof errorRecord !== 'object') return ''
  const message = errorRecord.message
  return typeof message === 'string' ? message : ''
}

function safeParseJsonBlock<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}
