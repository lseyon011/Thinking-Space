import { describe, expect, it } from 'vitest'
import {
  buildMindmapSceneFromMarkdownBlock,
  DEFAULT_MINDMAP_BUILD_OPTIONS,
  suggestMindmapOutputPathBlock,
} from '../src/services/lego_blocks/integrations/mindmapBuilderBlock'

function extractTextElements(scene: { elements: unknown[] }): string[] {
  return scene.elements
    .filter((item) => {
      if (!item || typeof item !== 'object') return false
      return (item as Record<string, unknown>).type === 'text'
    })
    .map((item) => String((item as Record<string, unknown>).text ?? ''))
}

function asSceneElements(scene: { elements: unknown[] }): Array<Record<string, unknown>> {
  return scene.elements.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
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

  it('preserves content text verbatim with blank-line spacing and allows uncapped content height', () => {
    const longBullet = `• ${'word '.repeat(80).trim()}`
    const repeated = Array.from({ length: 120 }, (_, index) => `${longBullet} ${index}`).join('\n\n\n')
    const verbatimSource = [
      '# Root',
      '',
      '## Bullets',
      '• first bullet sentence',
      '',
      '',
      '• second bullet sentence',
      '',
      '## Huge',
      repeated,
    ].join('\n')

    const result = buildMindmapSceneFromMarkdownBlock(
      verbatimSource,
      'notes/example.md',
      {
        ...DEFAULT_MINDMAP_BUILD_OPTIONS,
        includeFullText: true,
        arrowType: 'curved',
        growthMode: 'right-facing',
        maxWrapWidth: 980,
      },
    )

    const elements = asSceneElements(result.scene)
    // Runs of blank lines are collapsed to a single blank line between bullets.
    const bulletText = elements.find((element) => element.type === 'text' && element.text === '• first bullet sentence\n\n• second bullet sentence')
    expect(bulletText).toBeDefined()
    const bulletContainerId = bulletText?.containerId
    expect(typeof bulletContainerId).toBe('string')
    const bulletContainer = elements.find((element) => element.id === bulletContainerId)
    expect(typeof bulletContainer?.width).toBe('number')
    expect((bulletContainer?.width as number) >= 140).toBe(true)

    const hugeText = elements.find((element) => element.type === 'text' && typeof element.text === 'string' && (element.text as string).includes('word word word'))
    expect(hugeText).toBeDefined()
    const hugeContainer = elements.find((element) => element.id === hugeText?.containerId)
    expect(typeof hugeContainer?.height).toBe('number')
    expect((hugeContainer?.height as number) > 2400).toBe(true)
  })
})
