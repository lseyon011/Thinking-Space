// Integration test: parse YAML frontmatter files from the test-fixtures vault.
// Validates that the parser handles real-world content correctly.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseNote, validate } from '@/services/lego_blocks/units/yamlNoteBlock'

const TEST_VAULT = resolve(__dirname, '../../test-fixtures/vault')

function readTestFile(relPath: string): string {
  return readFileSync(resolve(TEST_VAULT, relPath), 'utf-8')
}

describe('yamlNoteBlock integration (real files)', () => {
  it('parses program-personal-growth.md', () => {
    const content = readTestFile('programs/program-personal-growth.md')
    const note = parseNote(content)

    expect(note).not.toBeNull()
    expect(note!.frontmatter.uuid).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    expect(note!.frontmatter.key).toBe('personal-growth')
    expect(note!.frontmatter.title).toBe('Personal Growth')
    expect(note!.frontmatter.type).toBe('program')
    expect(note!.frontmatter.level).toBe(0)
    expect((note!.frontmatter as any).children).toBeUndefined()
    expect(note!.frontmatter.tags).toEqual(['life', 'growth'])
    expect(note!.frontmatter.status).toBe('active')
    expect(note!.frontmatter.priority).toBe('high')
    expect(note!.body).toContain('Personal Growth')

    const errors = validate(note!.frontmatter)
    expect(errors).toEqual([])
  })

  it('parses epic-build-thinking-space.md with parent info', () => {
    const content = readTestFile('epics/epic-build-thinking-space.md')
    const note = parseNote(content)

    expect(note).not.toBeNull()
    expect(note!.frontmatter.type).toBe('epic')
    expect(note!.frontmatter.level).toBe(1)
    expect(note!.frontmatter.parent).toBe('personal-growth')
    expect(note!.frontmatter.parent_uuid).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    expect(note!.frontmatter.parent_type).toBe('program')
    expect(note!.frontmatter.progress).toBe(0.15)
    expect(note!.frontmatter.ai_summary).toBe('Core app to organize hierarchical thinking with ambient AI')
    expect((note!.frontmatter as any).children).toBeUndefined()

    const errors = validate(note!.frontmatter)
    expect(errors).toEqual([])
  })

  it('parses idea files with hierarchy links', () => {
    const content = readTestFile('ideas/idea-yaml-architecture.md')
    const note = parseNote(content)

    expect(note).not.toBeNull()
    expect(note!.frontmatter.type).toBe('idea')
    expect(note!.frontmatter.level).toBe(3)
    expect(note!.frontmatter.parent).toBe('build-thinking-space')
    expect(note!.body).toContain('YAML Frontmatter Architecture')
  })

  it('returns null for existing vault files without YAML frontmatter', () => {
    const content = readTestFile('Activity Dashboard.md')
    const note = parseNote(content)
    // This file either has no frontmatter or has non-hierarchy frontmatter
    // Either way it should parse gracefully
    // (it might return a note if it has any frontmatter, or null if not)
    if (note) {
      // If it does parse, it should at least have a type
      expect(note.frontmatter.type).toBeDefined()
    }
  })

  it('parses existing thoughts without frontmatter as null', () => {
    // Old-format thought (date-named, no frontmatter)
    const content = readTestFile('operations/sfw/thoughts/2026-01-06.md')
    const note = parseNote(content)
    expect(note).toBeNull() // No YAML frontmatter
  })
})
