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

export function buildInlineTextDiffSessionBlock(originalContent: string, suggestedContent: string): InlineTextDiffSessionBlock {
  const originalLines = toNormalizedLinesBlock(originalContent)
  const suggestedLines = toNormalizedLinesBlock(suggestedContent)
  const ops = buildLineDiffOpsBlock(originalLines, suggestedLines)

  const hunks: InlineTextDiffHunkBlock[] = []
  const nextHunkId = () => `hunk-${hunks.length + 1}`
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
    const beforeStartFallback = removedRun[0]?.beforeIndex
      ?? ((nextOp && nextOp.type === 'equal') ? nextOp.beforeIndex : originalLines.length)
    const paired = Math.min(removedRun.length, addedRun.length)

    for (let index = 0; index < paired; index += 1) {
      hunks.push({
        id: nextHunkId(),
        kind: 'changed',
        beforeStart: removedRun[index].beforeIndex,
        beforeLines: [removedRun[index].line],
        afterLines: [addedRun[index].line],
      })
    }

    for (let index = paired; index < removedRun.length; index += 1) {
      hunks.push({
        id: nextHunkId(),
        kind: 'removed',
        beforeStart: removedRun[index].beforeIndex,
        beforeLines: [removedRun[index].line],
        afterLines: [],
      })
    }

    const addedBeforeStart = removedRun.length > 0
      ? (removedRun[removedRun.length - 1].beforeIndex + 1)
      : beforeStartFallback
    if (paired < addedRun.length) {
      hunks.push({
        id: nextHunkId(),
        kind: 'added',
        beforeStart: addedBeforeStart,
        beforeLines: [],
        afterLines: addedRun.slice(paired).map(op => op.line),
      })
    }
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
    const nextLines = decision === 'accepted'
      ? hunk.afterLines
      : hunk.beforeLines
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
