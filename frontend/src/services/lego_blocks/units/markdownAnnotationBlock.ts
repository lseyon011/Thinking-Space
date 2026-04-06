import { v4 as uuidv4 } from 'uuid'
import { visit } from 'unist-util-visit'

export const MARKDOWN_ANNOTATION_FENCE_BLOCK = 'thinking-space-annotations'

export interface MarkdownAnnotationPointBlock {
  x: number
  y: number
  pressure: number | null
}

export interface MarkdownAnnotationStrokeBlock {
  id: string
  color: string
  points: MarkdownAnnotationPointBlock[]
}

export interface MarkdownAnchorAnnotationBlock {
  id: string
  anchorId: string
  text: string
  transcript: string
  ocrText: string
  ocrStatus: 'idle' | 'ready' | 'error'
  ocrUpdatedAt: string | null
  strokes: MarkdownAnnotationStrokeBlock[]
  createdAt: string
  updatedAt: string
}

export interface MarkdownAnnotationStoreBlock {
  version: 1
  annotations: MarkdownAnchorAnnotationBlock[]
}

export interface MarkdownAnnotationDocumentStateBlock {
  body: string
  store: MarkdownAnnotationStoreBlock
  rawFenceBlock: string | null
  parseError: string | null
}

export interface MarkdownHighlightSegmentBlock {
  kind: 'text' | 'highlight'
  rawStart: number
  rawEnd: number
  visibleText: string
  presetId: string | null
}

export interface MarkdownHighlightMatchBlock {
  rawSyntaxStart: number
  rawSyntaxEnd: number
  visibleStart: number
  visibleEnd: number
  visibleText: string
  presetId: string | null
}

const EMPTY_ANNOTATION_STORE_BLOCK: MarkdownAnnotationStoreBlock = {
  version: 1,
  annotations: [],
}

const MARKDOWN_ANCHOR_LINE_BLOCK = /^\^([a-z0-9][a-z0-9_-]{2,63})$/i

function buildDefaultAnnotationStoreBlock(): MarkdownAnnotationStoreBlock {
  return {
    version: 1,
    annotations: [],
  }
}

function normalizeBodySpacingBlock(body: string): string {
  return body.replace(/\r\n/g, '\n').replace(/\s+$/, '')
}

function parseStoreBlock(raw: string): MarkdownAnnotationStoreBlock {
  const parsed = JSON.parse(raw) as Partial<MarkdownAnnotationStoreBlock>
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Annotation payload must be an object.')
  }

  const annotations = Array.isArray(parsed.annotations) ? parsed.annotations : []
  return {
    version: 1,
    annotations: annotations.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []
      const candidate = entry as Partial<MarkdownAnchorAnnotationBlock>
      const anchorId = typeof candidate.anchorId === 'string' ? candidate.anchorId.trim() : ''
      if (!anchorId) return []
      const id = typeof candidate.id === 'string' && candidate.id.trim()
        ? candidate.id.trim()
        : buildMarkdownAnnotationIdBlock()
      const createdAt = typeof candidate.createdAt === 'string' && candidate.createdAt.trim()
        ? candidate.createdAt
        : new Date().toISOString()
      const updatedAt = typeof candidate.updatedAt === 'string' && candidate.updatedAt.trim()
        ? candidate.updatedAt
        : createdAt
      const text = typeof candidate.text === 'string' ? candidate.text : ''
      const transcript = typeof candidate.transcript === 'string' ? candidate.transcript : ''
      const ocrText = typeof (candidate as { ocrText?: unknown }).ocrText === 'string'
        ? (candidate as { ocrText: string }).ocrText
        : ''
      const ocrStatusCandidate = (candidate as { ocrStatus?: unknown }).ocrStatus
      const ocrStatus = ocrStatusCandidate === 'ready' || ocrStatusCandidate === 'error'
        ? ocrStatusCandidate
        : 'idle'
      const ocrUpdatedAt = typeof (candidate as { ocrUpdatedAt?: unknown }).ocrUpdatedAt === 'string'
        ? (candidate as { ocrUpdatedAt: string }).ocrUpdatedAt
        : null
      const strokes = Array.isArray(candidate.strokes)
        ? candidate.strokes.flatMap((stroke) => {
          if (!stroke || typeof stroke !== 'object') return []
          const strokeCandidate = stroke as Partial<MarkdownAnnotationStrokeBlock>
          const points = Array.isArray(strokeCandidate.points)
            ? strokeCandidate.points.flatMap((point) => {
              if (!point || typeof point !== 'object') return []
              const pointCandidate = point as Partial<MarkdownAnnotationPointBlock>
              if (typeof pointCandidate.x !== 'number' || typeof pointCandidate.y !== 'number') return []
              return [{
                x: pointCandidate.x,
                y: pointCandidate.y,
                pressure: typeof pointCandidate.pressure === 'number' ? pointCandidate.pressure : null,
              }]
            })
            : []
          if (points.length === 0) return []
          return [{
            id: typeof strokeCandidate.id === 'string' && strokeCandidate.id.trim()
              ? strokeCandidate.id.trim()
              : buildMarkdownAnnotationIdBlock(),
            color: typeof strokeCandidate.color === 'string' && strokeCandidate.color.trim()
              ? strokeCandidate.color.trim()
              : '#f59e0b',
            points,
          }]
        })
        : []

      return [{
        id,
        anchorId,
        text,
        transcript,
        ocrText,
        ocrStatus,
        ocrUpdatedAt,
        strokes,
        createdAt,
        updatedAt,
      }]
    }),
  }
}

function serializeStoreBlock(store: MarkdownAnnotationStoreBlock): string {
  return JSON.stringify(store, null, 2)
}

export function splitMarkdownAnnotationDocumentBlock(content: string): MarkdownAnnotationDocumentStateBlock {
  const normalized = content.replace(/\r\n/g, '\n')
  const matcher = new RegExp(`(?:\\n{2,}|\\n)?\`\`\`${MARKDOWN_ANNOTATION_FENCE_BLOCK}\\n([\\s\\S]*?)\\n\`\`\`\\s*$`)
  const match = normalized.match(matcher)

  if (!match) {
    return {
      body: normalized,
      store: buildDefaultAnnotationStoreBlock(),
      rawFenceBlock: null,
      parseError: null,
    }
  }

  const rawFenceBlock = match[0].trim()
  const body = normalized.slice(0, match.index ?? normalized.length).replace(/\s+$/, '')
  const rawPayload = match[1]?.trim() ?? ''
  if (!rawPayload) {
    return {
      body,
      store: buildDefaultAnnotationStoreBlock(),
      rawFenceBlock,
      parseError: null,
    }
  }

  try {
    return {
      body,
      store: parseStoreBlock(rawPayload),
      rawFenceBlock,
      parseError: null,
    }
  } catch (error) {
    return {
      body,
      store: buildDefaultAnnotationStoreBlock(),
      rawFenceBlock,
      parseError: error instanceof Error ? error.message : 'Invalid markdown annotations block.',
    }
  }
}

export function composeMarkdownAnnotationDocumentBlock(
  body: string,
  store: MarkdownAnnotationStoreBlock,
  options: {
    preserveRawFenceBlock?: string | null
    preserveParseError?: string | null
  } = {},
): string {
  const normalizedBody = normalizeBodySpacingBlock(body)
  if (options.preserveParseError && options.preserveRawFenceBlock) {
    return normalizedBody
      ? `${normalizedBody}\n\n${options.preserveRawFenceBlock}\n`
      : `${options.preserveRawFenceBlock}\n`
  }

  const hasAnnotations = store.annotations.length > 0
  if (!hasAnnotations) {
    return normalizedBody ? `${normalizedBody}\n` : ''
  }

  const fenceBlock = `\`\`\`${MARKDOWN_ANNOTATION_FENCE_BLOCK}\n${serializeStoreBlock(store)}\n\`\`\``
  return normalizedBody
    ? `${normalizedBody}\n\n${fenceBlock}\n`
    : `${fenceBlock}\n`
}

export function buildMarkdownAnchorIdBlock(): string {
  const raw = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : uuidv4()
  return `ts-${raw.replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase()}`
}

export function buildMarkdownAnnotationIdBlock(): string {
  const raw = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : uuidv4()
  return `ann-${raw.replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase()}`
}

export function isMarkdownAnchorLineBlock(value: string): boolean {
  return MARKDOWN_ANCHOR_LINE_BLOCK.test(value.trim())
}

export function parseMarkdownAnchorIdBlock(value: string): string | null {
  const match = value.trim().match(MARKDOWN_ANCHOR_LINE_BLOCK)
  return match?.[1] ?? null
}

export function buildMarkdownAnchorLineBlock(anchorId: string): string {
  return `^${anchorId}`
}

export function hasMarkdownAnchorLineBlock(content: string, anchorId: string): boolean {
  const escaped = anchorId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|\\n)\\^${escaped}(?=\\n|$)`).test(content.replace(/\r\n/g, '\n'))
}

export function insertMarkdownAnchorAtSelectionBlock(
  source: string,
  start: number,
  end: number,
  anchorId: string,
): { value: string; start: number; end: number } {
  const normalized = source.replace(/\r\n/g, '\n')
  const lineEndRaw = normalized.indexOf('\n', Math.max(start, end))
  const insertAt = lineEndRaw === -1 ? normalized.length : lineEndRaw
  const prefix = normalized.slice(0, insertAt)
  const suffix = normalized.slice(insertAt)
  const needsLeadingBreak = prefix.length > 0 && !prefix.endsWith('\n')
  const needsDoubleBreak = prefix.endsWith('\n\n') || prefix.length === 0 ? '' : '\n'
  const anchorText = `${needsLeadingBreak ? '\n' : ''}${needsDoubleBreak}${buildMarkdownAnchorLineBlock(anchorId)}\n`
  const value = `${prefix}${anchorText}${suffix.replace(/^\n?/, '\n')}`
  const anchorStart = prefix.length + anchorText.indexOf('^')
  return {
    value,
    start: anchorStart,
    end: anchorStart + anchorId.length + 1,
  }
}

export function findMarkdownAnchorAfterOffsetBlock(source: string, offset: number): string | null {
  const normalized = source.replace(/\r\n/g, '\n')
  const suffix = normalized.slice(Math.max(0, offset))
  const match = suffix.match(/^\n+\^([a-z0-9][a-z0-9_-]{2,63})(?=\n|$)/i)
  return match?.[1] ?? null
}

export function insertMarkdownAnchorAfterBlockOffsetBlock(
  source: string,
  blockEndOffset: number,
  anchorId: string,
): { value: string; start: number; end: number } {
  return insertMarkdownAnchorAtSelectionBlock(source, blockEndOffset, blockEndOffset, anchorId)
}

export function insertMarkdownHighlightAtRangeBlock(
  source: string,
  start: number,
  end: number,
  presetId: string | null = null,
): string {
  if (start >= end) return source
  const prefix = presetId ? `==[${presetId}]` : '=='
  return `${source.slice(0, start)}${prefix}${source.slice(start, end)}==${source.slice(end)}`
}

export function findMarkdownHighlightByVisibleOffsetBlock(
  source: string,
  offset: number,
): MarkdownHighlightMatchBlock | null {
  const pattern = /==(?:\[([a-z0-9-]+)\])?([\s\S]+?)==/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(source)) !== null) {
    const presetId = match[1] ?? null
    const visibleText = match[2] ?? ''
    const visibleStart = match.index + 2 + (presetId ? presetId.length + 2 : 0)
    const visibleEnd = visibleStart + visibleText.length
    if (offset < visibleStart || offset > visibleEnd) continue
    return {
      rawSyntaxStart: match.index,
      rawSyntaxEnd: match.index + match[0].length,
      visibleStart,
      visibleEnd,
      visibleText,
      presetId,
    }
  }
  return null
}

export function updateMarkdownHighlightPresetByVisibleOffsetBlock(
  source: string,
  offset: number,
  presetId: string | null,
): string {
  const match = findMarkdownHighlightByVisibleOffsetBlock(source, offset)
  if (!match) return source
  const prefix = presetId ? `==[${presetId}]` : '=='
  return `${source.slice(0, match.rawSyntaxStart)}${prefix}${match.visibleText}==${source.slice(match.rawSyntaxEnd)}`
}

export function removeMarkdownHighlightByVisibleOffsetBlock(
  source: string,
  offset: number,
): string {
  const match = findMarkdownHighlightByVisibleOffsetBlock(source, offset)
  if (!match) return source
  return `${source.slice(0, match.rawSyntaxStart)}${match.visibleText}${source.slice(match.rawSyntaxEnd)}`
}

export function upsertMarkdownAnchorAnnotationBlock(
  store: MarkdownAnnotationStoreBlock,
  annotation: MarkdownAnchorAnnotationBlock,
): MarkdownAnnotationStoreBlock {
  const nextAnnotations = [...store.annotations]
  const existingIndex = nextAnnotations.findIndex((entry) => entry.anchorId === annotation.anchorId)
  if (existingIndex >= 0) {
    nextAnnotations[existingIndex] = annotation
  } else {
    nextAnnotations.push(annotation)
  }
  return {
    version: 1,
    annotations: nextAnnotations,
  }
}

export function removeMarkdownAnchorAnnotationBlock(
  store: MarkdownAnnotationStoreBlock,
  anchorId: string,
): MarkdownAnnotationStoreBlock {
  return {
    version: 1,
    annotations: store.annotations.filter((entry) => entry.anchorId !== anchorId),
  }
}

export function getMarkdownAnchorAnnotationBlock(
  store: MarkdownAnnotationStoreBlock,
  anchorId: string,
): MarkdownAnchorAnnotationBlock | null {
  return store.annotations.find((entry) => entry.anchorId === anchorId) ?? null
}

export function isMarkdownAnnotationStoreEmptyBlock(store: MarkdownAnnotationStoreBlock): boolean {
  return store.annotations.length === 0
}

export function remarkMarkdownSourceSpansBlock() {
  return (tree: unknown) => {
    visit(tree as any, 'text', (node: any, index: number | undefined, parent: any) => {
      if (!node?.position || typeof node.value !== 'string' || !parent || typeof index !== 'number') return
      if (parent.type === 'inlineCode' || parent.type === 'code') return
      if (node.value.trim().length === 0) return

      node.data = {
        ...(node.data ?? {}),
        hName: 'span',
        hProperties: {
          ...((node.data?.hProperties ?? {}) as Record<string, unknown>),
          'data-md-source-start': node.position.start.offset,
          'data-md-source-end': node.position.end.offset,
        },
      }
    })
  }
}

export function parseMarkdownHighlightSegmentsBlock(text: string): MarkdownHighlightSegmentBlock[] {
  const segments: MarkdownHighlightSegmentBlock[] = []
  const pattern = /==(?:\[([a-z0-9-]+)\])?(.+?)==/gi
  let match: RegExpExecArray | null
  let cursor = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      segments.push({
        kind: 'text',
        rawStart: cursor,
        rawEnd: match.index,
        visibleText: text.slice(cursor, match.index),
        presetId: null,
      })
    }

    const presetId = match[1] ?? null
    const visibleText = match[2] ?? ''
    const visibleStart = match.index + 2 + (presetId ? presetId.length + 2 : 0)
    segments.push({
      kind: 'highlight',
      rawStart: visibleStart,
      rawEnd: visibleStart + visibleText.length,
      visibleText,
      presetId,
    })
    cursor = match.index + match[0].length
  }

  if (cursor < text.length) {
    segments.push({
      kind: 'text',
      rawStart: cursor,
      rawEnd: text.length,
      visibleText: text.slice(cursor),
      presetId: null,
    })
  }

  return segments.length > 0 ? segments : [{
    kind: 'text',
    rawStart: 0,
    rawEnd: text.length,
    visibleText: text,
    presetId: null,
  }]
}

export { EMPTY_ANNOTATION_STORE_BLOCK }
