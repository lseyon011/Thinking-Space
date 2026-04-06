import { describe, expect, it } from 'vitest'
import {
  buildMarkdownAnchorLineBlock,
  composeMarkdownAnnotationDocumentBlock,
  findMarkdownHighlightByVisibleOffsetBlock,
  findMarkdownAnchorAfterOffsetBlock,
  hasMarkdownAnchorLineBlock,
  insertMarkdownAnchorAfterBlockOffsetBlock,
  insertMarkdownHighlightAtRangeBlock,
  insertMarkdownAnchorAtSelectionBlock,
  isMarkdownAnchorLineBlock,
  parseMarkdownHighlightSegmentsBlock,
  parseMarkdownAnchorIdBlock,
  removeMarkdownHighlightByVisibleOffsetBlock,
  splitMarkdownAnnotationDocumentBlock,
  updateMarkdownHighlightPresetByVisibleOffsetBlock,
  upsertMarkdownAnchorAnnotationBlock,
} from '../src/services/lego_blocks/units/markdownAnnotationBlock'
import { mapRenderedMarkdownOffsetToSourceOffset, preserveExtraBlankLinesInMarkdown } from '../src/components/lego_blocks/units/MarkdownDocumentContentBlock'

describe('markdownAnnotationBlock', () => {
  it('splits and composes hidden markdown annotation fences', () => {
    const content = [
      '# Example',
      '',
      'Paragraph',
      '',
      '```thinking-space-annotations',
      '{',
      '  "version": 1,',
      '  "annotations": [',
      '    {',
      '      "id": "ann-1",',
      '      "anchorId": "ts-note1",',
      '      "text": "remember this",',
      '      "transcript": "",',
      '      "ocrText": "remember this",',
      '      "ocrStatus": "ready",',
      '      "ocrUpdatedAt": "2026-04-06T00:05:00.000Z",',
      '      "strokes": [],',
      '      "createdAt": "2026-04-06T00:00:00.000Z",',
      '      "updatedAt": "2026-04-06T00:00:00.000Z"',
      '    }',
      '  ]',
      '}',
      '```',
      '',
    ].join('\n')

    const split = splitMarkdownAnnotationDocumentBlock(content)
    expect(split.body).toBe('# Example\n\nParagraph')
    expect(split.parseError).toBeNull()
    expect(split.store.annotations).toHaveLength(1)
    expect(split.store.annotations[0]?.anchorId).toBe('ts-note1')
    expect(split.store.annotations[0]?.ocrText).toBe('remember this')

    const recomposed = composeMarkdownAnnotationDocumentBlock(split.body, split.store)
    expect(recomposed).toContain('```thinking-space-annotations')
    expect(recomposed).toContain('"anchorId": "ts-note1"')
  })

  it('preserves invalid raw annotation fences during recomposition', () => {
    const content = [
      '# Example',
      '',
      '```thinking-space-annotations',
      '{oops',
      '```',
    ].join('\n')

    const split = splitMarkdownAnnotationDocumentBlock(content)
    expect(split.parseError).not.toBeNull()

    const recomposed = composeMarkdownAnnotationDocumentBlock(split.body, split.store, {
      preserveRawFenceBlock: split.rawFenceBlock,
      preserveParseError: split.parseError,
    })
    expect(recomposed).toContain('{oops')
  })

  it('recognizes anchor lines and inserts them below the current line', () => {
    expect(isMarkdownAnchorLineBlock('^ts-abc123')).toBe(true)
    expect(parseMarkdownAnchorIdBlock(buildMarkdownAnchorLineBlock('ts-xyz987'))).toBe('ts-xyz987')

    const source = '# Title\n\nParagraph text'
    const patch = insertMarkdownAnchorAtSelectionBlock(source, source.length, source.length, 'ts-abc123')
    expect(patch.value).toContain('\n\n^ts-abc123\n')
    expect(hasMarkdownAnchorLineBlock(patch.value, 'ts-abc123')).toBe(true)
  })

  it('finds and inserts anchors relative to a block end offset', () => {
    const source = '# Title\n\nParagraph text'
    const patch = insertMarkdownAnchorAfterBlockOffsetBlock(source, source.length, 'ts-after')
    expect(findMarkdownAnchorAfterOffsetBlock(patch.value, source.length)).toBe('ts-after')
  })

  it('upserts anchor annotations by anchor id', () => {
    const initial = {
      version: 1 as const,
      annotations: [],
    }

    const first = upsertMarkdownAnchorAnnotationBlock(initial, {
      id: 'ann-1',
      anchorId: 'ts-abc123',
      text: 'first',
      transcript: '',
      ocrText: '',
      ocrStatus: 'idle',
      ocrUpdatedAt: null,
      strokes: [],
      createdAt: '2026-04-06T00:00:00.000Z',
      updatedAt: '2026-04-06T00:00:00.000Z',
    })
    const second = upsertMarkdownAnchorAnnotationBlock(first, {
      id: 'ann-2',
      anchorId: 'ts-abc123',
      text: 'updated',
      transcript: '',
      ocrText: 'updated',
      ocrStatus: 'ready',
      ocrUpdatedAt: '2026-04-06T00:30:00.000Z',
      strokes: [],
      createdAt: '2026-04-06T00:00:00.000Z',
      updatedAt: '2026-04-06T01:00:00.000Z',
    })

    expect(first.annotations).toHaveLength(1)
    expect(second.annotations).toHaveLength(1)
    expect(second.annotations[0]?.text).toBe('updated')
    expect(second.annotations[0]?.ocrText).toBe('updated')
  })

  it('inserts highlight markers at a source range', () => {
    expect(insertMarkdownHighlightAtRangeBlock('hello world', 6, 11)).toBe('hello ==world==')
    expect(insertMarkdownHighlightAtRangeBlock('hello world', 6, 11, 'highlighter-8')).toBe('hello ==[highlighter-8]world==')
  })

  it('maps rendered offsets back to source offsets when blank-line markers are injected', () => {
    const source = ['Line 1', '', '', '', '', 'Line 2'].join('\n')
    const rendered = preserveExtraBlankLinesInMarkdown(source)
    const renderedOffset = rendered.indexOf('Line 2')
    expect(renderedOffset).toBeGreaterThan(-1)
    expect(mapRenderedMarkdownOffsetToSourceOffset(source, renderedOffset)).toBe(source.indexOf('Line 2'))
  })

  it('parses preset-aware highlight segments', () => {
    expect(parseMarkdownHighlightSegmentsBlock('A ==[highlighter-8]bright== note')).toEqual([
      {
        kind: 'text',
        rawStart: 0,
        rawEnd: 2,
        visibleText: 'A ',
        presetId: null,
      },
      {
        kind: 'highlight',
        rawStart: 19,
        rawEnd: 25,
        visibleText: 'bright',
        presetId: 'highlighter-8',
      },
      {
        kind: 'text',
        rawStart: 27,
        rawEnd: 32,
        visibleText: ' note',
        presetId: null,
      },
    ])
  })

  it('finds, recolors, and removes an existing highlight by visible offset', () => {
    const source = 'A ==[default-2]bright== note'
    const match = findMarkdownHighlightByVisibleOffsetBlock(source, source.indexOf('bright') + 2)
    expect(match).toEqual({
      rawSyntaxStart: 2,
      rawSyntaxEnd: 23,
      visibleStart: 15,
      visibleEnd: 21,
      visibleText: 'bright',
      presetId: 'default-2',
    })
    expect(updateMarkdownHighlightPresetByVisibleOffsetBlock(source, 17, 'highlighter-8')).toBe('A ==[highlighter-8]bright== note')
    expect(removeMarkdownHighlightByVisibleOffsetBlock(source, 17)).toBe('A bright note')
  })
})
