import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useUILayoutBlock } from '@/components/lego_blocks/UILayoutBlock'
import type { ParsedExcalidrawScene } from '@/services/orchestrators/excalidrawSceneOrch'
import {
  parseExcalidrawSceneOrch,
} from '@/services/orchestrators/excalidrawSceneOrch'
import {
  buildExcalidrawInitialDataOrch,
  cloneExcalidrawSceneChangeOrch,
  createExcalidrawCanvasApiOrch,
  type ExcalidrawCanvasApiOrch,
} from '@/services/orchestrators/excalidrawIntegrationOrch'
import {
  mapPencilPressureToStrokeStyleOrch,
  nextPencilToolTypeOrch,
  subscribeNativePencilBridgeOrch,
  type NativePencilMetricsEventOrch,
  type PencilPressureStateOrch,
} from '@/services/orchestrators/pencilBridgeOrch'
import {
  EXCALIDRAW_HIGHLIGHTER_PRESETS_ORCH,
  buildExcalidrawDisableHighlighterAppStatePatchOrch,
  buildExcalidrawHighlighterAppStatePatchOrch,
  isExcalidrawHighlighterEnabledOrch,
  loadExcalidrawHighlighterPresetsOrch,
  matchExcalidrawHighlighterPresetOrch,
  type ExcalidrawHighlighterPresetBlock,
} from '@/services/orchestrators/excalidrawHighlighterOrch'
import { cn } from '@/lib/utils'

declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string | string[]
  }
}

function ensureExcalidrawAssetPath(): void {
  if (typeof window === 'undefined') return
  if (window.EXCALIDRAW_ASSET_PATH != null) return
  window.EXCALIDRAW_ASSET_PATH = import.meta.env.BASE_URL || '/'
}

const ExcalidrawCanvas = lazy(async () => {
  ensureExcalidrawAssetPath()
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

interface MiniMapBounds {
  minX: number
  minY: number
  width: number
  height: number
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
const VIEW_ANALYSIS_TIMEOUT_MS = 180
const PARSED_SCENE_CACHE_MAX_ENTRIES = 4
const MINIMAP_MAX_RECTS = 400
const COMPACT_VIEW_MIN_ZOOM = 0.22

const EMPTY_SCENE_ANALYSIS: SceneAnalysis = {
  sceneBounds: null,
  drawableCenters: [],
  durationMs: 0,
}

const parsedSceneCache = new Map<string, ParsedExcalidrawScene | null>()

interface SceneElementRect {
  left: number
  top: number
  width: number
  height: number
  centerX: number
  centerY: number
  type: string
}

function readActiveToolType(appState: Record<string, unknown>): string | null {
  const activeTool = appState.activeTool
  if (!activeTool || typeof activeTool !== 'object') return null
  const type = (activeTool as { type?: unknown }).type
  return typeof type === 'string' ? type : null
}

function readZoomFromAppState(appState: Record<string, unknown>): number | null {
  const zoomValue = (appState.zoom as { value?: unknown } | undefined)?.value
  if (typeof zoomValue === 'number' && Number.isFinite(zoomValue)) return zoomValue
  if (typeof appState.zoom === 'number' && Number.isFinite(appState.zoom)) return appState.zoom
  return null
}

function readCurrentOpacityFromAppState(appState: Record<string, unknown>): number {
  const raw = appState.currentItemOpacity
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 100
  return Math.min(100, Math.max(1, Math.round(raw)))
}

function resolveViewportWorldSize(params: {
  excalidrawApi: ExcalidrawCanvasApiOrch | null
  zoom: number
  fallbackWidth: number
  fallbackHeight: number
}): { viewportWorldW: number; viewportWorldH: number } {
  const { excalidrawApi, zoom, fallbackWidth, fallbackHeight } = params
  const safeZoom = Math.max(zoom, 0.01)
  const appState = excalidrawApi?.getAppStateBlock?.() ?? {}
  const width = typeof appState.width === 'number' && Number.isFinite(appState.width) && appState.width > 0
    ? appState.width
    : fallbackWidth
  const height = typeof appState.height === 'number' && Number.isFinite(appState.height) && appState.height > 0
    ? appState.height
    : fallbackHeight
  return {
    viewportWorldW: width / safeZoom,
    viewportWorldH: height / safeZoom,
  }
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function scheduleDeferredWork(callback: () => void): () => void {
  if (typeof window !== 'undefined' && typeof (window as any).requestIdleCallback === 'function') {
    const idleId = (window as any).requestIdleCallback(() => callback(), { timeout: VIEW_ANALYSIS_TIMEOUT_MS })
    return () => (window as any).cancelIdleCallback?.(idleId)
  }

  const timeoutId = window.setTimeout(callback, 16)
  return () => window.clearTimeout(timeoutId)
}

function parseSceneWithCache(content: string): ParsedExcalidrawScene | null {
  const cached = parsedSceneCache.get(content)
  if (cached !== undefined) return cached

  const parsed = parseExcalidrawSceneOrch(content)
  parsedSceneCache.set(content, parsed)
  if (parsedSceneCache.size > PARSED_SCENE_CACHE_MAX_ENTRIES) {
    const oldestKey = parsedSceneCache.keys().next().value
    if (typeof oldestKey === 'string') {
      parsedSceneCache.delete(oldestKey)
    }
  }
  return parsed
}

function readSceneElementRect(item: unknown): SceneElementRect | null {
  if (!item || typeof item !== 'object') return null
  const element = item as Record<string, unknown>
  if (element.isDeleted === true) return null

  const x = Number(element.x)
  const y = Number(element.y)
  const widthRaw = Number(element.width)
  const heightRaw = Number(element.height)
  const type = typeof element.type === 'string' ? element.type : ''
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(widthRaw) || !Number.isFinite(heightRaw)) {
    return null
  }

  const x2 = x + widthRaw
  const y2 = y + heightRaw
  const left = Math.min(x, x2)
  const right = Math.max(x, x2)
  const top = Math.min(y, y2)
  const bottom = Math.max(y, y2)
  const width = Math.max(right - left, 1)
  const height = Math.max(bottom - top, 1)

  return {
    left,
    top,
    width,
    height,
    centerX: left + width / 2,
    centerY: top + height / 2,
    type,
  }
}

function computeMiniMapBounds(elements: readonly unknown[]): MiniMapBounds | null {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let found = false

  for (const item of elements) {
    const rect = readSceneElementRect(item)
    if (!rect) continue
    minX = Math.min(minX, rect.left)
    minY = Math.min(minY, rect.top)
    maxX = Math.max(maxX, rect.left + rect.width)
    maxY = Math.max(maxY, rect.top + rect.height)
    found = true
  }

  if (!found) return null
  return {
    minX,
    minY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  }
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

function analyzeScene(parsedScene: ParsedExcalidrawScene | null): SceneAnalysis {
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
    const rect = readSceneElementRect(item)
    if (!rect) continue
    minX = Math.min(minX, rect.left)
    minY = Math.min(minY, rect.top)
    maxX = Math.max(maxX, rect.left + rect.width)
    maxY = Math.max(maxY, rect.top + rect.height)
    const cx = rect.centerX
    const cy = rect.centerY
    centerCount += 1
    centerSumX += cx
    centerSumY += cy
    drawableCenters.push({
      x: cx,
      y: cy,
      isAnchor: rect.type !== 'freedraw',
    })
    if (centerCount <= MEDIAN_SORT_THRESHOLD) {
      centersX.push(cx)
      centersY.push(cy)
    }
    if (rect.type !== 'freedraw') {
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
}

export default function ExcalidrawDocumentBlock({
  content,
  editable = false,
  onSceneChange,
  className,
}: ExcalidrawDocumentBlockProps) {
  const { layout } = useUILayoutBlock()
  const isCompactLayout = layout.mode !== 'desktop'
  const debugEnabled = editable
    && (globalThis as { __ltmExcalidrawDebugEnabled?: unknown }).__ltmExcalidrawDebugEnabled === true
  const parseDurationMsRef = useRef(0)
  const parsedScene = useMemo(() => {
    const started = nowMs()
    const parsed = parseSceneWithCache(content)
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
  const pencilPressureStateRef = useRef<PencilPressureStateOrch | null>(null)
  const pencilBridgeStopRef = useRef<(() => Promise<void>) | null>(null)
  const pencilAppStateFrameRef = useRef<number | null>(null)
  const pendingPencilAppStateRef = useRef<Record<string, unknown> | null>(null)
  const viewportSubscriptionActiveRef = useRef(false)
  const [miniMapElements, setMiniMapElements] = useState<readonly unknown[] | null>(null)
  const pendingMiniMapElementsRef = useRef<readonly unknown[] | null>(null)
  const miniMapElementsFrameRef = useRef<number | null>(null)
  const [highlighterPresets, setHighlighterPresets] = useState<readonly ExcalidrawHighlighterPresetBlock[]>(
    EXCALIDRAW_HIGHLIGHTER_PRESETS_ORCH,
  )
  const [activeHighlighterPresetId, setActiveHighlighterPresetId] = useState<string | null>(null)

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

  const queueMiniMapElements = useCallback((elements: readonly unknown[]) => {
    pendingMiniMapElementsRef.current = elements
    if (miniMapElementsFrameRef.current !== null) return
    miniMapElementsFrameRef.current = window.requestAnimationFrame(() => {
      miniMapElementsFrameRef.current = null
      const next = pendingMiniMapElementsRef.current
      pendingMiniMapElementsRef.current = null
      if (!next) return
      setMiniMapElements(prev => (prev === next ? prev : next))
    })
  }, [])

  const [deferredSceneAnalysis, setDeferredSceneAnalysis] = useState<SceneAnalysis>(EMPTY_SCENE_ANALYSIS)
  const sceneAnalysis = deferredSceneAnalysis

  useEffect(() => {
    if (!parsedScene || parsedScene.elements.length === 0) {
      setDeferredSceneAnalysis(EMPTY_SCENE_ANALYSIS)
      return
    }

    let cancelled = false
    setDeferredSceneAnalysis(EMPTY_SCENE_ANALYSIS)
    const cancelDeferred = scheduleDeferredWork(() => {
      if (cancelled) return
      setDeferredSceneAnalysis(analyzeScene(parsedScene))
    })

    return () => {
      cancelled = true
      cancelDeferred()
    }
  }, [editable, parsedScene])

  const sceneBounds = sceneAnalysis.sceneBounds
  const isLargeScene = (parsedScene?.elements.length ?? 0) >= LARGE_SCENE_ELEMENT_THRESHOLD
  const elementsForMiniMap = useMemo<readonly unknown[]>(() => {
    if (editable) return miniMapElements ?? parsedScene?.elements ?? []
    return parsedScene?.elements ?? []
  }, [editable, miniMapElements, parsedScene?.elements])
  const miniMapBounds = useMemo(() => computeMiniMapBounds(elementsForMiniMap), [elementsForMiniMap])

  useEffect(() => {
    if (!editable) {
      setMiniMapElements(null)
      pendingMiniMapElementsRef.current = null
      if (miniMapElementsFrameRef.current !== null) {
        window.cancelAnimationFrame(miniMapElementsFrameRef.current)
        miniMapElementsFrameRef.current = null
      }
      return
    }
    setMiniMapElements(parsedScene?.elements ?? null)
  }, [editable, parsedScene])

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
    if (!miniMapBounds || elementsForMiniMap.length === 0) return []

    const rects: Array<{ x: number; y: number; width: number; height: number; key: string }> = []
    const step = Math.max(1, Math.ceil(elementsForMiniMap.length / MINIMAP_MAX_RECTS))

    for (let index = 0; index < elementsForMiniMap.length; index += step) {
      const rect = readSceneElementRect(elementsForMiniMap[index])
      if (!rect) continue

      rects.push({
        key: `nav-${index}`,
        x: ((rect.left - miniMapBounds.minX) / miniMapBounds.width) * 100,
        y: ((rect.top - miniMapBounds.minY) / miniMapBounds.height) * 72,
        width: Math.max((rect.width / miniMapBounds.width) * 100, 0.5),
        height: Math.max((rect.height / miniMapBounds.height) * 72, 0.5),
      })
    }

    return rects
  }, [elementsForMiniMap, miniMapBounds])

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

  const syncActiveHighlighterPresetFromAppState = useCallback((appState: Record<string, unknown>) => {
    if (!editable) {
      setActiveHighlighterPresetId(null)
      return
    }
    const nextPresetId = matchExcalidrawHighlighterPresetOrch(appState, highlighterPresets)
    setActiveHighlighterPresetId((prev) => (prev === nextPresetId ? prev : nextPresetId))
  }, [editable, highlighterPresets])

  const applyHighlighterPreset = useCallback((presetId: string) => {
    if (!editable || !excalidrawApi) return
    const preset = highlighterPresets.find((item) => item.id === presetId)
    if (!preset) return
    const appState = excalidrawApi.getAppStateBlock()
    excalidrawApi.updateAppStateBlock(
      buildExcalidrawHighlighterAppStatePatchOrch(preset, appState),
    )
    setActiveHighlighterPresetId(preset.id)
  }, [editable, excalidrawApi, highlighterPresets])

  const disableHighlighter = useCallback(() => {
    if (!editable || !excalidrawApi) return
    const appState = excalidrawApi.getAppStateBlock()
    excalidrawApi.updateAppStateBlock(
      buildExcalidrawDisableHighlighterAppStatePatchOrch(appState),
    )
    setActiveHighlighterPresetId(null)
  }, [editable, excalidrawApi])

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
      try {
        onSceneChange(cloneExcalidrawSceneChangeOrch(
          queued.elements,
          queued.appState,
          queued.files,
        ))
      } catch (error) {
        debugLog('scene_change_flush_error', {
          message: error instanceof Error ? error.message : String(error),
        })
        return
      }
      pushGlobalExcalidrawPerfEvent({
        name: 'scene_change_flush',
        durationMs: nowMs() - flushStarted,
        elementCount: queued.elements.length,
        ts: new Date().toISOString(),
      })
    })
  }, [onSceneChange])

  const queuePencilAppStatePatch = useCallback((appState: Record<string, unknown>) => {
    if (!excalidrawApi) return
    pendingPencilAppStateRef.current = appState
    if (pencilAppStateFrameRef.current !== null) return

    pencilAppStateFrameRef.current = window.requestAnimationFrame(() => {
      pencilAppStateFrameRef.current = null
      const pending = pendingPencilAppStateRef.current
      if (!pending || !excalidrawApi) return
      pendingPencilAppStateRef.current = null
      excalidrawApi.updateAppStateBlock(pending)
    })
  }, [excalidrawApi])

  const handlePencilDoubleTap = useCallback(() => {
    if (!editable || !excalidrawApi) return
    const appState = excalidrawApi.getAppStateBlock()
    const currentType = readActiveToolType(appState)
    const nextType = nextPencilToolTypeOrch(currentType)
    const activeToolRaw = appState.activeTool
    const activeToolBase = activeToolRaw && typeof activeToolRaw === 'object'
      ? activeToolRaw as Record<string, unknown>
      : {}
    excalidrawApi.updateAppStateBlock({
      activeTool: {
        ...activeToolBase,
        type: nextType,
        customType: null,
        locked: false,
        fromSelection: false,
      },
    })
    debugLog('pencil_double_tap', {
      currentType,
      nextType,
    })
  }, [debugLog, editable, excalidrawApi])

  const handlePencilMetrics = useCallback((event: NativePencilMetricsEventOrch) => {
    if (!editable || !excalidrawApi) return
    const appState = excalidrawApi.getAppStateBlock()
    if (readActiveToolType(appState) !== 'freedraw') return
    if (isExcalidrawHighlighterEnabledOrch(appState)) return
    const currentOpacity = readCurrentOpacityFromAppState(appState)
    const mapped = mapPencilPressureToStrokeStyleOrch(event, pencilPressureStateRef.current, {
      minOpacity: currentOpacity,
      maxOpacity: currentOpacity,
    })
    pencilPressureStateRef.current = mapped.state
    if (!mapped.style) return
    queuePencilAppStatePatch({
      currentItemStrokeWidth: mapped.style.currentItemStrokeWidth,
      currentItemOpacity: mapped.style.currentItemOpacity,
    })
  }, [editable, excalidrawApi, queuePencilAppStatePatch])

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
      if (pencilAppStateFrameRef.current !== null) {
        window.cancelAnimationFrame(pencilAppStateFrameRef.current)
        pencilAppStateFrameRef.current = null
      }
      if (miniMapElementsFrameRef.current !== null) {
        window.cancelAnimationFrame(miniMapElementsFrameRef.current)
        miniMapElementsFrameRef.current = null
      }
      const stopPencilBridge = pencilBridgeStopRef.current
      pencilBridgeStopRef.current = null
      if (stopPencilBridge) {
        void stopPencilBridge()
      }
      queuedSceneRef.current = null
      pendingPencilAppStateRef.current = null
      pendingMiniMapElementsRef.current = null
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
    pencilPressureStateRef.current = null
    pendingPencilAppStateRef.current = null
    setActiveHighlighterPresetId(null)
    debugLog('scene_reset', { editable, contentLength: content.length })
  }, [content, debugLog, editable])

  useEffect(() => {
    let cancelled = false
    if (!editable) {
      setHighlighterPresets(EXCALIDRAW_HIGHLIGHTER_PRESETS_ORCH)
      return () => {
        cancelled = true
      }
    }

    void loadExcalidrawHighlighterPresetsOrch()
      .then((presets) => {
        if (cancelled) return
        setHighlighterPresets(
          presets.length > 0 ? presets : EXCALIDRAW_HIGHLIGHTER_PRESETS_ORCH,
        )
      })
      .catch(() => {
        if (cancelled) return
        setHighlighterPresets(EXCALIDRAW_HIGHLIGHTER_PRESETS_ORCH)
      })

    return () => {
      cancelled = true
    }
  }, [editable])

  useEffect(() => {
    if (!editable || !excalidrawApi) return undefined
    let cancelled = false
    void subscribeNativePencilBridgeOrch({
      onMetrics: handlePencilMetrics,
      onDoubleTap: () => handlePencilDoubleTap(),
    })
      .then((subscription) => {
        if (!subscription) return
        if (cancelled) {
          void subscription.stop()
          return
        }
        pencilBridgeStopRef.current = () => subscription.stop()
      })
      .catch((error) => {
        debugLog('pencil_bridge_subscription_error', {
          message: error instanceof Error ? error.message : String(error),
        })
      })

    return () => {
      cancelled = true
      pencilPressureStateRef.current = null
      const stopPencilBridge = pencilBridgeStopRef.current
      pencilBridgeStopRef.current = null
      if (stopPencilBridge) {
        void stopPencilBridge()
      }
    }
  }, [debugLog, editable, excalidrawApi, handlePencilDoubleTap, handlePencilMetrics])

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

    const trackViewport = miniMapBounds !== null
    const viewport = excalidrawApi.getViewportStateBlock()
    if (editable) {
      syncActiveHighlighterPresetFromAppState(excalidrawApi.getAppStateBlock())
    }
    if (trackViewport) {
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

    if (editable) {
      queueMiniMapElements(excalidrawApi.getSceneElementsBlock())
      if (sceneBounds) {
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
      } else if (parsedScene && parsedScene.elements.length > 0) {
        autoCenterRequestedRef.current = true
        scheduleAutoCenter('api_ready_pending_analysis')
      }
    }

    const unsubscribe = trackViewport
      ? excalidrawApi.onViewportChangeBlock((nextViewport) => {
        pendingScrollRef.current = nextViewport
        if (scrollFrameRef.current !== null) {
          return
        }

        scrollFrameRef.current = window.requestAnimationFrame(() => {
          scrollFrameRef.current = null
          setScrollState(pendingScrollRef.current)
        })
      })
      : null
    viewportSubscriptionActiveRef.current = unsubscribe !== null

    return () => {
      viewportSubscriptionActiveRef.current = false
      unsubscribe?.()
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current)
        scrollFrameRef.current = null
      }
    }
  }, [
    containerSize.height,
    containerSize.width,
    countDrawableCentersInViewport,
    debugLog,
    editable,
    excalidrawApi,
    miniMapBounds,
    parsedScene,
    queueMiniMapElements,
    sceneBounds,
    scheduleAutoCenter,
    syncActiveHighlighterPresetFromAppState,
  ])

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

  useEffect(() => {
    if (editable || !isCompactLayout || !excalidrawApi) return
    if (containerSize.width <= 8 || containerSize.height <= 8) return
    const viewport = excalidrawApi.getViewportStateBlock()
    const currentZoom = Number.isFinite(viewport.zoom) ? Math.max(viewport.zoom, 0.01) : 1
    if (currentZoom >= COMPACT_VIEW_MIN_ZOOM) return

    const { viewportWorldW, viewportWorldH } = resolveViewportWorldSize({
      excalidrawApi,
      zoom: currentZoom,
      fallbackWidth: containerSize.width,
      fallbackHeight: containerSize.height,
    })
    const centerX = -viewport.scrollX + viewportWorldW / 2
    const centerY = -viewport.scrollY + viewportWorldH / 2
    const targetWorldW = containerSize.width / COMPACT_VIEW_MIN_ZOOM
    const targetWorldH = containerSize.height / COMPACT_VIEW_MIN_ZOOM

    excalidrawApi.updateViewportBlock({
      zoom: COMPACT_VIEW_MIN_ZOOM,
      scrollX: -centerX + targetWorldW / 2,
      scrollY: -centerY + targetWorldH / 2,
    })
  }, [containerSize.height, containerSize.width, editable, excalidrawApi, isCompactLayout])

  if (!initialData) {
    debugLog('initial_data_missing')
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Could not parse Excalidraw scene from this file. Keep editing in markdown or open it in Obsidian.
      </div>
    )
  }

  return (
    <div ref={containerRef} className={cn('relative h-full min-h-0 overflow-hidden', className)}>
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
            if (editable) {
              syncActiveHighlighterPresetFromAppState(typedAppState)
            }
            if (editable && miniMapBounds && !viewportSubscriptionActiveRef.current) {
              const zoom = readZoomFromAppState(typedAppState)
              const scrollX = typeof typedAppState.scrollX === 'number' && Number.isFinite(typedAppState.scrollX)
                ? typedAppState.scrollX
                : null
              const scrollY = typeof typedAppState.scrollY === 'number' && Number.isFinite(typedAppState.scrollY)
                ? typedAppState.scrollY
                : null
              if (zoom !== null && scrollX !== null && scrollY !== null) {
                pendingScrollRef.current = { scrollX, scrollY, zoom }
                if (scrollFrameRef.current === null) {
                  scrollFrameRef.current = window.requestAnimationFrame(() => {
                    scrollFrameRef.current = null
                    setScrollState(pendingScrollRef.current)
                  })
                }
              }
            }
            if (editable) {
              queueMiniMapElements(elements)
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

      {editable && (
        <div className="pointer-events-none absolute right-3 top-3 z-30 flex max-w-[min(36rem,calc(100%-1.5rem))] flex-wrap items-center justify-end gap-1 rounded-lg border border-border/70 bg-background/90 px-2 py-1 shadow-sm backdrop-blur">
          <span className="hidden pr-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground sm:inline">
            Highlighter
          </span>
          <button
            type="button"
            onClick={disableHighlighter}
            className={cn(
              'pointer-events-auto rounded-md border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.08em] transition-colors',
              activeHighlighterPresetId === null
                ? 'border-primary/70 bg-primary/15 text-foreground'
                : 'border-border/70 bg-background text-muted-foreground hover:bg-muted',
            )}
            title="Switch to standard ink"
          >
            Ink
          </button>
          {highlighterPresets.map((preset) => {
            const isActive = activeHighlighterPresetId === preset.id
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyHighlighterPreset(preset.id)}
                className={cn(
                  'pointer-events-auto inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] transition-colors',
                  isActive
                    ? 'border-primary/70 bg-primary/15 text-foreground'
                    : 'border-border/70 bg-background text-muted-foreground hover:bg-muted',
                )}
                title={`Highlighter: ${preset.label}`}
                aria-label={`Use ${preset.label} highlighter`}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm border border-border/50"
                  style={{ backgroundColor: preset.backgroundColor }}
                />
                <span className="hidden sm:inline">{preset.label}</span>
              </button>
            )
          })}
          {activeHighlighterPresetId === 'custom' && (
            <span className="rounded-md border border-border/60 bg-background px-1.5 py-1 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              Custom
            </span>
          )}
        </div>
      )}

      {editable && isLargeScene && (
        <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-lg border border-border/70 bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
          Large scene mode: {parsedScene?.elements.length ?? 0} elements · parse {Math.round(parseDurationMsRef.current)}ms · analyze {Math.round(sceneAnalysis.durationMs)}ms
        </div>
      )}

      {miniMapBounds && !isCompactLayout && (
        <button
          type="button"
          className="fixed bottom-4 right-4 z-30 rounded-lg border border-border/70 bg-background/90 p-1 shadow-sm backdrop-blur"
          title="Mini map"
        >
          <svg
            data-navmap-track
            viewBox="0 0 100 72"
            className="h-16 w-24"
            onClick={(event) => {
              event.stopPropagation()
              if (!miniMapBounds || !excalidrawApi) return
              const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect()
              const px = (event.clientX - rect.left) / Math.max(rect.width, 1)
              const py = (event.clientY - rect.top) / Math.max(rect.height, 1)

              const worldX = miniMapBounds.minX + px * miniMapBounds.width
              const worldY = miniMapBounds.minY + py * miniMapBounds.height

              const zoom = Math.max(excalidrawApi.getViewportStateBlock().zoom, 0.01)
              const { viewportWorldW, viewportWorldH } = resolveViewportWorldSize({
                excalidrawApi,
                zoom,
                fallbackWidth: containerSize.width,
                fallbackHeight: containerSize.height,
              })
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
              const { viewportWorldW, viewportWorldH } = resolveViewportWorldSize({
                excalidrawApi,
                zoom,
                fallbackWidth: containerSize.width,
                fallbackHeight: containerSize.height,
              })
              const vx = ((leftWorld - miniMapBounds.minX) / miniMapBounds.width) * 100
              const vy = ((topWorld - miniMapBounds.minY) / miniMapBounds.height) * 72
              const vw = (viewportWorldW / miniMapBounds.width) * 100
              const vh = (viewportWorldH / miniMapBounds.height) * 72
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
