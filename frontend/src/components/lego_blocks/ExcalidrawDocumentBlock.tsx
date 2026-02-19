import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { ParsedExcalidrawScene } from '@/services/orchestrators/excalidrawSceneOrch'
import {
  parseExcalidrawSceneOrch,
  parseExcalidrawSceneRawOrch,
} from '@/services/orchestrators/excalidrawSceneOrch'
import { cn } from '@/lib/utils'

const ExcalidrawCanvas = lazy(async () => {
  await import('@excalidraw/excalidraw/index.css')
  const mod = await import('@excalidraw/excalidraw')
  return { default: mod.Excalidraw }
})

interface ExcalidrawDocumentBlockProps {
  content: string
  editable?: boolean
  onSceneChange?: (scene: ParsedExcalidrawScene) => void
  className?: string
}

type SceneBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

type SceneRect = {
  left: number
  top: number
  right: number
  bottom: number
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  if (sorted.length === 1) return sorted[0]
  const position = (sorted.length - 1) * q
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  const weight = position - lower
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

function rectsToBounds(rects: SceneRect[]): SceneBounds | null {
  if (rects.length === 0) return null
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const rect of rects) {
    minX = Math.min(minX, rect.left)
    minY = Math.min(minY, rect.top)
    maxX = Math.max(maxX, rect.right)
    maxY = Math.max(maxY, rect.bottom)
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  }
}

export default function ExcalidrawDocumentBlock({
  content,
  editable = false,
  onSceneChange,
  className,
}: ExcalidrawDocumentBlockProps) {
  const parsedScene = useMemo(() => {
    if (editable) {
      const raw = parseExcalidrawSceneRawOrch(content)
      if (raw) return raw
    }
    return parseExcalidrawSceneOrch(content)
  }, [content, editable])
  const [excalidrawApi, setExcalidrawApi] = useState<ExcalidrawImperativeAPI | null>(null)
  const [scrollState, setScrollState] = useState({ scrollX: 0, scrollY: 0, zoom: 1 })
  const [apiElementStats, setApiElementStats] = useState({ visible: 0, includingDeleted: 0 })
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 1, height: 1 })
  const scrollFrameRef = useRef<number | null>(null)
  const pendingScrollRef = useRef({ scrollX: 0, scrollY: 0, zoom: 1 })
  const sceneChangeFrameRef = useRef<number | null>(null)
  const latestSceneRef = useRef<ParsedExcalidrawScene | null>(null)
  const hasAutoFitRef = useRef(false)
  const hasHydratedSceneRef = useRef(false)

  const initialData = useMemo(() => {
    if (!parsedScene) return null
    const baseAppState = (parsedScene.appState ?? {}) as Record<string, unknown>
    return {
      elements: parsedScene.elements as any[],
      appState: {
        ...baseAppState,
        viewModeEnabled: !editable,
        ...(editable
          ? {
            // Start from deterministic viewport in edit mode, then auto-fit once container size is known.
            scrollX: 0,
            scrollY: 0,
            zoom: { value: 1 },
          }
          : {}),
      } as any,
      files: (parsedScene.files ?? {}) as any,
    }
  }, [editable, parsedScene])

  const drawableRects = useMemo(() => {
    if (!parsedScene || parsedScene.elements.length === 0) return [] as SceneRect[]

    const rects: SceneRect[] = []
    for (const item of parsedScene.elements) {
      if (!item || typeof item !== 'object') continue
      const element = item as Record<string, unknown>
      if (element.isDeleted === true) continue

      const x = Number(element.x)
      const y = Number(element.y)
      const rawWidth = Number(element.width)
      const rawHeight = Number(element.height)
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(rawWidth) || !Number.isFinite(rawHeight)) continue
      if (Math.abs(x) > 10_000_000 || Math.abs(y) > 10_000_000) continue

      const width = Math.max(Math.abs(rawWidth), 1)
      const height = Math.max(Math.abs(rawHeight), 1)
      const left = rawWidth >= 0 ? x : x - width
      const top = rawHeight >= 0 ? y : y - height

      rects.push({
        left,
        top,
        right: left + width,
        bottom: top + height,
      })
    }

    return rects
  }, [parsedScene])

  const sceneBounds = useMemo(() => rectsToBounds(drawableRects), [drawableRects])

  const fitBounds = useMemo(() => {
    if (drawableRects.length === 0) return null

    if (drawableRects.length < 50) {
      return rectsToBounds(drawableRects)
    }

    const lefts = drawableRects.map(rect => rect.left).sort((a, b) => a - b)
    const tops = drawableRects.map(rect => rect.top).sort((a, b) => a - b)
    const rights = drawableRects.map(rect => rect.right).sort((a, b) => a - b)
    const bottoms = drawableRects.map(rect => rect.bottom).sort((a, b) => a - b)

    const qMinX = quantile(lefts, 0.02)
    const qMinY = quantile(tops, 0.02)
    const qMaxX = quantile(rights, 0.98)
    const qMaxY = quantile(bottoms, 0.98)

    if (!Number.isFinite(qMinX) || !Number.isFinite(qMinY) || !Number.isFinite(qMaxX) || !Number.isFinite(qMaxY)) {
      return rectsToBounds(drawableRects)
    }

    const width = qMaxX - qMinX
    const height = qMaxY - qMinY
    if (width < 1 || height < 1) {
      return rectsToBounds(drawableRects)
    }

    return {
      minX: qMinX,
      minY: qMinY,
      maxX: qMaxX,
      maxY: qMaxY,
      width: Math.max(width, 1),
      height: Math.max(height, 1),
    }
  }, [parsedScene])

  const miniMapRects = useMemo(() => {
    if (!parsedScene || !sceneBounds) return []

    const rects: Array<{ x: number; y: number; width: number; height: number; key: string }> = []
    const elements = parsedScene.elements
    const maxElements = Math.min(elements.length, 400)

    for (let index = 0; index < maxElements; index += 1) {
      const item = elements[index]
      if (!item || typeof item !== 'object') continue
      const element = item as Record<string, unknown>
      if (element.isDeleted === true) continue
      const x = Number(element.x)
      const y = Number(element.y)
      const w = Math.max(Number(element.width), 1)
      const h = Math.max(Number(element.height), 1)
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) continue

      rects.push({
        key: `nav-${index}`,
        x: ((x - sceneBounds.minX) / sceneBounds.width) * 100,
        y: ((y - sceneBounds.minY) / sceneBounds.height) * 72,
        width: Math.max((w / sceneBounds.width) * 100, 0.5),
        height: Math.max((h / sceneBounds.height) * 72, 0.5),
      })
    }

    return rects
  }, [parsedScene, sceneBounds])

  const fitSceneToViewport = useCallback(() => {
    if (!editable || !excalidrawApi || !fitBounds) return false
    if (containerSize.width <= 1 || containerSize.height <= 1) return false

    const scaleX = (containerSize.width * 0.9) / Math.max(fitBounds.width, 1)
    const scaleY = (containerSize.height * 0.9) / Math.max(fitBounds.height, 1)
    let zoomValue = Math.min(scaleX, scaleY)
    if (!Number.isFinite(zoomValue) || zoomValue <= 0) zoomValue = 1
    zoomValue = Math.max(0.001, Math.min(zoomValue, 8))

    const viewportWorldW = containerSize.width / zoomValue
    const viewportWorldH = containerSize.height / zoomValue
    const centerX = fitBounds.minX + fitBounds.width / 2
    const centerY = fitBounds.minY + fitBounds.height / 2
    const scrollX = -centerX + viewportWorldW / 2
    const scrollY = -centerY + viewportWorldH / 2

    excalidrawApi.refresh()
    excalidrawApi.updateScene({
      appState: {
        ...excalidrawApi.getAppState(),
        zoom: { value: zoomValue } as any,
        scrollX,
        scrollY,
      } as any,
    })

    const sceneElements = excalidrawApi.getSceneElements()
    if (sceneElements.length > 0) {
      excalidrawApi.scrollToContent(sceneElements, {
        fitToViewport: true,
        viewportZoomFactor: 0.92,
        animate: false,
        minZoom: 0.001,
        maxZoom: 8,
      })
    }

    setApiElementStats({
      visible: excalidrawApi.getSceneElements().length,
      includingDeleted: excalidrawApi.getSceneElementsIncludingDeleted().length,
    })

    return true
  }, [containerSize.height, containerSize.width, editable, excalidrawApi, fitBounds])

  const hydrateSceneFromParsed = useCallback(() => {
    if (!editable || !excalidrawApi || !parsedScene) return false

    excalidrawApi.refresh()
    excalidrawApi.updateScene({
      elements: parsedScene.elements as any[],
      files: (parsedScene.files ?? {}) as any,
      appState: {
        ...excalidrawApi.getAppState(),
        ...(parsedScene.appState ?? {}),
        viewModeEnabled: false,
      } as any,
    })
    hasHydratedSceneRef.current = true
    setApiElementStats({
      visible: excalidrawApi.getSceneElements().length,
      includingDeleted: excalidrawApi.getSceneElementsIncludingDeleted().length,
    })
    return true
  }, [editable, excalidrawApi, parsedScene])

  const uiOptions = useMemo(() => {
    if (editable) {
      return {
        canvasActions: {
          loadScene: false,
          saveToActiveFile: false,
          toggleTheme: false,
        },
      }
    }

    return {
      canvasActions: {
        clearCanvas: false,
        export: false as const,
        loadScene: false,
        saveAsImage: false,
        saveToActiveFile: false,
        changeViewBackgroundColor: false,
        toggleTheme: false,
      },
    }
  }, [editable])

  const queueSceneChange = useCallback((scene: ParsedExcalidrawScene) => {
    if (!onSceneChange) return

    latestSceneRef.current = scene
    if (sceneChangeFrameRef.current !== null) return

    sceneChangeFrameRef.current = window.requestAnimationFrame(() => {
      sceneChangeFrameRef.current = null
      const nextScene = latestSceneRef.current
      if (!nextScene) return
      onSceneChange(nextScene)
    })
  }, [onSceneChange])

  useEffect(() => {
    return () => {
      if (sceneChangeFrameRef.current !== null) {
        window.cancelAnimationFrame(sceneChangeFrameRef.current)
        sceneChangeFrameRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    hasAutoFitRef.current = false
    hasHydratedSceneRef.current = false
  }, [content, editable])

  useEffect(() => {
    if (!editable || !excalidrawApi || !parsedScene || hasHydratedSceneRef.current) return

    const frameId = window.requestAnimationFrame(() => {
      try {
        hydrateSceneFromParsed()
      } catch {
        // Ignore hydration failures; fallback render remains active.
      }
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [editable, excalidrawApi, hydrateSceneFromParsed, parsedScene])

  useEffect(() => {
    if (!excalidrawApi) return undefined

    const app = excalidrawApi.getAppState()
    setScrollState({
      scrollX: app.scrollX,
      scrollY: app.scrollY,
      zoom: app.zoom.value,
    })
    pendingScrollRef.current = {
      scrollX: app.scrollX,
      scrollY: app.scrollY,
      zoom: app.zoom.value,
    }
    setApiElementStats({
      visible: excalidrawApi.getSceneElements().length,
      includingDeleted: excalidrawApi.getSceneElementsIncludingDeleted().length,
    })

    const unsubscribe = excalidrawApi.onScrollChange((scrollX, scrollY, zoom) => {
      pendingScrollRef.current = { scrollX, scrollY, zoom: zoom.value }
      if (scrollFrameRef.current !== null) {
        return
      }

      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null
        setScrollState(pendingScrollRef.current)
      })
    })

    return () => {
      unsubscribe()
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current)
        scrollFrameRef.current = null
      }
    }
  }, [excalidrawApi])

  useEffect(() => {
    if (!editable || !excalidrawApi || hasAutoFitRef.current) return
    if (!sceneBounds) return
    if (containerSize.width <= 1 || containerSize.height <= 1) return

    const frameId = window.requestAnimationFrame(() => {
      try {
        hasAutoFitRef.current = fitSceneToViewport()
      } catch {
        // Ignore fit failures; scene is still editable.
      }
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [containerSize.height, containerSize.width, editable, excalidrawApi, fitSceneToViewport, sceneBounds])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined
    const update = () => {
      setContainerSize({
        width: Math.max(container.clientWidth, 1),
        height: Math.max(container.clientHeight, 1),
      })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  if (!initialData) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Could not parse Excalidraw scene from this file. Keep editing in markdown or open it in Obsidian.
      </div>
    )
  }

  return (
    <div ref={containerRef} className={cn('relative h-full min-h-[60vh] overflow-hidden rounded-lg border border-border/60', className)}>
      <Suspense fallback={<div className="px-4 py-3 text-sm text-muted-foreground">Loading Excalidraw canvas...</div>}>
        <ExcalidrawCanvas
          excalidrawAPI={setExcalidrawApi}
          initialData={initialData}
          viewModeEnabled={!editable}
          autoFocus={editable}
          handleKeyboardGlobally={editable}
          onChange={(elements: readonly unknown[], appState: unknown, files: unknown) => {
            setApiElementStats({
              visible: excalidrawApi?.getSceneElements().length ?? elements.length,
              includingDeleted: excalidrawApi?.getSceneElementsIncludingDeleted().length ?? elements.length,
            })
            queueSceneChange({
              elements: [...elements],
              appState: (appState as Record<string, unknown>) ?? {},
              files: (files as Record<string, unknown>) ?? {},
            })
          }}
          UIOptions={uiOptions as any}
        />
      </Suspense>

      {editable && sceneBounds && (
        <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
          <div className="rounded-md border border-border/70 bg-background/90 px-2 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
            Loaded {(parsedScene?.elements ?? []).length} elements ({drawableRects.length} drawable)
          </div>
          <div className="rounded-md border border-border/70 bg-background/90 px-2 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
            Canvas {apiElementStats.visible}/{apiElementStats.includingDeleted} zoom {scrollState.zoom.toFixed(3)}
          </div>
          <button
            type="button"
            className="rounded-md border border-border/70 bg-background/90 px-2 py-1 text-xs font-medium shadow-sm backdrop-blur hover:bg-muted"
            onClick={() => {
              try {
                hydrateSceneFromParsed()
              } catch {
                // Ignore manual reload failures.
              }
            }}
            title="Reload scene from file content"
          >
            Reload Scene
          </button>
          <button
            type="button"
            className="rounded-md border border-border/70 bg-background/90 px-2 py-1 text-xs font-medium shadow-sm backdrop-blur hover:bg-muted"
            onClick={() => {
              try {
                fitSceneToViewport()
              } catch {
                // Ignore manual fit failures.
              }
            }}
            title="Fit drawing to viewport"
          >
            Fit to Content
          </button>
        </div>
      )}

      {!editable && sceneBounds && (
        <button
          type="button"
          className="absolute bottom-3 right-3 z-20 rounded-lg border border-border/70 bg-background/90 p-1 shadow-sm backdrop-blur"
          title="Mini map"
        >
          <svg
            data-navmap-track
            viewBox="0 0 100 72"
            className="h-16 w-24"
            onClick={(event) => {
              event.stopPropagation()
              if (!sceneBounds || !excalidrawApi) return
              const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect()
              const px = (event.clientX - rect.left) / Math.max(rect.width, 1)
              const py = (event.clientY - rect.top) / Math.max(rect.height, 1)

              const worldX = sceneBounds.minX + px * sceneBounds.width
              const worldY = sceneBounds.minY + py * sceneBounds.height

              const zoom = Math.max(scrollState.zoom, 0.01)
              const viewportWorldW = containerSize.width / zoom
              const viewportWorldH = containerSize.height / zoom
              const nextScrollX = -worldX + viewportWorldW / 2
              const nextScrollY = -worldY + viewportWorldH / 2

              excalidrawApi.updateScene({
                appState: {
                  ...excalidrawApi.getAppState(),
                  scrollX: nextScrollX,
                  scrollY: nextScrollY,
                },
              })
            }}
          >
            <rect x="0" y="0" width="100" height="72" rx="4" fill="hsl(var(--muted) / 0.45)" />

            {miniMapRects.map((rect) => {
              return (
                <rect
                  key={rect.key}
                  x={rect.x}
                  y={rect.y}
                  width={rect.width}
                  height={rect.height}
                  fill="hsl(var(--foreground) / 0.2)"
                />
              )
            })}

            {(() => {
              const zoom = Math.max(scrollState.zoom, 0.01)
              const leftWorld = -scrollState.scrollX
              const topWorld = -scrollState.scrollY
              const viewportWorldW = containerSize.width / zoom
              const viewportWorldH = containerSize.height / zoom
              const vx = ((leftWorld - sceneBounds.minX) / sceneBounds.width) * 100
              const vy = ((topWorld - sceneBounds.minY) / sceneBounds.height) * 72
              const vw = (viewportWorldW / sceneBounds.width) * 100
              const vh = (viewportWorldH / sceneBounds.height) * 72
              return (
                <rect
                  x={vx}
                  y={vy}
                  width={vw}
                  height={vh}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="1"
                />
              )
            })()}
          </svg>
        </button>
      )}
    </div>
  )
}
