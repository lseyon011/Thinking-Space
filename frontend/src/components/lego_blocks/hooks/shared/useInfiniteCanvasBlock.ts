import { useCallback, useEffect, useRef, useState } from 'react'

export interface CanvasTransform {
  x: number
  y: number
  scale: number
}

export interface UseInfiniteCanvasOptions {
  worldWidth?: number
  worldHeight?: number
  minScale?: number
  maxScale?: number
  initialScale?: number
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
}

export function useInfiniteCanvasBlock(
  opts: UseInfiniteCanvasOptions = {},
): UseInfiniteCanvasResult {
  const worldWidth = opts.worldWidth ?? 3000
  const worldHeight = opts.worldHeight ?? 2000
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

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const prev = transformRef.current

      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.01)
        const newScale = Math.min(maxScale, Math.max(minScale, prev.scale * factor))
        const realFactor = newScale / prev.scale
        setTransform({
          scale: newScale,
          x: cx - (cx - prev.x) * realFactor,
          y: cy - (cy - prev.y) * realFactor,
        })
      } else {
        setTransform({
          ...prev,
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        })
      }
    },
    [maxScale, minScale],
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const resetZoom = useCallback(() => {
    setTransform({
      x: -worldWidth / 2 + window.innerWidth / 2,
      y: -worldHeight / 2 + window.innerHeight / 2,
      scale: 1,
    })
  }, [worldWidth, worldHeight])

  const centerOnWorld = useCallback((worldX: number, worldY: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    const viewW = rect?.width ?? window.innerWidth
    const viewH = rect?.height ?? window.innerHeight
    setTransform(prev => ({
      ...prev,
      x: viewW / 2 - worldX * prev.scale,
      y: viewH / 2 - worldY * prev.scale,
    }))
  }, [])

  return {
    transform,
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
    resetZoom,
    centerOnWorld,
    worldWidth,
    worldHeight,
    minScale,
    maxScale,
  }
}
