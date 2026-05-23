/* Parse + serialize the trailing ```ink``` fenced block that carries
   pencil annotations inside a markdown note. Version 2 stores text anchors
   once and references them from Excalidraw-style freedraw strokes. */

import {
  deserializeInkStrokeBlock,
  serializeInkStrokeBlock,
  type InkStroke,
} from './inkStrokeBlock'

export interface InkFencedSplit {
  /* Markdown body with the ```ink``` block removed and trailing
     whitespace normalized. Safe to feed to the renderer. */
  body: string
  strokes: InkStroke[]
}

interface InkAnchorPayloadBlock {
  id: string
  text: string
  context: string
}

const TRAILING_INK_FENCE_RE = /\n*```ink\s*\n([\s\S]*?)\n```\s*$/

export function splitInkFencedBlock(source: string): InkFencedSplit {
  const match = source.match(TRAILING_INK_FENCE_RE)
  if (!match) {
    return { body: source, strokes: [] }
  }
  const body = source.slice(0, match.index ?? 0).replace(/\s+$/, '')
  const strokes = parseInkPayloadBlock(match[1])
  return { body, strokes }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function parseAnchorsBlock(rawAnchors: unknown): Map<string, InkAnchorPayloadBlock> {
  const out = new Map<string, InkAnchorPayloadBlock>()
  if (!Array.isArray(rawAnchors)) return out
  for (const raw of rawAnchors) {
    if (!isRecord(raw)) continue
    if (typeof raw.id !== 'string' || typeof raw.text !== 'string' || typeof raw.context !== 'string') continue
    out.set(raw.id, { id: raw.id, text: raw.text, context: raw.context })
  }
  return out
}

function parseInkPayloadBlock(payload: string): InkStroke[] {
  const trimmed = payload.trim()
  if (!trimmed) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return []
  }
  if (!isRecord(parsed) || parsed.version !== 2) return []
  if (!Array.isArray(parsed.strokes)) return []

  const anchors = parseAnchorsBlock(parsed.anchors)
  const out: InkStroke[] = []
  for (const raw of parsed.strokes) {
    if (!isRecord(raw) || typeof raw.anchorId !== 'string') continue
    const anchor = anchors.get(raw.anchorId)
    const stroke = deserializeInkStrokeBlock(raw, anchor ? {
      anchorText: anchor.text,
      anchorContext: anchor.context,
    } : null)
    if (stroke) out.push(stroke)
  }
  return out
}

function anchorKeyBlock(stroke: Pick<InkStroke, 'anchorText' | 'anchorContext'>): string {
  return `${stroke.anchorContext}\u0000${stroke.anchorText}`
}

function buildAnchorPayloadBlock(strokes: InkStroke[]): {
  anchors: InkAnchorPayloadBlock[]
  anchorIdByKey: Map<string, string>
} {
  const anchors: InkAnchorPayloadBlock[] = []
  const anchorIdByKey = new Map<string, string>()
  for (const stroke of strokes) {
    const key = anchorKeyBlock(stroke)
    if (anchorIdByKey.has(key)) continue
    const id = `a_${anchors.length + 1}`
    anchorIdByKey.set(key, id)
    anchors.push({
      id,
      text: stroke.anchorText,
      context: stroke.anchorContext,
    })
  }
  return { anchors, anchorIdByKey }
}

/* Emit `{body}\n\n```ink\n{json}\n````. JSON is pretty-printed with one
   anchor/stroke per line so small edits keep diffs readable. */
export function joinInkFencedBlock(body: string, strokes: InkStroke[]): string {
  const trimmedBody = body.replace(/\s+$/, '')
  if (strokes.length === 0) {
    return trimmedBody + (trimmedBody.endsWith('\n') ? '' : '\n')
  }

  const { anchors, anchorIdByKey } = buildAnchorPayloadBlock(strokes)
  const lines: string[] = ['{"version":2,"anchors":[']
  anchors.forEach((anchor, idx) => {
    const json = JSON.stringify(anchor)
    lines.push(idx === anchors.length - 1 ? json : `${json},`)
  })
  lines.push('],"strokes":[')
  strokes.forEach((stroke, idx) => {
    const anchorId = anchorIdByKey.get(anchorKeyBlock(stroke)) ?? 'a_1'
    const json = JSON.stringify(serializeInkStrokeBlock(stroke, anchorId))
    lines.push(idx === strokes.length - 1 ? json : `${json},`)
  })
  lines.push(']}')

  const payload = lines.join('\n')
  const separator = trimmedBody ? '\n\n' : ''
  return `${trimmedBody}${separator}\`\`\`ink\n${payload}\n\`\`\`\n`
}

export function replaceInkFencedBlock(source: string, strokes: InkStroke[]): string {
  const { body } = splitInkFencedBlock(source)
  return joinInkFencedBlock(body, strokes)
}
