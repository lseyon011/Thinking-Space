export function normalizeLineEndingsBlock(value: string): string {
  return value.replace(/\r\n/g, '\n')
}

export function toNormalizedLinesBlock(value: string): string[] {
  if (value.length === 0) return []
  return normalizeLineEndingsBlock(value).split('\n')
}

export interface LineDiffOpEqualBlock {
  type: 'equal'
  beforeIndex: number
  afterIndex: number
  line: string
}

export interface LineDiffOpAddedBlock {
  type: 'added'
  afterIndex: number
  line: string
}

export interface LineDiffOpRemovedBlock {
  type: 'removed'
  beforeIndex: number
  line: string
}

export type LineDiffOpBlock = LineDiffOpEqualBlock | LineDiffOpAddedBlock | LineDiffOpRemovedBlock

export function buildLineDiffOpsBlock(beforeLines: string[], afterLines: string[]): LineDiffOpBlock[] {
  const n = beforeLines.length
  const m = afterLines.length
  if (n === 0 && m === 0) return []

  // Keep runtime bounded for very large notes; fallback still preserves basic behavior.
  const matrixCellLimit = 1_200_000
  if (n * m > matrixCellLimit) {
    const ops: LineDiffOpBlock[] = []
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

  const ops: LineDiffOpBlock[] = []
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
