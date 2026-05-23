import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getStroke } from 'perfect-freehand'
import {
  buildFreedrawInkGeometryBlock,
  createInkStrokeIdBlock,
  type InkPointTuple,
  type InkRawPointTuple,
  type InkStroke,
} from '@/services/lego_blocks/units/inkStrokeBlock'
import { cn } from '@/lib/utils'

/* Transparent canvas overlay that captures Apple Pencil input and renders
   stored strokes anchored to ruled-notebook blocks. Geometry follows
   Excalidraw freedraw: stroke box + local centerline points + pressures. */

export interface RenderableInkStroke {
  stroke: InkStroke
  /* Current DOM rect of the anchored block, relative to the overlay's
     containing canvas. null when the stroke is orphaned or its block is
     not currently visible on this page. */
  blockRect: DOMRect | { left: number; top: number; width: number; height: number } | null
}

export interface InkStrokeDraft {
  /* Excalidraw-style freedraw geometry relative to the anchor block. */
  x: number
  y: number
  width: number
  height: number
  points: InkPointTuple[]
  pressures: number[]
  simulatePressure: boolean
  /* Block index (in the current page's block order) that this stroke
     should anchor to, plus that block's rect. Resolved by the parent
     using the same per-block refs it gave to `getBlockRect`. */
  blockIndex: number
  blockRect: { left: number; top: number; width: number; height: number }
}

export type InkOverlayMode = 'pen' | 'eraser'

interface InkOverlayBlockProps {
  enabled: boolean
  /* Pre-resolved strokes for the currently visible page. Parent owns the
     anchor → blockIndex mapping and per-block rect measurement. */
  renderableStrokes: RenderableInkStroke[]
  /* Given a container-local point, find the block index it falls within.
     Returns null when outside any block (e.g., margins). */
  hitTestBlock: (x: number, y: number) => { blockIndex: number; blockRect: { left: number; top: number; width: number; height: number } } | null
  onStrokeCommit: (draft: InkStrokeDraft) => void
  /* Called with the IDs of strokes the eraser pass deleted. Parent should
     drop them from state and persist. */
  onStrokesErase?: (strokeIds: string[]) => void
  mode?: InkOverlayMode
  penColor?: string
  penWidth?: number
  /* Perfect-freehand parameter: when false, every sample contributes the
     same width regardless of pressure. Useful for mouse / non-pen input. */
  pressureSensitive?: boolean
  /* Hit radius (CSS px) for eraser passes. */
  eraserRadius?: number
  className?: string
}

const DEFAULT_COLOR = '#1f2937'
const DEFAULT_WIDTH = 2
const DEFAULT_ERASER_RADIUS = 14

interface LiveStroke {
  points: InkRawPointTuple[]
  color: string
  width: number
}

export default function InkOverlayBlock({
  enabled,
  renderableStrokes,
  hitTestBlock,
  onStrokeCommit,
  onStrokesErase,
  mode = 'pen',
  penColor = DEFAULT_COLOR,
  penWidth = DEFAULT_WIDTH,
  pressureSensitive = true,
  eraserRadius = DEFAULT_ERASER_RADIUS,
  className,
}: InkOverlayBlockProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const liveStrokeRef = useRef<LiveStroke | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const eraserCursorRef = useRef<{ x: number; y: number } | null>(null)
  const erasedIdsRef = useRef<Set<string>>(new Set())
  const [size, setSize] = useState({ w: 0, h: 0 })

  /* Track container size so the backing canvas matches CSS pixels × DPR. */
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      setSize({ w: Math.round(rect.width), h: Math.round(rect.height) })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const dpr = window.devicePixelRatio || 1
    ctx.save()
    ctx.scale(dpr, dpr)

    for (const { stroke, blockRect } of renderableStrokes) {
      if (!blockRect) continue
      if (erasedIdsRef.current.has(stroke.id)) continue
      drawStrokeOnContext(ctx, stroke.points, stroke.pressures, stroke.strokeColor, stroke.strokeWidth, {
        offsetX: blockRect.left + stroke.x,
        offsetY: blockRect.top + stroke.y,
        simulatePressure: stroke.simulatePressure,
      })
    }

    const live = liveStrokeRef.current
    if (live && live.points.length > 0) {
      drawStrokeOnContext(ctx, live.points.map<InkPointTuple>(([x, y]) => [x, y]), live.points.map(([, , p]) => p), live.color, live.width, {
        offsetX: 0,
        offsetY: 0,
        simulatePressure: !pressureSensitive,
      })
    }

    /* Eraser cursor: dashed circle following the pen tip when in eraser
       mode. Gives a clear sense of the active radius. */
    const cursor = eraserCursorRef.current
    if (mode === 'eraser' && cursor) {
      ctx.save()
      ctx.strokeStyle = '#9ca3af'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.arc(cursor.x, cursor.y, eraserRadius, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    ctx.restore()
  }, [renderableStrokes, pressureSensitive, mode, eraserRadius])

  /* Resize the backing store when CSS size or DPR changes, then redraw. */
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.w === 0 || size.h === 0) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size.w * dpr
    canvas.height = size.h * dpr
    canvas.style.width = `${size.w}px`
    canvas.style.height = `${size.h}px`
    redraw()
  }, [size, redraw])

  useEffect(() => {
    redraw()
  }, [redraw])

  /* iOS WebKit claims touches for scrolling before React's synthetic pointer
     handlers fire — `touch-action: none` alone is unreliable inside scroll
     containers. A non-passive native touchstart/touchmove listener that
     calls preventDefault is the only way to reliably block page scroll
     when pen mode is on. */
  useEffect(() => {
    if (!enabled) return
    const el = containerRef.current
    if (!el) return
    /* Block single-touch (writing) but let multi-touch through so two-finger
       pan/zoom/scroll still work even while annotation mode is on. */
    const block = (e: TouchEvent) => {
      if (e.touches.length <= 1) e.preventDefault()
    }
    el.addEventListener('touchstart', block, { passive: false })
    el.addEventListener('touchmove', block, { passive: false })
    return () => {
      el.removeEventListener('touchstart', block)
      el.removeEventListener('touchmove', block)
    }
  }, [enabled])

  /* Mark strokes whose container-local points fall within eraserRadius of
     any sample on the eraser path. Mutates erasedIdsRef.current. */
  const eraseAt = useCallback((px: number, py: number) => {
    const r2 = eraserRadius * eraserRadius
    for (const { stroke, blockRect } of renderableStrokes) {
      if (!blockRect) continue
      if (erasedIdsRef.current.has(stroke.id)) continue
      for (const [sx, sy] of stroke.points) {
        const dx = blockRect.left + stroke.x + sx - px
        const dy = blockRect.top + stroke.y + sy - py
        if (dx * dx + dy * dy <= r2) {
          erasedIdsRef.current.add(stroke.id)
          break
        }
      }
    }
  }, [renderableStrokes, eraserRadius])

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled) return
    /* Accept pen, mouse, and touch when annotation mode is on — palm
       rejection (`pointerType === 'pen'` only) costs us the ability to
       test on laptop/finger, more painful than the occasional palm
       stroke. Re-enable pen-only behind a setting later. */
    const container = containerRef.current
    if (!container) return
    event.preventDefault()
    container.setPointerCapture(event.pointerId)
    activePointerIdRef.current = event.pointerId
    const rect = container.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    if (mode === 'eraser') {
      erasedIdsRef.current = new Set()
      eraserCursorRef.current = { x, y }
      eraseAt(x, y)
      redraw()
      return
    }

    liveStrokeRef.current = {
      points: [[x, y, event.pressure || 0.5]],
      color: penColor,
      width: penWidth,
    }
    redraw()
  }, [enabled, mode, penColor, penWidth, redraw, eraseAt])

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return
    const container = containerRef.current
    if (!container) return
    event.preventDefault()
    const rect = container.getBoundingClientRect()
    const events = typeof event.nativeEvent.getCoalescedEvents === 'function'
      ? event.nativeEvent.getCoalescedEvents()
      : [event.nativeEvent]

    if (mode === 'eraser') {
      let last = { x: 0, y: 0 }
      for (const e of events) {
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        eraseAt(x, y)
        last = { x, y }
      }
      eraserCursorRef.current = last
      redraw()
      return
    }

    const live = liveStrokeRef.current
    if (!live) return
    /* Drain coalesced samples for high-frequency Apple Pencil input —
       without this we drop most of the curve between frames. */
    for (const e of events) {
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      live.points.push([x, y, e.pressure || 0.5])
    }
    redraw()
  }, [mode, redraw, eraseAt])

  const finishStroke = useCallback(() => {
    activePointerIdRef.current = null

    if (mode === 'eraser') {
      const ids = Array.from(erasedIdsRef.current)
      erasedIdsRef.current = new Set()
      eraserCursorRef.current = null
      if (ids.length > 0) onStrokesErase?.(ids)
      redraw()
      return
    }

    const live = liveStrokeRef.current
    liveStrokeRef.current = null
    if (!live || live.points.length < 2) {
      redraw()
      return
    }
    /* Anchor to the block under the stroke's first sample. Centroid would
       be more robust to long strokes that wander, but for short
       annotations the start point is the user's intent. */
    const [sx, sy] = live.points[0]
    const hit = hitTestBlock(sx, sy)
    if (!hit) {
      redraw()
      return
    }
    const blockLocalRaw = live.points.map<InkRawPointTuple>(([x, y, p]) => [
      x - hit.blockRect.left,
      y - hit.blockRect.top,
      p,
    ])
    const geometry = buildFreedrawInkGeometryBlock(blockLocalRaw)
    if (!geometry) {
      redraw()
      return
    }
    onStrokeCommit({
      ...geometry,
      simulatePressure: !pressureSensitive,
      blockIndex: hit.blockIndex,
      blockRect: hit.blockRect,
    })
    redraw()
  }, [mode, hitTestBlock, onStrokeCommit, onStrokesErase, redraw, pressureSensitive])

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return
    event.preventDefault()
    finishStroke()
  }, [finishStroke])

  return (
    <div
      ref={containerRef}
      className={cn(
        'absolute inset-0',
        enabled ? (mode === 'eraser' ? 'cursor-cell' : 'cursor-crosshair') : 'pointer-events-none',
        className,
      )}
      style={{
        touchAction: enabled ? 'none' : 'auto',
        pointerEvents: enabled ? 'auto' : 'none',
        zIndex: 10,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        style={{ touchAction: 'none' }}
      />
    </div>
  )
}

/* Stroke ID helper re-exported so parents can construct InkStroke
   instances from drafts without importing a second module. */
export function buildInkStrokeFromDraft(params: {
  draft: InkStrokeDraft
  anchorText: string
  anchorContext: string
  color: string
  width: number
}): InkStroke {
  const { draft, anchorText, anchorContext, color, width } = params
  return {
    id: createInkStrokeIdBlock(),
    anchorText,
    anchorContext,
    type: 'freedraw',
    x: draft.x,
    y: draft.y,
    width: draft.width,
    height: draft.height,
    points: draft.points,
    pressures: draft.pressures,
    simulatePressure: draft.simulatePressure,
    strokeColor: color,
    strokeWidth: width,
    opacity: 100,
    createdAt: Date.now(),
  }
}

function drawStrokeOnContext(
  ctx: CanvasRenderingContext2D,
  points: InkPointTuple[],
  pressures: number[],
  color: string,
  width: number,
  origin: { offsetX: number; offsetY: number; simulatePressure: boolean },
) {
  if (points.length === 0) return
  const inputs = points.map(([x, y], index) => [
    x + origin.offsetX,
    y + origin.offsetY,
    pressures[index] ?? 0.5,
  ] as [number, number, number])
  const outline = getStroke(inputs, {
    size: width * 2,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.4,
    simulatePressure: origin.simulatePressure,
  })
  if (outline.length === 0) return
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(outline[0][0], outline[0][1])
  for (let i = 1; i < outline.length; i++) {
    ctx.lineTo(outline[i][0], outline[i][1])
  }
  ctx.closePath()
  ctx.fill()
}
