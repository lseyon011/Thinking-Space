// YAML frontmatter note primitive — parse, stringify, validate, key generation.
// Source of truth for the note data model (ADR-004).

import yaml from 'js-yaml'
import { v4 as uuidv4 } from 'uuid'

// ── Types ──

export type NodeType =
  | 'program'
  | 'epic'
  | 'idea_bucket'
  | 'idea'
  | 'thought_bucket'
  | 'thought'

export type NodeStatus = 'active' | 'paused' | 'completed' | 'archived'

export type NodePriority = 'low' | 'medium' | 'high' | 'critical'

/** Level mapping: program=0, epic=1, idea_bucket=2, idea=3, thought_bucket=4, thought=5 */
export const NODE_TYPE_LEVEL: Record<NodeType, number> = {
  program: 0,
  epic: 1,
  idea_bucket: 2,
  idea: 3,
  thought_bucket: 4,
  thought: 5,
}

export interface AISuggestionRelated {
  key: string
  reason: string
  score: number
}

export interface AISuggestionMove {
  parent: string
}

export interface AISuggestions {
  related?: AISuggestionRelated[]
  suggested_move?: AISuggestionMove
}

export interface YAMLCommentEntry {
  text: string
  added_at?: string
  added_by?: string
}

export interface YAMLFrontmatter {
  // Identity
  uuid: string
  key: string
  title: string

  // Type & level
  type: NodeType
  level: number

  // Hierarchy (logical tree, independent of filesystem)
  parent?: string
  parent_uuid?: string
  parent_type?: NodeType

  // Container fields
  children?: string[]
  child_types?: NodeType[]

  // Discovery & status
  tags?: string[]
  categories?: string[]
  progress?: number
  status: NodeStatus
  priority?: NodePriority

  // Timestamps
  created_at: string
  updated_at: string

  // AI layer (optional)
  ai_summary?: string
  ai_generated?: boolean
  last_ai_update?: string
  ai_suggestions?: AISuggestions

  // Integrations (optional)
  excalidraw?: string

  // Project storage (optional, set on program nodes)
  project_root?: string

  // Jira-like display id (optional, project-scoped)
  ticket?: string

  // Organizer metadata (optional)
  description?: string
  comments?: YAMLCommentEntry[]

  // Legacy compat — preserve unknown fields roundtrip
  [extra: string]: unknown
}

export interface YAMLNote {
  frontmatter: YAMLFrontmatter
  body: string
}

// ── Frontmatter delimiter ──

const FM_OPEN = '---'
const FM_CLOSE_RE = /^---\s*$/m

// ── Public API ──

/**
 * Parse a .md file string into YAMLNote (frontmatter + body).
 * Files without YAML frontmatter return null.
 */
export function parseNote(content: string): YAMLNote | null {
  const trimmed = content.trimStart()
  if (!trimmed.startsWith(FM_OPEN)) return null

  // Find closing delimiter (skip first line)
  const afterOpen = trimmed.indexOf('\n')
  if (afterOpen === -1) return null

  const rest = trimmed.slice(afterOpen + 1)
  const closeMatch = FM_CLOSE_RE.exec(rest)
  if (!closeMatch) return null

  const yamlStr = rest.slice(0, closeMatch.index)
  const body = rest.slice(closeMatch.index + closeMatch[0].length).replace(/^\n/, '')

  let parsed: Record<string, unknown>
  try {
    parsed = yaml.load(yamlStr) as Record<string, unknown>
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object') return null

  const frontmatter = normalizeFrontmatter(parsed)
  return { frontmatter, body }
}

/**
 * Stringify a YAMLNote back to .md file content.
 */
export function stringifyNote(note: YAMLNote): string {
  // Clean undefined/null values from frontmatter for tidy YAML
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(note.frontmatter)) {
    if (v !== undefined && v !== null) {
      clean[k] = v
    }
  }

  const yamlStr = yaml.dump(clean, {
    lineWidth: -1,       // don't wrap lines
    noRefs: true,        // no YAML anchors
    sortKeys: false,     // preserve insertion order
    quotingType: '"',    // use double quotes
  }).trimEnd()

  const parts = [FM_OPEN, yamlStr, FM_OPEN]

  if (note.body) {
    parts.push('')
    parts.push(note.body)
  } else {
    parts.push('')
  }

  return parts.join('\n')
}

/**
 * Generate a URL-safe key (slug) from a title string.
 * "Build Thinking Space App" -> "build-thinking-space-app"
 */
export function generateKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')   // strip non-alphanumeric
    .replace(/\s+/g, '-')            // spaces to hyphens
    .replace(/-+/g, '-')             // collapse multiple hyphens
    .replace(/^-|-$/g, '')           // trim leading/trailing hyphens
}

/**
 * Create a new YAMLNote with sensible defaults.
 */
export function createNote(params: {
  type: NodeType
  title: string
  parent?: string
  parent_uuid?: string
  parent_type?: NodeType
  tags?: string[]
  body?: string
}): YAMLNote {
  const now = new Date().toISOString()
  const frontmatter: YAMLFrontmatter = {
    uuid: uuidv4(),
    key: generateKey(params.title),
    title: params.title,
    type: params.type,
    level: NODE_TYPE_LEVEL[params.type],
    status: 'active' as NodeStatus,
    created_at: now,
    updated_at: now,
  }

  if (params.parent) frontmatter.parent = params.parent
  if (params.parent_uuid) frontmatter.parent_uuid = params.parent_uuid
  if (params.parent_type) frontmatter.parent_type = params.parent_type
  if (params.tags && params.tags.length > 0) frontmatter.tags = params.tags

  return {
    frontmatter,
    body: params.body ?? '',
  }
}

/**
 * Generate the recommended filename for a note.
 * Format: {type}-{key}.md
 */
export function suggestFilename(frontmatter: YAMLFrontmatter): string {
  return `${frontmatter.type}-${frontmatter.key}.md`
}

/**
 * Validate frontmatter for required fields and type consistency.
 * Returns array of error strings (empty = valid).
 */
export function validate(frontmatter: YAMLFrontmatter): string[] {
  const errors: string[] = []

  if (!frontmatter.uuid) errors.push('Missing uuid')
  if (!frontmatter.key) errors.push('Missing key')
  if (!frontmatter.title) errors.push('Missing title')
  if (!frontmatter.type) errors.push('Missing type')
  if (!(frontmatter.type in NODE_TYPE_LEVEL)) {
    errors.push(`Invalid type: ${frontmatter.type}`)
  }
  if (frontmatter.level !== NODE_TYPE_LEVEL[frontmatter.type]) {
    errors.push(`Level ${frontmatter.level} does not match type ${frontmatter.type} (expected ${NODE_TYPE_LEVEL[frontmatter.type]})`)
  }
  if (!frontmatter.created_at) errors.push('Missing created_at')
  if (!frontmatter.updated_at) errors.push('Missing updated_at')
  if (!frontmatter.status) errors.push('Missing status')

  return errors
}

/**
 * Check if a string content has YAML frontmatter.
 */
export function hasFrontmatter(content: string): boolean {
  return content.trimStart().startsWith(FM_OPEN)
}

// ── Internals ──

function normalizeFrontmatter(raw: Record<string, unknown>): YAMLFrontmatter {
  const type = (raw.type as NodeType) || 'thought'
  return {
    ...raw,
    uuid: String(raw.uuid || ''),
    key: String(raw.key || ''),
    title: String(raw.title || ''),
    type,
    level: typeof raw.level === 'number' ? raw.level : NODE_TYPE_LEVEL[type] ?? 5,
    status: (raw.status as NodeStatus) || 'active',
    created_at: String(raw.created_at || new Date().toISOString()),
    updated_at: String(raw.updated_at || new Date().toISOString()),
    parent: raw.parent != null ? String(raw.parent) : undefined,
    parent_uuid: raw.parent_uuid != null ? String(raw.parent_uuid) : undefined,
    parent_type: raw.parent_type as NodeType | undefined,
    children: Array.isArray(raw.children) ? raw.children.map(String) : undefined,
    child_types: Array.isArray(raw.child_types) ? raw.child_types as NodeType[] : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : undefined,
    categories: Array.isArray(raw.categories) ? raw.categories.map(String) : undefined,
    progress: typeof raw.progress === 'number' ? raw.progress : undefined,
    priority: raw.priority as NodePriority | undefined,
    ai_summary: raw.ai_summary != null ? String(raw.ai_summary) : undefined,
    ai_generated: typeof raw.ai_generated === 'boolean' ? raw.ai_generated : undefined,
    last_ai_update: raw.last_ai_update != null ? String(raw.last_ai_update) : undefined,
    ai_suggestions: raw.ai_suggestions as AISuggestions | undefined,
    excalidraw: raw.excalidraw != null ? String(raw.excalidraw) : undefined,
    project_root: raw.project_root != null ? String(raw.project_root) : undefined,
    ticket: raw.ticket != null ? String(raw.ticket) : undefined,
    description: raw.description != null ? String(raw.description) : undefined,
    comments: normalizeComments(raw.comments),
  }
}

function normalizeComments(raw: unknown): YAMLCommentEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined

  const comments = raw
    .map(normalizeComment)
    .filter((comment): comment is YAMLCommentEntry => comment !== null)

  return comments.length > 0 ? comments : undefined
}

function normalizeComment(value: unknown): YAMLCommentEntry | null {
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return null
    return { text }
  }

  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const rawText = typeof record.text === 'string'
    ? record.text
    : typeof record.comment === 'string'
      ? record.comment
      : ''
  const text = rawText.trim()
  if (!text) return null

  return {
    text,
    added_at: typeof record.added_at === 'string' ? record.added_at : undefined,
    added_by: typeof record.added_by === 'string' ? record.added_by : undefined,
  }
}
