import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import {
  PROJECTS_SCHEMA_VERSION_BLOCK,
  createProjectIdBlock,
  normalizeProjectsFileBlock,
  type ProjectBlock,
  type ProjectsFileBlock,
} from '@/services/lego_blocks/units/projectBlock'

/**
 * projectsStorageBlock — read/write `.thinking-space/projects.json` and emit
 * an in-process change event so surfaces (canvas anchors, settings page) stay
 * in sync without a full app reload.
 *
 * Stored format: `{ version, projects: [{ id, name, mission }, ...] }`. The
 * file is created on first write; reads return an empty list when missing.
 */

export const PROJECTS_FILE_PATH_BLOCK = '.thinking-space/projects.json'
export const PROJECTS_FILE_DIR_BLOCK = '.thinking-space'
export const PROJECTS_CHANGE_EVENT_BLOCK = 'thinking-space:projects-changed'

export interface CreateProjectInputBlock {
  name: string
  mission?: string
}

export interface UpdateProjectInputBlock {
  name?: string
  mission?: string
}

function dispatchProjectsChangeBlock(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(PROJECTS_CHANGE_EVENT_BLOCK))
  } catch {
    /* no-op */
  }
}

export async function readProjectsBlock(): Promise<ProjectBlock[]> {
  try {
    const fs = getVaultFS()
    if (!(await fs.exists(PROJECTS_FILE_PATH_BLOCK))) return []
    const raw = await fs.read(PROJECTS_FILE_PATH_BLOCK)
    const parsed = JSON.parse(raw) as unknown
    const file = normalizeProjectsFileBlock(parsed)
    return file ? file.projects : []
  } catch {
    return []
  }
}

async function writeProjectsBlock(projects: ProjectBlock[]): Promise<void> {
  const fs = getVaultFS()
  await fs.mkdir(PROJECTS_FILE_DIR_BLOCK)
  const payload: ProjectsFileBlock = {
    version: PROJECTS_SCHEMA_VERSION_BLOCK,
    projects,
  }
  await fs.write(PROJECTS_FILE_PATH_BLOCK, JSON.stringify(payload, null, 2))
  dispatchProjectsChangeBlock()
}

export async function addProjectBlock(input: CreateProjectInputBlock): Promise<ProjectBlock> {
  const projects = await readProjectsBlock()
  const next: ProjectBlock = {
    id: createProjectIdBlock(),
    name: input.name.trim() || 'Untitled project',
    mission: (input.mission ?? '').trim(),
  }
  await writeProjectsBlock([...projects, next])
  return next
}

export async function updateProjectBlock(id: string, patch: UpdateProjectInputBlock): Promise<ProjectBlock | null> {
  const projects = await readProjectsBlock()
  let updated: ProjectBlock | null = null
  const nextList = projects.map(project => {
    if (project.id !== id) return project
    updated = {
      ...project,
      name: patch.name !== undefined ? patch.name.trim() || project.name : project.name,
      mission: patch.mission !== undefined ? patch.mission : project.mission,
    }
    return updated
  })
  if (!updated) return null
  await writeProjectsBlock(nextList)
  return updated
}

export async function removeProjectBlock(id: string): Promise<void> {
  const projects = await readProjectsBlock()
  const next = projects.filter(project => project.id !== id)
  if (next.length === projects.length) return
  await writeProjectsBlock(next)
}

export async function getProjectByIdBlock(id: string | null | undefined): Promise<ProjectBlock | null> {
  if (!id) return null
  const projects = await readProjectsBlock()
  return projects.find(project => project.id === id) ?? null
}
