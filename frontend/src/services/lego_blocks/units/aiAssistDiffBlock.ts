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

function normalize(value: string): string {
  return value.replace(/\r\n/g, '\n')
}

function toLines(value: string): string[] {
  if (value.length === 0) return []
  return normalize(value).split('\n')
}

interface DiffOpEqual {
  type: 'equal'
  beforeIndex: number
  afterIndex: number
  line: string
}

interface DiffOpAdded {
  type: 'added'
  afterIndex: number
  line: string
}

interface DiffOpRemoved {
  type: 'removed'
  beforeIndex: number
  line: string
}

type DiffOp = DiffOpEqual | DiffOpAdded | DiffOpRemoved

function buildLineOps(beforeLines: string[], afterLines: string[]): DiffOp[] {
  const n = beforeLines.length
  const m = afterLines.length
  if (n === 0 && m === 0) return []

  // Keep runtime bounded for very large notes; fallback still preserves basic behavior.
  const matrixCellLimit = 1_200_000
  if (n * m > matrixCellLimit) {
    const ops: DiffOp[] = []
    const totalLines = Math.max(n, m)
    for (let index = 0; index < totalLines; index += 1) {
      const before = beforeLines[index]
      const after = afterLines[index]
      if (before === after && before != null) {
        ops.push({ type: 'equal', beforeIndex: index, afterIndex: index, line: before })
      } else {
        if (before != null) ops.push({ type: 'removed', beforeIndex: index, line: before })
        if (after != null) ops.push({ type: 'added', afterIndex: index, line: after })
      }
    }
    return ops
  }

  const width = m + 1
  const lcs = new Uint32Array((n + 1) * (m + 1))
  const idx = (i: number, j: number) => i * width + j

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      if (beforeLines[i] === afterLines[j]) {
        lcs[idx(i, j)] = lcs[idx(i + 1, j + 1)] + 1
      } else {
        const down = lcs[idx(i + 1, j)]
        const right = lcs[idx(i, j + 1)]
        lcs[idx(i, j)] = down >= right ? down : right
      }
    }
  }

  const ops: DiffOp[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (beforeLines[i] === afterLines[j]) {
      ops.push({ type: 'equal', beforeIndex: i, afterIndex: j, line: beforeLines[i] })
      i += 1
      j += 1
      continue
    }
    const down = lcs[idx(i + 1, j)]
    const right = lcs[idx(i, j + 1)]
    if (down >= right) {
      ops.push({ type: 'removed', beforeIndex: i, line: beforeLines[i] })
      i += 1
    } else {
      ops.push({ type: 'added', afterIndex: j, line: afterLines[j] })
      j += 1
    }
  }
  while (i < n) {
    ops.push({ type: 'removed', beforeIndex: i, line: beforeLines[i] })
    i += 1
  }
  while (j < m) {
    ops.push({ type: 'added', afterIndex: j, line: afterLines[j] })
    j += 1
  }

  return ops
}

export function buildAiAssistDiffBlock(
  original: string,
  suggested: string,
  maxRows = 200,
  options?: { includeUnchanged?: boolean },
): AiAssistDiffResult {
  const beforeLines = toLines(original)
  const afterLines = toLines(suggested)
  const ops = buildLineOps(beforeLines, afterLines)
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

    const removedRun: DiffOpRemoved[] = []
    const addedRun: DiffOpAdded[] = []
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
