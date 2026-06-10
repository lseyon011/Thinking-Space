import { describe, expect, it, vi } from 'vitest'
import {
  buildExcalidrawInitialDataBlock,
  cloneExcalidrawSceneChangeBlock,
  createExcalidrawCanvasApiBlock,
} from '../src/services/lego_blocks/integrations/excalidrawIntegrationBlock'

describe('excalidrawIntegrationBlock', () => {
  it('returns null for incompatible vendor api objects', () => {
    expect(createExcalidrawCanvasApiBlock(null)).toBeNull()
    expect(createExcalidrawCanvasApiBlock({})).toBeNull()
  })

  it('adapts vendor viewport methods behind local contract', () => {
    const scrollToContent = vi.fn()
    const unsubscribe = vi.fn()
    const onScrollChange = vi.fn((listener: (x: number, y: number, zoom: { value: number }) => void) => {
      listener(4, 5, { value: 0.75 })
      return unsubscribe
    })
    const appStateStore: Record<string, unknown> = {
      scrollX: 10,
      scrollY: 20,
      zoom: { value: 1.25 },
      activeTool: { type: 'freedraw' },
      currentStrokeOptions: { highlighter: true },
    }
    const updateScene = vi.fn((scene: { appState?: Record<string, unknown> }) => {
      if (scene.appState) {
        Object.assign(appStateStore, scene.appState)
      }
    })

    const rawApi = {
      getSceneElements: () => [{ id: 'el-1' }],
      getSceneElementsIncludingDeleted: () => [{ id: 'el-1' }, { id: 'el-2', isDeleted: true }],
      getAppState: () => ({ ...appStateStore }),
      updateScene,
      scrollToContent,
      onScrollChange,
    }

    const api = createExcalidrawCanvasApiBlock(rawApi)
    expect(api).not.toBeNull()
    expect(api?.getSceneElementsBlock().length).toBe(1)
    expect(api?.getSceneElementsIncludingDeletedBlock().length).toBe(2)
    expect(api?.getAppStateBlock()).toMatchObject({
      scrollX: 10,
      scrollY: 20,
      zoom: { value: 1.25 },
    })
    expect(api?.getViewportStateBlock()).toEqual({ scrollX: 10, scrollY: 20, zoom: 1.25 })

    api?.updateAppStateBlock({
      currentItemStrokeWidth: 4,
      currentItemOpacity: 80,
    })
    expect(updateScene).toHaveBeenCalledWith({
      appState: {
        scrollX: 10,
        scrollY: 20,
        zoom: { value: 1.25 },
        activeTool: { type: 'freedraw' },
        currentStrokeOptions: { highlighter: true },
        currentItemStrokeWidth: 4,
        currentItemOpacity: 80,
      },
    })

    api?.updateViewportBlock({ scrollX: 42, zoom: 1.5 })
    expect(updateScene).toHaveBeenCalledWith({
      appState: {
        scrollY: 20,
        currentItemStrokeWidth: 4,
        currentItemOpacity: 80,
        activeTool: { type: 'freedraw' },
        currentStrokeOptions: { highlighter: true },
        scrollX: 42,
        zoom: { value: 1.5 },
      },
    })

    api?.fitViewportToContentBlock([{ id: 'el-1' }])
    expect(scrollToContent).toHaveBeenCalledWith(
      [{ id: 'el-1' }],
      expect.objectContaining({
        fitToViewport: true,
        viewportZoomFactor: 0.9,
        animate: false,
        minZoom: 0.1,
        maxZoom: 4,
      }),
    )

    const listener = vi.fn()
    const unsub = api?.onViewportChangeBlock(listener)
    expect(listener).toHaveBeenCalledWith({ scrollX: 4, scrollY: 5, zoom: 0.75 })
    expect(onScrollChange).toHaveBeenCalledTimes(1)
    unsub?.()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('builds initial scene payload with view mode derived from editable', () => {
    const initial = buildExcalidrawInitialDataBlock({
      elements: [{ id: 'el-1' }],
      appState: { zoom: { value: 2 } },
      files: { fileA: { mimeType: 'image/png' } },
    }, true)

    expect(initial.elements).toEqual([{ id: 'el-1' }])
    expect(initial.appState).toMatchObject({
      zoom: { value: 2 },
      viewModeEnabled: false,
    })
    expect(initial.files).toEqual({ fileA: { mimeType: 'image/png' } })
  })

  // Scene change payloads are intentionally passed through by reference (no
  // per-onChange cloning) — cloning every tick was too expensive. Callers only
  // use the snapshot for save serialization.
  it('passes scene change payloads through by reference without cloning', () => {
    const elements = [{ id: 'shape' }]
    const appState = { zoom: { value: 1 } }
    const files = { fileA: { mimeType: 'image/png' } }

    const snapshot = cloneExcalidrawSceneChangeBlock(elements, appState, files)

    expect(snapshot.elements).toBe(elements)
    expect(snapshot.appState).toBe(appState)
    expect(snapshot.files).toBe(files)
  })

  it('never enumerates payload properties (getter traps stay untriggered)', () => {
    const appState: Record<string, unknown> = { zoom: { value: 1.1 } }
    Object.defineProperty(appState, 'badField', {
      enumerable: true,
      get() {
        throw new Error('boom')
      },
    })

    expect(() => cloneExcalidrawSceneChangeBlock([{ id: 'shape' }], appState, {})).not.toThrow()
  })

  it('defaults nullish payloads to empty containers', () => {
    const snapshot = cloneExcalidrawSceneChangeBlock(
      undefined as unknown as readonly unknown[],
      null as unknown as Record<string, unknown>,
      null as unknown as Record<string, unknown>,
    )
    expect(snapshot.elements).toEqual([])
    expect(snapshot.appState).toEqual({})
    expect(snapshot.files).toEqual({})
  })
})
