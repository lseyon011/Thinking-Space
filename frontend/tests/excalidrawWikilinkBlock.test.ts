import { describe, it, expect } from 'vitest'
import {
  extractFirstWikilinkTargetBlock,
  buildTextElementsSectionBlock,
} from '../src/services/lego_blocks/units/excalidrawWikilinkBlock'

describe('excalidrawWikilinkBlock', () => {
  describe('extractFirstWikilinkTargetBlock', () => {
    it('extracts target from simple wikilink', () => {
      expect(extractFirstWikilinkTargetBlock('[[Some File]]')).toBe('Some File')
    })

    it('extracts target from wikilink with 📍 prefix', () => {
      expect(extractFirstWikilinkTargetBlock('📍[[My Note]]')).toBe('My Note')
    })

    it('extracts path portion when alias is present', () => {
      expect(extractFirstWikilinkTargetBlock('[[path/to/file|Display Name]]')).toBe('path/to/file')
    })

    it('extracts target with heading reference', () => {
      expect(extractFirstWikilinkTargetBlock('[[file#Chapter 1]]')).toBe('file#Chapter 1')
    })

    it('extracts path from heading+alias combo', () => {
      expect(extractFirstWikilinkTargetBlock('[[file#Chapter 1|Ch 1]]')).toBe('file#Chapter 1')
    })

    it('returns null for plain text', () => {
      expect(extractFirstWikilinkTargetBlock('just some text')).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(extractFirstWikilinkTargetBlock('')).toBeNull()
    })

    it('extracts only the first wikilink when multiple exist', () => {
      expect(extractFirstWikilinkTargetBlock('See [[first]] and [[second]]')).toBe('first')
    })
  })

  describe('buildTextElementsSectionBlock', () => {
    it('generates section with text element and ^id reference', () => {
      const elements = [
        { type: 'text', id: 'abc123', text: '📍[[My Note]]', originalText: '📍[[My Note]]' },
      ]
      const result = buildTextElementsSectionBlock(elements)
      expect(result).toBe('📍[[My Note]] ^abc123\n')
    })

    it('includes multiple text elements', () => {
      const elements = [
        { type: 'text', id: 'a1', text: '📍[[Note A]]', originalText: '📍[[Note A]]' },
        { type: 'text', id: 'b2', text: '📍[[Note B]]', originalText: '📍[[Note B]]' },
      ]
      const result = buildTextElementsSectionBlock(elements)
      expect(result).toBe('📍[[Note A]] ^a1\n\n📍[[Note B]] ^b2\n')
    })

    it('skips non-text elements', () => {
      const elements = [
        { type: 'rectangle', id: 'r1' },
        { type: 'text', id: 't1', text: 'Hello', originalText: 'Hello' },
        { type: 'arrow', id: 'a1' },
      ]
      const result = buildTextElementsSectionBlock(elements)
      expect(result).toBe('Hello ^t1\n')
    })

    it('returns empty string for no text elements', () => {
      const elements = [
        { type: 'rectangle', id: 'r1' },
      ]
      expect(buildTextElementsSectionBlock(elements)).toBe('')
    })

    it('returns empty string for empty array', () => {
      expect(buildTextElementsSectionBlock([])).toBe('')
    })

    it('falls back to text when originalText is missing', () => {
      const elements = [
        { type: 'text', id: 'x1', text: 'Fallback text' },
      ]
      const result = buildTextElementsSectionBlock(elements)
      expect(result).toBe('Fallback text ^x1\n')
    })

    it('prefers originalText over text', () => {
      const elements = [
        { type: 'text', id: 'x1', text: 'wrapped\nversion', originalText: 'Original full text' },
      ]
      const result = buildTextElementsSectionBlock(elements)
      expect(result).toBe('Original full text ^x1\n')
    })

    it('skips elements with no text or id', () => {
      const elements = [
        { type: 'text', id: 'x1' },
        { type: 'text', text: 'no id' },
        null,
        undefined,
      ]
      expect(buildTextElementsSectionBlock(elements as any)).toBe('')
    })
  })
})
