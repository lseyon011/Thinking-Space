import type { VaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import { THINKING_ORGANIZER_DIR } from '@/services/lego_blocks/integrations/projectStorageBlock'
import { normalizeHexColorBlock, normalizeTagListBlock, tagLookupKeyBlock } from '@/services/lego_blocks/units/tagBlock'

export interface OrganizerProgramGroupEntryBlock {
  id: string
  name: string
  programIds: string[]
  collapsed?: boolean
}

export interface PinBoardPanelBlock {
  id: string
  type: 'markdown' | 'todos'
  path?: string
  colSpan?: 1 | 2 | 3
  heightPreset?: 'sm' | 'md' | 'lg' | 'xl'
}

export interface OrganizerUiStateBlock {
  schemaVersion: number
  updatedAt: string
  projectName?: string
  missionStatement?: string
  pinBoardPanels?: PinBoardPanelBlock[]
  presetTags: string[]
  tagColors: Record<string, string>
  programGroups: OrganizerProgramGroupEntryBlock[]
}

const ORGANIZER_UI_STATE_SCHEMA_VERSION_BLOCK = 2
const ORGANIZER_UI_STATE_FILE_BLOCK = 'organizer-ui-state.json'

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

function normalizePresetTags(raw: unknown): string[] {
  return normalizeTagListBlock(Array.isArray(raw) ? raw.map(String) : [])
}

function normalizeTagColors(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {}
  const record = raw as Record<string, unknown>
  const normalizedColors: Record<string, string> = {}
  for (const [tag, color] of Object.entries(record)) {
    const tagKey = tagLookupKeyBlock(String(tag))
    const normalizedColor = normalizeHexColorBlock(
      typeof color === 'string' ? color : null,
    )
    if (!tagKey || !normalizedColor) continue
    normalizedColors[tagKey] = normalizedColor
  }
  return normalizedColors
}

function dedupeProgramIds(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    const normalized = id.trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }
  return out
}

function normalizeProgramGroups(groups: unknown): OrganizerProgramGroupEntryBlock[] {
  if (!Array.isArray(groups)) return []
  const seenGroupIds = new Set<string>()
  const assignedPrograms = new Set<string>()
  const normalized: OrganizerProgramGroupEntryBlock[] = []

  for (const value of groups) {
    if (!value || typeof value !== 'object') continue
    const group = value as Record<string, unknown>
    const id = String(group.id ?? '').trim()
    if (!id || seenGroupIds.has(id)) continue
    seenGroupIds.add(id)

    const name = String(group.name ?? '').trim() || 'Group'
    const rawProgramIds = Array.isArray(group.programIds) ? group.programIds.map(String) : []
    const nextProgramIds: string[] = []
    for (const programId of dedupeProgramIds(rawProgramIds)) {
      if (assignedPrograms.has(programId)) continue
      assignedPrograms.add(programId)
      nextProgramIds.push(programId)
    }

    normalized.push({
      id,
      name,
      programIds: nextProgramIds,
      collapsed: !!group.collapsed,
    })
  }

  return normalized
}

function normalizeProjectName(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  return trimmed || undefined
}

function normalizeMissionStatement(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  return trimmed || undefined
}

function normalizeUpdatedAt(raw: unknown): string {
  if (typeof raw !== 'string') return new Date().toISOString()
  const trimmed = raw.trim()
  if (!trimmed) return new Date().toISOString()
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString()
  return parsed.toISOString()
}

function normalizeProjectMemoryPath(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const normalized = normalizePath(raw)
  return normalized || undefined
}

function generatePanelId(): string {
  return `panel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeColSpan(raw: unknown): 1 | 2 | 3 | undefined {
  if (raw === 1 || raw === 2 || raw === 3) return raw
  return undefined
}

function normalizeHeightPreset(raw: unknown): 'sm' | 'md' | 'lg' | 'xl' | undefined {
  if (raw === 'sm' || raw === 'md' || raw === 'lg' || raw === 'xl') return raw
  return undefined
}

function normalizePinBoardPanels(record: Record<string, unknown>): PinBoardPanelBlock[] | undefined {
  // Current format: pinBoardPanels array
  if (Array.isArray(record.pinBoardPanels)) {
    const panels: PinBoardPanelBlock[] = []
    for (const raw of record.pinBoardPanels) {
      if (!raw || typeof raw !== 'object') continue
      const p = raw as Record<string, unknown>
      const id = String(p.id ?? '').trim() || generatePanelId()
      const type = p.type === 'todos' ? 'todos' : 'markdown'
      const path = typeof p.path === 'string' ? normalizePath(p.path) || undefined : undefined
      panels.push({ id, type, path, colSpan: normalizeColSpan(p.colSpan), heightPreset: normalizeHeightPreset(p.heightPreset) })
    }
    return panels.length > 0 ? panels : undefined
  }
  // Migrate from pinnedNotesPaths array
  if (Array.isArray(record.pinnedNotesPaths)) {
    const panels: PinBoardPanelBlock[] = record.pinnedNotesPaths
      .map((p: unknown) => (typeof p === 'string' ? normalizePath(p) : ''))
      .filter(Boolean)
      .map((path): PinBoardPanelBlock => ({ id: generatePanelId(), type: 'markdown', path }))
    return panels.length > 0 ? panels : undefined
  }
  // Migrate from legacy projectQuotesPath / projectRememberPath
  const legacyPaths = [
    normalizeProjectMemoryPath(record.projectQuotesPath),
    normalizeProjectMemoryPath(record.projectRememberPath),
  ].filter((p): p is string => Boolean(p))
  if (legacyPaths.length > 0) {
    return legacyPaths.map((path): PinBoardPanelBlock => ({ id: generatePanelId(), type: 'markdown', path }))
  }
  return undefined
}

export function normalizeOrganizerUiStateBlock(raw: unknown): OrganizerUiStateBlock {
  const record = raw && typeof raw === 'object'
    ? (raw as Record<string, unknown>)
    : {}
  return {
    schemaVersion: ORGANIZER_UI_STATE_SCHEMA_VERSION_BLOCK,
    updatedAt: normalizeUpdatedAt(record.updatedAt),
    projectName: normalizeProjectName(record.projectName),
    missionStatement: normalizeMissionStatement(record.missionStatement),
    pinBoardPanels: normalizePinBoardPanels(record),
    presetTags: normalizePresetTags(record.presetTags),
    tagColors: normalizeTagColors(record.tagColors),
    programGroups: normalizeProgramGroups(record.programGroups),
  }
}

export function organizerUiStatePathBlock(projectRoot: string): string {
  const normalizedRoot = normalizePath(projectRoot)
  if (!normalizedRoot) return `${THINKING_ORGANIZER_DIR}/${ORGANIZER_UI_STATE_FILE_BLOCK}`
  return `${normalizedRoot}/${THINKING_ORGANIZER_DIR}/${ORGANIZER_UI_STATE_FILE_BLOCK}`
}

export async function readOrganizerUiStateBlock(
  fs: VaultFS,
  projectRoot: string,
): Promise<OrganizerUiStateBlock | null> {
  try {
    const raw = await fs.read(organizerUiStatePathBlock(projectRoot))
    return normalizeOrganizerUiStateBlock(JSON.parse(raw))
  } catch {
    return null
  }
}

export async function writeOrganizerUiStateBlock(
  fs: VaultFS,
  projectRoot: string,
  input: OrganizerUiStateBlock,
): Promise<OrganizerUiStateBlock> {
  const normalized = normalizeOrganizerUiStateBlock(input)
  const normalizedRoot = normalizePath(projectRoot)
  const organizerDir = normalizedRoot
    ? `${normalizedRoot}/${THINKING_ORGANIZER_DIR}`
    : THINKING_ORGANIZER_DIR
  try {
    await fs.mkdir(organizerDir)
  } catch {
    // Directory may already exist.
  }
  await fs.write(organizerUiStatePathBlock(projectRoot), `${JSON.stringify(normalized, null, 2)}\n`)
  return normalized
}
