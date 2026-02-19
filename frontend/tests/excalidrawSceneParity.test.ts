import { describe, expect, it } from 'vitest'
import {
  diffScenesParityFocused,
  diffScenesStrict,
} from './helpers/excalidrawSceneParity'
import type { ParsedExcalidrawScene } from '../src/services/lego_blocks/excalidrawFileBlock'

function buildBaseScene(): ParsedExcalidrawScene {
  return {
    elements: [
      {
        id: 'rect-a',
        type: 'rectangle',
        x: 10,
        y: 20,
        width: 120,
        height: 60,
        angle: 0,
        strokeColor: '#111111',
        backgroundColor: '#eeeeee',
        fillStyle: 'solid',
        strokeWidth: 2,
        strokeStyle: 'solid',
        roughness: 0,
        opacity: 100,
        groupIds: [],
        frameId: null,
        index: 'a0',
        roundness: null,
        seed: 101,
        version: 1,
        versionNonce: 111,
        isDeleted: false,
        boundElements: null,
        updated: 1000,
        link: null,
        locked: false,
      },
      {
        id: 'text-a',
        type: 'text',
        x: 20,
        y: 28,
        width: 90,
        height: 24,
        angle: 0,
        strokeColor: '#111111',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 0,
        opacity: 100,
        groupIds: [],
        frameId: null,
        index: 'a0t',
        roundness: null,
        seed: 301,
        version: 1,
        versionNonce: 311,
        isDeleted: false,
        boundElements: null,
        updated: 1002,
        link: null,
        locked: false,
        text: 'Alpha',
        fontSize: 20,
        fontFamily: 2,
        textAlign: 'left',
        verticalAlign: 'middle',
        lineHeight: 1.25,
        baseline: 16,
      },
      {
        id: 'rect-b',
        type: 'rectangle',
        x: 220,
        y: 120,
        width: 100,
        height: 50,
        angle: 0,
        strokeColor: '#222222',
        backgroundColor: '#dddddd',
        fillStyle: 'solid',
        strokeWidth: 2,
        strokeStyle: 'solid',
        roughness: 0,
        opacity: 100,
        groupIds: [],
        frameId: null,
        index: 'a1',
        roundness: null,
        seed: 202,
        version: 1,
        versionNonce: 222,
        isDeleted: false,
        boundElements: null,
        updated: 1001,
        link: null,
        locked: false,
      },
      {
        id: 'text-b',
        type: 'text',
        x: 228,
        y: 126,
        width: 80,
        height: 20,
        angle: 0,
        strokeColor: '#222222',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 0,
        opacity: 100,
        groupIds: [],
        frameId: null,
        index: 'a1t',
        roundness: null,
        seed: 302,
        version: 1,
        versionNonce: 322,
        isDeleted: false,
        boundElements: null,
        updated: 1003,
        link: null,
        locked: false,
        text: 'Beta',
        fontSize: 20,
        fontFamily: 2,
        textAlign: 'left',
        verticalAlign: 'middle',
        lineHeight: 1.25,
        baseline: 16,
      },
    ],
    appState: {
      viewBackgroundColor: '#ffffff',
      scrollX: 120,
      scrollY: -40,
      zoom: { value: 0.7 },
      activeTool: { type: 'freedraw' },
      currentItemStrokeColor: '#ffffff',
    },
    files: {},
  }
}

describe('excalidrawSceneParity helper', () => {
  it('parity-focused mode ignores volatile appState and non-semantic element metadata', () => {
    const left = buildBaseScene()
    const right = buildBaseScene()

    ;(right.elements[0] as Record<string, unknown>).id = 'rect-b'
    ;(right.elements[0] as Record<string, unknown>).index = 'z999'
    ;(right.elements[0] as Record<string, unknown>).seed = 99999
    ;(right.elements[0] as Record<string, unknown>).version = 42
    ;(right.elements[0] as Record<string, unknown>).versionNonce = 424242
    ;(right.elements[0] as Record<string, unknown>).updated = 987654321
    right.appState = {
      ...(right.appState ?? {}),
      scrollX: -9999,
      scrollY: 9999,
      zoom: { value: 4 },
      activeTool: { type: 'selection' },
      currentItemStrokeColor: '#ff00ff',
    }

    const strictDiffs = diffScenesStrict(left, right)
    const parityDiffs = diffScenesParityFocused(left, right)

    expect(strictDiffs.length).toBeGreaterThan(0)
    expect(parityDiffs).toEqual([])
  })

  it('parity-focused mode still reports structural/layout mismatches', () => {
    const left = buildBaseScene()
    const right = buildBaseScene()

    ;(right.elements[3] as Record<string, unknown>).text = 'Gamma'

    const parityDiffs = diffScenesParityFocused(left, right)
    expect(parityDiffs.length).toBeGreaterThan(0)
  })

  it('parity-focused mode ignores wrap-only text differences', () => {
    const left = buildBaseScene()
    const right = buildBaseScene()

    ;(right.elements[1] as Record<string, unknown>).text = 'Alpha\n'
    ;(right.elements[3] as Record<string, unknown>).text = '  Beta\t'

    const parityDiffs = diffScenesParityFocused(left, right)
    expect(parityDiffs).toEqual([])
  })
})
