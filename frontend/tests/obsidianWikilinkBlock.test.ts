import { describe, expect, it } from 'vitest'
import {
  buildWikilinkSuggestionsBlock,
  buildObsidianWikilinkBlock,
  buildThinkingSpaceWikilinkHrefBlock,
  parseThinkingSpaceWikilinkHrefBlock,
  parseWikilinkTargetBlock,
  resolveWikilinkPathBlock,
  splitTextByWikilinksBlock,
  toObsidianWikilinkTargetBlock,
} from '@/services/lego_blocks/obsidianWikilinkBlock'

describe('obsidianWikilinkBlock', () => {
  it('parses wikilink tokens with alias and embed markers', () => {
    const tokens = splitTextByWikilinksBlock('See [[notes/Alpha|Alpha Note]] and ![[Sketch.excalidraw]].')
    expect(tokens).toEqual([
      { kind: 'text', text: 'See ', target: null, alias: null, embed: false },
      { kind: 'wikilink', text: '[[notes/Alpha|Alpha Note]]', target: 'notes/Alpha', alias: 'Alpha Note', embed: false },
      { kind: 'text', text: ' and ', target: null, alias: null, embed: false },
      { kind: 'wikilink', text: '![[Sketch.excalidraw]]', target: 'Sketch.excalidraw', alias: null, embed: true },
      { kind: 'text', text: '.', target: null, alias: null, embed: false },
    ])
  })

  it('resolves basename links with same-folder preference', () => {
    const result = resolveWikilinkPathBlock({
      currentPath: 'projects/alpha/Today.md',
      target: 'Note',
      candidatePaths: [
        'archive/Note.md',
        'projects/alpha/Note.md',
      ],
    })
    expect(result.path).toBe('projects/alpha/Note.md')
  })

  it('resolves extensionless nested paths', () => {
    const result = resolveWikilinkPathBlock({
      currentPath: 'daily/2026-02-21.md',
      target: 'research/Deep Work',
      candidatePaths: ['research/Deep Work.md'],
    })
    expect(result.path).toBe('research/Deep Work.md')
  })

  it('resolves relative links from current folder', () => {
    const result = resolveWikilinkPathBlock({
      currentPath: 'projects/alpha/Today.md',
      target: '../shared/Overview',
      candidatePaths: ['projects/shared/Overview.md'],
    })
    expect(result.path).toBe('projects/shared/Overview.md')
  })

  it('resolves excalidraw path variants', () => {
    const result = resolveWikilinkPathBlock({
      currentPath: 'notes/Index.md',
      target: 'Sketch.excalidraw',
      candidatePaths: ['drawings/Sketch.excalidraw.md'],
    })
    expect(result.path).toBe('drawings/Sketch.excalidraw.md')
  })

  it('keeps heading-only links in the current file', () => {
    const parsed = parseWikilinkTargetBlock('#Plan')
    expect(parsed.path).toBe('')
    expect(parsed.heading).toBe('Plan')

    const resolved = resolveWikilinkPathBlock({
      currentPath: 'notes/Project.md',
      target: '#Plan',
      candidatePaths: [],
    })
    expect(resolved.path).toBe('notes/Project.md')
    expect(resolved.heading).toBe('Plan')
  })

  it('builds and parses Thinking Space wikilink hrefs', () => {
    const href = buildThinkingSpaceWikilinkHrefBlock('notes/My Note')
    const parsed = parseThinkingSpaceWikilinkHrefBlock(href)
    expect(parsed).toEqual({ target: 'notes/My Note' })
  })

  it('builds Obsidian-compatible wikilink syntax', () => {
    expect(toObsidianWikilinkTargetBlock('notes/Plan.md')).toBe('notes/Plan')
    expect(toObsidianWikilinkTargetBlock('drawings/Sketch.excalidraw.md')).toBe('drawings/Sketch.excalidraw')
    expect(buildObsidianWikilinkBlock('notes/Plan.md')).toBe('[[notes/Plan]]')
    expect(buildObsidianWikilinkBlock('notes/Plan.md', 'Plan Link')).toBe('[[notes/Plan|Plan Link]]')
  })

  it('returns fuzzy-ranked suggestions with current-folder preference', () => {
    const suggestions = buildWikilinkSuggestionsBlock({
      currentPath: 'projects/alpha/Today.md',
      query: 'pln',
      candidatePaths: [
        'projects/alpha/Project Plan.md',
        'archive/Planning Notes.md',
        'projects/alpha/Meeting.md',
      ],
    })
    expect(suggestions[0]?.target).toBe('projects/alpha/Project Plan')
    expect(suggestions.some(item => item.target === 'archive/Planning Notes')).toBe(true)
  })

  it('returns extensionless excalidraw targets in suggestions', () => {
    const suggestions = buildWikilinkSuggestionsBlock({
      currentPath: 'notes/Index.md',
      query: 'sketch',
      candidatePaths: ['drawings/Sketch.excalidraw.md'],
    })
    expect(suggestions[0]?.target).toBe('drawings/Sketch.excalidraw')
  })
})
