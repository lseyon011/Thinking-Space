export type TableDocKind = 'csv' | 'tsv' | 'xlsx' | 'gsheet'

export type TableCellAlign = 'left' | 'center' | 'right'

export type TableCellNumberFormat =
  | 'general'
  | 'number'
  | 'currency'
  | 'percent'
  | 'date'
  | 'text'

export interface TableCellFormatBlock {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  align?: TableCellAlign
  textColor?: string
  backgroundColor?: string
  numberFormat?: TableCellNumberFormat
}

export interface TableCellBlock {
  value: string
  format?: TableCellFormatBlock
}

export interface TableSheetBlock {
  id: string
  name: string
  rows: TableCellBlock[][]
}

export interface GoogleSheetDescriptorBlock {
  kind: 'google_sheet'
  spreadsheetId?: string
  title?: string
  openUrl?: string
  sheetName?: string
  range?: string
  accessToken?: string
  valueInputOption?: 'RAW' | 'USER_ENTERED'
}

export interface TableDocumentBlock {
  kind: TableDocKind
  sheets: TableSheetBlock[]
  activeSheetId: string
  delimiter?: ',' | '\t'
  google?: GoogleSheetDescriptorBlock
}

export function createEmptyCellBlock(value = ''): TableCellBlock {
  return { value }
}

export function createEmptySheetBlock(name = 'Sheet1', id = `sheet-${Math.random().toString(36).slice(2, 10)}`): TableSheetBlock {
  return {
    id,
    name,
    rows: [[createEmptyCellBlock('')]],
  }
}

export function createEmptyTableDocumentBlock(kind: TableDocKind): TableDocumentBlock {
  const sheet = createEmptySheetBlock()
  return {
    kind,
    sheets: [sheet],
    activeSheetId: sheet.id,
    delimiter: kind === 'tsv' ? '\t' : ',',
  }
}

export function normalizeTableDocumentBlock(input: Partial<TableDocumentBlock>, kind: TableDocKind): TableDocumentBlock {
  const fallback = createEmptyTableDocumentBlock(kind)
  const sheets = Array.isArray(input.sheets) && input.sheets.length > 0
    ? input.sheets.map((sheet, idx) => ({
      id: sheet.id || `sheet-${idx + 1}`,
      name: sheet.name || `Sheet${idx + 1}`,
      rows: normalizeRowsBlock(sheet.rows),
    }))
    : fallback.sheets

  const activeSheetId = input.activeSheetId && sheets.some(sheet => sheet.id === input.activeSheetId)
    ? input.activeSheetId
    : sheets[0].id

  const delimiter = input.delimiter === '\t' ? '\t' : ','

  return {
    kind,
    sheets,
    activeSheetId,
    delimiter,
    google: input.google && input.google.kind === 'google_sheet'
      ? input.google
      : undefined,
  }
}

function normalizeRowsBlock(rows: TableCellBlock[][] | undefined): TableCellBlock[][] {
  if (!Array.isArray(rows) || rows.length === 0) return [[createEmptyCellBlock('')]]
  const normalized = rows.map((row) => {
    if (!Array.isArray(row) || row.length === 0) return [createEmptyCellBlock('')]
    return row.map((cell) => ({
      value: typeof cell?.value === 'string' ? cell.value : '',
      format: normalizeFormatBlock(cell?.format),
    }))
  })
  return normalized.length > 0 ? normalized : [[createEmptyCellBlock('')]]
}

function normalizeFormatBlock(input: TableCellFormatBlock | undefined): TableCellFormatBlock | undefined {
  if (!input) return undefined
  const next: TableCellFormatBlock = {}
  if (input.bold) next.bold = true
  if (input.italic) next.italic = true
  if (input.underline) next.underline = true
  if (input.align === 'left' || input.align === 'center' || input.align === 'right') next.align = input.align
  if (typeof input.textColor === 'string' && input.textColor.trim()) next.textColor = input.textColor
  if (typeof input.backgroundColor === 'string' && input.backgroundColor.trim()) next.backgroundColor = input.backgroundColor
  if (
    input.numberFormat === 'general'
    || input.numberFormat === 'number'
    || input.numberFormat === 'currency'
    || input.numberFormat === 'percent'
    || input.numberFormat === 'date'
    || input.numberFormat === 'text'
  ) {
    next.numberFormat = input.numberFormat
  }
  return Object.keys(next).length > 0 ? next : undefined
}
