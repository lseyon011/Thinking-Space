import fs from 'node:fs/promises'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  createNote,
  generateKey,
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
  sourceRepo: string
  branch: string
  commit: string
  keySet: Set<string>
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
    throw new Error('Usage: vite-node scripts/agent/bootstrapAgentWorkspace.ts "<target-project-root>"')
  }

  const projectRootAbs = path.resolve(target)
  const repoRoot = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)))

  const ctx: BootstrapContext = {
    projectRootAbs,
    projectRootValue: deriveProjectRootValue(projectRootAbs),
    sourceRepo: path.basename(repoRoot),
    branch: safeGit(repoRoot, 'rev-parse --abbrev-ref HEAD') || 'unknown',
    commit: safeGit(repoRoot, 'rev-parse HEAD') || 'unknown',
    keySet: new Set<string>(),
  }

  await ensureOrganizerDirs(ctx)

  const developmentProgram = await createNode(ctx, {
    type: 'program',
    title: 'development (agent operations)',
    body: [
      '# development (agent operations)',
      '',
      'Primary workspace for active implementation tasks, plans, and execution runs.',
    ].join('\n'),
    extraFields: {
      record_kind: 'note',
      schema_version: '2',
      description: 'Primary workspace for active implementation tasks, plans, and execution runs.',
      source_repo: ctx.sourceRepo,
      branch: ctx.branch,
      commit: ctx.commit,
      artifacts: ['thinking-organizer/programs'],
    },
    tags: ['ops', 'development'],
  })

  await createNode(ctx, {
    type: 'epic',
    title: 'task backlog',
    parent: developmentProgram,
    tags: ['ops/task'],
    extraFields: {
      record_kind: 'note',
      schema_version: '2',
      description: 'Backlog epic containing active and upcoming implementation tasks.',
      source_repo: ctx.sourceRepo,
      branch: ctx.branch,
      commit: ctx.commit,
    },
  })

  await createNode(ctx, {
    type: 'epic',
    title: 'execution runs',
    parent: developmentProgram,
    tags: ['ops/run'],
    extraFields: {
      record_kind: 'note',
      schema_version: '2',
      description: 'Execution run records linked to task delivery and outcomes.',
      source_repo: ctx.sourceRepo,
      branch: ctx.branch,
      commit: ctx.commit,
    },
  })

  const handoffsProgram = await createNode(ctx, {
    type: 'program',
    title: 'handoffs (agent operations)',
    body: [
      '# handoffs (agent operations)',
      '',
      'Cross-session and cross-agent transfer records.',
    ].join('\n'),
    extraFields: {
      record_kind: 'note',
      schema_version: '2',
      description: 'Cross-session and cross-agent transfer records.',
      source_repo: ctx.sourceRepo,
      branch: ctx.branch,
      commit: ctx.commit,
    },
    tags: ['ops', 'handoff'],
  })

  await createNode(ctx, {
    type: 'epic',
    title: 'active handoffs',
    parent: handoffsProgram,
    tags: ['ops/handoff'],
    extraFields: {
      record_kind: 'note',
      schema_version: '2',
      description: 'Current pending and active handoff records.',
      source_repo: ctx.sourceRepo,
      branch: ctx.branch,
      commit: ctx.commit,
    },
  })

  const principlesProgram = await createNode(ctx, {
    type: 'program',
    title: 'principles and decisions (agent operations)',
    body: [
      '# principles and decisions (agent operations)',
      '',
      'Durable operating guidance, architecture decisions, and reusable learnings.',
    ].join('\n'),
    extraFields: {
      record_kind: 'note',
      schema_version: '2',
      description: 'Durable operating guidance, architecture decisions, and reusable learnings.',
      source_repo: ctx.sourceRepo,
      branch: ctx.branch,
      commit: ctx.commit,
    },
    tags: ['ops', 'principles'],
  })

  await createNode(ctx, {
    type: 'epic',
    title: 'operating contract',
    parent: principlesProgram,
    tags: ['ops/principles'],
    extraFields: {
      record_kind: 'decision',
      schema_version: '2',
      description: 'Core operating contract and guardrails for agents and humans.',
      source_repo: ctx.sourceRepo,
      branch: ctx.branch,
      commit: ctx.commit,
    },
  })

  const manifestPath = path.join(ctx.projectRootAbs, 'thinking-organizer', 'bootstrap-manifest.md')
  const manifest = [
    '# Agent Workspace Bootstrap Manifest',
    '',
    `Bootstrapped at: ${new Date().toISOString()}`,
    `Source repo: ${ctx.sourceRepo}`,
    `Source branch: ${ctx.branch}`,
    `Source commit: ${ctx.commit}`,
    '',
    '## Notes',
    '',
    '- This bootstrap creates the organizer workspace structure only.',
    '- Active tasks/plans/runs/handoffs should be created in-tool after bootstrap.',
  ].join('\n')
  await fs.writeFile(manifestPath, manifest, 'utf-8')

  console.log(
    JSON.stringify(
      {
        ok: true,
        projectRoot: ctx.projectRootAbs,
        created: [
          'development (agent operations)',
          'handoffs (agent operations)',
          'principles and decisions (agent operations)',
        ],
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

  const folder = path.join(ctx.projectRootAbs, 'thinking-organizer', TYPE_FOLDERS[params.type])
  const filename = `${params.type}-${note.frontmatter.key}.md`
  const filePathAbs = path.join(folder, filename)
  await fs.writeFile(filePathAbs, stringifyNote(note), 'utf-8')

  const relPath = path.relative(ctx.projectRootAbs, filePathAbs).replace(/\\/g, '/')
  return {
    type: params.type,
    key: note.frontmatter.key,
    uuid: note.frontmatter.uuid,
    filePath: relPath,
  }
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

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ ok: false, error: message }))
  process.exit(1)
})
