import { describe, expect, it } from 'vitest'
import { thinkingSpaceMarkdownUrlTransformBlock } from '@/services/lego_blocks/markdownUrlTransformBlock'

describe('markdownUrlTransformBlock', () => {
  it('preserves thinking-space wikilink hrefs', () => {
    const href = 'ts-wikilink:notes%2FProject%20Plan'
    expect(thinkingSpaceMarkdownUrlTransformBlock(href)).toBe(href)
  })

  it('keeps safe standard urls', () => {
    const href = 'https://example.com/path'
    expect(thinkingSpaceMarkdownUrlTransformBlock(href)).toBe(href)
  })

  it('continues blocking unsafe schemes', () => {
    expect(thinkingSpaceMarkdownUrlTransformBlock('javascript:alert(1)')).toBe('')
  })
})
