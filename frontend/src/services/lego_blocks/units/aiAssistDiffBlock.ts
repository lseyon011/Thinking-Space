import {
  buildLineDiffOpsBlock,
  toNormalizedLinesBlock,
  type LineDiffOpAddedBlock,
  type LineDiffOpRemovedBlock,
} from '@/services/lego_blocks/units/lineDiffBlock'

export type AiAssistDiffKind = 'unchanged' | 'changed' | 'added' | 'removed'

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

export function buildAiAssistDiffBlock(
  original: string,
  suggested: string,
  maxRows = 200,
  options?: { includeUnchanged?: boolean },
): AiAssistDiffResult {
  const beforeLines = toNormalizedLinesBlock(original)
  const afterLines = toNormalizedLinesBlock(suggested)
  const ops = buildLineDiffOpsBlock(beforeLines, afterLines)
  const includeUnchanged = options?.includeUnchanged === true
  let changed = 0
  let added = 0
  let removed = 0
  const rows: AiAssistDiffRow[] = []
  let totalRows = 0
  let cursor = 0

  while (cursor < ops.length) {
    const op = ops[cursor]
    if (op.type === 'equal') {
      if (includeUnchanged) {
        totalRows += 1
        if (rows.length < maxRows) {
          rows.push({
            lineNumber: op.beforeIndex + 1,
            before: op.line,
            after: op.line,
            kind: 'unchanged',
          })
        }
      }
      cursor += 1
      continue
    }

    const removedRun: LineDiffOpRemovedBlock[] = []
    const addedRun: LineDiffOpAddedBlock[] = []
    while (cursor < ops.length && ops[cursor].type !== 'equal') {
      const current = ops[cursor]
      if (current.type === 'removed') removedRun.push(current)
      if (current.type === 'added') addedRun.push(current)
      cursor += 1
    }

    const paired = Math.min(removedRun.length, addedRun.length)
    for (let i = 0; i < paired; i += 1) {
      changed += 1
      totalRows += 1
      if (rows.length < maxRows) {
        rows.push({
          lineNumber: removedRun[i].beforeIndex + 1,
          before: removedRun[i].line,
          after: addedRun[i].line,
          kind: 'changed',
        })
      }
    }

    for (let i = paired; i < removedRun.length; i += 1) {
      removed += 1
      totalRows += 1
      if (rows.length < maxRows) {
        rows.push({
          lineNumber: removedRun[i].beforeIndex + 1,
          before: removedRun[i].line,
          after: '',
          kind: 'removed',
        })
      }
    }

    for (let i = paired; i < addedRun.length; i += 1) {
      added += 1
      totalRows += 1
      if (rows.length < maxRows) {
        rows.push({
          lineNumber: addedRun[i].afterIndex + 1,
          before: '',
          after: addedRun[i].line,
          kind: 'added',
        })
      }
    }
  }

  const total = changed + added + removed
  return {
    rows,
    summary: { changed, added, removed, total },
    truncated: totalRows > rows.length,
  }
}
