// Project-scoped storage path helpers.
// Each project root gets a `thinking-organizer/` subfolder for hierarchy nodes.

import type { NodeType } from './yamlNoteBlock'

export const THINKING_ORGANIZER_DIR = 'thinking-organizer'

const TYPE_FOLDERS: Record<NodeType, string> = {
  program: 'programs',
  epic: 'epics',
  idea_bucket: 'idea_buckets',
  idea: 'ideas',
  thought_bucket: 'thought_buckets',
  thought: 'thoughts',
  task: 'tasks',
  run: 'runs',
  handoff: 'handoffs',
}

/**
 * Get the storage folder path for a node type within a project root.
 * Example: `my-project/thinking-organizer/epics`
 */
export function getProjectStoragePath(projectRoot: string, nodeType: NodeType): string {
  const root = projectRoot.replace(/\/+$/, '')
  return `${root}/${THINKING_ORGANIZER_DIR}/${TYPE_FOLDERS[nodeType]}`
}

/**
 * Resolve the full file path for a node within a project.
 * Example: `my-project/thinking-organizer/epics/epic-my-epic.md`
 */
export function resolveNodeFilePath(projectRoot: string, nodeType: NodeType, filename: string): string {
  return `${getProjectStoragePath(projectRoot, nodeType)}/${filename}`
}
