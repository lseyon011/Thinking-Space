import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  MarkdownAnnotationStrokeBlock,
} from '@/services/lego_blocks/units/markdownAnnotationBlock'
import {
  isNativePencilBridgeSupportedOrch,
  mapPencilPressureToStrokeStyleOrch,
  nextPencilToolTypeOrch,
  subscribeNativePencilBridgeOrch,
  type PencilPressureStateOrch,
} from '@/services/orchestrators/pencilBridgeOrch'
import {
  appendPointToMarkdownAnnotationStrokeBlock,
  buildMarkdownAnnotationPointFromNativePencilEventBlock,
  buildMarkdownAnnotationPointFromPointerBlock,
  buildMarkdownAnnotationStrokeBlock,
  eraseMarkdownAnnotationStrokesAtPointBlock,
  isNativePencilEventInsideCanvasBlock,
} from '@/services/lego_blocks/units/markdownAnnotationCanvasBlock'
import { cn } from '@/lib/utils'

interface MarkdownAnnotationCanvasBlockProps {
  strokes: MarkdownAnnotationStrokeBlock[]
  onChange?: (next: MarkdownAnnotationStrokeBlock[]) => void
  className?: string
  editable?: boolean
}

const CANVAS_WIDTH_BLOCK = 960
const CANVAS_HEIGHT_BLOCK = 320

function drawStrokeBlock(
  context: CanvasRenderingContext2D,
  stroke: MarkdownAnnotationStrokeBlock,
  width: number,
  height: number,
) {
  if (stroke.points.length === 0) return
  context.save()
  context.strokeStyle = stroke.color || '#f59e0b'
  context.lineCap = 'round'
  context.lineJoin = 'round'
  for (let index = 0; index < stroke.points.length; index += 1) {
    const point = stroke.points[index]
    const x = point.x * width
    const y = point.y * height
    if (index === 0) {
      context.beginPath()
      context.moveTo(x, y)
      context.lineWidth = 2 + ((point.pressure ?? 0.5) * 4)
      if (stroke.points.length === 1) {
        context.lineTo(x + 0.01, y + 0.01)
        context.stroke()
      }
      continue
    }
    const previous = stroke.points[index - 1]
    context.lineWidth = 2 + (((point.pressure ?? previous.pressure ?? 0.5)) * 4)
    context.lineTo(x, y)
    context.stroke()
    context.beginPath()
    context.moveTo(x, y)
  }
  context.restore()
}

export default function MarkdownAnnotationCanvasBlock({
  strokes,
  onChange,
  className,
  editable = false,
}: MarkdownAnnotationCanvasBlockProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const activeStrokeRef = useRef<MarkdownAnnotationStrokeBlock | null>(null)
  const nativePencilStopRef = useRef<(() => Promise<void>) | null>(null)
  const nativePencilPressureStateRef = useRef<PencilPressureStateOrch | null>(null)
  const strokesRef = useRef(strokes)
  const activeToolRef = useRef<'freedraw' | 'eraser'>('freedraw')
  const [activeTool, setActiveTool] = useState<'freedraw' | 'eraser'>('freedraw')
  const hasInk = strokes.length > 0
  const nativePencilSupported = useMemo(() => isNativePencilBridgeSupportedOrch(), [])

  useEffect(() => {
    strokesRef.current = strokes
  }, [strokes])

  useEffect(() => {
    activeToolRef.current = activeTool
  }, [activeTool])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    strokes.forEach((stroke) => drawStrokeBlock(context, stroke, canvas.width, canvas.height))
  }, [strokes])

  useEffect(() => {
    if (!editable) return
    const canvas = canvasRef.current
    if (!canvas || !onChange) return

    const handlePointerDown = (event: PointerEvent) => {
      if (nativePencilSupported && event.pointerType === 'pen') return
      if (event.button !== 0) return
      const point = buildMarkdownAnnotationPointFromPointerBlock(event, canvas)
      if (activeToolRef.current === 'eraser') {
        onChange(eraseMarkdownAnnotationStrokesAtPointBlock(strokesRef.current, point))
        return
      }
      const stroke = buildMarkdownAnnotationStrokeBlock(point)
      activeStrokeRef.current = stroke
      canvas.setPointerCapture(event.pointerId)
      onChange([...strokesRef.current, stroke])
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (nativePencilSupported && event.pointerType === 'pen') return
      const point = buildMarkdownAnnotationPointFromPointerBlock(event, canvas)
      if (activeToolRef.current === 'eraser') {
        if ((event.buttons & 1) !== 1) return
        onChange(eraseMarkdownAnnotationStrokesAtPointBlock(strokesRef.current, point))
        return
      }
      if (!activeStrokeRef.current) return
      activeStrokeRef.current = appendPointToMarkdownAnnotationStrokeBlock(activeStrokeRef.current, point)
      onChange([
        ...strokesRef.current.filter((entry) => entry.id !== activeStrokeRef.current?.id),
        activeStrokeRef.current,
      ])
    }

    const finishStroke = (event: PointerEvent) => {
      if (!activeStrokeRef.current) return
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId)
      }
      activeStrokeRef.current = null
    }

    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', finishStroke)
    canvas.addEventListener('pointercancel', finishStroke)
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', finishStroke)
      canvas.removeEventListener('pointercancel', finishStroke)
    }
  }, [editable, nativePencilSupported, onChange])

  useEffect(() => {
    if (!editable || !nativePencilSupported || !onChange) return undefined
    const canvas = canvasRef.current
    if (!canvas) return undefined

    let cancelled = false
    void subscribeNativePencilBridgeOrch({
      onDoubleTap: () => {
        setActiveTool((current) => nextPencilToolTypeOrch(current))
      },
      onMetrics: (event) => {
        const targetCanvas = canvasRef.current
        if (!targetCanvas) return
        const insideCanvas = isNativePencilEventInsideCanvasBlock(event, targetCanvas)
        if (!insideCanvas && !activeStrokeRef.current) return

        const mapped = mapPencilPressureToStrokeStyleOrch(event, nativePencilPressureStateRef.current, {
          minStrokeWidth: 1,
          maxStrokeWidth: 1,
          minOpacity: 100,
          maxOpacity: 100,
        })
        nativePencilPressureStateRef.current = mapped.state
        const point = buildMarkdownAnnotationPointFromNativePencilEventBlock(
          event,
          targetCanvas,
          mapped.state?.smoothedPressure ?? event.normalizedPressure,
        )
        if (!point) return

        if (activeToolRef.current === 'eraser') {
          if (event.phase === 'began' || event.phase === 'moved') {
            onChange(eraseMarkdownAnnotationStrokesAtPointBlock(strokesRef.current, point))
          }
          if (event.phase === 'ended' || event.phase === 'cancelled') {
            activeStrokeRef.current = null
            nativePencilPressureStateRef.current = null
          }
          return
        }

        if (event.phase === 'began') {
          const stroke = buildMarkdownAnnotationStrokeBlock(point)
          activeStrokeRef.current = stroke
          onChange([...strokesRef.current, stroke])
          return
        }

        if ((event.phase === 'moved' || event.phase === 'ended') && activeStrokeRef.current) {
          activeStrokeRef.current = appendPointToMarkdownAnnotationStrokeBlock(activeStrokeRef.current, point)
          onChange([
            ...strokesRef.current.filter((entry) => entry.id !== activeStrokeRef.current?.id),
            activeStrokeRef.current,
          ])
        }

        if (event.phase === 'ended' || event.phase === 'cancelled') {
          activeStrokeRef.current = null
          nativePencilPressureStateRef.current = null
        }
      },
    })
      .then((subscription) => {
        if (!subscription) return
        if (cancelled) {
          void subscription.stop()
          return
        }
        nativePencilStopRef.current = () => subscription.stop()
      })
      .catch(() => {})

    return () => {
      cancelled = true
      activeStrokeRef.current = null
      nativePencilPressureStateRef.current = null
      const stop = nativePencilStopRef.current
      nativePencilStopRef.current = null
      if (stop) void stop()
    }
  }, [editable, nativePencilSupported, onChange])

  const helperText = useMemo(() => {
    if (editable && nativePencilSupported) {
      return 'Apple Pencil pressure is enabled on iPad. Double tap switches draw and erase.'
    }
    if (editable) return 'Draw with Apple Pencil, pen, or touch. Strokes stay anchored to this markdown note.'
    if (hasInk) return 'Ink preview'
    return 'No ink strokes yet'
  }, [editable, hasInk, nativePencilSupported])

  return (
    <div className={cn('space-y-2', className)}>
      {editable && (
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-background/80 p-1">
            <button
              type="button"
              onClick={() => setActiveTool('freedraw')}
              className={cn(
                'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                activeTool === 'freedraw' ? 'bg-amber-500 text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              Draw
            </button>
            <button
              type="button"
              onClick={() => setActiveTool('eraser')}
              className={cn(
                'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                activeTool === 'eraser' ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              Erase
            </button>
          </div>
          {nativePencilSupported && (
            <div className="text-[11px] text-muted-foreground">Native Pencil bridge active</div>
          )}
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH_BLOCK}
        height={CANVAS_HEIGHT_BLOCK}
        className={cn(
          'h-40 w-full rounded-lg border border-amber-300/70 bg-[linear-gradient(180deg,#fff9e8_0%,#fff3c4_100%)] shadow-sm',
          editable && 'touch-none',
        )}
      />
      <div className="text-[11px] text-muted-foreground">{helperText}</div>
    </div>
  )
}
