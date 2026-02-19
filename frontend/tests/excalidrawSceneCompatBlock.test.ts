import { describe, expect, it } from 'vitest'
import {
  normalizeExcalidrawAppStateForInteropBlock,
  normalizeExcalidrawElementForInteropBlock,
  normalizeExcalidrawSceneForInteropBlock,
} from '../src/services/lego_blocks/excalidrawSceneCompatBlock'

describe('excalidrawSceneCompatBlock', () => {
  it('fills canonical appState defaults while preserving explicit values', () => {
    const appState = normalizeExcalidrawAppStateForInteropBlock({
      viewBackgroundColor: '#fefce8',
      scrollX: 42,
    })

    expect(appState.viewBackgroundColor).toBe('#fefce8')
    expect(appState.scrollX).toBe(42)
    expect(appState.gridSize).toBe(20)
    expect(appState.zoom).toEqual({ value: 1 })
    expect((appState.activeTool as Record<string, unknown>).type).toBe('selection')
    expect((appState.frameRendering as Record<string, unknown>).enabled).toBe(true)
  })

  it('normalizes minimal rectangle/text/arrow elements to interop schema', () => {
    const rectangle = normalizeExcalidrawElementForInteropBlock({
      id: 'rect-1',
      type: 'rectangle',
      x: 10,
      y: 20,
      width: 120,
      height: 60,
    }, 0) as Record<string, unknown>

    const text = normalizeExcalidrawElementForInteropBlock({
      id: 'text-1',
      type: 'text',
      x: 14,
      y: 24,
      width: 100,
      height: 40,
      text: 'Hello',
    }, 1) as Record<string, unknown>

    const arrow = normalizeExcalidrawElementForInteropBlock({
      id: 'arrow-1',
      type: 'arrow',
      x: 100,
      y: 100,
      width: 30,
      height: 15,
      points: [[0, 0], [30, 15]],
    }, 2) as Record<string, unknown>

    expect(rectangle.strokeStyle).toBe('solid')
    expect(rectangle.locked).toBe(false)
    expect(typeof rectangle.index).toBe('string')

    expect(text.fontFamily).toBe(2)
    expect(text.lineHeight).toBe(1.25)
    expect(text.baseline).toBeGreaterThan(0)
    expect(text.originalText).toBe('Hello')

    expect(arrow.endArrowhead).toBe('arrow')
    expect(arrow.startArrowhead).toBeNull()
    expect(Array.isArray(arrow.points)).toBe(true)
  })

  it('normalizes full scene structure and ensures files/appState presence', () => {
    const scene = normalizeExcalidrawSceneForInteropBlock({
      elements: [{ type: 'rectangle', width: 10, height: 10 }],
    })

    expect(scene.elements.length).toBe(1)
    expect(scene.files).toEqual({})
    expect(scene.appState?.gridModeEnabled).toBe(false)
  })
})
