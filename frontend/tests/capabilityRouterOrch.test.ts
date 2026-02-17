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

  it('derives epic status from descendant task statuses', async () => {
    const fs = new FakeVaultFS()

    const { node: program } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.create',
      input: {
        type: 'program',
        title: 'Ops Program',
        projectRoot: 'projects/ops',
      },
      actor: ACTOR,
    }, { fs })

    const { node: epic } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.create',
      input: {
        type: 'epic',
        title: 'Policy Engine',
        parentKey: program.key,
        parentUuid: program.uuid,
        parentType: 'program',
      },
      actor: ACTOR,
    }, { fs })

    const { node: task } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.create',
      input: {
        type: 'idea',
        title: 'Task A',
        parentKey: epic.key,
        parentUuid: epic.uuid,
        parentType: 'epic',
        extraFields: {
          record_kind: 'task',
          task_status: 'done',
        },
      },
      actor: ACTOR,
    }, { fs })

    const { node: epicAfterDone } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.get',
      input: { uuid: epic.uuid },
      actor: ACTOR,
    }, { fs })
    expect(epicAfterDone?.status).toBe('completed')

    await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'task.update_status',
      input: {
        uuid: task.uuid,
        taskStatus: 'in_progress',
      },
      actor: ACTOR,
    }, { fs })

    const { node: epicAfterActive } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.get',
      input: { uuid: epic.uuid },
      actor: ACTOR,
    }, { fs })
    expect(epicAfterActive?.status).toBe('active')
  })

  it('ignores manual epic status edits and keeps derived status', async () => {
    const fs = new FakeVaultFS()

    const { node: program } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.create',
      input: {
        type: 'program',
        title: 'Ops Program',
        projectRoot: 'projects/ops',
      },
      actor: ACTOR,
    }, { fs })

    const { node: epic } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.create',
      input: {
        type: 'epic',
        title: 'Manual Override Guard',
        parentKey: program.key,
        parentUuid: program.uuid,
        parentType: 'program',
      },
      actor: ACTOR,
    }, { fs })

    await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.create',
      input: {
        type: 'idea',
        title: 'Task A',
        parentKey: epic.key,
        parentUuid: epic.uuid,
        parentType: 'epic',
        extraFields: {
          record_kind: 'task',
          task_status: 'in_progress',
        },
      },
      actor: ACTOR,
    }, { fs })

    await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.update',
      input: {
        uuid: epic.uuid,
        updates: {
          status: 'completed',
        },
      },
      actor: ACTOR,
    }, { fs })

    const { node: epicAfterUpdate } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.get',
      input: { uuid: epic.uuid },
      actor: ACTOR,
    }, { fs })
    expect(epicAfterUpdate?.status).toBe('active')
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

  it('supports extra orchestration fields on create/update', async () => {
    const fs = new FakeVaultFS()

    const { node } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.create',
      input: {
        type: 'idea',
        title: 'Agent Task',
        projectRoot: 'projects/agent',
        extraFields: {
          record_kind: 'task',
          task_id: 'LTM-500',
          custom_scope: 'agent-native',
        },
      },
      actor: ACTOR,
    }, { fs })

    await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.update',
      input: {
        uuid: node.uuid,
        updates: {
          extraFields: {
            task_status: 'blocked',
            custom_scope: null,
          },
        },
      },
      actor: ACTOR,
    }, { fs })

    const { frontmatter } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.read_frontmatter',
      input: { filePath: node.filePath },
      actor: ACTOR,
    }, { fs })

    expect(frontmatter).not.toBeNull()
    expect(frontmatter!.record_kind).toBe('task')
    expect(frontmatter!.task_id).toBe('LTM-500')
    expect(frontmatter!.task_status).toBe('blocked')
    expect(frontmatter!.custom_scope).toBeUndefined()
  })

  it('supports task claim/status update and comment add capabilities', async () => {
    const fs = new FakeVaultFS()

    const { node: task } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.create',
      input: {
        type: 'idea',
        title: 'Migration Task',
        projectRoot: 'coding-projects/thinking-space',
        extraFields: {
          record_kind: 'task',
          task_id: 'LTM-900',
          task_status: 'ready',
          schema_version: '2',
        },
      },
      actor: ACTOR,
    }, { fs })

    const claimed = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'task.claim',
      input: {
        uuid: task.uuid,
        owner: 'codex-gpt5',
        note: 'Claimed for migration execution',
      },
      actor: ACTOR,
    }, { fs })
    expect(claimed.node.owner).toBe('codex-gpt5')
    expect(claimed.node.taskStatus).toBe('in_progress')

    const statusUpdated = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'task.update_status',
      input: {
        uuid: task.uuid,
        taskStatus: 'done',
      },
      actor: ACTOR,
    }, { fs })
    expect(statusUpdated.node.taskStatus).toBe('done')

    const commented = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'comment.add',
      input: {
        uuid: task.uuid,
        text: 'Completed migration bootstrap.',
      },
      actor: ACTOR,
    }, { fs })
    expect(commented.node.comments?.some(comment => comment.text.includes('Completed migration bootstrap.'))).toBe(true)
  })

  it('supports run.log and handoff.create capabilities', async () => {
    const fs = new FakeVaultFS()

    const { node: run } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'run.log',
      input: {
        title: 'Migration Run 001',
        projectRoot: 'coding-projects/thinking-space',
        result: 'success',
        sourceRepo: 'Thinking-Space',
        branch: 'main',
        commit: '251c328',
        artifacts: ['thinking-organizer/ideas'],
      },
      actor: ACTOR,
    }, { fs })
    expect(run.recordKind).toBe('run')
    expect(run.result).toBe('success')

    const { node: handoff } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'handoff.create',
      input: {
        title: 'Migration Handoff',
        projectRoot: 'coding-projects/thinking-space',
        fromAgent: 'codex',
        toAgent: 'claude',
        summary: 'Workspace imported and validated.',
        sourceRepo: 'Thinking-Space',
        branch: 'main',
        commit: '251c328',
      },
      actor: ACTOR,
    }, { fs })
    expect(handoff.recordKind).toBe('handoff')
    expect(handoff.description).toBe('Workspace imported and validated.')
    expect(handoff.filePath).toContain('thoughts/')
  })

  it('rejects handoff.create when summary is missing', async () => {
    const fs = new FakeVaultFS()
    await expect(capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'handoff.create',
      input: {
        title: 'Invalid Handoff',
        projectRoot: 'coding-projects/thinking-space',
        fromAgent: 'codex',
        toAgent: 'claude',
      },
      actor: ACTOR,
    }, { fs })).rejects.toThrow('Missing required field: summary')
  })

  it('reports and fixes status policy integrity violations', async () => {
    const fs = new FakeVaultFS()
    const integrity = await import('@/services/orchestrators/organizerIntegrityOrch')
    const hierarchy = await import('@/services/lego_blocks/yamlHierarchyBlock')

    const { node: program } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.create',
      input: {
        type: 'program',
        title: 'Ops Program',
        projectRoot: 'projects/ops',
      },
      actor: ACTOR,
    }, { fs })

    const { node: epic } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.create',
      input: {
        type: 'epic',
        title: 'Integrity Epic',
        parentKey: program.key,
        parentUuid: program.uuid,
        parentType: 'program',
      },
      actor: ACTOR,
    }, { fs })

    const { node: task } = await capabilityOrch!.invokeCapabilityOrThrow({
      capability: 'organizer.node.create',
      input: {
        type: 'idea',
        title: 'Integrity Task',
        parentKey: epic.key,
        parentUuid: epic.uuid,
        parentType: 'epic',
        extraFields: {
          record_kind: 'task',
          task_status: 'done',
        },
      },
      actor: ACTOR,
    }, { fs })

    await hierarchy.updateYamlNode(task.uuid, {
      status: 'active',
      extraFields: {
        record_kind: 'task',
        task_status: 'done',
      },
    }, fs)

    await hierarchy.updateYamlNode(epic.uuid, { status: 'active' }, fs)

    const reportBefore = await integrity.runOrganizerIntegrityCheck({
      fs,
      includeLegacyFieldScan: false,
    })
    expect(reportBefore.issues.some(issue => issue.kind === 'task_status_drift')).toBe(true)
    expect(reportBefore.issues.some(issue => issue.kind === 'epic_status_violation')).toBe(true)

    const applied = await integrity.applyOrganizerStatusPolicy({ fs })
    expect(applied.taskUpdates).toBeGreaterThan(0)
    expect(applied.epicUpdates).toBeGreaterThan(0)

    const reportAfter = await integrity.runOrganizerIntegrityCheck({
      fs,
      includeLegacyFieldScan: false,
    })
    expect(reportAfter.issues.some(issue => issue.kind === 'task_status_drift')).toBe(false)
    expect(reportAfter.issues.some(issue => issue.kind === 'epic_status_violation')).toBe(false)
  })
})
