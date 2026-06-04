import { useCallback, useEffect, useRef, useState } from 'react'

export interface CanvasTransform {
  x: number
  y: number
  scale: number
}

export type CanvasEdge = 'top' | 'right' | 'bottom' | 'left'

export interface UseInfiniteCanvasOptions {
  worldWidth?: number
  worldHeight?: number
  minScale?: number
  maxScale?: number
  initialScale?: number
  /** Fires when a pan attempt is clamped at the board boundary. Only fires
   * for wheel/trackpad pan; not for programmatic resetZoom / centerOnWorld /
   * zoom-driven clamping. */
  onEdgeHit?: (edge: CanvasEdge) => void
}

export interface UseInfiniteCanvasResult {
  transform: CanvasTransform
  containerRef: React.RefObject<HTMLDivElement>
  resetZoom: () => void
  centerOnWorld: (worldX: number, worldY: number) => void
  worldWidth: number
  worldHeight: number
  minScale: number
  maxScale: number
  /** Cached viewport size (updates on resize only). Use this instead of
   * reading containerRef.current.clientWidth in render — that forces a
   * synchronous layout flush every frame during pan/zoom. */
  viewportWidth: number
  viewportHeight: number
}

export function useInfiniteCanvasBlock(
  opts: UseInfiniteCanvasOptions = {},
): UseInfiniteCanvasResult {
  const worldWidth = opts.worldWidth ?? 4500
  const worldHeight = opts.worldHeight ?? 3000
  const minScale = opts.minScale ?? 0.25
  const maxScale = opts.maxScale ?? 1.5
  const initialScale = opts.initialScale ?? 1

  const containerRef = useRef<HTMLDivElement | null>(null)
  const [transform, setTransform] = useState<CanvasTransform>(() => ({
    x: -worldWidth / 2 + (typeof window !== 'undefined' ? window.innerWidth / 2 : 0),
    y: -worldHeight / 2 + (typeof window !== 'undefined' ? window.innerHeight / 2 : 0),
    scale: initialScale,
  }))

  const transformRef = useRef(transform)
  transformRef.current = transform

  const onEdgeHitRef = useRef(opts.onEdgeHit)
  onEdgeHitRef.current = opts.onEdgeHit

  // Cached container rect + viewport size. Reading getBoundingClientRect /
  // clientWidth on every wheel event forces a synchronous layout flush, which
  // murders pan/zoom smoothness at trackpad's 120Hz event rate. We update
  // this cache only on mount and resize via ResizeObserver.
  // The ref holds left/top for hit-testing in wheel handler (no re-render
  // needed); state holds width/height so consumers can use them in render
  // without re-querying the DOM.
  const viewportRef = useRef({ left: 0, top: 0, width: 0, height: 0 })
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      viewportRef.current = { left: r.left, top: r.top, width: r.width, height: r.height }
      setViewportSize(prev =>
        prev.width === r.width && prev.height === r.height ? prev : { width: r.width, height: r.height },
      )
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [])

  // Clamp the pan so panning can't run off into infinity. We allow one viewport
  // worth of overscroll past the board edge on each side — enough to drag the
  // board fully off-screen if you want, but no more than that.
  // Reads cached viewport dims — does NOT force layout.
  const clampTransform = useCallback(
    (t: CanvasTransform): CanvasTransform => {
      const { width: viewW, height: viewH } = viewportRef.current
      const boardW = worldWidth * t.scale
      const boardH = worldHeight * t.scale
      const x = Math.min(viewW, Math.max(-boardW, t.x))
      const y = Math.min(viewH, Math.max(-boardH, t.y))
      return { ...t, x, y }
    },
    [worldWidth, worldHeight],
  )

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()
      const v = viewportRef.current
      if (v.width === 0) return
      const cx = e.clientX - v.left
      const cy = e.clientY - v.top
      const prev = transformRef.current

      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.01)
        const newScale = Math.min(maxScale, Math.max(minScale, prev.scale * factor))
        const realFactor = newScale / prev.scale
        setTransform(clampTransform({
          scale: newScale,
          x: cx - (cx - prev.x) * realFactor,
          y: cy - (cy - prev.y) * realFactor,
        }))
      } else {
        const desired = {
          ...prev,
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }
        const clamped = clampTransform(desired)
        setTransform(clamped)
        const cb = onEdgeHitRef.current
        if (cb) {
          // Detect which edge the clamp truncated against. clamped.x > desired.x
          // means the clamp lifted x back up — desired had pushed below the lower
          // bound (-boardW), i.e. the user tried to pan further right than the
          // board's right edge. Symmetric for the other three.
          if (clamped.x > desired.x) cb('right')
          else if (clamped.x < desired.x) cb('left')
          if (clamped.y > desired.y) cb('bottom')
          else if (clamped.y < desired.y) cb('top')
        }
      }
    },
    [maxScale, minScale, clampTransform],
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const resetZoom = useCallback(() => {
    setTransform(clampTransform({
      x: -worldWidth / 2 + window.innerWidth / 2,
      y: -worldHeight / 2 + window.innerHeight / 2,
      scale: 1,
    }))
  }, [worldWidth, worldHeight, clampTransform])

  const centerOnWorld = useCallback((worldX: number, worldY: number) => {
    const { width: viewW, height: viewH } = viewportRef.current
    setTransform(prev => clampTransform({
      ...prev,
      x: viewW / 2 - worldX * prev.scale,
      y: viewH / 2 - worldY * prev.scale,
    }))
  }, [clampTransform])

  return {
    transform,
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
    resetZoom,
    centerOnWorld,
    worldWidth,
    worldHeight,
    minScale,
    maxScale,
    viewportWidth: viewportSize.width,
    viewportHeight: viewportSize.height,
  }
}
