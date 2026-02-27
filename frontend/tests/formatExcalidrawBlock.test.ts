import { describe, expect, it } from 'vitest'
import { formatMarkdown } from '@/services/lego_blocks/units/formatExcalidrawBlock'

const DEFAULT_OPTIONS = {
  normalize_book: true,
  strip_fences: true,
  split_long_paragraphs: false,
  join_lines: true,
}

describe('formatExcalidrawBlock', () => {
  it('uses table-of-contents hints for chapter titles', () => {
    const input = [
      '# Table of Contents',
      'Chapter 1: Getting Started ........ 3',
      'Chapter 2: Deep Work ........ 27',
      '',
      'CHAPTER 1',
      'This chapter opens with context.',
      '',
      'CHAPTER 2',
      'This chapter goes deeper.',
    ].join('\n')

    const output = formatMarkdown(input, DEFAULT_OPTIONS)

    expect(output).toContain('## Chapter 1: Getting Started')
    expect(output).toContain('## Chapter 2: Deep Work')
    expect(output).toContain('### Chapter 1 Part 1')
    expect(output).toContain('### Chapter 2 Part 1')
  })

  it('splits long chapter content into 2000-word parts', () => {
    const chapterOneWords = Array.from({ length: 4100 }, (_, index) => `word${index + 1}`).join(' ')
    const input = [
      'CHAPTER 1',
      chapterOneWords,
    ].join('\n')

    const output = formatMarkdown(input, DEFAULT_OPTIONS)
    const chapterOneParts = output.match(/^### Chapter 1 Part \d+$/gm) ?? []

    expect(chapterOneParts.length).toBe(3)
    expect(output).toContain('### Chapter 1 Part 1')
    expect(output).toContain('### Chapter 1 Part 2')
    expect(output).toContain('### Chapter 1 Part 3')
  })

  it('keeps chapter titles from source when no index hint exists', () => {
    const input = [
      'Chapter 7: Systems Thinking',
      'A short chapter body lives here.',
    ].join('\n')

    const output = formatMarkdown(input, DEFAULT_OPTIONS)

    expect(output).toContain('## Chapter 7: Systems Thinking')
    expect(output).toContain('### Chapter 7 Part 1')
  })
})
