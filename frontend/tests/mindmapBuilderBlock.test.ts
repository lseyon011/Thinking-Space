import { describe, expect, it } from 'vitest'
import {
  buildMindmapSceneFromMarkdownBlock,
  DEFAULT_MINDMAP_BUILD_OPTIONS,
  suggestMindmapOutputPathBlock,
} from '../src/services/lego_blocks/mindmapBuilderBlock'

function extractTextElements(scene: { elements: unknown[] }): string[] {
  return scene.elements
    .filter((item) => {
      if (!item || typeof item !== 'object') return false
      return (item as Record<string, unknown>).type === 'text'
    })
    .map((item) => String((item as Record<string, unknown>).text ?? ''))
}

describe('mindmapBuilderBlock', () => {
  const source = [
    '# Root heading',
    'Intro paragraph under root.',
    '',
    '## Child A',
    'Detail line A1.',
    'Detail line A2.',
    '',
    '## Child B',
    'Detail line B1.',
  ].join('\n')

  it('includes section body text when full-text mode is enabled', () => {
    const result = buildMindmapSceneFromMarkdownBlock(
      source,
      'notes/example.md',
      {
        ...DEFAULT_MINDMAP_BUILD_OPTIONS,
        includeFullText: true,
        arrowType: 'curved',
        growthMode: 'right-facing',
      },
    )

    const textElements = extractTextElements(result.scene)
    expect(result.stats.headingCount).toBe(3)
    expect(result.stats.nodeCount).toBe(7) // root + headings + per-heading content nodes
    expect(textElements.some(text => text.includes('Detail line A1.'))).toBe(true)
    expect(textElements.some(text => text.includes('Child A'))).toBe(true)
  })

  it('keeps node text to heading titles when full-text mode is disabled', () => {
    const result = buildMindmapSceneFromMarkdownBlock(
      source,
      'notes/example.md',
      {
        ...DEFAULT_MINDMAP_BUILD_OPTIONS,
        includeFullText: false,
        arrowType: 'curved',
        growthMode: 'left-facing',
      },
    )

    const textElements = extractTextElements(result.scene)
    expect(textElements.some(text => text.includes('Detail line A1.'))).toBe(false)
    expect(textElements.some(text => text.includes('Child A'))).toBe(true)
  })

  it('builds default output paths with excalidraw suffix', () => {
    const output = suggestMindmapOutputPathBlock('folder/my-note.md')
    expect(output).toBe('folder/my-note (mindmap full text).excalidraw.md')
  })
})
