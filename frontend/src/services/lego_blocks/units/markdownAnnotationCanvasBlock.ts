import type { NativePencilMetricsEventBlock } from '@/services/lego_blocks/units/pencilBridgeBlock'
import type {
  MarkdownAnnotationPointBlock,
  MarkdownAnnotationStrokeBlock,
} from '@/services/lego_blocks/units/markdownAnnotationBlock'

export const MARKDOWN_ANNOTATION_ERASER_RADIUS_BLOCK = 0.04

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function buildMarkdownAnnotationStrokeIdBlock(): string {
  return `stroke-${Date.now().toString(36)}-${Math.round(Math.random() * 1_000).toString(36)}`
}

export function buildMarkdownAnnotationStrokeBlock(
  point: MarkdownAnnotationPointBlock,
  color = '#f59e0b',
): MarkdownAnnotationStrokeBlock {
  return {
    id: buildMarkdownAnnotationStrokeIdBlock(),
    color,
    points: [point],
  }
}

export function appendPointToMarkdownAnnotationStrokeBlock(
  stroke: MarkdownAnnotationStrokeBlock,
  point: MarkdownAnnotationPointBlock,
): MarkdownAnnotationStrokeBlock {
  return {
    ...stroke,
    points: [...stroke.points, point],
  }
}

export function buildMarkdownAnnotationPointFromPointerBlock(
  event: PointerEvent,
  canvas: HTMLCanvasElement,
): MarkdownAnnotationPointBlock {
  const rect = canvas.getBoundingClientRect()
  const x = rect.width > 0 ? clamp01((event.clientX - rect.left) / rect.width) : 0
  const y = rect.height > 0 ? clamp01((event.clientY - rect.top) / rect.height) : 0
  const pressure = typeof event.pressure === 'number' && event.pressure > 0 ? clamp01(event.pressure) : null
  return { x, y, pressure }
}

export function buildMarkdownAnnotationPointFromNativePencilEventBlock(
  event: NativePencilMetricsEventBlock,
  canvas: HTMLCanvasElement,
  pressureOverride: number | null = null,
): MarkdownAnnotationPointBlock | null {
  if (typeof event.locationX !== 'number' || typeof event.locationY !== 'number') return null
  const rect = canvas.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  const x = clamp01((event.locationX - rect.left) / rect.width)
  const y = clamp01((event.locationY - rect.top) / rect.height)
  const pressure = typeof pressureOverride === 'number'
    ? clamp01(pressureOverride)
    : (typeof event.normalizedPressure === 'number' ? clamp01(event.normalizedPressure) : null)
  return { x, y, pressure }
}

export function isNativePencilEventInsideCanvasBlock(
  event: NativePencilMetricsEventBlock,
  canvas: HTMLCanvasElement,
): boolean {
  if (typeof event.locationX !== 'number' || typeof event.locationY !== 'number') return false
  const rect = canvas.getBoundingClientRect()
  return (
    event.locationX >= rect.left
    && event.locationX <= rect.right
    && event.locationY >= rect.top
    && event.locationY <= rect.bottom
  )
}

export function eraseMarkdownAnnotationStrokesAtPointBlock(
  strokes: MarkdownAnnotationStrokeBlock[],
  point: MarkdownAnnotationPointBlock,
  radius = MARKDOWN_ANNOTATION_ERASER_RADIUS_BLOCK,
): MarkdownAnnotationStrokeBlock[] {
  const radiusSquared = radius * radius
  return strokes.filter((stroke) => (
    !stroke.points.some((candidate) => {
      const deltaX = candidate.x - point.x
      const deltaY = candidate.y - point.y
      return ((deltaX * deltaX) + (deltaY * deltaY)) <= radiusSquared
    })
  ))
}
