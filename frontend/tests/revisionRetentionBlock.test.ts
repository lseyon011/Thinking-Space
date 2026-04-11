import { beforeEach, describe, expect, it, vi } from 'vitest'

class FakeRevisionRetentionFs {
  private readonly files = new Set<string>()
  private readonly dirs = new Set<string>([''])
  readonly deleted: string[] = []

  private normalize(path: string): string {
    return path.replace(/\\/g, '/').replace(/\/+$/g, '')
  }

  private ensureParentDirs(path: string): void {
    const normalized = this.normalize(path)
    const parts = normalized.split('/').filter(Boolean)
    let current = ''
    for (let i = 0; i < parts.length - 1; i += 1) {
      current = current ? `${current}/${parts[i]}` : parts[i]
      this.dirs.add(current)
    }
  }

  seedFile(path: string): void {
    const normalized = this.normalize(path)
    this.ensureParentDirs(normalized)
    this.files.add(normalized)
  }

  async exists(path: string): Promise<boolean> {
    const normalized = this.normalize(path)
    return this.files.has(normalized) || this.dirs.has(normalized)
  }

  async list(path: string): Promise<{ files: string[]; folders: string[] }> {
    const normalized = this.normalize(path)
    const files = new Set<string>()
    const folders = new Set<string>()
    const prefix = normalized ? `${normalized}/` : ''

    for (const filePath of this.files) {
      if (!filePath.startsWith(prefix)) continue
      const remainder = filePath.slice(prefix.length)
      if (!remainder || remainder.includes('/')) continue
      files.add(remainder)
    }

    for (const dirPath of this.dirs) {
      if (!dirPath || dirPath === normalized || !dirPath.startsWith(prefix)) continue
      const remainder = dirPath.slice(prefix.length)
      if (!remainder || remainder.includes('/')) continue
      folders.add(remainder)
    }

    return {
      files: [...files].sort(),
      folders: [...folders].sort(),
    }
  }

  async delete(path: string): Promise<void> {
    const normalized = this.normalize(path)
    this.deleted.push(normalized)
    this.files.delete(normalized)
  }
}

let fakeFs: FakeRevisionRetentionFs

vi.mock('@/services/lego_blocks/integrations/fsBlock', () => ({
  getVaultFS: () => fakeFs,
}))

describe('revisionRetentionBlock', () => {
  beforeEach(() => {
    vi.resetModules()
    fakeFs = new FakeRevisionRetentionFs()
  })

  it('keeps the latest five revision snapshots for the same source file', async () => {
    const marker = 'notes__a.md'
    fakeFs.seedFile('.thinking-space/revisions/2026-04-01/090000-000--notes__b.md')
    fakeFs.seedFile(`.thinking-space/revisions/2026-04-01/090000-000--${marker}`)
    fakeFs.seedFile(`.thinking-space/revisions/2026-04-02/090000-000--${marker}`)
    fakeFs.seedFile(`.thinking-space/revisions/2026-04-03/090000-000--${marker}`)
    fakeFs.seedFile(`.thinking-space/revisions/2026-04-04/090000-000--${marker}`)
    fakeFs.seedFile(`.thinking-space/revisions/2026-04-05/090000-000--${marker}`)
    fakeFs.seedFile(`.thinking-space/revisions/2026-04-06/090000-000--${marker}`)

    const { pruneRevisionHistoryBlock } = await import('@/services/lego_blocks/integrations/revisionRetentionBlock')
    await pruneRevisionHistoryBlock(`.thinking-space/revisions/2026-04-06/090000-000--${marker}`)

    expect(fakeFs.deleted).toEqual([
      `.thinking-space/revisions/2026-04-01/090000-000--${marker}`,
    ])
  })

  it('does nothing when the revision file name is malformed', async () => {
    fakeFs.seedFile('.thinking-space/revisions/2026-04-06/bad-file-name')

    const { pruneRevisionHistoryBlock } = await import('@/services/lego_blocks/integrations/revisionRetentionBlock')
    await pruneRevisionHistoryBlock('.thinking-space/revisions/2026-04-06/bad-file-name')

    expect(fakeFs.deleted).toEqual([])
  })
})
