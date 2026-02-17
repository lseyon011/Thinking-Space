import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { ParsedExcalidrawScene } from '@/services/orchestrators/excalidrawSceneOrch'
import { parseExcalidrawSceneOrch } from '@/services/orchestrators/excalidrawSceneOrch'
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

export default function ExcalidrawDocumentBlock({
  content,
  editable = false,
  onSceneChange,
  className,
}: ExcalidrawDocumentBlockProps) {
  const parsedScene = useMemo(() => parseExcalidrawSceneOrch(content), [content])
  const [excalidrawApi, setExcalidrawApi] = useState<ExcalidrawImperativeAPI | null>(null)
  const [scrollState, setScrollState] = useState({ scrollX: 0, scrollY: 0, zoom: 1 })
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 1, height: 1 })

  const initialData = useMemo(() => {
    if (!parsedScene) return null
    return {
      elements: parsedScene.elements as any[],
      appState: {
        ...(parsedScene.appState ?? {}),
        viewModeEnabled: true,
      } as any,
      files: (parsedScene.files ?? {}) as any,
    }
  }, [parsedScene])

  const sceneBounds = useMemo(() => {
    if (!parsedScene || parsedScene.elements.length === 0) return null

    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    let found = false

    for (const item of parsedScene.elements) {
      if (!item || typeof item !== 'object') continue
      const element = item as Record<string, unknown>
      if (element.isDeleted === true) continue
      const x = Number(element.x)
      const y = Number(element.y)
      const width = Number(element.width)
      const height = Number(element.height)
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x + Math.max(width, 1))
      maxY = Math.max(maxY, y + Math.max(height, 1))
      found = true
    }

    if (!found) return null
    return {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(maxX - minX, 1),
      height: Math.max(maxY - minY, 1),
    }
  }, [parsedScene])

  useEffect(() => {
    if (!excalidrawApi) return undefined

    const app = excalidrawApi.getAppState()
    setScrollState({
      scrollX: app.scrollX,
      scrollY: app.scrollY,
      zoom: app.zoom.value,
    })

    return excalidrawApi.onScrollChange((scrollX, scrollY, zoom) => {
      setScrollState({ scrollX, scrollY, zoom: zoom.value })
    })
  }, [excalidrawApi])

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
          onChange={(elements: readonly unknown[], appState: unknown, files: unknown) => {
            onSceneChange?.({
              elements: [...elements],
              appState: (appState as Record<string, unknown>) ?? {},
              files: (files as Record<string, unknown>) ?? {},
            })
          }}
          UIOptions={{
            canvasActions: {
              clearCanvas: false,
              export: false,
              loadScene: false,
              saveAsImage: false,
              saveToActiveFile: false,
              changeViewBackgroundColor: false,
              toggleTheme: false,
            },
          }}
        />
      </Suspense>

      {!editable && sceneBounds && (
        <button
          type="button"
          className="absolute bottom-3 right-3 z-20 rounded-lg border border-border/70 bg-background/90 p-1 shadow-sm backdrop-blur"
          title="Mini map"
          onClick={(e) => {
            const target = e.currentTarget.querySelector('[data-navmap-track]') as HTMLDivElement | null
            if (!target || !sceneBounds || !excalidrawApi) return
          }}
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

            {(parsedScene?.elements ?? []).slice(0, 400).map((item, index) => {
              if (!item || typeof item !== 'object') return null
              const element = item as Record<string, unknown>
              if (element.isDeleted === true) return null
              const x = Number(element.x)
              const y = Number(element.y)
              const w = Math.max(Number(element.width), 1)
              const h = Math.max(Number(element.height), 1)
              if (!Number.isFinite(x) || !Number.isFinite(y)) return null
              const rx = ((x - sceneBounds.minX) / sceneBounds.width) * 100
              const ry = ((y - sceneBounds.minY) / sceneBounds.height) * 72
              const rw = Math.max((w / sceneBounds.width) * 100, 0.5)
              const rh = Math.max((h / sceneBounds.height) * 72, 0.5)
              return (
                <rect
                  key={`nav-${index}`}
                  x={rx}
                  y={ry}
                  width={rw}
                  height={rh}
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
