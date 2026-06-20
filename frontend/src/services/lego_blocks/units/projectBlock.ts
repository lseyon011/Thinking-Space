/**
 * Project — a user-defined "what am I trying to do here" context that can be
 * bound to any canvas surface (Home, Webull F9, future surfaces). Stored as a
 * settings-only concept in `.thinking-space/projects.json`; not derived from
 * the organizer.
 *
 * Schema is intentionally minimal: a short name and a mission statement. UI
 * surfaces (anchor headings, pickers) render `name` as the title and `mission`
 * as the body copy.
 */

export interface ProjectBlock {
  /** Stable id (crypto.randomUUID where available, falls back to a time+random suffix). */
  id: string
  /** Short display name (e.g. "Personal market workspace"). */
  name: string
  /** One- or two-line mission statement shown under the name on surfaces. */
  mission: string
}

export const PROJECTS_SCHEMA_VERSION_BLOCK = 1

export interface ProjectsFileBlock {
  version: number
  projects: ProjectBlock[]
}

export function createProjectIdBlock(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    /* fall through */
  }
  return `project-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function isValidProjectBlock(value: unknown): value is ProjectBlock {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ProjectBlock>
  return (
    typeof candidate.id === 'string' && candidate.id.length > 0 &&
    typeof candidate.name === 'string' &&
    typeof candidate.mission === 'string'
  )
}

export function normalizeProjectsFileBlock(value: unknown): ProjectsFileBlock | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<ProjectsFileBlock>
  if (candidate.version !== PROJECTS_SCHEMA_VERSION_BLOCK) return null
  if (!Array.isArray(candidate.projects)) return null
  const projects = candidate.projects.filter(isValidProjectBlock)
  return { version: PROJECTS_SCHEMA_VERSION_BLOCK, projects }
}
