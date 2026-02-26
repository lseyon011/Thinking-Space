import { describe, expect, it } from 'vitest'
import { parseExcalidrawScene, serializeExcalidrawScene } from '../src/services/lego_blocks/integrations/excalidrawFileBlock'

describe('excalidrawFileBlock serialize', () => {
  it('replaces compressed-json fences with editable json scene content', () => {
    const original = [
      '---',
      'excalidraw-plugin: parsed',
      '---',
      '',
      '```compressed-json',
      'not-a-real-scene',
      '```',
      '',
      'footer',
      '',
    ].join('\n')

    const updated = serializeExcalidrawScene(original, {
      elements: [
        {
          id: 'rect-1',
          type: 'rectangle',
          x: 10,
          y: 20,
          width: 120,
          height: 60,
        },
      ],
      appState: {},
      files: {},
    })

    expect(updated).not.toContain('```compressed-json')
    expect((updated.match(/```json/g) ?? []).length).toBe(1)

    const parsed = parseExcalidrawScene(updated)
    expect(parsed).not.toBeNull()
    expect(parsed?.elements.length).toBe(1)
    expect((parsed?.elements[0] as Record<string, unknown>).id).toBe('rect-1')
  })

  it('updates existing json fences in place without duplicating scene blocks', () => {
    const original = [
      'intro',
      '```json',
      '{"elements":[],"appState":{},"files":{}}',
      '```',
      'outro',
      '',
    ].join('\n')

    const updated = serializeExcalidrawScene(original, {
      elements: [
        {
          id: 'ellipse-1',
          type: 'ellipse',
          x: 5,
          y: 6,
          width: 30,
          height: 40,
        },
      ],
      appState: { viewBackgroundColor: '#ffffff' },
      files: {},
    })

    expect((updated.match(/```json/g) ?? []).length).toBe(1)
    expect(updated).toContain('intro')
    expect(updated).toContain('outro')

    const parsed = parseExcalidrawScene(updated)
    expect(parsed).not.toBeNull()
    expect((parsed?.elements[0] as Record<string, unknown>).id).toBe('ellipse-1')
  })

  it('serializes scenes with circular and non-json-safe values without throwing', () => {
    const original = [
      '```json',
      '{"elements":[],"appState":{},"files":{}}',
      '```',
      '',
    ].join('\n')

    const appState: Record<string, unknown> = {
      viewBackgroundColor: '#ffffff',
      collaboratorCount: BigInt(2),
      collaborators: new Set(['alpha', 'beta']),
      pointer: new Map([['x', 12], ['y', 18]]),
    }
    appState.self = appState

    const updated = serializeExcalidrawScene(original, {
      elements: [],
      appState,
      files: {},
    })

    const parsed = parseExcalidrawScene(updated)
    expect(parsed).not.toBeNull()
    expect(parsed?.appState?.viewBackgroundColor).toBe('#ffffff')
    expect(parsed?.appState?.collaboratorCount).toBe(2)
    expect((parsed?.appState?.collaborators as unknown[] | undefined)?.length).toBe(2)
    expect((parsed?.appState?.pointer as Record<string, unknown> | undefined)?.x).toBe(12)
  })

  it('preserves repeated shared object values while removing only circular refs', () => {
    const original = [
      '```json',
      '{"elements":[],"appState":{},"files":{}}',
      '```',
      '',
    ].join('\n')

    const sharedPoint = { x: 3, y: 7 }
    const appState: Record<string, unknown> = {
      first: sharedPoint,
      second: sharedPoint,
    }
    appState.self = appState

    const updated = serializeExcalidrawScene(original, {
      elements: [],
      appState,
      files: {},
    })

    const parsed = parseExcalidrawScene(updated)
    expect(parsed).not.toBeNull()
    expect((parsed?.appState?.first as Record<string, unknown> | undefined)?.x).toBe(3)
    expect((parsed?.appState?.second as Record<string, unknown> | undefined)?.x).toBe(3)
  })

  it('serializes safely even when scene objects include throwing getters', () => {
    const original = [
      '```json',
      '{"elements":[],"appState":{},"files":{}}',
      '```',
      '',
    ].join('\n')

    const trouble: Record<string, unknown> = {}
    Object.defineProperty(trouble, 'explode', {
      enumerable: true,
      get() {
        throw new Error('getter exploded')
      },
    })

    const updated = serializeExcalidrawScene(original, {
      elements: [{ id: 'rect-1', type: 'rectangle', x: 0, y: 0, width: 10, height: 10 }],
      appState: {
        viewBackgroundColor: '#ffffff',
        trouble,
      },
      files: {},
    })

    const parsed = parseExcalidrawScene(updated)
    expect(parsed).not.toBeNull()
    expect(parsed?.appState?.viewBackgroundColor).toBe('#ffffff')
  })

  it('does not invoke custom toJSON functions while serializing scene payload', () => {
    const original = [
      '```json',
      '{"elements":[],"appState":{},"files":{}}',
      '```',
      '',
    ].join('\n')

    const toJsonTrap = {
      stable: true,
      toJSON() {
        throw new Error('should not be called')
      },
    }

    const updated = serializeExcalidrawScene(original, {
      elements: [{ id: 'ellipse-1', type: 'ellipse', x: 1, y: 2, width: 3, height: 4 }],
      appState: {
        trap: toJsonTrap,
      },
      files: {},
    })

    const parsed = parseExcalidrawScene(updated)
    expect(parsed).not.toBeNull()
    expect((parsed?.appState?.trap as Record<string, unknown> | undefined)?.stable).toBe(true)
    expect((parsed?.appState?.trap as Record<string, unknown> | undefined)?.toJSON).toBeUndefined()
  })

  it('parses fenced json when element text contains inline triple backticks', () => {
    const scenePayload = {
      elements: [
        {
          id: 'text-1',
          type: 'text',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          version: 1,
          versionNonce: 1,
          text: 'Original Credit\\n```js*/\\n/**',
        },
      ],
      appState: {},
      files: {},
    }

    const original = [
      'header',
      '```json',
      JSON.stringify(scenePayload, null, 2),
      '```',
      'footer',
      '',
    ].join('\n')

    const parsed = parseExcalidrawScene(original)
    expect(parsed).not.toBeNull()
    expect((parsed?.elements[0] as Record<string, unknown> | undefined)?.id).toBe('text-1')
  })

  it('replaces the correct json fence when scene text includes triple backticks', () => {
    const scenePayload = {
      elements: [
        {
          id: 'text-2',
          type: 'text',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          version: 1,
          versionNonce: 1,
          text: 'Ref\\n```js*/\\n/**',
        },
      ],
      appState: {},
      files: {},
    }

    const original = [
      'header',
      '```json',
      JSON.stringify(scenePayload, null, 2),
      '```',
      'footer',
      '',
    ].join('\n')

    const updated = serializeExcalidrawScene(original, {
      elements: [
        {
          id: 'next',
          type: 'ellipse',
          x: 1,
          y: 2,
          width: 3,
          height: 4,
        },
      ],
      appState: {},
      files: {},
    })

    expect((updated.match(/```json/g) ?? []).length).toBe(1)
    expect(updated).toContain('header')
    expect(updated).toContain('footer')
    const parsed = parseExcalidrawScene(updated)
    expect(parsed).not.toBeNull()
    expect((parsed?.elements[0] as Record<string, unknown> | undefined)?.id).toBe('next')
  })
})
