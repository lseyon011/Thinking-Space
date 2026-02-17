import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ListedFiles, VaultEntry, VaultFS, VaultStat } from '@/services/lego_blocks/fsBlock'

class FakeVaultFS implements VaultFS {
  private readonly files = new Map<string, string>()
  private readonly mtimes = new Map<string, number>()
  private readonly dirs = new Set<string>([''])

  async read(path: string): Promise<string> {
    const normalized = this.normalize(path)
    const content = this.files.get(normalized)
    if (content == null) throw new Error(`Missing file: ${normalized}`)
    return content
  }

  async write(path: string, data: string): Promise<void> {
    const normalized = this.normalize(path)
    this.files.set(normalized, data)
    this.mtimes.set(normalized, Date.now() / 1000)
    this.ensureParentDirs(normalized)
  }

  async create(path: string, data: string): Promise<void> {
    const normalized = this.normalize(path)
    if (this.files.has(normalized)) throw new Error(`File already exists: ${normalized}`)
    await this.write(normalized, data)
  }

  async list(path: string): Promise<ListedFiles> {
    const normalized = this.normalize(path)
    if (!this.folderExists(normalized)) throw new Error(`Missing folder: ${normalized}`)

    const files = new Set<string>()
    const folders = new Set<string>()

    for (const filePath of this.files.keys()) {
      const { parent, name } = this.splitParent(filePath)
      if (parent === normalized) files.add(name)
    }

    for (const dirPath of this.dirs) {
      if (dirPath === normalized) continue
      const { parent, name } = this.splitParent(dirPath)
      if (parent === normalized) folders.add(name)
    }

    return {
      files: [...files].sort(),
      folders: [...folders].sort(),
    }
  }

  async walkVault(extensions: string[] = ['.md']): Promise<VaultEntry[]> {
    const lowered = extensions.map(ext => ext.toLowerCase())
    const entries: VaultEntry[] = []

    for (const [path, content] of this.files.entries()) {
      const include = lowered.some(ext => path.toLowerCase().endsWith(ext))
      if (!include) continue

      const ts = this.mtimes.get(path) ?? Date.now() / 1000
      entries.push({
        path,
        size: content.length,
        mtime: ts,
        ctime: ts,
      })
    }

    return entries
  }

  async stat(path: string): Promise<VaultStat> {
    const normalized = this.normalize(path)
    if (this.files.has(normalized)) {
      return {
        size: this.files.get(normalized)!.length,
        mtime: this.mtimes.get(normalized) ?? 0,
        isDirectory: false,
      }
    }

    if (this.folderExists(normalized)) {
      return {
        size: 0,
        mtime: 0,
        isDirectory: true,
      }
    }

    throw new Error(`Missing path: ${normalized}`)
  }

  async exists(path: string): Promise<boolean> {
    const normalized = this.normalize(path)
    return this.files.has(normalized) || this.folderExists(normalized)
  }

  async mkdir(path: string): Promise<void> {
    const normalized = this.normalize(path)
    this.ensureDir(normalized)
  }

  async process(path: string, fn: (data: string) => string): Promise<void> {
    const current = await this.read(path)
    await this.write(path, fn(current))
  }

  private normalize(path: string): string {
    return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/')
  }

  private splitParent(path: string): { parent: string; name: string } {
    const idx = path.lastIndexOf('/')
    if (idx < 0) return { parent: '', name: path }
    return {
      parent: path.slice(0, idx),
      name: path.slice(idx + 1),
    }
  }

  private ensureParentDirs(path: string): void {
    const parts = this.normalize(path).split('/')
    if (parts.length <= 1) return

    let cursor = ''
    for (let i = 0; i < parts.length - 1; i += 1) {
      cursor = cursor ? `${cursor}/${parts[i]}` : parts[i]
      this.dirs.add(cursor)
    }
  }

  private ensureDir(path: string): void {
    const normalized = this.normalize(path)
    if (!normalized) return

    const parts = normalized.split('/')
    let cursor = ''
    for (const part of parts) {
      cursor = cursor ? `${cursor}/${part}` : part
      this.dirs.add(cursor)
    }
  }

  private folderExists(path: string): boolean {
    if (!path) return true
    if (this.dirs.has(path)) return true
    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(`${path}/`)) return true
    }
    return false
  }
}

const ACTOR = { kind: 'human', id: 'test-suite' } as const

let fakeIdb: typeof import('fake-indexeddb') | null = null
let capabilityOrch: typeof import('@/services/orchestrators/capabilityRouterOrch') | null = null

beforeEach(async () => {
  fakeIdb = await import('fake-indexeddb')
  globalThis.indexedDB = fakeIdb.default
  globalThis.IDBKeyRange = fakeIdb.IDBKeyRange as any
  capabilityOrch = await import('@/services/orchestrators/capabilityRouterOrch')
})

afterEach(async () => {
  const { deleteDb } = await import('@/services/lego_blocks/dbBlock')
  await deleteDb()
})

describe('capabilityRouterOrch', () => {
  it('lists organizer capabilities', () => {
    const names = capabilityOrch!.listCapabilitiesOrch().map(capability => capability.name)
    expect(names).toContain('organizer.node.create')
    expect(names).toContain('organizer.node.update')
  })

  it('creates and lists nodes through capability invocations', async () => {
    const fs = new FakeVaultFS()

    const { node: program } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.create',
      input: {
        type: 'program',
        title: 'Data Ingestion',
        projectRoot: 'projects/data-ingestion',
      },
      actor: ACTOR,
    }, { fs })

    await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.create',
      input: {
        type: 'epic',
        title: 'Backlog Polish',
        parentKey: program.key,
        parentUuid: program.uuid,
        parentType: 'program',
      },
      actor: ACTOR,
    }, { fs })

    const { nodes: roots } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.nodes.list_roots',
      input: { typeFilter: 'program' },
      actor: ACTOR,
    }, { fs })
    expect(roots.length).toBe(1)

    const { nodes: children } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.nodes.list_children',
      input: { parentKey: program.key },
      actor: ACTOR,
    }, { fs })
    expect(children.length).toBe(1)
    expect(children[0].type).toBe('epic')
  })

  it('writes structured comment metadata on update', async () => {
    const fs = new FakeVaultFS()

    const { node: thought } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.create',
      input: {
        type: 'thought',
        title: 'Capture findings',
        projectRoot: 'projects/data-ingestion',
      },
      actor: ACTOR,
    }, { fs })

    await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.update',
      input: {
        uuid: thought.uuid,
        updates: {
          comments: ['Need validation numbers'],
        },
      },
      actor: ACTOR,
    }, { fs })

    const { frontmatter } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.read_frontmatter',
      input: { filePath: thought.filePath },
      actor: ACTOR,
    }, { fs })

    expect(frontmatter).not.toBeNull()
    expect(frontmatter!.comments?.[0].text).toBe('Need validation numbers')
    expect(frontmatter!.comments?.[0].added_by).toBe('unknown')
    expect(frontmatter!.comments?.[0].added_at).toBeTruthy()
  })

  it('supports dry-run preview for move without persisting', async () => {
    const fs = new FakeVaultFS()

    const { node: programA } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.create',
      input: {
        type: 'program',
        title: 'Program A',
        projectRoot: 'projects/a',
      },
      actor: ACTOR,
    }, { fs })

    const { node: programB } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.create',
      input: {
        type: 'program',
        title: 'Program B',
        projectRoot: 'projects/b',
      },
      actor: ACTOR,
    }, { fs })

    const { node: epic } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.create',
      input: {
        type: 'epic',
        title: 'Epic 1',
        parentKey: programA.key,
        parentUuid: programA.uuid,
        parentType: 'program',
      },
      actor: ACTOR,
    }, { fs })

    const dryRun = await capabilityOrch!.invokeCapabilityOrch({
      capability: 'organizer.node.move',
      input: {
        uuid: epic.uuid,
        newParentKey: programB.key,
      },
      actor: ACTOR,
      dryRun: true,
    }, { fs })

    expect(dryRun.ok).toBe(true)
    if (!dryRun.ok) throw new Error('Expected dry-run response to succeed')
    expect(dryRun.data.preview?.fromParentKey).toBe(programA.key)
    expect(dryRun.data.preview?.toParentKey).toBe(programB.key)
    expect(dryRun.warnings[0]).toContain('Dry-run')

    const { nodes: stillUnderA } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.nodes.list_children',
      input: { parentKey: programA.key },
      actor: ACTOR,
    }, { fs })
    expect(stillUnderA.some(node => node.uuid === epic.uuid)).toBe(true)

    const { nodes: underB } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.nodes.list_children',
      input: { parentKey: programB.key },
      actor: ACTOR,
    }, { fs })
    expect(underB.some(node => node.uuid === epic.uuid)).toBe(false)
  })

  it('supports dry-run preview for delete without persisting', async () => {
    const fs = new FakeVaultFS()

    const { node } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.create',
      input: {
        type: 'thought',
        title: 'Delete candidate',
        projectRoot: 'projects/data-ingestion',
      },
      actor: ACTOR,
    }, { fs })

    const dryRun = await capabilityOrch!.invokeCapabilityOrch({
      capability: 'organizer.node.delete',
      input: {
        uuid: node.uuid,
      },
      actor: ACTOR,
      dryRun: true,
    }, { fs })

    expect(dryRun.ok).toBe(true)
    if (!dryRun.ok) throw new Error('Expected dry-run response to succeed')
    expect(dryRun.data.deleted).toBe(true)
    expect(dryRun.data.preview?.nodeUuid).toBe(node.uuid)

    const { node: stillThere } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.get',
      input: { uuid: node.uuid },
      actor: ACTOR,
    }, { fs })
    expect(stillThere).not.toBeNull()
  })

  it('writes capability audit entries', async () => {
    const fs = new FakeVaultFS()

    await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.create',
      input: {
        type: 'program',
        title: 'Audit Program',
        projectRoot: 'projects/audit',
      },
      actor: ACTOR,
    }, { fs })

    const log = await fs.read('.ltm-pilot/audit/capability-audit.log')
    const lines = log.split('\n').filter(Boolean)
    expect(lines.length).toBeGreaterThan(0)

    const latest = JSON.parse(lines[lines.length - 1]) as { capability: string; ok: boolean; auditId: string }
    expect(latest.capability).toBe('organizer.node.create')
    expect(latest.ok).toBe(true)
    expect(latest.auditId).toContain('audit-')
  })
})
