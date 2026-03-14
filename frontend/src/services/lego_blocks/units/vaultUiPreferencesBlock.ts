export type ExplorerIconStyleBlock = 'outline' | 'filled'

export interface NewThoughtQuickDestinationPreferenceBlock {
  id: string
  label: string
  pathSegments: string[]
}

export interface ExplorerFolderColorPreferenceBlock {
  id: string
  folderPath: string
  color: string
  includeDescendants: boolean
}

export interface VaultUiPreferencesBlock {
  explorerIconStyle: ExplorerIconStyleBlock
  newThoughtQuickDestinations: NewThoughtQuickDestinationPreferenceBlock[]
  explorerFolderColorRules: ExplorerFolderColorPreferenceBlock[]
  f9TabLabel: string
  f9TabIconText: string
}

export const DEFAULT_EXPLORER_FOLDER_COLOR_PRESET_BLOCK: ExplorerFolderColorPreferenceBlock[] = [
  { id: 'explorer-color-acceleration-core', folderPath: 'acceleration_core', color: '#1491d4', includeDescendants: false },
  { id: 'explorer-color-acceleration-core-f9', folderPath: 'acceleration_core/F9', color: '#2e9fe5', includeDescendants: true },
  { id: 'explorer-color-acceleration-core-ideas-ai', folderPath: 'acceleration_core/ideas.ai', color: '#29ab87', includeDescendants: true },
  { id: 'explorer-color-acceleration-core-sfai', folderPath: 'acceleration_core/sfai', color: '#705cca', includeDescendants: true },
  { id: 'explorer-color-acceleration-core-sfj', folderPath: 'acceleration_core/sfj', color: '#e76f51', includeDescendants: true },
  { id: 'explorer-color-acceleration-core-sflc', folderPath: 'acceleration_core/sflc', color: '#f7c44c', includeDescendants: true },
  { id: 'explorer-color-lifeblood-systems', folderPath: 'lifeblood_systems', color: '#964bb4', includeDescendants: false },
  { id: 'explorer-color-lifeblood-systems-ff08', folderPath: 'lifeblood_systems/FF08', color: '#a65ac2', includeDescendants: true },
  { id: 'explorer-color-lifeblood-systems-sfcommunication', folderPath: 'lifeblood_systems/sfcommunication', color: '#8c3caa', includeDescendants: true },
  { id: 'explorer-color-lifeblood-systems-sfdl', folderPath: 'lifeblood_systems/sfdl', color: '#b26ccd', includeDescendants: true },
  { id: 'explorer-color-lifeblood-systems-sftravel', folderPath: 'lifeblood_systems/sftravel', color: '#be84dc', includeDescendants: true },
  { id: 'explorer-color-lifeblood-systems-sfw', folderPath: 'lifeblood_systems/sfw', color: '#aa5fd2', includeDescendants: true },
  { id: 'explorer-color-lifeblood-systems-understanding-myself', folderPath: 'lifeblood_systems/Understanding Myself', color: '#2e9fe5', includeDescendants: true },
]

function cloneExplorerFolderColorRulesBlock(
  rules: ExplorerFolderColorPreferenceBlock[],
): ExplorerFolderColorPreferenceBlock[] {
  return rules.map((rule) => ({ ...rule }))
}

export const DEFAULT_VAULT_UI_PREFERENCES_BLOCK: VaultUiPreferencesBlock = {
  explorerIconStyle: 'outline',
  newThoughtQuickDestinations: [],
  explorerFolderColorRules: cloneExplorerFolderColorRulesBlock(DEFAULT_EXPLORER_FOLDER_COLOR_PRESET_BLOCK),
  f9TabLabel: 'Webull',
  f9TabIconText: '',
}

export function createDefaultVaultUiPreferencesBlock(): VaultUiPreferencesBlock {
  return {
    explorerIconStyle: DEFAULT_VAULT_UI_PREFERENCES_BLOCK.explorerIconStyle,
    newThoughtQuickDestinations: [],
    explorerFolderColorRules: cloneExplorerFolderColorRulesBlock(DEFAULT_VAULT_UI_PREFERENCES_BLOCK.explorerFolderColorRules),
    f9TabLabel: 'Webull',
    f9TabIconText: '',
  }
}

export function normalizeExplorerIconStyleBlock(value: unknown): ExplorerIconStyleBlock {
  return value === 'filled' ? 'filled' : 'outline'
}

const HEX_COLOR_BLOCK_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

function normalizeFolderPathBlock(value: unknown): string {
  if (typeof value !== 'string') return ''
  const normalized = value
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join('/')
  return normalized
}

function normalizeHexColorBlock(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!HEX_COLOR_BLOCK_PATTERN.test(trimmed)) return ''
  const lower = trimmed.toLowerCase()
  if (lower.length === 4) {
    return `#${lower[1]}${lower[1]}${lower[2]}${lower[2]}${lower[3]}${lower[3]}`
  }
  return lower
}

function normalizeExplorerFolderColorRuleBlock(
  value: unknown,
  index: number,
): ExplorerFolderColorPreferenceBlock | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Partial<ExplorerFolderColorPreferenceBlock>
  const folderPath = normalizeFolderPathBlock(record.folderPath)
  const color = normalizeHexColorBlock(record.color)
  if (!folderPath || !color) return null
  const id = typeof record.id === 'string' && record.id.trim()
    ? record.id.trim()
    : `explorer-color-${index + 1}`
  return {
    id,
    folderPath,
    color,
    includeDescendants: record.includeDescendants !== false,
  }
}

export function normalizeExplorerFolderColorPreferencesBlock(
  value: unknown,
): ExplorerFolderColorPreferenceBlock[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const normalized: ExplorerFolderColorPreferenceBlock[] = []
  for (const [index, candidate] of value.entries()) {
    const rule = normalizeExplorerFolderColorRuleBlock(candidate, index)
    if (!rule || seen.has(rule.id)) continue
    seen.add(rule.id)
    normalized.push(rule)
  }
  return normalized
}

function normalizePathSegmentsBlock(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((segment) => (typeof segment === 'string' ? segment.split('/') : []))
      .map((segment) => segment.trim())
      .filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean)
  }
  return []
}

function normalizeQuickDestinationBlock(value: unknown): NewThoughtQuickDestinationPreferenceBlock | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Partial<NewThoughtQuickDestinationPreferenceBlock>
  const id = typeof record.id === 'string' ? record.id.trim() : ''
  const label = typeof record.label === 'string' ? record.label.trim() : ''
  const pathSegments = normalizePathSegmentsBlock(record.pathSegments)
  if (!id || !label || pathSegments.length === 0) return null
  return { id, label, pathSegments }
}

export function normalizeNewThoughtQuickDestinationsBlock(
  value: unknown,
): NewThoughtQuickDestinationPreferenceBlock[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const normalized: NewThoughtQuickDestinationPreferenceBlock[] = []
  for (const candidate of value) {
    const destination = normalizeQuickDestinationBlock(candidate)
    if (!destination || seen.has(destination.id)) continue
    seen.add(destination.id)
    normalized.push(destination)
  }
  return normalized
}

export function normalizeVaultUiPreferencesBlock(value: unknown): VaultUiPreferencesBlock {
  if (!value || typeof value !== 'object') return createDefaultVaultUiPreferencesBlock()
  const record = value as Partial<VaultUiPreferencesBlock>
  const normalizedExplorerFolderColorRules = Array.isArray(record.explorerFolderColorRules)
    ? normalizeExplorerFolderColorPreferencesBlock(record.explorerFolderColorRules)
    : cloneExplorerFolderColorRulesBlock(DEFAULT_VAULT_UI_PREFERENCES_BLOCK.explorerFolderColorRules)
  return {
    explorerIconStyle: normalizeExplorerIconStyleBlock(record.explorerIconStyle),
    newThoughtQuickDestinations: normalizeNewThoughtQuickDestinationsBlock(record.newThoughtQuickDestinations),
    explorerFolderColorRules: normalizedExplorerFolderColorRules,
    f9TabLabel: typeof record.f9TabLabel === 'string' && record.f9TabLabel.trim()
      ? record.f9TabLabel.trim()
      : 'Webull',
    f9TabIconText: typeof record.f9TabIconText === 'string'
      ? record.f9TabIconText.trim()
      : '',
  }
}

export function serializeVaultUiPreferencesBlock(preferences: VaultUiPreferencesBlock): string {
  return `${JSON.stringify(preferences, null, 2)}\n`
}
