import type { ExcalidrawCanvasApiBlock } from '@/services/lego_blocks/integrations/excalidrawIntegrationBlock'

// ---------------------------------------------------------------------------
// Timing constants
// ---------------------------------------------------------------------------

export const SCENE_CHANGE_EMIT_INTERVAL_MS = 320
export const SCENE_CHANGE_EMIT_INTERVAL_IOS_MS = 500
export const SCENE_CHANGE_EMIT_INTERVAL_LARGE_SCENE_MS = 640
export const SCENE_CHANGE_EMIT_INTERVAL_LARGE_SCENE_IOS_MS = 900
export const MINIMAP_UPDATE_INTERVAL_MS = 240
export const MINIMAP_UPDATE_INTERVAL_LARGE_SCENE_MS = 420
export const MINIMAP_UPDATE_INTERVAL_IOS_MS = 360
export const MINIMAP_UPDATE_INTERVAL_LARGE_SCENE_IOS_MS = 760
export const PENCIL_STYLE_UPDATE_INTERVAL_MS = 40
export const PENCIL_STROKE_WIDTH_DELTA_THRESHOLD = 0.14
export const PENCIL_OPACITY_DELTA_THRESHOLD = 2
export const COMPACT_VIEW_MIN_ZOOM = 0.22
export const VIEW_ANALYSIS_TIMEOUT_MS = 180
export const ENABLE_NATIVE_PENCIL_PRESSURE_BRIDGE = false

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

export function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

export function isObjectLike(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

export function scheduleDeferredWork(callback: () => void): () => void {
  if (typeof window !== 'undefined' && typeof (window as any).requestIdleCallback === 'function') {
    const idleId = (window as any).requestIdleCallback(() => callback(), { timeout: VIEW_ANALYSIS_TIMEOUT_MS })
    return () => (window as any).cancelIdleCallback?.(idleId)
  }

  const timeoutId = window.setTimeout(callback, 16)
  return () => window.clearTimeout(timeoutId)
}

// ---------------------------------------------------------------------------
// AppState readers
// ---------------------------------------------------------------------------

export function readActiveToolType(appState: Record<string, unknown>): string | null {
  const activeTool = appState.activeTool
  if (!activeTool || typeof activeTool !== 'object') return null
  const type = (activeTool as { type?: unknown }).type
  return typeof type === 'string' ? type : null
}

export function readZoomFromAppState(appState: Record<string, unknown>): number | null {
  const zoomValue = (appState.zoom as { value?: unknown } | undefined)?.value
  if (typeof zoomValue === 'number' && Number.isFinite(zoomValue)) return zoomValue
  if (typeof appState.zoom === 'number' && Number.isFinite(appState.zoom)) return appState.zoom
  return null
}

export function readCurrentOpacityFromAppState(appState: Record<string, unknown>): number {
  const raw = appState.currentItemOpacity
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 100
  return Math.min(100, Math.max(1, Math.round(raw)))
}

// ---------------------------------------------------------------------------
// Viewport math
// ---------------------------------------------------------------------------

export function resolveViewportWorldSize(params: {
  excalidrawApi: ExcalidrawCanvasApiBlock | null
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
