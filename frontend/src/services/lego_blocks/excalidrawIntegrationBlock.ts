import type { ParsedExcalidrawScene } from './excalidrawFileBlock'

export interface ExcalidrawViewportStateBlock {
  scrollX: number
  scrollY: number
  zoom: number
}

export interface ExcalidrawCanvasApiBlock {
  getSceneElementsBlock(): readonly unknown[]
  getSceneElementsIncludingDeletedBlock(): readonly unknown[]
  getViewportStateBlock(): ExcalidrawViewportStateBlock
  updateViewportBlock(next: Partial<ExcalidrawViewportStateBlock>): void
  fitViewportToContentBlock(elements: readonly unknown[]): void
  onViewportChangeBlock(listener: (viewport: ExcalidrawViewportStateBlock) => void): (() => void) | null
}

interface RawExcalidrawApi {
  getSceneElements?: () => readonly unknown[]
  getSceneElementsIncludingDeleted?: () => readonly unknown[]
  getAppState?: () => Record<string, unknown>
  updateScene?: (scene: { appState?: Record<string, unknown> }) => void
  scrollToContent?: (
    elements: readonly unknown[],
    options: {
      fitToViewport: boolean
      viewportZoomFactor: number
      animate: boolean
      minZoom: number
      maxZoom: number
    },
  ) => void
  onScrollChange?: (
    listener: (scrollX: number, scrollY: number, zoom: { value: number }) => void,
  ) => (() => void) | undefined
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readZoomValue(zoom: unknown): number {
  if (typeof zoom === 'number' && Number.isFinite(zoom)) return zoom
  if (zoom && typeof zoom === 'object') {
    const candidate = (zoom as { value?: unknown }).value
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate
  }
  return 1
}

function readViewportState(api: RawExcalidrawApi): ExcalidrawViewportStateBlock {
  const appState = api.getAppState?.() ?? {}
  return {
    scrollX: numberOr(appState.scrollX, 0),
    scrollY: numberOr(appState.scrollY, 0),
    zoom: readZoomValue(appState.zoom),
  }
}

function isCompatibleRawApi(value: unknown): value is RawExcalidrawApi {
  if (!value || typeof value !== 'object') return false
  const api = value as RawExcalidrawApi
  return typeof api.getSceneElements === 'function'
    && typeof api.getSceneElementsIncludingDeleted === 'function'
    && typeof api.getAppState === 'function'
    && typeof api.updateScene === 'function'
    && typeof api.scrollToContent === 'function'
}

export function createExcalidrawCanvasApiBlock(rawApi: unknown): ExcalidrawCanvasApiBlock | null {
  if (!isCompatibleRawApi(rawApi)) return null

  return {
    getSceneElementsBlock: () => rawApi.getSceneElements?.() ?? [],
    getSceneElementsIncludingDeletedBlock: () => rawApi.getSceneElementsIncludingDeleted?.() ?? [],
    getViewportStateBlock: () => readViewportState(rawApi),
    updateViewportBlock: (next) => {
      const appState: Record<string, unknown> = {}
      if (typeof next.scrollX === 'number' && Number.isFinite(next.scrollX)) appState.scrollX = next.scrollX
      if (typeof next.scrollY === 'number' && Number.isFinite(next.scrollY)) appState.scrollY = next.scrollY
      if (typeof next.zoom === 'number' && Number.isFinite(next.zoom)) appState.zoom = { value: next.zoom }
      if (Object.keys(appState).length === 0) return
      rawApi.updateScene?.({ appState })
    },
    fitViewportToContentBlock: (elements) => {
      rawApi.scrollToContent?.(elements, {
        fitToViewport: true,
        viewportZoomFactor: 0.9,
        animate: false,
        minZoom: 0.1,
        maxZoom: 4,
      })
    },
    onViewportChangeBlock: (listener) => {
      if (typeof rawApi.onScrollChange !== 'function') return null
      return rawApi.onScrollChange((scrollX, scrollY, zoom) => {
        listener({
          scrollX: numberOr(scrollX, 0),
          scrollY: numberOr(scrollY, 0),
          zoom: readZoomValue(zoom),
        })
      }) ?? null
    },
  }
}

export function buildExcalidrawInitialDataBlock(
  scene: ParsedExcalidrawScene,
  editable: boolean,
): ParsedExcalidrawScene {
  const baseAppState = (scene.appState ?? {}) as Record<string, unknown>
  return {
    elements: [...scene.elements],
    appState: {
      ...baseAppState,
      viewModeEnabled: !editable,
    },
    files: { ...(scene.files ?? {}) },
  }
}

export function cloneExcalidrawSceneChangeBlock(
  elements: readonly unknown[],
  appState: Record<string, unknown>,
  files: Record<string, unknown>,
): ParsedExcalidrawScene {
  return {
    elements: [...elements],
    appState: { ...appState },
    files: { ...files },
  }
}
