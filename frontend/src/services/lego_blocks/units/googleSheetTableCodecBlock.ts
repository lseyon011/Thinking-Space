import {
  createEmptyCellBlock,
  createEmptyTableDocumentBlock,
  normalizeTableDocumentBlock,
  type GoogleSheetDescriptorBlock,
  type TableDocumentBlock,
} from '@/services/lego_blocks/units/tableDocumentSchemaBlock'

interface GoogleSheetFilePayloadBlock {
  kind?: 'google_sheet'
  spreadsheetId?: string
  sheetName?: string
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

export function decodeGoogleSheetFileBlock(text: string): TableDocumentBlock {
  let payload: GoogleSheetFilePayloadBlock = {}
  if (text.trim()) {
    try {
      payload = JSON.parse(text) as GoogleSheetFilePayloadBlock
    } catch {
      // Treat malformed gsheet files as empty sheets so they remain editable.
      payload = {}
    }
  }

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
      spreadsheetId: payload.spreadsheetId,
      sheetName: payload.sheetName,
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

export async function pullGoogleSheetValuesBlock(document: TableDocumentBlock): Promise<TableDocumentBlock> {
  const descriptor = requireGoogleDescriptorBlock(document.google)
  const range = buildGoogleRangeBlock(descriptor)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(descriptor.spreadsheetId!)}/values/${encodeURIComponent(range)}?majorDimension=ROWS`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${descriptor.accessToken}`,
    },
  })
  if (!response.ok) {
    const detail = await safeReadErrorBodyBlock(response)
    throw new Error(`Google Sheets pull failed (${response.status})${detail ? `: ${detail}` : ''}`)
  }

  const payload = await response.json() as { values?: string[][]; range?: string }
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

  return {
    ...document,
    sheets: [{ id: nextSheetId, name: nextSheetName, rows }],
    activeSheetId: nextSheetId,
    google: {
      ...descriptor,
      range: payload.range || descriptor.range,
    },
  }
}

export async function pushGoogleSheetValuesBlock(document: TableDocumentBlock): Promise<void> {
  const descriptor = requireGoogleDescriptorBlock(document.google)
  const activeSheet = document.sheets.find(sheet => sheet.id === document.activeSheetId) ?? document.sheets[0]
  if (!activeSheet) throw new Error('No active sheet to push')

  const range = buildGoogleRangeBlock({
    ...descriptor,
    sheetName: descriptor.sheetName || activeSheet.name,
  })
  const values = activeSheet.rows.map(row => row.map(cell => cell.value))

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(descriptor.spreadsheetId!)}/values/${encodeURIComponent(range)}?valueInputOption=${encodeURIComponent(descriptor.valueInputOption || 'USER_ENTERED')}`
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${descriptor.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values,
    }),
  })
  if (!response.ok) {
    const detail = await safeReadErrorBodyBlock(response)
    throw new Error(`Google Sheets push failed (${response.status})${detail ? `: ${detail}` : ''}`)
  }
}

function requireGoogleDescriptorBlock(input: GoogleSheetDescriptorBlock | undefined): GoogleSheetDescriptorBlock {
  if (!input || input.kind !== 'google_sheet') {
    throw new Error('Missing Google Sheets descriptor metadata')
  }
  if (!input.spreadsheetId?.trim()) {
    throw new Error('Google Sheet file is missing spreadsheetId')
  }
  if (!input.accessToken?.trim()) {
    throw new Error('Google Sheet accessToken is required for pull/push')
  }
  return input
}

function buildGoogleRangeBlock(descriptor: GoogleSheetDescriptorBlock): string {
  const sheet = descriptor.sheetName?.trim() || 'Sheet1'
  if (descriptor.range?.trim()) return descriptor.range
  return `${sheet}!A1:ZZ2000`
}

async function safeReadErrorBodyBlock(response: Response): Promise<string> {
  try {
    const json = await response.json()
    return typeof json?.error?.message === 'string'
      ? json.error.message
      : typeof json?.error_description === 'string'
        ? json.error_description
        : ''
  } catch {
    return ''
  }
}

