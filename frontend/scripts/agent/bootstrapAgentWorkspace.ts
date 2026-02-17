import fs from 'node:fs/promises'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  createNote,
  generateKey,
  parseNote,
  stringifyNote,
  type NodeType,
} from '../../src/services/lego_blocks/yamlNoteBlock'

interface CreatedNode {
  type: NodeType
  key: string
  uuid: string
  filePath: string
}

interface BootstrapContext {
  projectRootAbs: string
  projectRootValue: string
  repoRoot: string
  sourceRepo: string
  branch: string
  commit: string
  keySet: Set<string>
  nodesByKey: Map<string, CreatedNode>
}

const TYPE_FOLDERS: Record<NodeType, string> = {
  program: 'programs',
  epic: 'epics',
  idea_bucket: 'idea_buckets',
  idea: 'ideas',
  thought_bucket: 'thought_buckets',
  thought: 'thoughts',
}

async function main(): Promise<void> {
  const target = process.argv[2]?.trim()
  if (!target) {
    throw new Error(
      'Usage: vite-node scripts/agent/bootstrapAgentWorkspace.ts "<target-project-root>"',
    )
  }

  const projectRootAbs = path.resolve(target)
  const repoRoot = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)))

  const ctx: BootstrapContext = {
    projectRootAbs,
    projectRootValue: deriveProjectRootValue(projectRootAbs),
    repoRoot,
    sourceRepo: path.basename(repoRoot),
    branch: safeGit(repoRoot, 'rev-parse --abbrev-ref HEAD') || 'unknown',
    commit: safeGit(repoRoot, 'rev-parse HEAD') || 'unknown',
    keySet: new Set<string>(),
    nodesByKey: new Map<string, CreatedNode>(),
  }

  await ensureOrganizerDirs(ctx)

  const program = await createNode(ctx, {
    type: 'program',
    title: 'Thinking Space Agent Operations',
    tags: ['ops', 'agent-management'],
    body: [
      '# Thinking Space Agent Operations',
      '',
      'Workspace for agent-native execution tracking imported from repo-local `agents/*.md` artifacts.',
      '',
      `Source repository: ${ctx.sourceRepo}`,
      `Branch: ${ctx.branch}`,
      `Commit: ${ctx.commit}`,
    ].join('\n'),
    extraFields: {
      record_kind: 'note',
      schema_version: '2',
      source_repo: ctx.sourceRepo,
      branch: ctx.branch,
      commit: ctx.commit,
      artifacts: ['agents/TODO.md', 'agents/DONE.md', 'agents/HANDOFFS.md', 'agents/UNDERSTANDINGS.md'],
    },
  })

  const backlogEpic = await createNode(ctx, {
    type: 'epic',
    title: 'Task Backlog',
    parent: program,
    tags: ['ops/task'],
    extraFields: {
      record_kind: 'note',
      schema_version: '2',
      source_repo: ctx.sourceRepo,
      branch: ctx.branch,
      commit: ctx.commit,
      artifacts: ['agents/TODO.md'],
    },
  })

  const runsEpic = await createNode(ctx, {
    type: 'epic',
    title: 'Execution Runs',
    parent: program,
    tags: ['ops/run'],
    extraFields: {
      record_kind: 'note',
      schema_version: '2',
      source_repo: ctx.sourceRepo,
      branch: ctx.branch,
      commit: ctx.commit,
      artifacts: ['agents/DONE.md'],
    },
  })

  const handoffsEpic = await createNode(ctx, {
    type: 'epic',
    title: 'Handoffs',
    parent: program,
    tags: ['ops/handoff'],
    extraFields: {
      record_kind: 'note',
      schema_version: '2',
      source_repo: ctx.sourceRepo,
      branch: ctx.branch,
      commit: ctx.commit,
      artifacts: ['agents/HANDOFFS.md'],
    },
  })

  const principlesEpic = await createNode(ctx, {
    type: 'epic',
    title: 'Principles and Decisions',
    parent: program,
    tags: ['ops/principles'],
    extraFields: {
      record_kind: 'note',
      schema_version: '2',
      source_repo: ctx.sourceRepo,
      branch: ctx.branch,
      commit: ctx.commit,
      artifacts: ['agents/UNDERSTANDINGS.md'],
    },
  })

  const todoImported = await importTodoRows(ctx, backlogEpic)
  const doneImported = await importDoneRows(ctx, runsEpic)
  const handoffImported = await importHandoffRows(ctx, handoffsEpic)
  const understandingImported = await importUnderstandings(ctx, principlesEpic)

  const manifestPath = path.join(
    ctx.projectRootAbs,
    'thinking-organizer',
    'import-manifest.md',
  )
  const manifest = [
    '# Agent Workspace Import Manifest',
    '',
    `Imported at: ${new Date().toISOString()}`,
    `Source repo: ${ctx.sourceRepo}`,
    `Source branch: ${ctx.branch}`,
    `Source commit: ${ctx.commit}`,
    '',
    '## Counts',
    '',
    `- Tasks imported: ${todoImported}`,
    `- Run/completion notes imported: ${doneImported}`,
    `- Handoffs imported: ${handoffImported}`,
    `- Principles/decisions imported: ${understandingImported}`,
    '',
    '## Source Files',
    '',
    '- agents/TODO.md',
    '- agents/DONE.md',
    '- agents/HANDOFFS.md',
    '- agents/UNDERSTANDINGS.md',
  ].join('\n')
  await fs.writeFile(manifestPath, manifest, 'utf-8')

  console.log(
    JSON.stringify(
      {
        ok: true,
        projectRoot: ctx.projectRootAbs,
        counts: {
          tasks: todoImported,
          runs: doneImported,
          handoffs: handoffImported,
          principles: understandingImported,
        },
      },
      null,
      2,
    ),
  )
}

async function ensureOrganizerDirs(ctx: BootstrapContext): Promise<void> {
  await fs.mkdir(ctx.projectRootAbs, { recursive: true })
  await fs.mkdir(path.join(ctx.projectRootAbs, 'thinking-organizer'), { recursive: true })
  for (const folder of Object.values(TYPE_FOLDERS)) {
    await fs.mkdir(path.join(ctx.projectRootAbs, 'thinking-organizer', folder), { recursive: true })
  }
}

async function createNode(
  ctx: BootstrapContext,
  params: {
    type: NodeType
    title: string
    parent?: CreatedNode
    tags?: string[]
    body?: string
    extraFields?: Record<string, unknown>
  },
): Promise<CreatedNode> {
  const note = createNote({
    type: params.type,
    title: params.title,
    parent: params.parent?.key,
    parent_uuid: params.parent?.uuid,
    parent_type: params.parent?.type,
    tags: params.tags,
    body: params.body,
  })

  note.frontmatter.project_root = ctx.projectRootValue
  note.frontmatter.source_repo = ctx.sourceRepo
  note.frontmatter.branch = ctx.branch
  note.frontmatter.commit = ctx.commit
  note.frontmatter.schema_version = '2'

  if (params.extraFields) {
    for (const [key, value] of Object.entries(params.extraFields)) {
      if (value === undefined || value === null || value === '') continue
      note.frontmatter[key] = value
    }
  }

  note.frontmatter.key = makeUniqueKey(ctx, note.frontmatter.key || generateKey(params.title) || params.type)
  const folder = path.join(
    ctx.projectRootAbs,
    'thinking-organizer',
    TYPE_FOLDERS[params.type],
  )
  const filename = `${params.type}-${note.frontmatter.key}.md`
  const filePathAbs = path.join(folder, filename)
  await fs.writeFile(filePathAbs, stringifyNote(note), 'utf-8')

  if (params.parent) {
    await appendChildKey(ctx, params.parent, note.frontmatter.key)
  }

  const relPath = path.relative(ctx.projectRootAbs, filePathAbs).replace(/\\/g, '/')
  const created: CreatedNode = {
    type: params.type,
    key: note.frontmatter.key,
    uuid: note.frontmatter.uuid,
    filePath: relPath,
  }
  ctx.nodesByKey.set(created.key, created)
  return created
}

async function appendChildKey(ctx: BootstrapContext, parent: CreatedNode, childKey: string): Promise<void> {
  const parentPath = path.join(ctx.projectRootAbs, parent.filePath)
  const content = await fs.readFile(parentPath, 'utf-8')
  const parsed = parseNote(content)
  if (!parsed) return
  const existing = parsed.frontmatter.children ?? []
  if (!existing.includes(childKey)) existing.push(childKey)
  parsed.frontmatter.children = existing
  parsed.frontmatter.updated_at = new Date().toISOString()
  await fs.writeFile(parentPath, stringifyNote(parsed), 'utf-8')
}

async function importTodoRows(ctx: BootstrapContext, parent: CreatedNode): Promise<number> {
  const filePath = path.join(ctx.repoRoot, 'agents', 'TODO.md')
  const content = await fs.readFile(filePath, 'utf-8')
  const rows = content
    .split('\n')
    .filter(line => line.startsWith('| LTM-'))

  let count = 0
  for (const row of rows) {
    const cols = row
      .split('|')
      .slice(1, -1)
      .map(part => part.trim())
    if (cols.length < 6) continue

    const [taskId, title, status, owner, dependsOn, acceptance] = cols
    const normalizedStatus = normalizeTaskStatus(status)
    const depends = parseCsv(dependsOn)
    const nodeTitle = `${taskId} ${title}`

    const body = [
      `# ${nodeTitle}`,
      '',
      `Status: ${status}`,
      `Owner: ${owner || 'unassigned'}`,
      '',
      '## Acceptance Criteria',
      '',
      acceptance || 'No criteria provided',
      '',
      '## Source',
      '',
      '- agents/TODO.md',
    ].join('\n')

    await createNode(ctx, {
      type: 'idea',
      title: nodeTitle,
      parent,
      tags: ['ops/task'],
      body,
      extraFields: {
        record_kind: 'task',
        schema_version: '2',
        task_id: taskId,
        task_status: normalizedStatus,
        depends_on: depends,
        blocked_by: [],
        acceptance_criteria: acceptance ? [acceptance] : [],
        owner: owner && owner !== 'unassigned' ? owner : 'unknown',
        source_repo: ctx.sourceRepo,
        branch: ctx.branch,
        commit: ctx.commit,
        artifacts: ['agents/TODO.md'],
        related_nodes: depends,
        state_history: [
          {
            at: new Date().toISOString(),
            by: 'migration',
            from: '',
            to: normalizedStatus,
            note: 'Imported from agents/TODO.md',
          },
        ],
      },
    })
    count += 1
  }
  return count
}

async function importDoneRows(ctx: BootstrapContext, parent: CreatedNode): Promise<number> {
  const filePath = path.join(ctx.repoRoot, 'agents', 'DONE.md')
  const content = await fs.readFile(filePath, 'utf-8')
  const regex = /^###\s+(.+)\n([\s\S]*?)(?=^###\s+|^##\s+|(?![\s\S]))/gm
  let match: RegExpExecArray | null
  let count = 0

  while ((match = regex.exec(content)) !== null) {
    const heading = match[1].trim()
    const sectionBody = match[2].trim()
    const runId = `run-${generateKey(heading).slice(0, 24) || Date.now().toString(36)}`

    await createNode(ctx, {
      type: 'thought',
      title: heading,
      parent,
      tags: ['ops/run'],
      body: sectionBody,
      extraFields: {
        record_kind: 'run',
        schema_version: '2',
        run_id: runId,
        result: 'success',
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        source_repo: ctx.sourceRepo,
        branch: ctx.branch,
        commit: ctx.commit,
        artifacts: ['agents/DONE.md'],
      },
    })
    count += 1
  }

  return count
}

async function importHandoffRows(ctx: BootstrapContext, parent: CreatedNode): Promise<number> {
  const filePath = path.join(ctx.repoRoot, 'agents', 'HANDOFFS.md')
  const content = await fs.readFile(filePath, 'utf-8')
  const regex = /^##\s+(.+)\n([\s\S]*?)(?=^##\s+|(?![\s\S]))/gm
  let match: RegExpExecArray | null
  let count = 0

  while ((match = regex.exec(content)) !== null) {
    const heading = match[1].trim()
    if (heading.toLowerCase().includes('agent handoffs')) continue
    const sectionBody = match[2].trim()

    await createNode(ctx, {
      type: 'thought',
      title: heading,
      parent,
      tags: ['ops/handoff'],
      body: sectionBody,
      extraFields: {
        record_kind: 'handoff',
        schema_version: '2',
        source_repo: ctx.sourceRepo,
        branch: ctx.branch,
        commit: ctx.commit,
        artifacts: ['agents/HANDOFFS.md'],
      },
    })
    count += 1
  }

  return count
}

async function importUnderstandings(ctx: BootstrapContext, parent: CreatedNode): Promise<number> {
  const filePath = path.join(ctx.repoRoot, 'agents', 'UNDERSTANDINGS.md')
  const content = await fs.readFile(filePath, 'utf-8')
  const sections = splitBySection(content)
  const nodes: Array<{ title: string; kind: 'decision' | 'principle'; body: string }> = []

  for (const line of sections['Locked Decisions'] ?? []) {
    const m = line.match(/^\d+\.\s+(.+)$/)
    if (!m) continue
    nodes.push({
      title: m[1].trim(),
      kind: 'decision',
      body: m[1].trim(),
    })
  }

  for (const sectionName of ['Product Direction', 'Invariants to Preserve']) {
    for (const line of sections[sectionName] ?? []) {
      const m = line.match(/^-+\s+(.+)$/)
      if (!m) continue
      nodes.push({
        title: m[1].trim(),
        kind: 'principle',
        body: m[1].trim(),
      })
    }
  }

  let count = 0
  for (const item of nodes) {
    await createNode(ctx, {
      type: 'idea',
      title: item.title.slice(0, 120),
      parent,
      tags: ['ops/principles'],
      body: item.body,
      extraFields: {
        record_kind: item.kind,
        schema_version: '2',
        source_repo: ctx.sourceRepo,
        branch: ctx.branch,
        commit: ctx.commit,
        artifacts: ['agents/UNDERSTANDINGS.md'],
      },
    })
    count += 1
  }

  return count
}

function makeUniqueKey(ctx: BootstrapContext, initial: string): string {
  const base = generateKey(initial) || 'node'
  if (!ctx.keySet.has(base)) {
    ctx.keySet.add(base)
    return base
  }

  let index = 2
  while (index < 10_000) {
    const next = `${base}-${index}`
    if (!ctx.keySet.has(next)) {
      ctx.keySet.add(next)
      return next
    }
    index += 1
  }
  throw new Error(`Failed to generate unique key for ${initial}`)
}

function normalizeTaskStatus(raw: string): string {
  const value = raw
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  return value || 'unknown'
}

function parseCsv(raw: string): string[] {
  return raw
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
}

function deriveProjectRootValue(projectRootAbs: string): string {
  const normalized = projectRootAbs.replace(/\\/g, '/')
  const marker = '/Documents/Long Term Memory iCloud/'
  const idx = normalized.indexOf(marker)
  if (idx >= 0) {
    const relative = normalized.slice(idx + marker.length).replace(/^\/+/, '')
    if (relative) return relative
  }
  return path.basename(projectRootAbs)
}

function safeGit(repoRoot: string, command: string): string {
  try {
    return execSync(`git -C "${repoRoot}" ${command}`, { encoding: 'utf-8' }).trim()
  } catch {
    return ''
  }
}

function splitBySection(content: string): Record<string, string[]> {
  const lines = content.split('\n')
  const sections: Record<string, string[]> = {}
  let current = ''
  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)$/)
    if (heading) {
      current = heading[1].trim()
      if (!sections[current]) sections[current] = []
      continue
    }
    if (!current) continue
    sections[current].push(line)
  }
  return sections
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ ok: false, error: message }))
  process.exit(1)
})
