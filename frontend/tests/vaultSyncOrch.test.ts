import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VaultFS, ListedFiles, VaultStat, VaultEntry } from '@/services/lego_blocks/fsBlock'
import {
  createNote,
  stringifyNote,
  type YAMLNote,
} from '@/services/lego_blocks/yamlNoteBlock'

// ── Fake VaultFS ──

class FakeVaultFS implements VaultFS {
  private readonly files = new Map<string, string>()
  private readonly mtimes = new Map<string, number>()

  seedFile(path: string, content: string, mtime: number = Date.now() / 1000): void {
    this.files.set(path, content)
    this.mtimes.set(path, mtime)
  }

  removeFile(path: string): void {
    this.files.delete(path)
    this.mtimes.delete(path)
  }

  async read(path: string): Promise<string> {
    const content = this.files.get(path)
    if (content == null) throw new Error(`Missing file: ${path}`)
    return content
  }

  async write(path: string, data: string): Promise<void> {
    this.files.set(path, data)
    this.mtimes.set(path, Date.now() / 1000)
  }

  async create(path: string, data: string): Promise<void> {
    await this.write(path, data)
  }

  async list(_path: string): Promise<ListedFiles> {
    return { files: [], folders: [] }
  }

  async walkVault(_extensions?: string[]): Promise<VaultEntry[]> {
    const entries: VaultEntry[] = []
    for (const [path, _content] of this.files) {
      if (!path.endsWith('.md')) continue
      entries.push({
        path,
        size: _content.length,
        mtime: this.mtimes.get(path) ?? Date.now() / 1000,
        ctime: this.mtimes.get(path) ?? Date.now() / 1000,
      })
    }
    return entries
  }

  async stat(path: string): Promise<VaultStat> {
    if (!this.files.has(path)) throw new Error(`Missing: ${path}`)
    return { size: this.files.get(path)!.length, mtime: this.mtimes.get(path) ?? 0 }
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path)
  }

  async mkdir(_path: string): Promise<void> {}

  async process(path: string, fn: (data: string) => string): Promise<void> {
    const content = await this.read(path)
    await this.write(path, fn(content))
  }
}

// ── Mock IndexedDB via fake-indexeddb ──
// Dexie requires IndexedDB. In Node test environment we use fake-indexeddb.

let fakeIdb: typeof import('fake-indexeddb') | null = null

beforeEach(async () => {
  // Dynamically import fake-indexeddb if available, skip tests otherwise
  try {
    fakeIdb = await import('fake-indexeddb')
    // Set up global IndexedDB for Dexie
    globalThis.indexedDB = fakeIdb.default
    globalThis.IDBKeyRange = fakeIdb.IDBKeyRange as any
  } catch {
    fakeIdb = null
  }
})

afterEach(async () => {
  // Clean up database between tests
  try {
    const { deleteDb } = await import('@/services/lego_blocks/dbBlock')
    await deleteDb()
  } catch {
    // ignore cleanup errors
  }
})

// Helper to create a seeded vault
function createSeededVault(): FakeVaultFS {
  const fs = new FakeVaultFS()

  // Seed some YAML frontmatter notes
  const program = createNote({ type: 'program', title: 'Personal Growth' })
  fs.seedFile('program-personal-growth.md', stringifyNote(program))

  const epic = createNote({
    type: 'epic',
    title: 'Build Thinking Space',
    parent: program.frontmatter.key,
    parent_uuid: program.frontmatter.uuid,
    parent_type: 'program',
  })
  fs.seedFile('epic-build-thinking-space.md', stringifyNote(epic))

  const thought = createNote({
    type: 'thought',
    title: 'AI Extensibility Ideas',
    parent: epic.frontmatter.key,
    body: 'Some thoughts about AI extensibility and plugin systems.',
  })
  fs.seedFile('thoughts/thought-ai-extensibility.md', stringifyNote(thought))

  // Seed a plain markdown file (no frontmatter) — should be skipped
  fs.seedFile('plain-note.md', '# Just a Note\n\nNo frontmatter here.')

  return fs
}

describe('vaultSyncOrch', () => {
  it('fullSync parses YAML files and skips plain markdown', async () => {
    if (!fakeIdb) return // skip if fake-indexeddb not available

    const { fullSync } = await import('@/services/orchestrators/vaultSyncOrch')
    const { getNodeCount, getAllNodes } = await import('@/services/lego_blocks/dbBlock')

    const fs = createSeededVault()
    const result = await fullSync(fs)

    expect(result.parsedNodes).toBe(3)
    expect(result.skippedFiles).toBe(1) // plain-note.md
    expect(result.errors).toHaveLength(0)

    const count = await getNodeCount()
    expect(count).toBe(3)

    const nodes = await getAllNodes()
    const types = nodes.map(n => n.type).sort()
    expect(types).toEqual(['epic', 'program', 'thought'])
  })

  it('syncSingleFile upserts one file into cache', async () => {
    if (!fakeIdb) return

    const { syncSingleFile } = await import('@/services/orchestrators/vaultSyncOrch')
    const { getNodeByKey, getNodeCount } = await import('@/services/lego_blocks/dbBlock')

    const fs = new FakeVaultFS()
    const note = createNote({ type: 'idea', title: 'New Idea' })
    fs.seedFile('idea-new-idea.md', stringifyNote(note))

    const success = await syncSingleFile('idea-new-idea.md', fs)
    expect(success).toBe(true)

    const count = await getNodeCount()
    expect(count).toBe(1)

    const cached = await getNodeByKey('new-idea')
    expect(cached).toBeDefined()
    expect(cached!.title).toBe('New Idea')
    expect(cached!.type).toBe('idea')
  })

  it('syncSingleFile returns false for plain markdown', async () => {
    if (!fakeIdb) return

    const { syncSingleFile } = await import('@/services/orchestrators/vaultSyncOrch')

    const fs = new FakeVaultFS()
    fs.seedFile('plain.md', '# No frontmatter')

    const success = await syncSingleFile('plain.md', fs)
    expect(success).toBe(false)
  })

  it('incrementalSync detects deleted files', async () => {
    if (!fakeIdb) return

    const { fullSync, incrementalSync } = await import('@/services/orchestrators/vaultSyncOrch')
    const { getNodeCount } = await import('@/services/lego_blocks/dbBlock')

    const fs = createSeededVault()

    // Full sync first
    await fullSync(fs)
    expect(await getNodeCount()).toBe(3)

    // Remove a file and do incremental sync
    fs.removeFile('thoughts/thought-ai-extensibility.md')

    const pastTimestamp = Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
    const result = await incrementalSync(pastTimestamp, fs)

    expect(result.deletedNodes).toBe(1)
    expect(await getNodeCount()).toBe(2)
  })

  it('fullSync stores body excerpt', async () => {
    if (!fakeIdb) return

    const { fullSync } = await import('@/services/orchestrators/vaultSyncOrch')
    const { getAllNodes } = await import('@/services/lego_blocks/dbBlock')

    const fs = createSeededVault()
    await fullSync(fs)

    const nodes = await getAllNodes()
    const thought = nodes.find(n => n.type === 'thought')
    expect(thought).toBeDefined()
    expect(thought!.bodyExcerpt).toContain('AI extensibility')
  })

  it('fullSync preserves parent relationships', async () => {
    if (!fakeIdb) return

    const { fullSync } = await import('@/services/orchestrators/vaultSyncOrch')
    const { getAllNodes } = await import('@/services/lego_blocks/dbBlock')

    const fs = createSeededVault()
    await fullSync(fs)

    const nodes = await getAllNodes()
    const epic = nodes.find(n => n.type === 'epic')
    expect(epic).toBeDefined()
    expect(epic!.parent).toBe('personal-growth')
  })
})

describe('dbBlock search', () => {
  it('searches across title and body excerpt', async () => {
    if (!fakeIdb) return

    const { fullSync } = await import('@/services/orchestrators/vaultSyncOrch')
    const { searchNodes } = await import('@/services/lego_blocks/dbBlock')

    const fs = createSeededVault()
    await fullSync(fs)

    const results = await searchNodes('extensibility')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].title).toContain('Extensibility')
  })

  it('returns empty for no matches', async () => {
    if (!fakeIdb) return

    const { fullSync } = await import('@/services/orchestrators/vaultSyncOrch')
    const { searchNodes } = await import('@/services/lego_blocks/dbBlock')

    const fs = createSeededVault()
    await fullSync(fs)

    const results = await searchNodes('zzzznonexistent')
    expect(results).toHaveLength(0)
  })
})
