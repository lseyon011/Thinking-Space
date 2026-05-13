import { describe, expect, it } from 'vitest'
import { isHtmlDocumentPathBlock } from '@/services/lego_blocks/units/htmlDocumentPathBlock'

describe('isHtmlDocumentPathBlock', () => {
  it('accepts html and htm files', () => {
    expect(isHtmlDocumentPathBlock('notes/preview.html')).toBe(true)
    expect(isHtmlDocumentPathBlock('notes/preview.HTM')).toBe(true)
  })

  it('rejects non-html files', () => {
    expect(isHtmlDocumentPathBlock('notes/preview.md')).toBe(false)
    expect(isHtmlDocumentPathBlock('notes/html-preview')).toBe(false)
  })
})
