import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VaultFS, ListedFiles, VaultStat, VaultEntry } from '@/services/lego_blocks/fsBlock'

class FakeVaultFS implements VaultFS {
  private readonly files = new Map<string, string>()
  private readonly mtimes = new Map<string, number>()
  readonly writes: string[] = []
  readonly mkdirs: string[] = []

  seedFile(path: string, content: string, mtime: number): void {
    this.files.set(path, content)
    this.mtimes.set(path, mtime)
  }

  async read(path: string): Promise<string> {
    const content = this.files.get(path)
    if (content == null) throw new Error(`Missing file: ${path}`)
    return content
  }

  async write(path: string, data: string): Promise<void> {
    this.writes.push(path)
    this.files.set(path, data)
    this.mtimes.set(path, (this.mtimes.get(path) ?? 0) + 1)
  }

  async create(path: string, data: string): Promise<void> {
    await this.write(path, data)
  }

  async list(_path: string): Promise<ListedFiles> {
    return { files: [], folders: [] }
  }

  async walkVault(): Promise<VaultEntry[]> {
    return []
  }

  async stat(path: string): Promise<VaultStat> {
    const mtime = this.mtimes.get(path)
    if (mtime == null) throw new Error(`Missing stat: ${path}`)
    return { size: (this.files.get(path) ?? '').length, mtime, ctime: mtime }
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path)
  }

  async mkdir(path: string): Promise<void> {
    this.mkdirs.push(path)
  }

  async process(path: string, fn: (data: string) => string): Promise<void> {
    const content = await this.read(path)
    await this.write(path, fn(content))
  }
}

const fakeFs = new FakeVaultFS()

vi.mock('@/services/lego_blocks/fsBlock', () => {
  return {
    getVaultFS: () => fakeFs,
  }
})

describe('markdownDocumentsOrch', () => {
  beforeEach(() => {
    fakeFs.writes.length = 0
    fakeFs.mkdirs.length = 0
    fakeFs.seedFile('notes/a.md', 'hello', 10)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-14T12:34:56.789Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('throws conflict when base mtime/hash changed', async () => {
    const mod = await import('@/services/orchestrators/markdownDocumentsOrch')

    const opened = await mod.readMarkdownDocument('notes/a.md')
    await fakeFs.write('notes/a.md', 'server-side change')

    await expect(mod.saveMarkdownDocument({
      path: 'notes/a.md',
      content: 'my edit',
      baseMtime: opened.mtime,
      baseHash: opened.hash,
    })).rejects.toBeInstanceOf(mod.MarkdownDocumentConflictError)
  })

  it('writes revision snapshot before save on content changes', async () => {
    const mod = await import('@/services/orchestrators/markdownDocumentsOrch')
    const opened = await mod.readMarkdownDocument('notes/a.md')

    const result = await mod.saveMarkdownDocument({
      path: 'notes/a.md',
      content: 'updated content',
      baseMtime: opened.mtime,
      baseHash: opened.hash,
    })

    expect(result.output_path).toBe('notes/a.md')
    expect(result.revision_path).toContain('.ltm-pilot/revisions/2026-02-14/')
    expect(fakeFs.mkdirs[0]).toContain('.ltm-pilot/revisions/2026-02-14')
    expect(fakeFs.writes.some(path => path === 'notes/a.md')).toBe(true)
    expect(fakeFs.writes.some(path => path.includes('.ltm-pilot/revisions/2026-02-14'))).toBe(true)
  })
})
