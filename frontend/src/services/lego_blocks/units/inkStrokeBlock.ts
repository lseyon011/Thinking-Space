/* Ink stroke primitives for ruled-notebook pencil annotations.
   Strokes use Excalidraw-style freedraw geometry: an element-level
   x/y/width/height box, local centerline points, and aligned pressure
   samples. Text anchoring is metadata around that freedraw element. */

export type InkPointTuple = [x: number, y: number]
export type InkRawPointTuple = [x: number, y: number, p: number]

export interface InkStroke {
  id: string
  /* Markdown source text of the block this stroke is anchored to. */
  anchorText: string
  /* Hash of [prevBlockText, anchorText, nextBlockText] for disambiguation
     when anchorText alone is duplicated elsewhere in the document. */
  anchorContext: string
  type: 'freedraw'
  /* Freedraw element box relative to the anchor block's top-left. These
     can be negative for margin annotations; points stay local to the box. */
  x: number
  y: number
  width: number
  height: number
  points: InkPointTuple[]
  pressures: number[]
  simulatePressure: boolean
  strokeColor: string
  strokeWidth: number
  opacity: number
  createdAt: number
}

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function createInkStrokeIdBlock(): string {
  let out = 's_'
  for (let i = 0; i < 10; i++) {
    out += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)]
  }
  return out
}

/* DJB2 - small, deterministic, no deps. Good enough for disambiguating
   anchor neighbors; not cryptographic. */
export function hashAnchorContextBlock(parts: Array<string | null | undefined>): string {
  let hash = 5381
  for (const part of parts) {
    const s = part ?? ''
    hash = (hash * 33) ^ 0
    for (let i = 0; i < s.length; i++) {
      hash = ((hash * 33) ^ s.charCodeAt(i)) | 0
    }
    hash = (hash * 33) ^ 0x1f
  }
  return (hash >>> 0).toString(36)
}

function roundTo(n: number, digits: number): number {
  const m = 10 ** digits
  return Math.round(n * m) / m
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function quantizeInkPointsBlock(points: InkPointTuple[]): InkPointTuple[] {
  return points.map(([x, y]) => [Math.round(x), Math.round(y)])
}

export function quantizeInkPressuresBlock(pressures: number[]): number[] {
  return pressures.map((pressure) => roundTo(Math.min(Math.max(pressure, 0), 1), 2))
}

export function buildFreedrawInkGeometryBlock(
  rawPoints: InkRawPointTuple[],
): Pick<InkStroke, 'x' | 'y' | 'width' | 'height' | 'points' | 'pressures'> | null {
  const deduped: InkRawPointTuple[] = []
  for (const [x, y, p] of rawPoints) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(p)) continue
    const q: InkRawPointTuple = [Math.round(x), Math.round(y), roundTo(Math.min(Math.max(p, 0), 1), 2)]
    const prev = deduped[deduped.length - 1]
    if (prev && prev[0] === q[0] && prev[1] === q[1] && prev[2] === q[2]) continue
    deduped.push(q)
  }
  if (deduped.length < 2) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of deduped) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }

  const points = deduped.map<InkPointTuple>(([x, y]) => [x - minX, y - minY])
  const pressures = deduped.map(([, , p]) => p)
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    points,
    pressures,
  }
}

/* JSON-ready shape with fixed object key order. `anchorId` points to the
   compact anchor table emitted by inkFencedBlock. */
export function serializeInkStrokeBlock(stroke: InkStroke, anchorId: string): Record<string, unknown> {
  return {
    id: stroke.id,
    anchorId,
    type: 'freedraw',
    x: Math.round(stroke.x),
    y: Math.round(stroke.y),
    width: Math.round(stroke.width),
    height: Math.round(stroke.height),
    strokeColor: stroke.strokeColor,
    strokeWidth: stroke.strokeWidth,
    opacity: Math.min(Math.max(Math.round(stroke.opacity), 1), 100),
    simulatePressure: stroke.simulatePressure,
    createdAt: stroke.createdAt,
    points: quantizeInkPointsBlock(stroke.points),
    pressures: quantizeInkPressuresBlock(stroke.pressures),
  }
}

export function deserializeInkStrokeBlock(
  raw: unknown,
  anchor: { anchorText: string; anchorContext: string } | null,
): InkStroke | null {
  if (!isRecord(raw) || !anchor) return null
  if (typeof raw.id !== 'string') return null
  if (raw.type !== 'freedraw') return null
  if (!isFiniteNumber(raw.x) || !isFiniteNumber(raw.y)) return null
  if (!isFiniteNumber(raw.width) || !isFiniteNumber(raw.height)) return null
  if (typeof raw.strokeColor !== 'string' || !isFiniteNumber(raw.strokeWidth)) return null
  if (!isFiniteNumber(raw.opacity) || !isFiniteNumber(raw.createdAt)) return null
  if (!Array.isArray(raw.points) || !Array.isArray(raw.pressures)) return null
  if (raw.points.length !== raw.pressures.length) return null

  const points: InkPointTuple[] = []
  for (const point of raw.points) {
    if (!Array.isArray(point) || point.length !== 2) return null
    if (!isFiniteNumber(point[0]) || !isFiniteNumber(point[1])) return null
    points.push([point[0], point[1]])
  }
  if (!raw.pressures.every(isFiniteNumber)) return null

  return {
    id: raw.id,
    anchorText: anchor.anchorText,
    anchorContext: anchor.anchorContext,
    type: 'freedraw',
    x: raw.x,
    y: raw.y,
    width: raw.width,
    height: raw.height,
    points,
    pressures: raw.pressures,
    simulatePressure: raw.simulatePressure !== false,
    strokeColor: raw.strokeColor,
    strokeWidth: raw.strokeWidth,
    opacity: Math.min(Math.max(Math.round(raw.opacity), 1), 100),
    createdAt: raw.createdAt,
  }
}
