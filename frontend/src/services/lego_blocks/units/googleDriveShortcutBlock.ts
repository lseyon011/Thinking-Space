export interface ParsedGoogleDriveShortcutBlock {
  url?: string
  fileId?: string
  docId?: string
  spreadsheetId?: string
  title?: string
}

const URL_PATTERN_BLOCK = /https?:\/\/[^\s"'<>]+/gi

export function parseGoogleDriveShortcutBlock(text: string): ParsedGoogleDriveShortcutBlock | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const fromJson = parseJsonShortcutBlock(trimmed)
  if (fromJson) return fromJson

  const fromIni = parseIniShortcutBlock(trimmed)
  if (fromIni) return fromIni

  const firstUrl = extractFirstUrlBlock(trimmed)
  if (firstUrl) return buildParsedShortcutBlock({ url: firstUrl })

  return null
}

export function extractGoogleDocIdFromUrlBlock(url: string): string | null {
  const byDocPath = url.match(/\/document\/d\/([A-Za-z0-9_-]+)/i)
  if (byDocPath?.[1]) return byDocPath[1]
  const byGenericFilePath = url.match(/\/file\/d\/([A-Za-z0-9_-]+)/i)
  if (byGenericFilePath?.[1]) return byGenericFilePath[1]
  const byIdQuery = url.match(/[?&]id=([A-Za-z0-9_-]+)/i)
  if (byIdQuery?.[1]) return byIdQuery[1]
  return null
}

export function extractGoogleSpreadsheetIdFromUrlBlock(url: string): string | null {
  const bySheetPath = url.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/i)
  if (bySheetPath?.[1]) return bySheetPath[1]
  const byGenericFilePath = url.match(/\/file\/d\/([A-Za-z0-9_-]+)/i)
  if (byGenericFilePath?.[1]) return byGenericFilePath[1]
  const byIdQuery = url.match(/[?&]id=([A-Za-z0-9_-]+)/i)
  if (byIdQuery?.[1]) return byIdQuery[1]
  return null
}

function parseJsonShortcutBlock(trimmed: string): ParsedGoogleDriveShortcutBlock | null {
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    const url = pickStringFieldBlock(parsed, ['url', 'openUrl', 'open_url', 'link', 'webViewLink', 'target'])
      ?? extractFirstUrlFromValuesBlock(parsed)
    const resource = pickStringFieldBlock(parsed, ['resource_id', 'resourceid', 'resourceId'])
    const resourceId = parseResourceIdBlock(resource)
    const docId = pickStringFieldBlock(parsed, ['doc_id', 'documentId', 'document_id', 'docId'])
      || resourceId?.docId
    const spreadsheetId = pickStringFieldBlock(parsed, ['spreadsheetId', 'spreadsheet_id', 'sheet_id'])
      || resourceId?.spreadsheetId
    const fileId = normalizeFileIdFieldBlock(pickStringFieldBlock(parsed, ['fileId', 'file_id', 'resourceId', 'resource_id']))
      || resourceId?.fileId
    const title = pickStringFieldBlock(parsed, ['title', 'name'])
    return buildParsedShortcutBlock({
      url: sanitizeBlock(url),
      docId: sanitizeBlock(docId),
      spreadsheetId: sanitizeBlock(spreadsheetId),
      fileId: sanitizeBlock(fileId),
      title: sanitizeBlock(title),
    })
  } catch {
    return null
  }
}

function normalizeFileIdFieldBlock(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  const resource = parseResourceIdBlock(trimmed)
  return resource?.fileId || trimmed
}

function parseIniShortcutBlock(trimmed: string): ParsedGoogleDriveShortcutBlock | null {
  const lines = trimmed.split(/\r?\n/)
  const entries = new Map<string, string>()
  for (const line of lines) {
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim().toLowerCase()
    const value = line.slice(idx + 1).trim()
    if (!key || !value) continue
    entries.set(key, value)
  }
  const url = entries.get('url') ?? entries.get('openurl') ?? entries.get('link')
  const title = entries.get('title') ?? entries.get('name')
  const resource = entries.get('resource_id') ?? entries.get('resourceid')
  const resourceId = parseResourceIdBlock(resource)
  return buildParsedShortcutBlock({
    url: sanitizeBlock(url),
    fileId: resourceId?.fileId,
    docId: resourceId?.docId,
    spreadsheetId: resourceId?.spreadsheetId,
    title: sanitizeBlock(title),
  })
}

function parseResourceIdBlock(resource: string | undefined): {
  fileId?: string
  docId?: string
  spreadsheetId?: string
} | null {
  if (!resource) return null
  const trimmed = resource.trim()
  if (!trimmed) return null
  const byType = trimmed.match(/^(document|spreadsheet|file):([A-Za-z0-9_-]+)$/i)
  if (byType?.[2]) {
    const type = byType[1]?.toLowerCase()
    const id = byType[2]
    if (type === 'document') return { docId: id, fileId: id }
    if (type === 'spreadsheet') return { spreadsheetId: id, fileId: id }
    return { fileId: id }
  }
  if (/^[A-Za-z0-9_-]{16,}$/.test(trimmed)) {
    return { fileId: trimmed }
  }
  return null
}

function extractFirstUrlFromValuesBlock(input: Record<string, unknown>): string | undefined {
  for (const value of Object.values(input)) {
    if (typeof value !== 'string') continue
    const first = extractFirstUrlBlock(value)
    if (first) return first
  }
  return undefined
}

function extractFirstUrlBlock(text: string): string | null {
  const matches = text.match(URL_PATTERN_BLOCK)
  if (!matches || matches.length === 0) return null
  return matches[0]?.trim() || null
}

function pickStringFieldBlock(input: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = input[key]
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed) return trimmed
  }
  return undefined
}

function buildParsedShortcutBlock(raw: ParsedGoogleDriveShortcutBlock): ParsedGoogleDriveShortcutBlock | null {
  const url = raw.url?.trim()
  const docId = raw.docId?.trim() || (url ? extractGoogleDocIdFromUrlBlock(url) ?? undefined : undefined)
  const spreadsheetId = raw.spreadsheetId?.trim() || (url ? extractGoogleSpreadsheetIdFromUrlBlock(url) ?? undefined : undefined)
  const fileId = raw.fileId?.trim() || docId || spreadsheetId
  const title = raw.title?.trim()
  if (!url && !fileId) return null
  return {
    ...(url ? { url } : {}),
    ...(fileId ? { fileId } : {}),
    ...(docId ? { docId } : {}),
    ...(spreadsheetId ? { spreadsheetId } : {}),
    ...(title ? { title } : {}),
  }
}

function sanitizeBlock(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}
