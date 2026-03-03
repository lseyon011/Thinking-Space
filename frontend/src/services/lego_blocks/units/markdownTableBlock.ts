import { markdownTable } from 'markdown-table'

export type DelimitedTableDelimiterBlock = '\t' | ',' | ';' | '|'

export interface ParsedDelimitedTableBlock {
  delimiter: DelimitedTableDelimiterBlock
  rows: string[][]
}

export interface TextPatchBlock {
  value: string
  start: number
  end: number
}

function normalizeCellValueBlock(value: string): string {
  return value.replace(/\r?\n/g, ' ').trim()
}

function normalizeRowsBlock(rows: string[][]): string[][] {
  const trimmedRows = rows
    .map(row => row.map(cell => normalizeCellValueBlock(cell)))
    .filter(row => row.some(cell => cell.length > 0))

  if (trimmedRows.length === 0) return []

  const maxColumns = Math.max(1, ...trimmedRows.map(row => row.length))
  return trimmedRows.map((row) => {
    const padded = [...row]
    while (padded.length < maxColumns) padded.push('')
    return padded
  })
}

export function buildMarkdownTableFromRowsBlock(rows: string[][]): string {
  const normalized = normalizeRowsBlock(rows)
  if (normalized.length === 0) {
    return markdownTable([
      ['Column 1', 'Column 2', 'Column 3'],
      ['', '', ''],
      ['', '', ''],
    ], { alignDelimiters: true })
  }
  return markdownTable(normalized, { alignDelimiters: true })
}

export function buildMarkdownTableTemplateBlock(columnCount = 3, bodyRowCount = 2): string {
  const columns = Math.max(2, columnCount)
  const rows = Math.max(1, bodyRowCount)
  const header = Array.from({ length: columns }, (_, idx) => `Column ${idx + 1}`)
  const body = Array.from({ length: rows }, () => Array.from({ length: columns }, () => ''))
  return markdownTable([header, ...body], { alignDelimiters: true })
}

function parseDelimitedRowsBlock(input: string, delimiter: DelimitedTableDelimiterBlock): string[][] {
  if (!input.trim()) return []

  const rows: string[][] = []
  let row: string[] = []
  let value = ''
  let inQuotes = false

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          value += '"'
          i += 1
          continue
        }
        inQuotes = false
        continue
      }
      value += ch
      continue
    }

    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === delimiter) {
      row.push(value)
      value = ''
      continue
    }
    if (ch === '\n') {
      row.push(value)
      rows.push(row)
      row = []
      value = ''
      continue
    }
    if (ch === '\r') {
      if (input[i + 1] === '\n') i += 1
      row.push(value)
      rows.push(row)
      row = []
      value = ''
      continue
    }
    value += ch
  }

  row.push(value)
  rows.push(row)
  return rows
}

function scoreRowsForDelimiterBlock(rows: string[][], delimiter: DelimitedTableDelimiterBlock): number {
  if (rows.length < 2) return -1
  const normalized = rows.filter(row => row.some(cell => cell.trim().length > 0))
  if (normalized.length < 2) return -1
  const widths = normalized.map(row => row.length)
  const maxColumns = Math.max(...widths)
  if (maxColumns < 2) return -1
  const minColumns = Math.min(...widths)
  const consistentRows = widths.filter(count => count === widths[0]).length
  const delimiterBonus = delimiter === '\t' ? 30 : delimiter === ',' ? 20 : delimiter === ';' ? 10 : 5
  return (consistentRows * 20) + (minColumns * 10) + maxColumns + delimiterBonus
}

function readDelimitedLineStatsBlock(
  input: string,
  delimiter: DelimitedTableDelimiterBlock,
): {
  nonEmptyLineCount: number
  linesWithDelimiter: number
  maxDelimitersOnLine: number
  totalDelimiters: number
  delimitersFollowedByWhitespace: number
} {
  const lines = input
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)

  let linesWithDelimiter = 0
  let maxDelimitersOnLine = 0
  let totalDelimiters = 0
  let delimitersFollowedByWhitespace = 0

  for (const line of lines) {
    let inQuotes = false
    let delimiterCount = 0

    for (let index = 0; index < line.length; index += 1) {
      const ch = line[index]
      if (ch === '"') {
        if (inQuotes && line[index + 1] === '"') {
          index += 1
          continue
        }
        inQuotes = !inQuotes
        continue
      }
      if (!inQuotes && ch === delimiter) {
        delimiterCount += 1
        totalDelimiters += 1
        if (/\s/.test(line[index + 1] ?? '')) {
          delimitersFollowedByWhitespace += 1
        }
      }
    }

    if (delimiterCount > 0) {
      linesWithDelimiter += 1
      if (delimiterCount > maxDelimitersOnLine) {
        maxDelimitersOnLine = delimiterCount
      }
    }
  }

  return {
    nonEmptyLineCount: lines.length,
    linesWithDelimiter,
    maxDelimitersOnLine,
    totalDelimiters,
    delimitersFollowedByWhitespace,
  }
}

function isLikelyDelimitedTableBlock(
  input: string,
  delimiter: DelimitedTableDelimiterBlock,
  rows: string[][],
): boolean {
  const normalizedRows = rows.filter(row => row.some(cell => cell.trim().length > 0))
  if (normalizedRows.length < 2) return false

  const widths = normalizedRows.map(row => row.length)
  const maxColumns = Math.max(...widths)
  if (maxColumns < 2) return false

  const stats = readDelimitedLineStatsBlock(input, delimiter)
  if (stats.linesWithDelimiter < 2) return false

  const delimiterLineCoverage = stats.nonEmptyLineCount > 0
    ? stats.linesWithDelimiter / stats.nonEmptyLineCount
    : 0
  if (delimiterLineCoverage < 0.8) return false

  // Pipe-delimited table-like content should have at least 2 separators per line
  // (e.g. col1|col2|col3). Single pipe usage is often prose/code.
  if (delimiter === '|' && stats.maxDelimitersOnLine < 2) return false

  // For comma/semicolon, avoid converting prose clauses like
  // "sentence, with punctuation" pasted over multiple lines.
  if ((delimiter === ',' || delimiter === ';') && stats.maxDelimitersOnLine === 1) {
    if (stats.linesWithDelimiter < 3) return false
    const followedByWhitespaceRatio = stats.totalDelimiters > 0
      ? stats.delimitersFollowedByWhitespace / stats.totalDelimiters
      : 0
    if (followedByWhitespaceRatio > 0.8) return false
  }

  return true
}

export function detectAndParseDelimitedTableBlock(input: string): ParsedDelimitedTableBlock | null {
  if (!input.trim()) return null
  const normalizedInput = input.replace(/\r\n/g, '\n')
  const candidates: DelimitedTableDelimiterBlock[] = normalizedInput.includes('\t')
    ? ['\t', ',', ';', '|']
    : [',', ';', '|']

  let best: { delimiter: DelimitedTableDelimiterBlock; rows: string[][]; score: number } | null = null
  for (const delimiter of candidates) {
    const rows = parseDelimitedRowsBlock(normalizedInput, delimiter)
    const score = scoreRowsForDelimiterBlock(rows, delimiter)
    if (score < 0) continue
    if (!best || score > best.score) best = { delimiter, rows, score }
  }

  if (!best) return null
  const normalizedRows = normalizeRowsBlock(best.rows)
  if (normalizedRows.length < 2 || normalizedRows[0]?.length < 2) return null
  if (!isLikelyDelimitedTableBlock(normalizedInput, best.delimiter, normalizedRows)) return null
  return {
    delimiter: best.delimiter,
    rows: normalizedRows,
  }
}

function isMarkdownTableSeparatorLineBlock(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)
}

function splitMarkdownTableRowCellsBlock(line: string): string[] {
  let trimmed = line.trim()
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1)
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1)

  const cells: string[] = []
  let cell = ''
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i]
    if (ch === '|' && trimmed[i - 1] !== '\\') {
      cells.push(cell.trim())
      cell = ''
      continue
    }
    cell += ch
  }
  cells.push(cell.trim())
  return cells
}

function parseMarkdownTableAlignmentBlock(separatorLine: string): string[] | undefined {
  const cells = splitMarkdownTableRowCellsBlock(separatorLine)
  const align = cells.map((cell) => {
    const value = cell.trim()
    if (/^:-+:$/.test(value)) return 'c'
    if (/^:-+$/.test(value)) return 'l'
    if (/^-+:$/.test(value)) return 'r'
    return ''
  })
  return align.some(token => token) ? align : undefined
}

function computeLineStartsBlock(lines: string[]): number[] {
  const starts: number[] = []
  let offset = 0
  for (let index = 0; index < lines.length; index += 1) {
    starts.push(offset)
    offset += lines[index].length
    if (index < lines.length - 1) offset += 1
  }
  return starts
}

function findLineIndexAtOffsetBlock(lineStarts: number[], lines: string[], offset: number): number {
  const clamped = Math.max(0, offset)
  for (let index = 0; index < lineStarts.length; index += 1) {
    const lineStart = lineStarts[index]
    const lineEnd = lineStart + lines[index].length
    if (clamped <= lineEnd) return index
  }
  return Math.max(0, lineStarts.length - 1)
}

function formatTableRowsBlock(rows: string[][], align?: string[]): string {
  return markdownTable(rows, {
    alignDelimiters: true,
    align,
  })
}

export function formatMarkdownTableAtSelectionBlock(source: string, start: number, end: number): TextPatchBlock {
  const lines = source.split('\n')
  if (lines.length < 2) return { value: source, start, end }

  const lineStarts = computeLineStartsBlock(lines)
  const startLineIndex = findLineIndexAtOffsetBlock(lineStarts, lines, start)
  const endLineIndex = findLineIndexAtOffsetBlock(lineStarts, lines, end)

  let top = startLineIndex
  let bottom = endLineIndex
  const isPipeLine = (line: string) => line.trim().length > 0 && line.includes('|')
  while (top > 0 && isPipeLine(lines[top - 1])) top -= 1
  while (bottom < lines.length - 1 && isPipeLine(lines[bottom + 1])) bottom += 1

  const windowLines = lines.slice(top, bottom + 1)
  if (windowLines.length < 2) return { value: source, start, end }

  const separatorIndex = windowLines.findIndex((line, idx) => idx > 0 && isMarkdownTableSeparatorLineBlock(line))
  if (separatorIndex <= 0) return { value: source, start, end }

  const headerAbsoluteIndex = top + separatorIndex - 1
  const tableLines = lines.slice(headerAbsoluteIndex, bottom + 1)
  if (tableLines.length < 2 || !isMarkdownTableSeparatorLineBlock(tableLines[1])) {
    return { value: source, start, end }
  }

  const parsedRows = tableLines
    .filter(line => line.trim().length > 0)
    .filter((_line, idx) => idx !== 1)
    .map(splitMarkdownTableRowCellsBlock)

  if (parsedRows.length < 2 || parsedRows[0].length < 2) {
    return { value: source, start, end }
  }

  const alignment = parseMarkdownTableAlignmentBlock(tableLines[1])
  const formattedTable = formatTableRowsBlock(parsedRows, alignment)
  const tableStartOffset = lineStarts[headerAbsoluteIndex]
  const tableEndOffset = lineStarts[bottom] + lines[bottom].length

  const nextValue = `${source.slice(0, tableStartOffset)}${formattedTable}${source.slice(tableEndOffset)}`
  const nextCursor = tableStartOffset + formattedTable.length
  return { value: nextValue, start: nextCursor, end: nextCursor }
}
