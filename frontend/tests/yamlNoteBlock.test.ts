import { describe, expect, it } from 'vitest'
import {
  parseNote,
  stringifyNote,
  generateKey,
  createNote,
  suggestFilename,
  validate,
  hasFrontmatter,
  NODE_TYPE_LEVEL,
  type YAMLNote,
  type YAMLFrontmatter,
} from '@/services/lego_blocks/yamlNoteBlock'

// ── parseNote ──

describe('parseNote', () => {
  it('parses a valid YAML frontmatter note', () => {
    const content = `---
uuid: "abc-123"
key: "test-thought"
title: "Test Thought"
type: "thought"
level: 5
status: "active"
created_at: "2026-02-14T10:00:00Z"
updated_at: "2026-02-14T10:00:00Z"
---

# Hello World

Body content here.
`
    const result = parseNote(content)
    expect(result).not.toBeNull()
    expect(result!.frontmatter.uuid).toBe('abc-123')
    expect(result!.frontmatter.key).toBe('test-thought')
    expect(result!.frontmatter.title).toBe('Test Thought')
    expect(result!.frontmatter.type).toBe('thought')
    expect(result!.frontmatter.level).toBe(5)
    expect(result!.frontmatter.status).toBe('active')
    expect(result!.body).toContain('# Hello World')
    expect(result!.body).toContain('Body content here.')
  })

  it('returns null for content without frontmatter', () => {
    expect(parseNote('# Just a heading\n\nSome text.')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseNote('')).toBeNull()
  })

  it('returns null for malformed YAML', () => {
    const content = `---
invalid: [unclosed
---

Body.
`
    expect(parseNote(content)).toBeNull()
  })

  it('handles frontmatter with optional fields', () => {
    const content = `---
uuid: "abc"
key: "test"
title: "Test"
type: "epic"
level: 1
status: "active"
parent: "parent-key"
parent_uuid: "parent-uuid-123"
parent_type: "program"
tags:
  - "ai"
  - "pkm"
children:
  - "child-1"
  - "child-2"
progress: 0.5
priority: "high"
created_at: "2026-01-01T00:00:00Z"
updated_at: "2026-02-14T00:00:00Z"
ai_summary: "An AI summary"
---

Body.
`
    const result = parseNote(content)!
    expect(result.frontmatter.parent).toBe('parent-key')
    expect(result.frontmatter.parent_uuid).toBe('parent-uuid-123')
    expect(result.frontmatter.parent_type).toBe('program')
    expect(result.frontmatter.tags).toEqual(['ai', 'pkm'])
    expect(result.frontmatter.children).toEqual(['child-1', 'child-2'])
    expect(result.frontmatter.progress).toBe(0.5)
    expect(result.frontmatter.priority).toBe('high')
    expect(result.frontmatter.ai_summary).toBe('An AI summary')
  })

  it('handles empty body after frontmatter', () => {
    const content = `---
uuid: "x"
key: "x"
title: "X"
type: "thought"
level: 5
status: "active"
created_at: "2026-01-01T00:00:00Z"
updated_at: "2026-01-01T00:00:00Z"
---
`
    const result = parseNote(content)!
    expect(result.body).toBe('')
  })

  it('handles leading whitespace before frontmatter', () => {
    const content = `
---
uuid: "ws"
key: "ws"
title: "Whitespace"
type: "thought"
level: 5
status: "active"
created_at: "2026-01-01T00:00:00Z"
updated_at: "2026-01-01T00:00:00Z"
---

Body.
`
    const result = parseNote(content)
    expect(result).not.toBeNull()
    expect(result!.frontmatter.key).toBe('ws')
  })

  it('preserves unknown/extra fields in frontmatter', () => {
    const content = `---
uuid: "extra"
key: "extra"
title: "Extra"
type: "thought"
level: 5
status: "active"
created_at: "2026-01-01T00:00:00Z"
updated_at: "2026-01-01T00:00:00Z"
custom_field: "custom_value"
another_custom: 42
---

Body.
`
    const result = parseNote(content)!
    expect(result.frontmatter.custom_field).toBe('custom_value')
    expect(result.frontmatter.another_custom).toBe(42)
  })

  it('defaults missing type to thought', () => {
    const content = `---
uuid: "no-type"
key: "no-type"
title: "No Type"
created_at: "2026-01-01T00:00:00Z"
updated_at: "2026-01-01T00:00:00Z"
---

Body.
`
    const result = parseNote(content)!
    expect(result.frontmatter.type).toBe('thought')
    expect(result.frontmatter.level).toBe(5)
  })
})

// ── stringifyNote ──

describe('stringifyNote', () => {
  it('produces valid YAML frontmatter markdown', () => {
    const note: YAMLNote = {
      frontmatter: {
        uuid: 'test-uuid',
        key: 'test-key',
        title: 'Test Title',
        type: 'thought',
        level: 5,
        status: 'active',
        created_at: '2026-02-14T10:00:00Z',
        updated_at: '2026-02-14T10:00:00Z',
      },
      body: '# Hello\n\nWorld.',
    }

    const output = stringifyNote(note)
    expect(output).toMatch(/^---\n/)
    expect(output).toContain('uuid:')
    expect(output).toContain('test-uuid')
    expect(output).toContain('Test Title')
    expect(output).toContain('# Hello\n\nWorld.')
  })

  it('omits undefined/null optional fields', () => {
    const note: YAMLNote = {
      frontmatter: {
        uuid: 'u',
        key: 'k',
        title: 'T',
        type: 'thought',
        level: 5,
        status: 'active',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        parent: undefined,
        tags: undefined,
      },
      body: '',
    }

    const output = stringifyNote(note)
    expect(output).not.toContain('parent:')
    expect(output).not.toContain('tags:')
  })
})

// ── roundtrip ──

describe('roundtrip (parse -> stringify -> parse)', () => {
  it('preserves all fields through roundtrip', () => {
    const original: YAMLNote = {
      frontmatter: {
        uuid: 'round-trip-uuid',
        key: 'roundtrip-test',
        title: 'Roundtrip Test',
        type: 'epic',
        level: 1,
        parent: 'parent-prog',
        parent_uuid: 'parent-uuid',
        parent_type: 'program',
        children: ['child-a', 'child-b'],
        tags: ['test', 'roundtrip'],
        progress: 0.75,
        status: 'active',
        priority: 'high',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-02-14T12:00:00Z',
        ai_summary: 'Test summary',
      },
      body: '## Section\n\nContent here.\n',
    }

    const serialized = stringifyNote(original)
    const reparsed = parseNote(serialized)!

    expect(reparsed.frontmatter.uuid).toBe(original.frontmatter.uuid)
    expect(reparsed.frontmatter.key).toBe(original.frontmatter.key)
    expect(reparsed.frontmatter.title).toBe(original.frontmatter.title)
    expect(reparsed.frontmatter.type).toBe(original.frontmatter.type)
    expect(reparsed.frontmatter.level).toBe(original.frontmatter.level)
    expect(reparsed.frontmatter.parent).toBe(original.frontmatter.parent)
    expect(reparsed.frontmatter.parent_uuid).toBe(original.frontmatter.parent_uuid)
    expect(reparsed.frontmatter.parent_type).toBe(original.frontmatter.parent_type)
    expect(reparsed.frontmatter.children).toEqual(original.frontmatter.children)
    expect(reparsed.frontmatter.tags).toEqual(original.frontmatter.tags)
    expect(reparsed.frontmatter.progress).toBe(original.frontmatter.progress)
    expect(reparsed.frontmatter.status).toBe(original.frontmatter.status)
    expect(reparsed.frontmatter.priority).toBe(original.frontmatter.priority)
    expect(reparsed.frontmatter.ai_summary).toBe(original.frontmatter.ai_summary)
    expect(reparsed.body).toBe(original.body)
  })
})

// ── generateKey ──

describe('generateKey', () => {
  it('converts title to lowercase kebab-case', () => {
    expect(generateKey('Build Thinking Space App')).toBe('build-thinking-space-app')
  })

  it('strips special characters', () => {
    expect(generateKey("What's the Plan? (v2)")).toBe('whats-the-plan-v2')
  })

  it('collapses multiple spaces and hyphens', () => {
    expect(generateKey('too   many    spaces')).toBe('too-many-spaces')
    expect(generateKey('too---many---hyphens')).toBe('too-many-hyphens')
  })

  it('trims leading/trailing hyphens', () => {
    expect(generateKey(' -hello- ')).toBe('hello')
  })

  it('handles empty string', () => {
    expect(generateKey('')).toBe('')
  })
})

// ── createNote ──

describe('createNote', () => {
  it('creates a thought with defaults', () => {
    const note = createNote({ type: 'thought', title: 'My First Thought' })

    expect(note.frontmatter.uuid).toBeTruthy()
    expect(note.frontmatter.uuid.length).toBeGreaterThan(10) // UUID format
    expect(note.frontmatter.key).toBe('my-first-thought')
    expect(note.frontmatter.title).toBe('My First Thought')
    expect(note.frontmatter.type).toBe('thought')
    expect(note.frontmatter.level).toBe(5)
    expect(note.frontmatter.status).toBe('active')
    expect(note.frontmatter.created_at).toBeTruthy()
    expect(note.frontmatter.updated_at).toBeTruthy()
    expect(note.body).toBe('')
  })

  it('creates an epic with parent info', () => {
    const note = createNote({
      type: 'epic',
      title: 'Build Thinking Space',
      parent: 'personal-growth',
      parent_uuid: 'p-uuid',
      parent_type: 'program',
      tags: ['project', 'ai'],
    })

    expect(note.frontmatter.type).toBe('epic')
    expect(note.frontmatter.level).toBe(1)
    expect(note.frontmatter.parent).toBe('personal-growth')
    expect(note.frontmatter.parent_uuid).toBe('p-uuid')
    expect(note.frontmatter.parent_type).toBe('program')
    expect(note.frontmatter.tags).toEqual(['project', 'ai'])
  })

  it('includes body when provided', () => {
    const note = createNote({
      type: 'thought',
      title: 'With Body',
      body: '## Content\n\nHere is some text.',
    })
    expect(note.body).toBe('## Content\n\nHere is some text.')
  })
})

// ── suggestFilename ──

describe('suggestFilename', () => {
  it('generates type-key.md format', () => {
    const fm = { type: 'epic', key: 'build-app' } as YAMLFrontmatter
    expect(suggestFilename(fm)).toBe('epic-build-app.md')
  })

  it('works for thoughts', () => {
    const fm = { type: 'thought', key: 'my-first-thought' } as YAMLFrontmatter
    expect(suggestFilename(fm)).toBe('thought-my-first-thought.md')
  })
})

// ── validate ──

describe('validate', () => {
  it('returns empty array for valid frontmatter', () => {
    const note = createNote({ type: 'thought', title: 'Valid' })
    expect(validate(note.frontmatter)).toEqual([])
  })

  it('reports missing uuid', () => {
    const fm = createNote({ type: 'thought', title: 'Test' }).frontmatter
    fm.uuid = ''
    expect(validate(fm)).toContain('Missing uuid')
  })

  it('reports level mismatch', () => {
    const fm = createNote({ type: 'epic', title: 'Test' }).frontmatter
    fm.level = 5 // wrong — epic should be 1
    const errors = validate(fm)
    expect(errors.some(e => e.includes('Level'))).toBe(true)
  })

  it('reports invalid type', () => {
    const fm = createNote({ type: 'thought', title: 'Test' }).frontmatter
    ;(fm as any).type = 'invalid_type'
    expect(validate(fm).some(e => e.includes('Invalid type'))).toBe(true)
  })
})

// ── hasFrontmatter ──

describe('hasFrontmatter', () => {
  it('returns true for content with YAML frontmatter', () => {
    expect(hasFrontmatter('---\ntitle: Hello\n---\nBody')).toBe(true)
  })

  it('returns false for plain markdown', () => {
    expect(hasFrontmatter('# Hello\n\nWorld')).toBe(false)
  })

  it('returns true with leading whitespace', () => {
    expect(hasFrontmatter('  \n---\ntitle: Hello\n---\n')).toBe(true)
  })
})

// ── NODE_TYPE_LEVEL ──

describe('NODE_TYPE_LEVEL', () => {
  it('has correct level assignments', () => {
    expect(NODE_TYPE_LEVEL.program).toBe(0)
    expect(NODE_TYPE_LEVEL.epic).toBe(1)
    expect(NODE_TYPE_LEVEL.idea_bucket).toBe(2)
    expect(NODE_TYPE_LEVEL.idea).toBe(3)
    expect(NODE_TYPE_LEVEL.thought_bucket).toBe(4)
    expect(NODE_TYPE_LEVEL.thought).toBe(5)
  })
})
