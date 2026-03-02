export type ExplorerIconStyleBlock = 'outline' | 'filled'

export interface NewThoughtQuickDestinationPreferenceBlock {
  id: string
  label: string
  pathSegments: string[]
}

export interface VaultUiPreferencesBlock {
  explorerIconStyle: ExplorerIconStyleBlock
  newThoughtQuickDestinations: NewThoughtQuickDestinationPreferenceBlock[]
}

export const DEFAULT_VAULT_UI_PREFERENCES_BLOCK: VaultUiPreferencesBlock = {
  explorerIconStyle: 'outline',
  newThoughtQuickDestinations: [],
}

export function normalizeExplorerIconStyleBlock(value: unknown): ExplorerIconStyleBlock {
  return value === 'filled' ? 'filled' : 'outline'
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
  if (!value || typeof value !== 'object') return { ...DEFAULT_VAULT_UI_PREFERENCES_BLOCK }
  const record = value as Partial<VaultUiPreferencesBlock>
  return {
    explorerIconStyle: normalizeExplorerIconStyleBlock(record.explorerIconStyle),
    newThoughtQuickDestinations: normalizeNewThoughtQuickDestinationsBlock(record.newThoughtQuickDestinations),
  }
}

export function serializeVaultUiPreferencesBlock(preferences: VaultUiPreferencesBlock): string {
  return `${JSON.stringify(preferences, null, 2)}\n`
}
