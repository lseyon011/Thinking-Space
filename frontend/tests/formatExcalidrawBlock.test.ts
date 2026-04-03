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

  it('handles contents pattern with separate CHAPTER and title heading lines', () => {
    const longChapterBody = Array.from({ length: 2200 }, (_, index) => `body${index + 1}`).join(' ')
    const input = [
      '# Contents',
      '### CHAPTER 1',
      '## The Way of the Wind',
      '### CHAPTER 2',
      '## How the Grid Got Its Wires',
      '',
      '# Introduction',
      'Short intro text.',
      '',
      '## The Way of the Wind',
      longChapterBody,
      '',
      '## How the Grid Got Its Wires',
      'Short second chapter.',
    ].join('\n')

    const output = formatMarkdown(input, DEFAULT_OPTIONS)

    expect(output).not.toContain('### CHAPTER 1')
    expect(output).not.toContain('## The Way of the Wind\n### CHAPTER 2')
    expect(output).toContain('## Chapter 1: The Way of the Wind')
    expect(output).toContain('### Chapter 1 Part 1')
    expect(output).toContain('### Chapter 1 Part 2')
    expect(output).toContain('## Chapter 2: How the Grid Got Its Wires')
    expect(output).toContain('### Chapter 2 Part 1')
  })

  it('maps numeric-space contents entries to chapter headings and splits long chapters', () => {
    const longChapterBody = Array.from({ length: 2200 }, (_, index) => `grain${index + 1}`).join(' ')
    const input = [
      '## Contents',
      '1 Homo Faber',
      '2 Built upon Sand',
      '',
      '### Introduction',
      'Context before chapters.',
      '',
      '## Homo Faber',
      longChapterBody,
      '',
      '## Built upon Sand',
      'Short second chapter.',
    ].join('\n')

    const output = formatMarkdown(input, DEFAULT_OPTIONS)

    expect(output).toContain('## Chapter 1: Homo Faber')
    expect(output).toContain('### Chapter 1 Part 1')
    expect(output).toContain('### Chapter 1 Part 2')
    expect(output).toContain('## Chapter 2: Built upon Sand')
    expect(output).toContain('### Chapter 2 Part 1')
  })

  it('treats bold numbered transcript sections as single numbered headings', () => {
    const input = [
      '### 1997',
      '',
      '_Morning Session - 1997 Meeting_',
      '',
      '**1. Buffett is losing his voice**',
      '',
      'WARREN BUFFETT: Good morning. I am Warren Buffett.',
      'I had a real problem last night. I was losing my voice almost entirely.',
      '',
      '**2. Formal business meeting begins**',
      '',
      'WARREN BUFFETT: I think that is most of the preliminaries.',
      'We will get the meeting over with here promptly with your cooperation.',
    ].join('\n')

    const output = formatMarkdown(input, DEFAULT_OPTIONS)

    expect(output).toContain('## 1 Buffett is losing his voice')
    expect(output).toContain('## 2 Formal business meeting begins')
    expect(output).not.toContain('• **1. Buffett is losing his voice**')
    expect(output).not.toContain('• Buffett is losing his voice')
  })

  it('failsafe splits any oversized heading block into parts', () => {
    const longSectionBody = Array.from({ length: 4300 }, (_, index) => `line${index + 1}`).join(' ')
    const input = [
      '# Notes from Session',
      longSectionBody,
      '',
      '## Follow-up',
      'Small section.',
    ].join('\n')

    const output = formatMarkdown(input, DEFAULT_OPTIONS)

    expect(output).toContain('## Notes from Session Part 1')
    expect(output).toContain('## Notes from Session Part 2')
    expect(output).toContain('## Notes from Session Part 3')
    expect(output).toContain('## Follow-up')
  })
})
