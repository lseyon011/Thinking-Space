import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ParsedExcalidrawScene } from '@/services/orchestrators/excalidrawSceneOrch'
import { parseExcalidrawSceneOrch } from '@/services/orchestrators/excalidrawSceneOrch'
import {
  buildExcalidrawInitialDataOrch,
  cloneExcalidrawSceneChangeOrch,
  createExcalidrawCanvasApiOrch,
  type ExcalidrawCanvasApiOrch,
} from '@/services/orchestrators/excalidrawIntegrationOrch'
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

interface SceneDrawableCenter {
  x: number
  y: number
  isAnchor: boolean
}

interface SceneAnalysis {
  sceneBounds: {
    minX: number
    minY: number
    maxX: number
    maxY: number
    width: number
    height: number
    medianCenterX: number
    medianCenterY: number
    anchorCount: number
    medianAnchorCenterX: number
    medianAnchorCenterY: number
  } | null
  drawableCenters: SceneDrawableCenter[]
  durationMs: number
}

interface ExcalidrawPerfEvent {
  name: string
  durationMs: number
  elementCount: number
  ts: string
  meta?: Record<string, unknown>
}

const LARGE_SCENE_ELEMENT_THRESHOLD = 1200
const MEDIAN_SORT_THRESHOLD = 2000
const PERF_EVENTS_LIMIT = 400

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function pushGlobalExcalidrawPerfEvent(event: ExcalidrawPerfEvent): void {
  const state = globalThis as {
    __ltmExcalidrawPerfEvents?: ExcalidrawPerfEvent[]
    __ltmExcalidrawPerfLast?: ExcalidrawPerfEvent
  }
  const events = Array.isArray(state.__ltmExcalidrawPerfEvents)
    ? state.__ltmExcalidrawPerfEvents
    : []
  events.push(event)
  if (events.length > PERF_EVENTS_LIMIT) events.shift()
  state.__ltmExcalidrawPerfEvents = events
  state.__ltmExcalidrawPerfLast = event
}

export default function ExcalidrawDocumentBlock({
  content,
  editable = false,
  onSceneChange,
  className,
}: ExcalidrawDocumentBlockProps) {
  const debugEnabled = editable
    && (globalThis as { __ltmExcalidrawDebugEnabled?: unknown }).__ltmExcalidrawDebugEnabled === true
  const parseDurationMsRef = useRef(0)
  const parsedScene = useMemo(() => {
    const started = nowMs()
    const parsed = parseExcalidrawSceneOrch(content)
    parseDurationMsRef.current = nowMs() - started
    return parsed
  }, [content])
  const [excalidrawApi, setExcalidrawApi] = useState<ExcalidrawCanvasApiOrch | null>(null)
  const [scrollState, setScrollState] = useState({ scrollX: 0, scrollY: 0, zoom: 1 })
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 1, height: 1 })
  const scrollFrameRef = useRef<number | null>(null)
  const pendingScrollRef = useRef({ scrollX: 0, scrollY: 0, zoom: 1 })
  const sceneChangeFrameRef = useRef<number | null>(null)
  const hasAutoCenteredRef = useRef(false)
  const autoCenterRequestedRef = useRef(false)
  const autoCenterAttemptsRef = useRef(0)
  const autoCenterFrameRef = useRef<number | null>(null)
  const onChangeLogCountRef = useRef(0)
  const queuedSceneRef = useRef<{
    elements: readonly unknown[]
    appState: Record<string, unknown>
    files: Record<string, unknown>
  } | null>(null)

  const debugLog = useCallback((event: string, data: Record<string, unknown> = {}) => {
    if (!debugEnabled) return
    const payload = {
      event,
      data,
      ts: new Date().toISOString(),
    }
    console.log('[LTM-EXCALIDRAW-DEBUG]', payload)
    const globalState = globalThis as any
    const events = Array.isArray(globalState.__ltmExcalidrawDebugEvents)
      ? globalState.__ltmExcalidrawDebugEvents
      : []
    events.push(payload)
    if (events.length > 200) events.shift()
    globalState.__ltmExcalidrawDebugEvents = events
    globalState.__ltmExcalidrawDebug = payload
  }, [debugEnabled])

  const initialData = useMemo(() => {
    if (!parsedScene) return null
    return buildExcalidrawInitialDataOrch(parsedScene, editable)
  }, [editable, parsedScene])

  const sceneAnalysis = useMemo<SceneAnalysis>(() => {
    const started = nowMs()
    if (!parsedScene || parsedScene.elements.length === 0) {
      return {
        sceneBounds: null,
        drawableCenters: [],
        durationMs: nowMs() - started,
      }
    }

    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    let found = false
    let centerSumX = 0
    let centerSumY = 0
    let anchorCenterSumX = 0
    let anchorCenterSumY = 0
    let anchorCount = 0
    let centerCount = 0
    const centersX: number[] = []
    const centersY: number[] = []
    const anchorCentersX: number[] = []
    const anchorCentersY: number[] = []
    const drawableCenters: SceneDrawableCenter[] = []

    for (const item of parsedScene.elements) {
      if (!item || typeof item !== 'object') continue
      const element = item as Record<string, unknown>
      if (element.isDeleted === true) continue
      const x = Number(element.x)
      const y = Number(element.y)
      const width = Number(element.width)
      const height = Number(element.height)
      const type = typeof element.type === 'string' ? element.type : ''
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x + Math.max(width, 1))
      maxY = Math.max(maxY, y + Math.max(height, 1))
      const cx = x + Math.max(width, 1) / 2
      const cy = y + Math.max(height, 1) / 2
      centerCount += 1
      centerSumX += cx
      centerSumY += cy
      drawableCenters.push({
        x: cx,
        y: cy,
        isAnchor: type !== 'freedraw',
      })
      if (centerCount <= MEDIAN_SORT_THRESHOLD) {
        centersX.push(cx)
        centersY.push(cy)
      }
      if (type !== 'freedraw') {
        anchorCount += 1
        anchorCenterSumX += cx
        anchorCenterSumY += cy
        if (anchorCount <= MEDIAN_SORT_THRESHOLD) {
          anchorCentersX.push(cx)
          anchorCentersY.push(cy)
        }
      }
      found = true
    }

    if (!found || centerCount === 0) {
      return {
        sceneBounds: null,
        drawableCenters,
        durationMs: nowMs() - started,
      }
    }

    const useAveragesForCenter = centerCount > MEDIAN_SORT_THRESHOLD
    let medianCenterX = minX + (maxX - minX) / 2
    let medianCenterY = minY + (maxY - minY) / 2
    let medianAnchorCenterX = medianCenterX
    let medianAnchorCenterY = medianCenterY

    if (useAveragesForCenter) {
      medianCenterX = centerSumX / centerCount
      medianCenterY = centerSumY / centerCount
      if (anchorCount > 0) {
        medianAnchorCenterX = anchorCenterSumX / anchorCount
        medianAnchorCenterY = anchorCenterSumY / anchorCount
      }
    } else {
      centersX.sort((a, b) => a - b)
      centersY.sort((a, b) => a - b)
      anchorCentersX.sort((a, b) => a - b)
      anchorCentersY.sort((a, b) => a - b)
      const mid = Math.floor(centersX.length / 2)
      medianCenterX = centersX[mid] ?? medianCenterX
      medianCenterY = centersY[mid] ?? medianCenterY
      const anchorMid = Math.floor(anchorCentersX.length / 2)
      medianAnchorCenterX = anchorCentersX[anchorMid] ?? medianCenterX
      medianAnchorCenterY = anchorCentersY[anchorMid] ?? medianCenterY
    }

    return {
      sceneBounds: {
        minX,
        minY,
        maxX,
        maxY,
        width: Math.max(maxX - minX, 1),
        height: Math.max(maxY - minY, 1),
        medianCenterX,
        medianCenterY,
        anchorCount,
        medianAnchorCenterX,
        medianAnchorCenterY,
      },
      drawableCenters,
      durationMs: nowMs() - started,
    }
  }, [parsedScene])

  const sceneBounds = sceneAnalysis.sceneBounds
  const isLargeScene = (parsedScene?.elements.length ?? 0) >= LARGE_SCENE_ELEMENT_THRESHOLD

  useEffect(() => {
    pushGlobalExcalidrawPerfEvent({
      name: 'parse_scene',
      durationMs: parseDurationMsRef.current,
      elementCount: parsedScene?.elements.length ?? 0,
      ts: new Date().toISOString(),
      meta: {
        contentLength: content.length,
      },
    })
    pushGlobalExcalidrawPerfEvent({
      name: 'analyze_scene',
      durationMs: sceneAnalysis.durationMs,
      elementCount: parsedScene?.elements.length ?? 0,
      ts: new Date().toISOString(),
      meta: {
        largeSceneMode: isLargeScene,
      },
    })
    debugLog('parse', {
      contentLength: content.length,
      parsed: Boolean(parsedScene),
      elementCount: parsedScene?.elements?.length ?? 0,
      hasAppState: Boolean(parsedScene?.appState),
      hasFiles: Boolean(parsedScene?.files),
      sceneBounds,
      parseDurationMs: parseDurationMsRef.current,
      sceneAnalysisMs: sceneAnalysis.durationMs,
      largeSceneMode: isLargeScene,
    })
  }, [content.length, debugLog, isLargeScene, parsedScene, sceneAnalysis.durationMs, sceneBounds])

  const miniMapRects = useMemo(() => {
    if (editable || !parsedScene || !sceneBounds) return []

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
  }, [editable, parsedScene, sceneBounds])

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

  const queueSceneChange = useCallback((params: {
    elements: readonly unknown[]
    appState: Record<string, unknown>
    files: Record<string, unknown>
  }) => {
    if (!onSceneChange) return

    queuedSceneRef.current = params
    if (sceneChangeFrameRef.current !== null) return

    sceneChangeFrameRef.current = window.requestAnimationFrame(() => {
      sceneChangeFrameRef.current = null
      const queued = queuedSceneRef.current
      if (!queued) return
      const flushStarted = nowMs()
      onSceneChange(cloneExcalidrawSceneChangeOrch(
        queued.elements,
        queued.appState,
        queued.files,
      ))
      pushGlobalExcalidrawPerfEvent({
        name: 'scene_change_flush',
        durationMs: nowMs() - flushStarted,
        elementCount: queued.elements.length,
        ts: new Date().toISOString(),
      })
    })
  }, [onSceneChange])

  const countDrawableCentersInViewport = useCallback((viewport: {
    left: number
    top: number
    right: number
    bottom: number
  }, options?: { anchorsOnly?: boolean }): number => {
    if (sceneAnalysis.drawableCenters.length === 0) return 0
    const anchorsOnly = options?.anchorsOnly === true
    let count = 0
    for (const center of sceneAnalysis.drawableCenters) {
      if (anchorsOnly && !center.isAnchor) continue
      if (center.x >= viewport.left && center.x <= viewport.right && center.y >= viewport.top && center.y <= viewport.bottom) {
        count += 1
      }
    }
    return count
  }, [sceneAnalysis.drawableCenters])

  useEffect(() => {
    return () => {
      if (sceneChangeFrameRef.current !== null) {
        window.cancelAnimationFrame(sceneChangeFrameRef.current)
        sceneChangeFrameRef.current = null
      }
      if (autoCenterFrameRef.current !== null) {
        window.cancelAnimationFrame(autoCenterFrameRef.current)
        autoCenterFrameRef.current = null
      }
      queuedSceneRef.current = null
    }
  }, [])

  useEffect(() => {
    hasAutoCenteredRef.current = false
    autoCenterRequestedRef.current = false
    autoCenterAttemptsRef.current = 0
    if (autoCenterFrameRef.current !== null) {
      window.cancelAnimationFrame(autoCenterFrameRef.current)
      autoCenterFrameRef.current = null
    }
    onChangeLogCountRef.current = 0
    queuedSceneRef.current = null
    debugLog('scene_reset', { editable, contentLength: content.length })
  }, [content, editable])

  const tryAutoCenter = useCallback((source: string, hintedElementCount?: number) => {
    if (!editable || !excalidrawApi || hasAutoCenteredRef.current) return false
    if (!autoCenterRequestedRef.current) return false
    if (!parsedScene || parsedScene.elements.length === 0) return false

    autoCenterAttemptsRef.current += 1
    const attempt = autoCenterAttemptsRef.current
    const elements = excalidrawApi.getSceneElementsBlock()
    debugLog('auto_center_attempt', {
      source,
      attempt,
      hintedElementCount: hintedElementCount ?? null,
      apiElements: elements.length,
      parsedElements: parsedScene.elements.length,
      containerWidth: containerSize.width,
      containerHeight: containerSize.height,
    })

    if (elements.length === 0) {
      debugLog('auto_center_waiting_for_elements', {
        source,
        attempt,
      })
      return false
    }

    const autoCenterStarted = nowMs()
    try {
      const baseViewport = excalidrawApi.getViewportStateBlock()
      const parsedAppState = (parsedScene.appState ?? {}) as Record<string, unknown>
      const parsedZoomCandidate = (() => {
        const rawZoom = parsedAppState.zoom as { value?: unknown } | undefined
        const value = typeof rawZoom?.value === 'number' ? rawZoom.value : null
        if (value !== null && Number.isFinite(value)) return value
        const maybeZoom = parsedAppState.zoom
        if (typeof maybeZoom === 'number' && Number.isFinite(maybeZoom)) return maybeZoom
        return null
      })()

      if (sceneBounds && containerSize.width > 0 && containerSize.height > 0) {
        const currentZoom = Number.isFinite(baseViewport.zoom) ? baseViewport.zoom : 1
        const targetZoom = Math.min(Math.max(parsedZoomCandidate ?? currentZoom ?? 1, 0.1), 2)
        const viewportWorldW = containerSize.width / targetZoom
        const viewportWorldH = containerSize.height / targetZoom
        const centerX = sceneBounds.anchorCount > 0 ? sceneBounds.medianAnchorCenterX : sceneBounds.medianCenterX
        const centerY = sceneBounds.anchorCount > 0 ? sceneBounds.medianAnchorCenterY : sceneBounds.medianCenterY
        const nextScrollX = -centerX + viewportWorldW / 2
        const nextScrollY = -centerY + viewportWorldH / 2
        excalidrawApi.updateViewportBlock({
          scrollX: nextScrollX,
          scrollY: nextScrollY,
          zoom: targetZoom,
        })
        debugLog('auto_center_strategy', {
          strategy: sceneBounds.anchorCount > 0 ? 'anchor_median_preserve_zoom' : 'median_center_preserve_zoom',
          targetZoom,
          centerX,
          centerY,
          anchorCount: sceneBounds.anchorCount,
          nextScrollX,
          nextScrollY,
        })
      } else {
        excalidrawApi.fitViewportToContentBlock(elements)
        debugLog('auto_center_strategy', {
          strategy: 'scroll_to_content_fallback',
        })
      }
      const viewport = excalidrawApi.getViewportStateBlock()
      debugLog('auto_center_done', {
        source,
        attempt,
        appScrollX: viewport.scrollX,
        appScrollY: viewport.scrollY,
        appZoom: viewport.zoom,
      })
      pushGlobalExcalidrawPerfEvent({
        name: 'auto_center',
        durationMs: nowMs() - autoCenterStarted,
        elementCount: parsedScene.elements.length,
        ts: new Date().toISOString(),
        meta: {
          source,
          attempt,
          success: true,
        },
      })
      hasAutoCenteredRef.current = true
      autoCenterRequestedRef.current = false
      return true
    } catch (error) {
      debugLog('auto_center_error', {
        source,
        attempt,
        message: error instanceof Error ? error.message : String(error),
      })
      pushGlobalExcalidrawPerfEvent({
        name: 'auto_center',
        durationMs: nowMs() - autoCenterStarted,
        elementCount: parsedScene.elements.length,
        ts: new Date().toISOString(),
        meta: {
          source,
          attempt,
          success: false,
          message: error instanceof Error ? error.message : String(error),
        },
      })
      // Keep editor usable even if camera centering fails.
      return false
    }
  }, [containerSize.height, containerSize.width, debugLog, editable, excalidrawApi, parsedScene, sceneBounds])

  const scheduleAutoCenter = useCallback((source: string, hintedElementCount?: number) => {
    if (!editable || !excalidrawApi || hasAutoCenteredRef.current) return
    if (!autoCenterRequestedRef.current) return
    if (autoCenterFrameRef.current !== null) return
    autoCenterFrameRef.current = window.requestAnimationFrame(() => {
      autoCenterFrameRef.current = null
      tryAutoCenter(source, hintedElementCount)
    })
  }, [editable, excalidrawApi, tryAutoCenter])

  useEffect(() => {
    if (!excalidrawApi) return undefined

    const viewport = excalidrawApi.getViewportStateBlock()
    if (!editable) {
      setScrollState({
        scrollX: viewport.scrollX,
        scrollY: viewport.scrollY,
        zoom: viewport.zoom,
      })
      pendingScrollRef.current = {
        scrollX: viewport.scrollX,
        scrollY: viewport.scrollY,
        zoom: viewport.zoom,
      }
    }
    debugLog('api_ready', {
      appScrollX: viewport.scrollX,
      appScrollY: viewport.scrollY,
      appZoom: viewport.zoom,
      apiElements: excalidrawApi.getSceneElementsBlock().length,
      apiElementsIncludingDeleted: excalidrawApi.getSceneElementsIncludingDeletedBlock().length,
    })

    if (editable && sceneBounds) {
      const zoom = Number.isFinite(viewport.zoom) ? viewport.zoom : 0
      const zoomValid = zoom >= 0.02 && zoom <= 4
      const viewportWorldW = containerSize.width / Math.max(zoom, 0.001)
      const viewportWorldH = containerSize.height / Math.max(zoom, 0.001)
      const left = -viewport.scrollX
      const top = -viewport.scrollY
      const right = left + viewportWorldW
      const bottom = top + viewportWorldH
      const intersectsScene = right >= sceneBounds.minX
        && left <= sceneBounds.maxX
        && bottom >= sceneBounds.minY
        && top <= sceneBounds.maxY
      const viewportBounds = { left, top, right, bottom, viewportWorldW, viewportWorldH }
      const visibleCenterCount = countDrawableCentersInViewport(viewportBounds)
      const visibleAnchorCenterCount = countDrawableCentersInViewport(viewportBounds, { anchorsOnly: true })
      const visibleCenterThreshold = parsedScene && parsedScene.elements.length >= 1000 ? 10 : 1
      const sparseViewport = visibleCenterCount < visibleCenterThreshold
      const hasAnchorElements = sceneBounds.anchorCount > 0
      const missingAnchors = hasAnchorElements && visibleAnchorCenterCount === 0
      const shouldAutoCenter = !zoomValid || !intersectsScene || sparseViewport || missingAnchors
      autoCenterRequestedRef.current = shouldAutoCenter
      if (!shouldAutoCenter) {
        hasAutoCenteredRef.current = true
      }
      debugLog('viewport_validation', {
        zoom,
        zoomValid,
        intersectsScene,
        visibleCenterCount,
        visibleAnchorCenterCount,
        visibleCenterThreshold,
        sparseViewport,
        hasAnchorElements,
        missingAnchors,
        shouldAutoCenter,
        viewport: viewportBounds,
      })
      if (shouldAutoCenter) {
        scheduleAutoCenter('api_ready')
      }
    }

    const unsubscribe = editable
      ? null
      : excalidrawApi.onViewportChangeBlock((nextViewport) => {
        pendingScrollRef.current = nextViewport
        if (scrollFrameRef.current !== null) {
          return
        }

        scrollFrameRef.current = window.requestAnimationFrame(() => {
          scrollFrameRef.current = null
          setScrollState(pendingScrollRef.current)
        })
      })

    return () => {
      unsubscribe?.()
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current)
        scrollFrameRef.current = null
      }
    }
  }, [containerSize.height, containerSize.width, countDrawableCentersInViewport, debugLog, editable, excalidrawApi, parsedScene, sceneBounds, scheduleAutoCenter])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined
    const update = () => {
      const next = {
        width: Math.max(container.clientWidth, 1),
        height: Math.max(container.clientHeight, 1),
      }
      setContainerSize((prev) => {
        if (prev.width === next.width && prev.height === next.height) return prev
        return {
          width: next.width,
          height: next.height,
        }
      })
      debugLog('container_resize', next)
      if (editable && excalidrawApi && !hasAutoCenteredRef.current && autoCenterRequestedRef.current) {
        scheduleAutoCenter('resize')
      }
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(container)
    return () => ro.disconnect()
  }, [debugLog, editable, excalidrawApi, scheduleAutoCenter])

  if (!initialData) {
    debugLog('initial_data_missing')
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
          excalidrawAPI={(api: unknown) => setExcalidrawApi(createExcalidrawCanvasApiOrch(api))}
          initialData={initialData as any}
          viewModeEnabled={!editable}
          autoFocus={editable}
          handleKeyboardGlobally={editable}
          onChange={(elements: readonly unknown[], appState: unknown, files: unknown) => {
            onChangeLogCountRef.current += 1
            const typedAppState = (appState as Record<string, unknown>) ?? {}
            const typedFiles = (files as Record<string, unknown>) ?? {}
            if (onChangeLogCountRef.current <= 5 || onChangeLogCountRef.current % 100 === 0) {
              const zoom = (typedAppState.zoom as { value?: unknown } | undefined)?.value
              debugLog('on_change', {
                count: onChangeLogCountRef.current,
                elements: elements.length,
                files: Object.keys(typedFiles).length,
                zoom: typeof zoom === 'number' ? zoom : null,
                scrollX: typeof typedAppState.scrollX === 'number' ? typedAppState.scrollX : null,
                scrollY: typeof typedAppState.scrollY === 'number' ? typedAppState.scrollY : null,
              })
            }
            if (editable && excalidrawApi && !hasAutoCenteredRef.current && autoCenterRequestedRef.current && elements.length > 0) {
              scheduleAutoCenter('on_change', elements.length)
            }
            queueSceneChange({
              elements,
              appState: typedAppState,
              files: typedFiles,
            })
          }}
          UIOptions={uiOptions as any}
        />
      </Suspense>

      {editable && isLargeScene && (
        <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-lg border border-border/70 bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
          Large scene mode: {parsedScene?.elements.length ?? 0} elements · parse {Math.round(parseDurationMsRef.current)}ms · analyze {Math.round(sceneAnalysis.durationMs)}ms
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

              excalidrawApi.updateViewportBlock({
                scrollX: nextScrollX,
                scrollY: nextScrollY,
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
