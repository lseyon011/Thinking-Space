import type { MarkdownAnnotationStrokeBlock } from '@/services/lego_blocks/units/markdownAnnotationBlock'

export interface MarkdownAnnotationOcrResultBlock {
  text: string
}

export function buildMarkdownAnnotationOcrCanvasDataUrlBlock(
  strokes: MarkdownAnnotationStrokeBlock[],
  options: {
    width?: number
    height?: number
    backgroundColor?: string
  } = {},
): string | null {
  if (typeof document === 'undefined') return null
  const width = options.width ?? 1200
  const height = options.height ?? 480
  const backgroundColor = options.backgroundColor ?? '#fffef7'

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return null

  context.fillStyle = backgroundColor
  context.fillRect(0, 0, width, height)

  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue
    context.save()
    context.strokeStyle = '#111827'
    context.lineCap = 'round'
    context.lineJoin = 'round'
    for (let index = 0; index < stroke.points.length; index += 1) {
      const point = stroke.points[index]
      const x = point.x * width
      const y = point.y * height
      if (index === 0) {
        context.beginPath()
        context.moveTo(x, y)
        context.lineWidth = 3 + ((point.pressure ?? 0.5) * 5)
        if (stroke.points.length === 1) {
          context.lineTo(x + 0.01, y + 0.01)
          context.stroke()
        }
        continue
      }
      const previous = stroke.points[index - 1]
      context.lineWidth = 3 + ((point.pressure ?? previous.pressure ?? 0.5) * 5)
      context.lineTo(x, y)
      context.stroke()
      context.beginPath()
      context.moveTo(x, y)
    }
    context.restore()
  }

  return canvas.toDataURL('image/png')
}
