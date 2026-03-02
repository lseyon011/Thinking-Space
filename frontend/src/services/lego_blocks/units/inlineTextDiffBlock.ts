import {
  buildLineDiffOpsBlock,
  toNormalizedLinesBlock,
  type LineDiffOpAddedBlock,
  type LineDiffOpRemovedBlock,
} from '@/services/lego_blocks/units/lineDiffBlock'

export type InlineTextDiffHunkKindBlock = 'changed' | 'added' | 'removed'
export type InlineTextDiffDecisionBlock = 'pending' | 'accepted' | 'rejected'

export interface InlineTextDiffHunkBlock {
  id: string
  kind: InlineTextDiffHunkKindBlock
  beforeStart: number
  beforeLines: string[]
  afterLines: string[]
}

export interface InlineTextDiffSessionBlock {
  originalContent: string
  suggestedContent: string
  originalLines: string[]
  hunks: InlineTextDiffHunkBlock[]
}

export interface InlineTextDiffRenderedHunkBlock extends InlineTextDiffHunkBlock {
  startLine: number
  endLine: number
  decision: InlineTextDiffDecisionBlock
}

export interface InlineTextDiffRenderBlockResult {
  content: string
  hunks: InlineTextDiffRenderedHunkBlock[]
  summary: {
    pending: number
    accepted: number
    rejected: number
    total: number
  }
}

function classifyHunkKindBlock(removedRun: LineDiffOpRemovedBlock[], addedRun: LineDiffOpAddedBlock[]): InlineTextDiffHunkKindBlock {
  if (removedRun.length > 0 && addedRun.length > 0) return 'changed'
  if (addedRun.length > 0) return 'added'
  return 'removed'
}

export function buildInlineTextDiffSessionBlock(originalContent: string, suggestedContent: string): InlineTextDiffSessionBlock {
  const originalLines = toNormalizedLinesBlock(originalContent)
  const suggestedLines = toNormalizedLinesBlock(suggestedContent)
  const ops = buildLineDiffOpsBlock(originalLines, suggestedLines)

  const hunks: InlineTextDiffHunkBlock[] = []
  let cursor = 0
  while (cursor < ops.length) {
    if (ops[cursor].type === 'equal') {
      cursor += 1
      continue
    }

    const removedRun: LineDiffOpRemovedBlock[] = []
    const addedRun: LineDiffOpAddedBlock[] = []
    while (cursor < ops.length && ops[cursor].type !== 'equal') {
      const op = ops[cursor]
      if (op.type === 'removed') removedRun.push(op)
      if (op.type === 'added') addedRun.push(op)
      cursor += 1
    }

    const nextOp = ops[cursor]
    const beforeStart = removedRun[0]?.beforeIndex
      ?? ((nextOp && nextOp.type === 'equal') ? nextOp.beforeIndex : originalLines.length)
    hunks.push({
      id: `hunk-${hunks.length + 1}`,
      kind: classifyHunkKindBlock(removedRun, addedRun),
      beforeStart,
      beforeLines: removedRun.map(op => op.line),
      afterLines: addedRun.map(op => op.line),
    })
  }

  return {
    originalContent,
    suggestedContent,
    originalLines,
    hunks,
  }
}

export function renderInlineTextDiffBlock(
  session: InlineTextDiffSessionBlock,
  decisions: Record<string, InlineTextDiffDecisionBlock | undefined>,
): InlineTextDiffRenderBlockResult {
  const renderedLines: string[] = []
  const renderedHunks: InlineTextDiffRenderedHunkBlock[] = []
  let cursor = 0
  let pending = 0
  let accepted = 0
  let rejected = 0

  for (const hunk of session.hunks) {
    const safeBeforeStart = Math.max(cursor, hunk.beforeStart)
    renderedLines.push(...session.originalLines.slice(cursor, safeBeforeStart))

    const decision = decisions[hunk.id] ?? 'pending'
    if (decision === 'pending') pending += 1
    if (decision === 'accepted') accepted += 1
    if (decision === 'rejected') rejected += 1

    const startLine = renderedLines.length
    const useSuggestedLines = decision === 'accepted'
    const nextLines = useSuggestedLines ? hunk.afterLines : hunk.beforeLines
    renderedLines.push(...nextLines)
    const endLine = renderedLines.length

    renderedHunks.push({
      ...hunk,
      startLine,
      endLine,
      decision,
    })

    cursor = safeBeforeStart + hunk.beforeLines.length
  }

  renderedLines.push(...session.originalLines.slice(cursor))

  return {
    content: renderedLines.join('\n'),
    hunks: renderedHunks,
    summary: {
      pending,
      accepted,
      rejected,
      total: session.hunks.length,
    },
  }
}
