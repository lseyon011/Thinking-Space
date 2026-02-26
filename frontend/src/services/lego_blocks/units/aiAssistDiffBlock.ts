export type AiAssistDiffKind = 'changed' | 'added' | 'removed'

export interface AiAssistDiffRow {
  lineNumber: number
  before: string
  after: string
  kind: AiAssistDiffKind
}

export interface AiAssistDiffSummary {
  changed: number
  added: number
  removed: number
  total: number
}

export interface AiAssistDiffResult {
  rows: AiAssistDiffRow[]
  summary: AiAssistDiffSummary
  truncated: boolean
}

function normalize(value: string): string {
  return value.replace(/\r\n/g, '\n')
}

function toLines(value: string): string[] {
  if (value.length === 0) return []
  return normalize(value).split('\n')
}

export function buildAiAssistDiffBlock(original: string, suggested: string, maxRows = 200): AiAssistDiffResult {
  const beforeLines = toLines(original)
  const afterLines = toLines(suggested)
  const totalLines = Math.max(beforeLines.length, afterLines.length)

  let changed = 0
  let added = 0
  let removed = 0
  const rows: AiAssistDiffRow[] = []

  for (let index = 0; index < totalLines; index += 1) {
    const before = beforeLines[index]
    const after = afterLines[index]
    if (before === after) continue

    let kind: AiAssistDiffKind
    if (before == null && after != null) {
      kind = 'added'
      added += 1
    } else if (before != null && after == null) {
      kind = 'removed'
      removed += 1
    } else {
      kind = 'changed'
      changed += 1
    }

    if (rows.length < maxRows) {
      rows.push({
        lineNumber: index + 1,
        before: before ?? '',
        after: after ?? '',
        kind,
      })
    }
  }

  const total = changed + added + removed
  return {
    rows,
    summary: { changed, added, removed, total },
    truncated: total > rows.length,
  }
}
