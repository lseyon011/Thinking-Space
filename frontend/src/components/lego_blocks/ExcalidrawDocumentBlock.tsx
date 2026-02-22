import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useUILayoutBlock } from '@/components/lego_blocks/UILayoutBlock'
import type { ParsedExcalidrawScene } from '@/services/orchestrators/excalidrawSceneOrch'
import {
  parseExcalidrawSceneOrch,
} from '@/services/orchestrators/excalidrawSceneOrch'
import {
  buildExcalidrawInitialDataOrch,
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
  buildExcalidrawHighlighterAppStatePatchOrch,
  isExcalidrawHighlighterEnabledOrch,
  loadExcalidrawHighlighterPresetsOrch,
  matchExcalidrawHighlighterPresetOrch,
  type ExcalidrawHighlighterPresetBlock,
} from '@/services/orchestrators/excalidrawHighlighterOrch'
import {
  type SceneAnalysis,
  EMPTY_SCENE_ANALYSIS,
  LARGE_SCENE_ELEMENT_THRESHOLD,
  MINIMAP_MAX_RECTS,
  analyzeScene,
  computeMiniMapBounds,
  parseSceneWithCache,
  pushGlobalExcalidrawPerfEvent,
  readSceneElementRect,
} from '@/services/lego_blocks/excalidrawSceneAnalysisBlock'
import {
  COMPACT_VIEW_MIN_ZOOM,
  ENABLE_NATIVE_PENCIL_PRESSURE_BRIDGE,
  MINIMAP_UPDATE_INTERVAL_IOS_MS,
  MINIMAP_UPDATE_INTERVAL_LARGE_SCENE_IOS_MS,
  MINIMAP_UPDATE_INTERVAL_LARGE_SCENE_MS,
  MINIMAP_UPDATE_INTERVAL_MS,
  PENCIL_OPACITY_DELTA_THRESHOLD,
  PENCIL_STROKE_WIDTH_DELTA_THRESHOLD,
  PENCIL_STYLE_UPDATE_INTERVAL_MS,
  SCENE_CHANGE_EMIT_INTERVAL_IOS_MS,
  SCENE_CHANGE_EMIT_INTERVAL_LARGE_SCENE_IOS_MS,
  SCENE_CHANGE_EMIT_INTERVAL_LARGE_SCENE_MS,
  SCENE_CHANGE_EMIT_INTERVAL_MS,
  isObjectLike,
  nowMs,
  readActiveToolType,
  readCurrentOpacityFromAppState,
  readZoomFromAppState,
  resolveViewportWorldSize,
  scheduleDeferredWork,
} from '@/services/lego_blocks/excalidrawViewportBlock'
import ExcalidrawPenPaletteBlock from '@/components/lego_blocks/ExcalidrawPenPaletteBlock'
import ExcalidrawMiniMapBlock, { type MiniMapRect } from '@/components/lego_blocks/ExcalidrawMiniMapBlock'
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

export default function ExcalidrawDocumentBlock({
  content,
  editable = false,
  onSceneChange,
  className,
}: ExcalidrawDocumentBlockProps) {
  const { layout } = useUILayoutBlock()
  const isIosSurface = layout.surface === 'capacitor-ios'
  const isCompactLayout = layout.mode === 'phone'
  const debugEnabled = editable
    && (globalThis as { __ltmExcalidrawDebugEnabled?: unknown }).__ltmExcalidrawDebugEnabled === true
  const parseDurationMsRef = useRef(0)
  const parsedScene = useMemo(() => {
    const started = nowMs()
    const parsed = parseSceneWithCache(content, parseExcalidrawSceneOrch)
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
  const sceneChangeTimeoutRef = useRef<number | null>(null)
  const lastSceneChangeEmitAtRef = useRef(0)
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
  const lastPencilStyleRef = useRef<{ currentItemStrokeWidth: number; currentItemOpacity: number } | null>(null)
  const lastPencilStyleEmitAtRef = useRef(0)
  const pencilBridgeStopRef = useRef<(() => Promise<void>) | null>(null)
  const pencilAppStateFrameRef = useRef<number | null>(null)
  const pendingPencilAppStateRef = useRef<Record<string, unknown> | null>(null)
  const viewportSubscriptionActiveRef = useRef(false)
  const [miniMapElements, setMiniMapElements] = useState<readonly unknown[] | null>(null)
  const pendingMiniMapElementsRef = useRef<readonly unknown[] | null>(null)
  const miniMapElementsFrameRef = useRef<number | null>(null)
  const miniMapElementsTimeoutRef = useRef<number | null>(null)
  const lastMiniMapEmitAtRef = useRef(0)
  const [highlighterPresets, setHighlighterPresets] = useState<readonly ExcalidrawHighlighterPresetBlock[]>(
    EXCALIDRAW_HIGHLIGHTER_PRESETS_ORCH,
  )
  const [activeHighlighterPresetId, setActiveHighlighterPresetId] = useState<string | null>(null)
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState(2)

  // ---------------------------------------------------------------------------
  // Debug logging
  // ---------------------------------------------------------------------------

  const debugLog = useCallback((event: string, data: Record<string, unknown> = {}) => {
    if (!debugEnabled) return
    const payload = { event, data, ts: new Date().toISOString() }
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

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const initialData = useMemo(() => {
    if (!parsedScene) return null
    return buildExcalidrawInitialDataOrch(parsedScene, editable)
  }, [editable, parsedScene])
  const isLargeScene = (parsedScene?.elements.length ?? 0) >= LARGE_SCENE_ELEMENT_THRESHOLD

  // ---------------------------------------------------------------------------
  // MiniMap element queuing (throttled)
  // ---------------------------------------------------------------------------

  const queueMiniMapElements = useCallback((elements: readonly unknown[]) => {
    pendingMiniMapElementsRef.current = elements
    if (miniMapElementsFrameRef.current !== null || miniMapElementsTimeoutRef.current !== null) return

    const now = nowMs()
    const minInterval = isLargeScene
      ? (isIosSurface ? MINIMAP_UPDATE_INTERVAL_LARGE_SCENE_IOS_MS : MINIMAP_UPDATE_INTERVAL_LARGE_SCENE_MS)
      : (isIosSurface ? MINIMAP_UPDATE_INTERVAL_IOS_MS : MINIMAP_UPDATE_INTERVAL_MS)
    const elapsed = now - lastMiniMapEmitAtRef.current
    const delay = Math.max(0, minInterval - elapsed)

    miniMapElementsTimeoutRef.current = window.setTimeout(() => {
      miniMapElementsTimeoutRef.current = null
      miniMapElementsFrameRef.current = window.requestAnimationFrame(() => {
        miniMapElementsFrameRef.current = null
        const next = pendingMiniMapElementsRef.current
        pendingMiniMapElementsRef.current = null
        if (!next) return
        lastMiniMapEmitAtRef.current = nowMs()
        setMiniMapElements(prev => (prev === next ? prev : next))
      })
    }, delay)
  }, [isIosSurface, isLargeScene])

  // ---------------------------------------------------------------------------
  // Deferred scene analysis
  // ---------------------------------------------------------------------------

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
    return () => { cancelled = true; cancelDeferred() }
  }, [editable, parsedScene])

  const sceneBounds = sceneAnalysis.sceneBounds

  // ---------------------------------------------------------------------------
  // MiniMap derived data
  // ---------------------------------------------------------------------------

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
      if (miniMapElementsTimeoutRef.current !== null) {
        window.clearTimeout(miniMapElementsTimeoutRef.current)
        miniMapElementsTimeoutRef.current = null
      }
      return
    }
    setMiniMapElements(parsedScene?.elements ?? null)
  }, [editable, parsedScene])

  // ---------------------------------------------------------------------------
  // Performance event logging
  // ---------------------------------------------------------------------------

  useEffect(() => {
    pushGlobalExcalidrawPerfEvent({
      name: 'parse_scene',
      durationMs: parseDurationMsRef.current,
      elementCount: parsedScene?.elements.length ?? 0,
      ts: new Date().toISOString(),
      meta: { contentLength: content.length },
    })
    pushGlobalExcalidrawPerfEvent({
      name: 'analyze_scene',
      durationMs: sceneAnalysis.durationMs,
      elementCount: parsedScene?.elements.length ?? 0,
      ts: new Date().toISOString(),
      meta: { largeSceneMode: isLargeScene },
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

  // ---------------------------------------------------------------------------
  // MiniMap rects
  // ---------------------------------------------------------------------------

  const miniMapRects = useMemo<MiniMapRect[]>(() => {
    if (!miniMapBounds || elementsForMiniMap.length === 0) return []
    const rects: MiniMapRect[] = []
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
  const showMiniMap = miniMapBounds !== null && (!isCompactLayout || isIosSurface)

  // ---------------------------------------------------------------------------
  // UI options
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Highlighter preset management
  // ---------------------------------------------------------------------------

  const syncActiveHighlighterPresetFromAppState = useCallback((appState: Record<string, unknown>) => {
    if (!editable) {
      setActiveHighlighterPresetId(null)
      return
    }
    const nextPresetId = matchExcalidrawHighlighterPresetOrch(appState, highlighterPresets)
    setActiveHighlighterPresetId((prev) => (prev === nextPresetId ? prev : nextPresetId))
    const width = typeof appState.currentItemStrokeWidth === 'number'
      ? appState.currentItemStrokeWidth : 2
    setCurrentStrokeWidth((prev) => (prev === width ? prev : width))
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
    // Sync stroke width display from the applied preset or current state
    const nextWidth = preset.strokeWidth > 0
      ? preset.strokeWidth
      : (typeof appState.currentItemStrokeWidth === 'number' ? appState.currentItemStrokeWidth : 2)
    setCurrentStrokeWidth(nextWidth)
  }, [editable, excalidrawApi, highlighterPresets])

  const handleStrokeWidthChange = useCallback((width: number) => {
    if (!editable || !excalidrawApi) return
    excalidrawApi.updateAppStateBlock({ currentItemStrokeWidth: width })
    setCurrentStrokeWidth(width)
  }, [editable, excalidrawApi])

  // ---------------------------------------------------------------------------
  // Scene change queuing (throttled)
  // ---------------------------------------------------------------------------

  const queueSceneChange = useCallback((params: {
    elements: readonly unknown[]
    appState: Record<string, unknown>
    files: Record<string, unknown>
  }) => {
    if (!onSceneChange) return
    queuedSceneRef.current = params
    if (sceneChangeTimeoutRef.current !== null || sceneChangeFrameRef.current !== null) return

    const now = nowMs()
    const intervalMs = isLargeScene
      ? (isIosSurface ? SCENE_CHANGE_EMIT_INTERVAL_LARGE_SCENE_IOS_MS : SCENE_CHANGE_EMIT_INTERVAL_LARGE_SCENE_MS)
      : (isIosSurface ? SCENE_CHANGE_EMIT_INTERVAL_IOS_MS : SCENE_CHANGE_EMIT_INTERVAL_MS)
    const elapsed = now - lastSceneChangeEmitAtRef.current
    const delay = Math.max(0, intervalMs - elapsed)

    sceneChangeTimeoutRef.current = window.setTimeout(() => {
      sceneChangeTimeoutRef.current = null
      sceneChangeFrameRef.current = window.requestAnimationFrame(() => {
        sceneChangeFrameRef.current = null
        const queued = queuedSceneRef.current
        if (!queued) return
        const flushStarted = nowMs()
        try {
          onSceneChange({
            elements: Array.isArray(queued.elements) ? queued.elements as unknown[] : [],
            appState: queued.appState ?? {},
            files: queued.files ?? {},
          })
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
        lastSceneChangeEmitAtRef.current = nowMs()
      })
    }, delay)
  }, [debugLog, isIosSurface, isLargeScene, onSceneChange])

  // ---------------------------------------------------------------------------
  // Pencil pressure bridge
  // ---------------------------------------------------------------------------

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
      activeTool: { ...activeToolBase, type: nextType, customType: null, locked: false, fromSelection: false },
    })
    debugLog('pencil_double_tap', { currentType, nextType })
  }, [debugLog, editable, excalidrawApi])

  const handlePencilMetrics = useCallback((event: NativePencilMetricsEventOrch) => {
    if (!ENABLE_NATIVE_PENCIL_PRESSURE_BRIDGE) return
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
    const previousStyle = lastPencilStyleRef.current
    const now = nowMs()
    if (previousStyle) {
      const widthDelta = Math.abs(previousStyle.currentItemStrokeWidth - mapped.style.currentItemStrokeWidth)
      const opacityDelta = Math.abs(previousStyle.currentItemOpacity - mapped.style.currentItemOpacity)
      if (widthDelta < PENCIL_STROKE_WIDTH_DELTA_THRESHOLD && opacityDelta < PENCIL_OPACITY_DELTA_THRESHOLD) return
      if ((now - lastPencilStyleEmitAtRef.current) < PENCIL_STYLE_UPDATE_INTERVAL_MS) return
    }
    lastPencilStyleRef.current = mapped.style
    lastPencilStyleEmitAtRef.current = now
    queuePencilAppStatePatch({
      currentItemStrokeWidth: mapped.style.currentItemStrokeWidth,
      currentItemOpacity: mapped.style.currentItemOpacity,
    })
  }, [editable, excalidrawApi, queuePencilAppStatePatch])

  // ---------------------------------------------------------------------------
  // Viewport center counting
  // ---------------------------------------------------------------------------

  const countDrawableCentersInViewport = useCallback((viewport: {
    left: number; top: number; right: number; bottom: number
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

  // ---------------------------------------------------------------------------
  // Cleanup effect
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (sceneChangeFrameRef.current !== null) window.cancelAnimationFrame(sceneChangeFrameRef.current)
      if (sceneChangeTimeoutRef.current !== null) window.clearTimeout(sceneChangeTimeoutRef.current)
      if (autoCenterFrameRef.current !== null) window.cancelAnimationFrame(autoCenterFrameRef.current)
      if (pencilAppStateFrameRef.current !== null) window.cancelAnimationFrame(pencilAppStateFrameRef.current)
      if (miniMapElementsFrameRef.current !== null) window.cancelAnimationFrame(miniMapElementsFrameRef.current)
      if (miniMapElementsTimeoutRef.current !== null) window.clearTimeout(miniMapElementsTimeoutRef.current)
      sceneChangeFrameRef.current = null
      sceneChangeTimeoutRef.current = null
      autoCenterFrameRef.current = null
      pencilAppStateFrameRef.current = null
      miniMapElementsFrameRef.current = null
      miniMapElementsTimeoutRef.current = null
      const stopPencilBridge = pencilBridgeStopRef.current
      pencilBridgeStopRef.current = null
      if (stopPencilBridge) void stopPencilBridge()
      queuedSceneRef.current = null
      pendingPencilAppStateRef.current = null
      pendingMiniMapElementsRef.current = null
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Scene reset
  // ---------------------------------------------------------------------------

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
    lastSceneChangeEmitAtRef.current = 0
    lastMiniMapEmitAtRef.current = 0
    if (sceneChangeTimeoutRef.current !== null) {
      window.clearTimeout(sceneChangeTimeoutRef.current)
      sceneChangeTimeoutRef.current = null
    }
    if (miniMapElementsTimeoutRef.current !== null) {
      window.clearTimeout(miniMapElementsTimeoutRef.current)
      miniMapElementsTimeoutRef.current = null
    }
    pencilPressureStateRef.current = null
    lastPencilStyleRef.current = null
    lastPencilStyleEmitAtRef.current = 0
    pendingPencilAppStateRef.current = null
    setActiveHighlighterPresetId(null)
    debugLog('scene_reset', { editable, contentLength: content.length })
  }, [content, debugLog, editable])

  // ---------------------------------------------------------------------------
  // Highlighter preset loading
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false
    if (!editable) {
      setHighlighterPresets(EXCALIDRAW_HIGHLIGHTER_PRESETS_ORCH)
      return () => { cancelled = true }
    }
    void loadExcalidrawHighlighterPresetsOrch()
      .then((presets) => {
        if (cancelled) return
        debugLog('highlighter_presets_loaded', { source: 'vault_plugin_settings', count: presets.length })
        setHighlighterPresets(presets.length > 0 ? presets : EXCALIDRAW_HIGHLIGHTER_PRESETS_ORCH)
      })
      .catch(() => {
        if (cancelled) return
        debugLog('highlighter_presets_fallback', { source: 'builtin_defaults', reason: 'vault_plugin_settings_unavailable' })
        setHighlighterPresets(EXCALIDRAW_HIGHLIGHTER_PRESETS_ORCH)
      })
    return () => { cancelled = true }
  }, [debugLog, editable])

  // ---------------------------------------------------------------------------
  // Pencil bridge subscription
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!ENABLE_NATIVE_PENCIL_PRESSURE_BRIDGE) return undefined
    if (!editable || !excalidrawApi) return undefined
    let cancelled = false
    void subscribeNativePencilBridgeOrch({
      onMetrics: handlePencilMetrics,
      onDoubleTap: () => handlePencilDoubleTap(),
    })
      .then((subscription) => {
        if (!subscription) return
        if (cancelled) { void subscription.stop(); return }
        pencilBridgeStopRef.current = () => subscription.stop()
      })
      .catch((error) => {
        debugLog('pencil_bridge_subscription_error', { message: error instanceof Error ? error.message : String(error) })
      })
    return () => {
      cancelled = true
      pencilPressureStateRef.current = null
      const stopPencilBridge = pencilBridgeStopRef.current
      pencilBridgeStopRef.current = null
      if (stopPencilBridge) void stopPencilBridge()
    }
  }, [debugLog, editable, excalidrawApi, handlePencilDoubleTap, handlePencilMetrics])

  // ---------------------------------------------------------------------------
  // Auto-center
  // ---------------------------------------------------------------------------

  const tryAutoCenter = useCallback((source: string, hintedElementCount?: number) => {
    if (!editable || !excalidrawApi || hasAutoCenteredRef.current) return false
    if (!autoCenterRequestedRef.current) return false
    if (!parsedScene || parsedScene.elements.length === 0) return false

    autoCenterAttemptsRef.current += 1
    const attempt = autoCenterAttemptsRef.current
    const elements = excalidrawApi.getSceneElementsBlock()
    debugLog('auto_center_attempt', {
      source, attempt,
      hintedElementCount: hintedElementCount ?? null,
      apiElements: elements.length,
      parsedElements: parsedScene.elements.length,
      containerWidth: containerSize.width,
      containerHeight: containerSize.height,
    })

    if (elements.length === 0) {
      debugLog('auto_center_waiting_for_elements', { source, attempt })
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
        excalidrawApi.updateViewportBlock({
          scrollX: -centerX + viewportWorldW / 2,
          scrollY: -centerY + viewportWorldH / 2,
          zoom: targetZoom,
        })
        debugLog('auto_center_strategy', {
          strategy: sceneBounds.anchorCount > 0 ? 'anchor_median_preserve_zoom' : 'median_center_preserve_zoom',
          targetZoom, centerX, centerY, anchorCount: sceneBounds.anchorCount,
          nextScrollX: -centerX + viewportWorldW / 2,
          nextScrollY: -centerY + viewportWorldH / 2,
        })
      } else {
        excalidrawApi.fitViewportToContentBlock(elements)
        debugLog('auto_center_strategy', { strategy: 'scroll_to_content_fallback' })
      }
      const viewport = excalidrawApi.getViewportStateBlock()
      debugLog('auto_center_done', { source, attempt, appScrollX: viewport.scrollX, appScrollY: viewport.scrollY, appZoom: viewport.zoom })
      pushGlobalExcalidrawPerfEvent({
        name: 'auto_center', durationMs: nowMs() - autoCenterStarted,
        elementCount: parsedScene.elements.length, ts: new Date().toISOString(),
        meta: { source, attempt, success: true },
      })
      hasAutoCenteredRef.current = true
      autoCenterRequestedRef.current = false
      return true
    } catch (error) {
      debugLog('auto_center_error', { source, attempt, message: error instanceof Error ? error.message : String(error) })
      pushGlobalExcalidrawPerfEvent({
        name: 'auto_center', durationMs: nowMs() - autoCenterStarted,
        elementCount: parsedScene.elements.length, ts: new Date().toISOString(),
        meta: { source, attempt, success: false, message: error instanceof Error ? error.message : String(error) },
      })
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

  // ---------------------------------------------------------------------------
  // API ready + viewport tracking
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!excalidrawApi) return undefined

    const trackViewport = miniMapBounds !== null
    const viewport = excalidrawApi.getViewportStateBlock()
    if (editable) {
      syncActiveHighlighterPresetFromAppState(excalidrawApi.getAppStateBlock())
    }
    if (trackViewport) {
      setScrollState({ scrollX: viewport.scrollX, scrollY: viewport.scrollY, zoom: viewport.zoom })
      pendingScrollRef.current = { scrollX: viewport.scrollX, scrollY: viewport.scrollY, zoom: viewport.zoom }
    }
    debugLog('api_ready', {
      appScrollX: viewport.scrollX, appScrollY: viewport.scrollY, appZoom: viewport.zoom,
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
        const intersectsScene = right >= sceneBounds.minX && left <= sceneBounds.maxX && bottom >= sceneBounds.minY && top <= sceneBounds.maxY
        const viewportBounds = { left, top, right, bottom, viewportWorldW, viewportWorldH }
        const visibleCenterCount = countDrawableCentersInViewport(viewportBounds)
        const visibleAnchorCenterCount = countDrawableCentersInViewport(viewportBounds, { anchorsOnly: true })
        const visibleCenterThreshold = parsedScene && parsedScene.elements.length >= 1000 ? 10 : 1
        const sparseViewport = visibleCenterCount < visibleCenterThreshold
        const hasAnchorElements = sceneBounds.anchorCount > 0
        const missingAnchors = hasAnchorElements && visibleAnchorCenterCount === 0
        const shouldAutoCenter = !zoomValid || !intersectsScene || sparseViewport || missingAnchors
        autoCenterRequestedRef.current = shouldAutoCenter
        if (!shouldAutoCenter) hasAutoCenteredRef.current = true
        debugLog('viewport_validation', {
          zoom, zoomValid, intersectsScene, visibleCenterCount, visibleAnchorCenterCount,
          visibleCenterThreshold, sparseViewport, hasAnchorElements, missingAnchors,
          shouldAutoCenter, viewport: viewportBounds,
        })
        if (shouldAutoCenter) scheduleAutoCenter('api_ready')
      } else if (parsedScene && parsedScene.elements.length > 0) {
        autoCenterRequestedRef.current = true
        scheduleAutoCenter('api_ready_pending_analysis')
      }
    } else if (!hasAutoCenteredRef.current) {
      const elements = excalidrawApi.getSceneElementsBlock()
      if (elements.length > 0) {
        try {
          excalidrawApi.fitViewportToContentBlock(elements)
          hasAutoCenteredRef.current = true
        } catch {
          // Keep readonly rendering intact even if viewport fitting fails.
        }
      }
    }

    const unsubscribe = trackViewport
      ? excalidrawApi.onViewportChangeBlock((nextViewport) => {
        pendingScrollRef.current = nextViewport
        if (scrollFrameRef.current !== null) return
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
    containerSize.height, containerSize.width, countDrawableCentersInViewport,
    debugLog, editable, excalidrawApi, miniMapBounds, parsedScene,
    queueMiniMapElements, sceneBounds, scheduleAutoCenter, syncActiveHighlighterPresetFromAppState,
  ])

  // ---------------------------------------------------------------------------
  // Container resize
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined
    const update = () => {
      const next = { width: Math.max(container.clientWidth, 1), height: Math.max(container.clientHeight, 1) }
      setContainerSize((prev) => {
        if (prev.width === next.width && prev.height === next.height) return prev
        return next
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

  // ---------------------------------------------------------------------------
  // Compact view zoom fitting
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (editable || !isCompactLayout || !excalidrawApi) return
    if (containerSize.width <= 8 || containerSize.height <= 8) return
    const viewport = excalidrawApi.getViewportStateBlock()
    const currentZoom = Number.isFinite(viewport.zoom) ? Math.max(viewport.zoom, 0.01) : 1
    if (currentZoom >= COMPACT_VIEW_MIN_ZOOM) return

    const { viewportWorldW, viewportWorldH } = resolveViewportWorldSize({
      excalidrawApi, zoom: currentZoom,
      fallbackWidth: containerSize.width, fallbackHeight: containerSize.height,
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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

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

            // On iOS during active freedraw strokes: skip ALL work to eliminate lag.
            const isIosFreedraw = isIosSurface && readActiveToolType(typedAppState) === 'freedraw'
            const iosStrokeActive = isIosFreedraw
              && (isObjectLike(typedAppState.newElement) || isObjectLike(typedAppState.draggingElement))
            if (iosStrokeActive) return

            if (onChangeLogCountRef.current <= 5 || onChangeLogCountRef.current % 100 === 0) {
              const zoom = (typedAppState.zoom as { value?: unknown } | undefined)?.value
              debugLog('on_change', {
                count: onChangeLogCountRef.current, elements: elements.length,
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
                ? typedAppState.scrollX : null
              const scrollY = typeof typedAppState.scrollY === 'number' && Number.isFinite(typedAppState.scrollY)
                ? typedAppState.scrollY : null
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
            queueSceneChange({ elements, appState: typedAppState, files: typedFiles })
          }}
          UIOptions={uiOptions as any}
        />
      </Suspense>

      {editable && (
        <ExcalidrawPenPaletteBlock
          presets={highlighterPresets}
          activePresetId={activeHighlighterPresetId}
          onSelectPreset={applyHighlighterPreset}
          currentStrokeWidth={currentStrokeWidth}
          onStrokeWidthChange={handleStrokeWidthChange}
        />
      )}

      {editable && isLargeScene && !isIosSurface && (
        <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-lg border border-border/70 bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
          Large scene mode: {parsedScene?.elements.length ?? 0} elements · parse {Math.round(parseDurationMsRef.current)}ms · analyze {Math.round(sceneAnalysis.durationMs)}ms
        </div>
      )}

      {showMiniMap && miniMapBounds && (
        <ExcalidrawMiniMapBlock
          bounds={miniMapBounds}
          rects={miniMapRects}
          scrollState={scrollState}
          excalidrawApi={excalidrawApi}
          containerSize={containerSize}
          isIosSurface={isIosSurface}
        />
      )}
    </div>
  )
}
