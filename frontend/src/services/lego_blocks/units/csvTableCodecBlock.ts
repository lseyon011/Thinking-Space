import {
  createEmptyCellBlock,
  createEmptyTableDocumentBlock,
  type TableCellBlock,
  type TableDocumentBlock,
} from '@/services/lego_blocks/units/tableDocumentSchemaBlock'

export function decodeDelimitedTableBlock(input: string, delimiter: ',' | '\t'): TableDocumentBlock {
  const rows = parseDelimitedBlock(input, delimiter)
  const doc = createEmptyTableDocumentBlock(delimiter === '\t' ? 'tsv' : 'csv')
  doc.delimiter = delimiter
  doc.sheets[0].rows = rows.length > 0 ? rows : [[createEmptyCellBlock('')]]
  return doc
}

export function encodeDelimitedTableBlock(document: TableDocumentBlock, delimiter: ',' | '\t'): string {
  const sheet = document.sheets.find(item => item.id === document.activeSheetId) ?? document.sheets[0]
  const rows = sheet?.rows ?? []
  const values = rows.map(row => row.map(cell => cell.value ?? ''))

  let lastRow = values.length - 1
  while (lastRow >= 0 && values[lastRow].every(value => value === '')) lastRow -= 1
  const trimmedRows = values.slice(0, Math.max(1, lastRow + 1))
  return stringifyDelimitedBlock(trimmedRows, delimiter)
}

function parseDelimitedBlock(input: string, delimiter: string): TableCellBlock[][] {
  if (!input) return [[createEmptyCellBlock('')]]
  const rows: string[][] = []
  let row: string[] = []
  let value = ''
  let inQuotes = false
  let i = 0

  while (i < input.length) {
    const ch = input[i]
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          value += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      value += ch
      i += 1
      continue
    }

    if (ch === '"') {
      inQuotes = true
      i += 1
      continue
    }

    if (ch === delimiter) {
      row.push(value)
      value = ''
      i += 1
      continue
    }

    if (ch === '\n') {
      row.push(value)
      rows.push(row)
      row = []
      value = ''
      i += 1
      continue
    }

    if (ch === '\r') {
      if (input[i + 1] === '\n') i += 1
      row.push(value)
      rows.push(row)
      row = []
      value = ''
      i += 1
      continue
    }

    value += ch
    i += 1
  }

  row.push(value)
  rows.push(row)

  const maxColumns = rows.reduce((max, current) => Math.max(max, current.length), 1)
  return rows.map((current) => {
    const padded = [...current]
    while (padded.length < maxColumns) padded.push('')
    return padded.map(cell => createEmptyCellBlock(cell))
  })
}

function stringifyDelimitedBlock(rows: string[][], delimiter: string): string {
  return rows
    .map((row) => row.map((value) => {
      const needsQuote = value.includes(delimiter) || value.includes('"') || value.includes('\n') || value.includes('\r')
      if (!needsQuote) return value
      return `"${value.replace(/"/g, '""')}"`
    }).join(delimiter))
    .join('\n')
}

