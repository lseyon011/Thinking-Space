import type { VaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import { THINKING_ORGANIZER_DIR } from '@/services/lego_blocks/integrations/projectStorageBlock'
import { normalizeHexColorBlock, normalizeTagListBlock, tagLookupKeyBlock } from '@/services/lego_blocks/units/tagBlock'

export interface OrganizerProgramGroupEntryBlock {
  id: string
  name: string
  programIds: string[]
  collapsed?: boolean
}

export interface OrganizerPinBoardGroupEntryBlock {
  id: string
  name: string
  panelIds: string[]
  collapsed?: boolean
}

export interface PinBoardPanelBlock {
  id: string
  type: 'markdown' | 'todos'
  path?: string
  section?: string
  x?: number
  y?: number
  width?: number
  height?: number
}

export interface OrganizerUiStateBlock {
  schemaVersion: number
  updatedAt: string
  projectName?: string
  missionStatement?: string
  pinBoardPanels?: PinBoardPanelBlock[]
  pinBoardGroups: OrganizerPinBoardGroupEntryBlock[]
  presetTags: string[]
  tagColors: Record<string, string>
  programGroups: OrganizerProgramGroupEntryBlock[]
}

const ORGANIZER_UI_STATE_SCHEMA_VERSION_BLOCK = 3
const ORGANIZER_UI_STATE_FILE_BLOCK = 'organizer-ui-state.json'
export const PIN_BOARD_PANEL_PADDING_BLOCK = 24
export const PIN_BOARD_PANEL_GAP_BLOCK = 24
export const PIN_BOARD_PANEL_POSITION_STEP_BLOCK = 24
export const PIN_BOARD_PANEL_WIDTH_STEP_BLOCK = 160
export const PIN_BOARD_PANEL_HEIGHT_STEP_BLOCK = 120
export const PIN_BOARD_PANEL_MIN_WIDTH_BLOCK = 320
export const PIN_BOARD_PANEL_MIN_HEIGHT_BLOCK = 240
const PIN_BOARD_PANEL_DEFAULT_WIDTH_BLOCK = 320
const PIN_BOARD_PANEL_DEFAULT_HEIGHT_BLOCK = 480
const PIN_BOARD_TODO_DEFAULT_WIDTH_BLOCK = 640
const PIN_BOARD_TODO_DEFAULT_HEIGHT_BLOCK = 600

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

function dedupePanelIds(ids: string[]): string[] {
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

function normalizePinBoardGroups(groups: unknown): OrganizerPinBoardGroupEntryBlock[] {
  if (!Array.isArray(groups)) return []
  const seenGroupIds = new Set<string>()
  const assignedPanels = new Set<string>()
  const normalized: OrganizerPinBoardGroupEntryBlock[] = []

  for (const value of groups) {
    if (!value || typeof value !== 'object') continue
    const group = value as Record<string, unknown>
    const id = String(group.id ?? '').trim()
    if (!id || seenGroupIds.has(id)) continue
    seenGroupIds.add(id)

    const name = String(group.name ?? '').trim() || 'Group'
    const rawPanelIds = Array.isArray(group.panelIds) ? group.panelIds.map(String) : []
    const nextPanelIds: string[] = []
    for (const panelId of dedupePanelIds(rawPanelIds)) {
      if (assignedPanels.has(panelId)) continue
      assignedPanels.add(panelId)
      nextPanelIds.push(panelId)
    }

    normalized.push({
      id,
      name,
      panelIds: nextPanelIds,
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

function normalizeRowSpan(raw: unknown): 1 | 2 | 3 | 4 | 5 | 6 | undefined {
  if (raw === 1 || raw === 2 || raw === 3 || raw === 4 || raw === 5 || raw === 6) return raw
  // Migrate legacy heightPreset values
  if (raw === 'sm') return 2
  if (raw === 'md') return 3
  if (raw === 'lg') return 4
  if (raw === 'xl') return 6
  return undefined
}

function snapToStep(value: number, step: number, min: number): number {
  const snapped = Math.round(value / step) * step
  return Math.max(min, snapped)
}

function normalizeCoordinate(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined
  return Math.max(0, Math.round(raw))
}

function widthFromLegacyColSpan(raw: unknown): number | undefined {
  if (raw === 1) return 320
  if (raw === 2) return 480
  if (raw === 3) return 640
  return undefined
}

function heightFromLegacyRowSpan(raw: unknown): number | undefined {
  const rowSpan = normalizeRowSpan(raw)
  if (!rowSpan) return undefined
  return 120 * (rowSpan + 1)
}

function normalizePanelWidth(raw: unknown, fallbackType: PinBoardPanelBlock['type']): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return snapToStep(raw, PIN_BOARD_PANEL_WIDTH_STEP_BLOCK, PIN_BOARD_PANEL_MIN_WIDTH_BLOCK)
  }
  return fallbackType === 'todos' ? PIN_BOARD_TODO_DEFAULT_WIDTH_BLOCK : PIN_BOARD_PANEL_DEFAULT_WIDTH_BLOCK
}

function normalizePanelHeight(raw: unknown, fallbackType: PinBoardPanelBlock['type']): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return snapToStep(raw, PIN_BOARD_PANEL_HEIGHT_STEP_BLOCK, PIN_BOARD_PANEL_MIN_HEIGHT_BLOCK)
  }
  return fallbackType === 'todos' ? PIN_BOARD_TODO_DEFAULT_HEIGHT_BLOCK : PIN_BOARD_PANEL_DEFAULT_HEIGHT_BLOCK
}

function defaultPanelLayoutByIndex(index: number, type: PinBoardPanelBlock['type']) {
  const width = type === 'todos' ? PIN_BOARD_TODO_DEFAULT_WIDTH_BLOCK : PIN_BOARD_PANEL_DEFAULT_WIDTH_BLOCK
  const height = type === 'todos' ? PIN_BOARD_TODO_DEFAULT_HEIGHT_BLOCK : PIN_BOARD_PANEL_DEFAULT_HEIGHT_BLOCK
  const column = index % 2
  const row = Math.floor(index / 2)
  return {
    x: PIN_BOARD_PANEL_PADDING_BLOCK + column * (PIN_BOARD_PANEL_DEFAULT_WIDTH_BLOCK + PIN_BOARD_PANEL_GAP_BLOCK),
    y: PIN_BOARD_PANEL_PADDING_BLOCK + row * (PIN_BOARD_PANEL_DEFAULT_HEIGHT_BLOCK + PIN_BOARD_PANEL_GAP_BLOCK),
    width,
    height,
  }
}

function normalizePinBoardPanelLayout(
  rawPanel: Record<string, unknown>,
  index: number,
  type: PinBoardPanelBlock['type'],
): Pick<PinBoardPanelBlock, 'x' | 'y' | 'width' | 'height'> {
  const fallback = defaultPanelLayoutByIndex(index, type)
  return {
    x: normalizeCoordinate(rawPanel.x) ?? fallback.x,
    y: normalizeCoordinate(rawPanel.y) ?? fallback.y,
    width: normalizePanelWidth(rawPanel.width ?? widthFromLegacyColSpan(rawPanel.colSpan), type),
    height: normalizePanelHeight(rawPanel.height ?? heightFromLegacyRowSpan(rawPanel.rowSpan ?? rawPanel.heightPreset), type),
  }
}

export function createPinBoardPanelBlock(
  type: PinBoardPanelBlock['type'],
  existingPanels: PinBoardPanelBlock[] = [],
): PinBoardPanelBlock {
  const baseY = existingPanels.reduce((maxY, panel) => {
    const panelY = typeof panel.y === 'number' ? panel.y : PIN_BOARD_PANEL_PADDING_BLOCK
    const panelHeight = typeof panel.height === 'number'
      ? panel.height
      : (panel.type === 'todos' ? PIN_BOARD_TODO_DEFAULT_HEIGHT_BLOCK : PIN_BOARD_PANEL_DEFAULT_HEIGHT_BLOCK)
    return Math.max(maxY, panelY + panelHeight)
  }, 0)

  return {
    id: generatePanelId(),
    type,
    x: PIN_BOARD_PANEL_PADDING_BLOCK,
    y: Math.max(PIN_BOARD_PANEL_PADDING_BLOCK, baseY + PIN_BOARD_PANEL_GAP_BLOCK),
    width: type === 'todos' ? PIN_BOARD_TODO_DEFAULT_WIDTH_BLOCK : PIN_BOARD_PANEL_DEFAULT_WIDTH_BLOCK,
    height: type === 'todos' ? PIN_BOARD_TODO_DEFAULT_HEIGHT_BLOCK : PIN_BOARD_PANEL_DEFAULT_HEIGHT_BLOCK,
  }
}

function normalizePinBoardPanels(record: Record<string, unknown>): PinBoardPanelBlock[] | undefined {
  // Current format: pinBoardPanels array
  if (Array.isArray(record.pinBoardPanels)) {
    const panels: PinBoardPanelBlock[] = []
    for (const [index, raw] of record.pinBoardPanels.entries()) {
      if (!raw || typeof raw !== 'object') continue
      const p = raw as Record<string, unknown>
      const id = String(p.id ?? '').trim() || generatePanelId()
      const type = p.type === 'todos' ? 'todos' : 'markdown'
      const path = typeof p.path === 'string' ? normalizePath(p.path) || undefined : undefined
      const section = typeof p.section === 'string' ? p.section.trim() || undefined : undefined
      const layout = normalizePinBoardPanelLayout(p, index, type)
      panels.push({ id, type, path, section, ...layout })
    }
    return panels.length > 0 ? panels : undefined
  }
  // Migrate from pinnedNotesPaths array
  if (Array.isArray(record.pinnedNotesPaths)) {
    const panels: PinBoardPanelBlock[] = record.pinnedNotesPaths
      .map((p: unknown) => (typeof p === 'string' ? normalizePath(p) : ''))
      .filter(Boolean)
      .map((path, index): PinBoardPanelBlock => ({
        id: generatePanelId(),
        type: 'markdown',
        path,
        ...defaultPanelLayoutByIndex(index, 'markdown'),
      }))
    return panels.length > 0 ? panels : undefined
  }
  // Migrate from legacy projectQuotesPath / projectRememberPath
  const legacyPaths = [
    normalizeProjectMemoryPath(record.projectQuotesPath),
    normalizeProjectMemoryPath(record.projectRememberPath),
  ].filter((p): p is string => Boolean(p))
  if (legacyPaths.length > 0) {
    return legacyPaths.map((path, index): PinBoardPanelBlock => ({
      id: generatePanelId(),
      type: 'markdown',
      path,
      ...defaultPanelLayoutByIndex(index, 'markdown'),
    }))
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
    pinBoardGroups: normalizePinBoardGroups(record.pinBoardGroups),
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
