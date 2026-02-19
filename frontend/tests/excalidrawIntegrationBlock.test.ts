import { describe, expect, it, vi } from 'vitest'
import {
  buildExcalidrawInitialDataBlock,
  cloneExcalidrawSceneChangeBlock,
  createExcalidrawCanvasApiBlock,
} from '../src/services/lego_blocks/excalidrawIntegrationBlock'

describe('excalidrawIntegrationBlock', () => {
  it('returns null for incompatible vendor api objects', () => {
    expect(createExcalidrawCanvasApiBlock(null)).toBeNull()
    expect(createExcalidrawCanvasApiBlock({})).toBeNull()
  })

  it('adapts vendor viewport methods behind local contract', () => {
    const updateScene = vi.fn()
    const scrollToContent = vi.fn()
    const unsubscribe = vi.fn()
    const onScrollChange = vi.fn((listener: (x: number, y: number, zoom: { value: number }) => void) => {
      listener(4, 5, { value: 0.75 })
      return unsubscribe
    })
    const rawApi = {
      getSceneElements: () => [{ id: 'el-1' }],
      getSceneElementsIncludingDeleted: () => [{ id: 'el-1' }, { id: 'el-2', isDeleted: true }],
      getAppState: () => ({ scrollX: 10, scrollY: 20, zoom: { value: 1.25 } }),
      updateScene,
      scrollToContent,
      onScrollChange,
    }

    const api = createExcalidrawCanvasApiBlock(rawApi)
    expect(api).not.toBeNull()
    expect(api?.getSceneElementsBlock().length).toBe(1)
    expect(api?.getSceneElementsIncludingDeletedBlock().length).toBe(2)
    expect(api?.getViewportStateBlock()).toEqual({ scrollX: 10, scrollY: 20, zoom: 1.25 })

    api?.updateViewportBlock({ scrollX: 42, zoom: 1.5 })
    expect(updateScene).toHaveBeenCalledWith({
      appState: {
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

  it('clones scene change payloads so callers can mutate safely', () => {
    const elements = [{ id: 'shape' }]
    const appState = { zoom: { value: 1 } }
    const files = { fileA: { mimeType: 'image/png' } }

    const cloned = cloneExcalidrawSceneChangeBlock(elements, appState, files)

    expect(cloned.elements).toEqual(elements)
    expect(cloned.elements).not.toBe(elements)
    expect(cloned.appState).toEqual(appState)
    expect(cloned.appState).not.toBe(appState)
    expect(cloned.files).toEqual(files)
    expect(cloned.files).not.toBe(files)
  })
})
