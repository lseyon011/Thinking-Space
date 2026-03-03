import {
  createEmptyCellBlock,
  createEmptyTableDocumentBlock,
  normalizeTableDocumentBlock,
  type GoogleSheetDescriptorBlock,
  type TableDocumentBlock,
} from '@/services/lego_blocks/units/tableDocumentSchemaBlock'
import {
  extractGoogleSpreadsheetIdFromUrlBlock,
  parseGoogleDriveShortcutBlock,
} from '@/services/lego_blocks/units/googleDriveShortcutBlock'

interface GoogleSheetFilePayloadBlock {
  kind?: 'google_sheet'
  spreadsheetId?: string
  spreadsheet_id?: string
  sheet_id?: string
  fileId?: string
  file_id?: string
  title?: string
  name?: string
  openUrl?: string
  url?: string
  webViewLink?: string
  sheetName?: string
  sheet_name?: string
  range?: string
  accessToken?: string
  valueInputOption?: 'RAW' | 'USER_ENTERED'
  cached?: {
    activeSheetId?: string
    sheets?: Array<{
      id?: string
      name?: string
      rows?: string[][]
    }>
  }
}

export function resolveGoogleSheetOpenUrlBlock(descriptor: GoogleSheetDescriptorBlock | undefined): string | null {
  const openUrl = descriptor?.openUrl?.trim()
  if (openUrl) return openUrl
  const spreadsheetId = descriptor?.spreadsheetId?.trim()
  if (!spreadsheetId) return null
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/edit`
}

export function decodeGoogleSheetFileBlock(text: string): TableDocumentBlock {
  const trimmed = stripUtf8BomBlock(text).trim()
  let payload: GoogleSheetFilePayloadBlock = {}
  if (trimmed) {
    try {
      payload = JSON.parse(trimmed) as GoogleSheetFilePayloadBlock
    } catch {
      // Treat malformed gsheet files as empty sheets so they remain editable.
      payload = {}
    }
  }
  const parsedShortcut = trimmed ? parseGoogleDriveShortcutBlock(trimmed) : null
  const openUrl = sanitizeBlock(payload.openUrl)
    || sanitizeBlock(payload.url)
    || sanitizeBlock(payload.webViewLink)
    || parsedShortcut?.url
  const spreadsheetId = sanitizeBlock(payload.spreadsheetId)
    || sanitizeBlock(payload.spreadsheet_id)
    || sanitizeBlock(payload.sheet_id)
    || sanitizeBlock(payload.fileId)
    || sanitizeBlock(payload.file_id)
    || parsedShortcut?.spreadsheetId
    || parsedShortcut?.fileId
    || (openUrl ? extractGoogleSpreadsheetIdFromUrlBlock(openUrl) ?? undefined : undefined)
  const sheetName = sanitizeBlock(payload.sheetName) || sanitizeBlock(payload.sheet_name)
  const title = sanitizeBlock(payload.title) || sanitizeBlock(payload.name) || parsedShortcut?.title

  const fallback = createEmptyTableDocumentBlock('gsheet')
  const cachedSheets = payload.cached?.sheets?.map((sheet, idx) => ({
    id: sheet.id || `sheet-${idx + 1}`,
    name: sheet.name || `Sheet${idx + 1}`,
    rows: (sheet.rows && sheet.rows.length > 0)
      ? sheet.rows.map(row => (row.length > 0 ? row : [''])).map(row => row.map(value => createEmptyCellBlock(value ?? '')))
      : [[createEmptyCellBlock('')]],
  })) ?? fallback.sheets

  return normalizeTableDocumentBlock({
    kind: 'gsheet',
    sheets: cachedSheets,
    activeSheetId: payload.cached?.activeSheetId || cachedSheets[0]?.id,
    google: {
      kind: 'google_sheet',
      spreadsheetId,
      title,
      openUrl,
      sheetName: sheetName || cachedSheets[0]?.name,
      range: payload.range,
      accessToken: payload.accessToken,
      valueInputOption: payload.valueInputOption || 'USER_ENTERED',
    },
  }, 'gsheet')
}

export function encodeGoogleSheetFileBlock(document: TableDocumentBlock): string {
  const google = document.google ?? { kind: 'google_sheet' }
  const payload: GoogleSheetFilePayloadBlock = {
    kind: 'google_sheet',
    spreadsheetId: google.spreadsheetId,
    title: google.title,
    openUrl: google.openUrl,
    sheetName: google.sheetName,
    range: google.range,
    accessToken: google.accessToken,
    valueInputOption: google.valueInputOption ?? 'USER_ENTERED',
    cached: {
      activeSheetId: document.activeSheetId,
      sheets: document.sheets.map((sheet) => ({
        id: sheet.id,
        name: sheet.name,
        rows: sheet.rows.map(row => row.map(cell => cell.value)),
      })),
    },
  }
  return `${JSON.stringify(payload, null, 2)}\n`
}

export async function pullGoogleSheetValuesBlock(
  document: TableDocumentBlock,
  options?: { accessToken?: string | null },
): Promise<TableDocumentBlock> {
  const descriptor = requireGoogleDescriptorBlock(document.google, options?.accessToken)
  const range = buildGoogleRangeBlock(descriptor)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(descriptor.spreadsheetId!)}/values/${encodeURIComponent(range)}?majorDimension=ROWS`
  const response = await requestGoogleApiTextBlock({
    method: 'GET',
    url,
    accessToken: descriptor.accessToken!,
  })
  if (response.status < 200 || response.status >= 300) {
    const detail = extractGoogleApiErrorMessageBlock(response.body)
    throw new Error(`Google Sheets pull failed (${response.status})${detail ? `: ${detail}` : ''}`)
  }

  const payload = safeParseJsonBlock<{ values?: string[][]; range?: string }>(response.body) ?? {}
  const values = Array.isArray(payload.values) ? payload.values : [[]]
  const width = values.reduce((max, row) => Math.max(max, row.length), 1)
  const normalizedRows = values.map(row => {
    const padded = [...row]
    while (padded.length < width) padded.push('')
    return padded.map(value => createEmptyCellBlock(String(value ?? '')))
  })
  const rows = normalizedRows.length > 0 ? normalizedRows : [[createEmptyCellBlock('')]]
  const activeSheet = document.sheets.find(sheet => sheet.id === document.activeSheetId) ?? document.sheets[0]
  const nextSheetName = descriptor.sheetName || activeSheet?.name || 'Sheet1'
  const nextSheetId = activeSheet?.id || 'sheet-1'
  const persistedAccessToken = sanitizeBlock(document.google?.accessToken)

  return {
    ...document,
    sheets: [{ id: nextSheetId, name: nextSheetName, rows }],
    activeSheetId: nextSheetId,
    google: {
      ...descriptor,
      accessToken: persistedAccessToken,
      range: payload.range || descriptor.range,
    },
  }
}

export async function pushGoogleSheetValuesBlock(
  document: TableDocumentBlock,
  options?: { accessToken?: string | null },
): Promise<void> {
  const descriptor = requireGoogleDescriptorBlock(document.google, options?.accessToken)
  const activeSheet = document.sheets.find(sheet => sheet.id === document.activeSheetId) ?? document.sheets[0]
  if (!activeSheet) throw new Error('No active sheet to push')

  const range = buildGoogleRangeBlock({
    ...descriptor,
    sheetName: descriptor.sheetName || activeSheet.name,
  })
  const values = activeSheet.rows.map(row => row.map(cell => cell.value))

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(descriptor.spreadsheetId!)}/values/${encodeURIComponent(range)}?valueInputOption=${encodeURIComponent(descriptor.valueInputOption || 'USER_ENTERED')}`
  const response = await requestGoogleApiTextBlock({
    method: 'PUT',
    url,
    accessToken: descriptor.accessToken!,
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values,
    }),
  })
  if (response.status < 200 || response.status >= 300) {
    const detail = extractGoogleApiErrorMessageBlock(response.body)
    throw new Error(`Google Sheets push failed (${response.status})${detail ? `: ${detail}` : ''}`)
  }
}

function requireGoogleDescriptorBlock(
  input: GoogleSheetDescriptorBlock | undefined,
  accessTokenOverride?: string | null,
): GoogleSheetDescriptorBlock {
  if (!input || input.kind !== 'google_sheet') {
    throw new Error('Missing Google Sheets descriptor metadata')
  }
  const spreadsheetId = sanitizeBlock(input.spreadsheetId)
    || (input.openUrl ? extractGoogleSpreadsheetIdFromUrlBlock(input.openUrl) ?? undefined : undefined)
  if (!spreadsheetId) {
    throw new Error('Google Sheet file is missing spreadsheetId')
  }
  const accessToken = sanitizeBlock(accessTokenOverride || undefined) || sanitizeBlock(input.accessToken)
  if (!accessToken) {
    throw new Error('Google Sheet accessToken is required for pull/push')
  }
  return {
    ...input,
    kind: 'google_sheet',
    spreadsheetId,
    accessToken,
  }
}

function buildGoogleRangeBlock(descriptor: GoogleSheetDescriptorBlock): string {
  const sheet = descriptor.sheetName?.trim() || 'Sheet1'
  if (descriptor.range?.trim()) return descriptor.range
  return `${sheet}!A1:ZZ2000`
}

async function requestGoogleApiTextBlock(input: {
  method: 'GET' | 'PUT'
  url: string
  accessToken: string
  body?: string
}): Promise<{ status: number; body: string }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${input.accessToken}`,
  }
  if (input.body) {
    headers['Content-Type'] = 'application/json'
  }

  if (window.electronAPI?.isElectron && window.electronAPI.googleOauthRequest) {
    return window.electronAPI.googleOauthRequest({
      method: input.method,
      url: input.url,
      headers,
      body: input.body,
    })
  }

  const response = await fetch(input.url, {
    method: input.method,
    headers,
    body: input.body,
  })
  return {
    status: response.status,
    body: await response.text(),
  }
}

function extractGoogleApiErrorMessageBlock(payloadText: string): string {
  const payload = safeParseJsonBlock<Record<string, unknown>>(payloadText)
  const nestedError = payload?.error
  if (nestedError && typeof nestedError === 'object') {
    const message = (nestedError as Record<string, unknown>).message
    if (typeof message === 'string' && message.trim()) return message.trim()
  }
  const topLevelErrorDescription = payload?.error_description
  if (typeof topLevelErrorDescription === 'string' && topLevelErrorDescription.trim()) {
    return topLevelErrorDescription.trim()
  }
  const topLevelError = payload?.error
  if (typeof topLevelError === 'string' && topLevelError.trim()) {
    return topLevelError.trim()
  }
  return ''
}

function safeParseJsonBlock<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T
  } catch {
    return null
  }
}

function sanitizeBlock(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function stripUtf8BomBlock(input: string): string {
  return input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
}
