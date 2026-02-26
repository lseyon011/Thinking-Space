import fs from 'node:fs/promises'
import path from 'node:path'
import {
  parseNote,
  stringifyNote,
  type NodeType,
  type YAMLNote,
} from '../../src/services/lego_blocks/units/yamlNoteBlock'

type FolderName =
  | 'programs'
  | 'epics'
  | 'ideas'
  | 'thoughts'
  | 'idea_buckets'
  | 'thought_buckets'

interface WorkspaceNode {
  sourcePath: string
  folder: FolderName
  note: YAMLNote
  deleted?: boolean
}

const TYPE_FOLDERS: Record<NodeType, FolderName> = {
  program: 'programs',
  epic: 'epics',
  idea_bucket: 'idea_buckets',
  idea: 'ideas',
  thought_bucket: 'thought_buckets',
  thought: 'thoughts',
}

const SCAN_FOLDERS: FolderName[] = [
  'programs',
  'epics',
  'ideas',
  'thoughts',
  'idea_buckets',
  'thought_buckets',
]

const TASK_SEED_PARENT_BY_ID: Record<string, string> = {
  'LTM-001': 'dev-001-epic-1-thought-edit-conflict-safe-save',
  'LTM-002': 'dev-001-epic-1-thought-edit-conflict-safe-save',
  'LTM-003': 'dev-004-epic-2-start-sqlite-schema-bootstrap-web-electron-parity',
  'LTM-004': 'dev-005-epic-2-hierarchy-crud-mirrored-path-manager',
  'LTM-005': 'dev-005-epic-2-hierarchy-crud-mirrored-path-manager',
  'LTM-013': 'dev-002-unified-markdown-viewer-editor',
  'LTM-014': 'dev-003-architecture-conformance-refactor-lego-blocks-orchestrators',
  'LTM-018': 'dev-006-audit-debt-slice-ltm-018-ltm-019',
  'LTM-019': 'dev-006-audit-debt-slice-ltm-018-ltm-019',
  'LTM-021': 'dev-008-phase-1-phase-2-yaml-note-block-indexeddb-cache-vault-sync',
  'LTM-022': 'dev-008-phase-1-phase-2-yaml-note-block-indexeddb-cache-vault-sync',
  'LTM-024': 'dev-008-phase-1-phase-2-yaml-note-block-indexeddb-cache-vault-sync',
  'LTM-025': 'dev-008-phase-1-phase-2-yaml-note-block-indexeddb-cache-vault-sync',
}

function statusFromTask(taskStatus?: string): 'active' | 'paused' | 'completed' | 'archived' {
  const s = (taskStatus || '').trim().toLowerCase()
  if (s === 'done' || s === 'completed' || s === 'closed') return 'completed'
  if (s === 'blocked' || s === 'on_hold' || s === 'paused') return 'paused'
  if (s === 'archived' || s === 'obsolete' || s === 'cancelled' || s === 'canceled') return 'archived'
  return 'active'
}

function statusFromRunResult(result?: string): 'active' | 'paused' | 'completed' | 'archived' {
  const s = (result || '').trim().toLowerCase()
  if (s === 'success' || s === 'done' || s === 'completed') return 'completed'
  if (s === 'failed' || s === 'failure' || s === 'error') return 'paused'
  if (s === 'canceled' || s === 'cancelled') return 'archived'
  return 'active'
}

function toArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (item == null ? '' : String(item).trim()))
    .filter(Boolean)
}

function normalizeTaskId(value: unknown): string {
  const raw = String(value || '').trim().toUpperCase()
  if (!raw) return ''
  const m = raw.match(/LTM-\d{3}/)
  return m ? m[0] : ''
}

function extractTaskIds(text: string): string[] {
  const upper = text.toUpperCase()
  const matches = upper.match(/LTM-\d{3}/g) || []
  return Array.from(new Set(matches))
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  let entries: string[] = []
  try {
    entries = await fs.readdir(dir)
  } catch {
    return []
  }
  return entries
    .filter((name) => name.endsWith('.md'))
    .map((name) => path.join(dir, name))
}

async function main(): Promise<void> {
  const targetRootArg = process.argv[2]?.trim()
  if (!targetRootArg) {
    throw new Error(
      'Usage: vite-node scripts/agent/restructureAgentWorkspace.ts "<target-project-root>"',
    )
  }

  const now = new Date().toISOString()
  const targetRoot = path.resolve(targetRootArg)
  const organizerRoot = path.join(targetRoot, 'thinking-organizer')

  const nodes: WorkspaceNode[] = []
  for (const folder of SCAN_FOLDERS) {
    const dir = path.join(organizerRoot, folder)
    const files = await listMarkdownFiles(dir)
    for (const filePath of files) {
      const content = await fs.readFile(filePath, 'utf-8')
      const parsed = parseNote(content)
      if (!parsed) continue
      nodes.push({ sourcePath: filePath, folder, note: parsed })
    }
  }

  const nodeByKey = new Map<string, WorkspaceNode>()
  for (const node of nodes) {
    const key = String(node.note.frontmatter.key || '').trim()
    if (!key) continue
    if (!nodeByKey.has(key)) nodeByKey.set(key, node)
  }

  const rootProgram = nodeByKey.get('development-agent-operations')
    || nodeByKey.get('thinking-space-agent-operations')
  const taskBacklogEpic = nodeByKey.get('task-backlog')
  const executionRunsEpic = nodeByKey.get('execution-runs')
  const handoffsProgram = nodeByKey.get('handoffs-agent-operations')
    || nodeByKey.get('handoffs')
  const principlesProgram = nodeByKey.get('principles-and-decisions-agent-operations')
    || nodeByKey.get('principles-and-decisions')

  if (!rootProgram || !taskBacklogEpic || !handoffsProgram || !principlesProgram) {
    throw new Error(
      'Expected bootstrap nodes not found (development or thinking-space root + task-backlog + handoffs + principles).',
    )
  }

  const developmentProgramKey = 'development-agent-operations'
  const handoffsProgramKey = 'handoffs-agent-operations'
  const principlesProgramKey = 'principles-and-decisions-agent-operations'

  let updatedNodes = 0
  let movedFiles = 0
  let runTypeFixes = 0
  let taskStatusFixes = 0
  let runStatusFixes = 0
  let epicStatusRollupFixes = 0

  // Development program: repurpose old root program.
  rootProgram.note.frontmatter.key = developmentProgramKey
  rootProgram.note.frontmatter.title = 'Development (Agent Operations)'
  rootProgram.note.frontmatter.type = 'program'
  rootProgram.note.frontmatter.level = 0
  rootProgram.note.frontmatter.updated_at = now
  delete rootProgram.note.frontmatter.parent
  delete rootProgram.note.frontmatter.parent_uuid
  delete rootProgram.note.frontmatter.parent_type
  updatedNodes += 1

  // Task backlog remains an epic under Development program.
  taskBacklogEpic.note.frontmatter.parent = developmentProgramKey
  taskBacklogEpic.note.frontmatter.parent_uuid = rootProgram.note.frontmatter.uuid
  taskBacklogEpic.note.frontmatter.parent_type = 'program'
  taskBacklogEpic.note.frontmatter.type = 'epic'
  taskBacklogEpic.note.frontmatter.level = 1
  taskBacklogEpic.note.frontmatter.updated_at = now
  updatedNodes += 1

  // Convert handoffs and principles containers to top-level programs.
  handoffsProgram.note.frontmatter.key = handoffsProgramKey
  handoffsProgram.note.frontmatter.title = 'Handoffs (Agent Operations)'
  handoffsProgram.note.frontmatter.type = 'program'
  handoffsProgram.note.frontmatter.level = 0
  handoffsProgram.note.frontmatter.updated_at = now
  delete handoffsProgram.note.frontmatter.parent
  delete handoffsProgram.note.frontmatter.parent_uuid
  delete handoffsProgram.note.frontmatter.parent_type
  updatedNodes += 1

  principlesProgram.note.frontmatter.key = principlesProgramKey
  principlesProgram.note.frontmatter.title = 'Principles and Decisions (Agent Operations)'
  principlesProgram.note.frontmatter.type = 'program'
  principlesProgram.note.frontmatter.level = 0
  principlesProgram.note.frontmatter.updated_at = now
  delete principlesProgram.note.frontmatter.parent
  delete principlesProgram.note.frontmatter.parent_uuid
  delete principlesProgram.note.frontmatter.parent_type
  updatedNodes += 1

  // Reparent children of container keys that changed.
  for (const node of nodes) {
    const fm = node.note.frontmatter
    if (String(fm.parent || '') === 'thinking-space-agent-operations') {
      fm.parent = developmentProgramKey
      fm.parent_uuid = rootProgram.note.frontmatter.uuid
      fm.parent_type = 'program'
      fm.updated_at = now
      updatedNodes += 1
    }
    if (String(fm.parent || '') === 'handoffs') {
      fm.parent = handoffsProgramKey
      fm.parent_uuid = handoffsProgram.note.frontmatter.uuid
      fm.parent_type = 'program'
      fm.updated_at = now
      updatedNodes += 1
    }
    if (String(fm.parent || '') === 'principles-and-decisions') {
      fm.parent = principlesProgramKey
      fm.parent_uuid = principlesProgram.note.frontmatter.uuid
      fm.parent_type = 'program'
      fm.updated_at = now
      updatedNodes += 1
    }
  }

  // Sync task statuses from task_status into status.
  for (const node of nodes) {
    const fm = node.note.frontmatter
    if (String(fm.record_kind || '') !== 'task') continue
    const mappedStatus = statusFromTask(fm.task_status ? String(fm.task_status) : undefined)
    if (fm.status !== mappedStatus) {
      fm.status = mappedStatus
      fm.updated_at = now
      taskStatusFixes += 1
      updatedNodes += 1
    }
  }

  // Convert run notes to epic.
  for (const node of nodes) {
    const fm = node.note.frontmatter
    if (String(fm.record_kind || '') !== 'run') continue
    if (fm.type !== 'epic') {
      fm.type = 'epic'
      fm.level = 1
      runTypeFixes += 1
      updatedNodes += 1
    }
    fm.parent = developmentProgramKey
    fm.parent_uuid = rootProgram.note.frontmatter.uuid
    fm.parent_type = 'program'
    fm.updated_at = now
  }

  // Build run epic indexes for task->epic mapping.
  const runEpicByTaskId = new Map<string, WorkspaceNode>()
  for (const node of nodes) {
    const fm = node.note.frontmatter
    if (String(fm.record_kind || '') !== 'run') continue
    if (String(fm.type || '') !== 'epic') continue
    const key = String(fm.key || '').trim()
    if (!key) continue
    const ids = extractTaskIds(`${fm.key || ''} ${fm.title || ''}`)
    for (const id of ids) {
      if (!runEpicByTaskId.has(id)) runEpicByTaskId.set(id, node)
    }
  }
  for (const [taskId, epicKey] of Object.entries(TASK_SEED_PARENT_BY_ID)) {
    const epicNode = nodeByKey.get(epicKey)
    if (epicNode) runEpicByTaskId.set(taskId, epicNode)
  }

  // Map every task backlog item to one of development epics.
  const taskNodes = nodes.filter((node) => String(node.note.frontmatter.record_kind || '') === 'task')
  const epicByTaskId = new Map<string, WorkspaceNode>()

  for (const node of taskNodes) {
    const fm = node.note.frontmatter
    const taskId = normalizeTaskId(fm.task_id || fm.key || fm.title)
    if (!taskId) continue
    const directEpic = runEpicByTaskId.get(taskId)
    if (directEpic) epicByTaskId.set(taskId, directEpic)
  }

  let progress = true
  while (progress) {
    progress = false
    for (const node of taskNodes) {
      const fm = node.note.frontmatter
      const taskId = normalizeTaskId(fm.task_id || fm.key || fm.title)
      if (!taskId || epicByTaskId.has(taskId)) continue
      const depends = toArray(fm.depends_on).map(normalizeTaskId).filter(Boolean)
      const mappedDep = depends.find((dep) => epicByTaskId.has(dep))
      if (mappedDep) {
        const depEpic = epicByTaskId.get(mappedDep)
        if (depEpic) {
          epicByTaskId.set(taskId, depEpic)
          progress = true
        }
      }
    }
  }

  const fallbackEpic =
    nodeByKey.get('dev-014-ltm-036-agent-orchestration-metadata-cache-queryability')
    || nodeByKey.get('dev-013-ltm-035-capability-rollout-controls-adapter-parity')
    || nodes.find((node) => String(node.note.frontmatter.record_kind || '') === 'run')
    || null

  let taskParentFixes = 0
  let fallbackAssignments = 0

  for (const node of taskNodes) {
    const fm = node.note.frontmatter
    const taskId = normalizeTaskId(fm.task_id || fm.key || fm.title)
    const mappedEpic = (taskId ? epicByTaskId.get(taskId) : undefined) || fallbackEpic
    if (!mappedEpic) continue
    const nextParent = String(mappedEpic.note.frontmatter.key || '')
    if (!nextParent) continue
    if (
      fm.parent !== nextParent
      || fm.parent_uuid !== mappedEpic.note.frontmatter.uuid
      || fm.parent_type !== 'epic'
    ) {
      fm.parent = nextParent
      fm.parent_uuid = mappedEpic.note.frontmatter.uuid
      fm.parent_type = 'epic'
      fm.updated_at = now
      taskParentFixes += 1
      updatedNodes += 1
    }
    if (taskId && !epicByTaskId.has(taskId) && fallbackEpic) {
      epicByTaskId.set(taskId, fallbackEpic)
      fallbackAssignments += 1
    }
  }

  // Remove "Execution Runs" container epic entirely.
  if (executionRunsEpic && !executionRunsEpic.deleted) {
    executionRunsEpic.deleted = true
    updatedNodes += 1
  }

  // Roll up epic status from task children:
  // if any child task is not completed/archived => epic stays active.
  const taskChildrenByEpic = new Map<string, WorkspaceNode[]>()
  for (const node of taskNodes) {
    const parent = String(node.note.frontmatter.parent || '').trim()
    if (!parent) continue
    const list = taskChildrenByEpic.get(parent) || []
    list.push(node)
    taskChildrenByEpic.set(parent, list)
  }

  // For run epics without mapped task children, derive status from run result.
  for (const node of nodes) {
    if (node.deleted) continue
    const fm = node.note.frontmatter
    if (String(fm.record_kind || '') !== 'run') continue
    if (fm.type !== 'epic') continue
    const key = String(fm.key || '').trim()
    if (!key) continue
    const hasTaskChildren = (taskChildrenByEpic.get(key) || []).length > 0
    if (hasTaskChildren) continue
    const mappedStatus = statusFromRunResult(fm.result ? String(fm.result) : undefined)
    if (fm.status !== mappedStatus) {
      fm.status = mappedStatus
      fm.updated_at = now
      runStatusFixes += 1
      updatedNodes += 1
    }
  }

  for (const node of nodes) {
    if (node.deleted) continue
    const fm = node.note.frontmatter
    if (fm.type !== 'epic') continue
    const key = String(fm.key || '').trim()
    if (!key) continue
    const childTasks = taskChildrenByEpic.get(key) || []
    if (childTasks.length === 0) continue
    const hasRemaining = childTasks.some((child) => {
      const s = String(child.note.frontmatter.status || '').trim().toLowerCase()
      return s !== 'completed' && s !== 'archived'
    })
    const nextStatus = hasRemaining ? 'active' : 'completed'
    if (fm.status !== nextStatus) {
      fm.status = nextStatus
      fm.updated_at = now
      epicStatusRollupFixes += 1
      updatedNodes += 1
    }
  }

  // Strip legacy forward-link hierarchy fields; parent is the only source of truth.
  for (const node of nodes) {
    if (node.deleted) continue
    const fm = node.note.frontmatter as Record<string, unknown>
    let changed = false
    if ('children' in fm) {
      delete fm.children
      changed = true
    }
    if ('child_types' in fm) {
      delete fm.child_types
      changed = true
    }
    if (changed) {
      node.note.frontmatter.updated_at = now
      updatedNodes += 1
    }
  }

  const targetFiles = new Map<string, string>()
  const sourceFiles = new Set(nodes.map((node) => node.sourcePath))

  for (const node of nodes) {
    if (node.deleted) continue
    const fm = node.note.frontmatter
    const type = fm.type
    const key = String(fm.key || '').trim()
    const folder = TYPE_FOLDERS[type]
    const filename = `${type}-${key}.md`
    const nextPath = path.join(organizerRoot, folder, filename)
    targetFiles.set(nextPath, stringifyNote(node.note))
    if (nextPath !== node.sourcePath) movedFiles += 1
  }

  for (const folder of SCAN_FOLDERS) {
    await fs.mkdir(path.join(organizerRoot, folder), { recursive: true })
  }

  for (const [filePath, content] of targetFiles.entries()) {
    await fs.writeFile(filePath, content, 'utf-8')
  }

  const targetPathSet = new Set(targetFiles.keys())
  for (const oldPath of sourceFiles) {
    if (!targetPathSet.has(oldPath)) {
      await fs.unlink(oldPath)
    }
  }

  const folderCounts: Record<string, number> = {}
  for (const folder of SCAN_FOLDERS) {
    const files = await listMarkdownFiles(path.join(organizerRoot, folder))
    folderCounts[folder] = files.length
  }

  let epicStatusViolationsAfter = 0
  for (const node of nodes) {
    if (node.deleted) continue
    const fm = node.note.frontmatter
    if (fm.type !== 'epic') continue
    const key = String(fm.key || '').trim()
    if (!key) continue
    const childTasks = taskChildrenByEpic.get(key) || []
    if (childTasks.length === 0) continue
    const hasRemaining = childTasks.some((child) => {
      const s = String(child.note.frontmatter.status || '').trim().toLowerCase()
      return s !== 'completed' && s !== 'archived'
    })
    if (hasRemaining && fm.status !== 'active') {
      epicStatusViolationsAfter += 1
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        targetRoot,
        summary: {
          updated_nodes: updatedNodes,
          moved_files: movedFiles,
          run_type_fixes: runTypeFixes,
          task_status_fixes: taskStatusFixes,
          run_status_fixes: runStatusFixes,
          task_parent_fixes: taskParentFixes,
          fallback_assignments: fallbackAssignments,
          epic_status_rollup_fixes: epicStatusRollupFixes,
          epic_status_violations_after: epicStatusViolationsAfter,
        },
        counts: folderCounts,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  )
  process.exit(1)
})
