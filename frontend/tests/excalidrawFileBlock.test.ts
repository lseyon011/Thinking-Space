import { describe, expect, it } from 'vitest'
import { parseExcalidrawScene, serializeExcalidrawScene } from '../src/services/lego_blocks/excalidrawFileBlock'

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
})
