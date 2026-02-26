export type ExplorerIconStyleBlock = 'outline' | 'filled'

export interface VaultUiPreferencesBlock {
  explorerIconStyle: ExplorerIconStyleBlock
}

export const DEFAULT_VAULT_UI_PREFERENCES_BLOCK: VaultUiPreferencesBlock = {
  explorerIconStyle: 'outline',
}

export function normalizeExplorerIconStyleBlock(value: unknown): ExplorerIconStyleBlock {
  return value === 'filled' ? 'filled' : 'outline'
}

export function normalizeVaultUiPreferencesBlock(value: unknown): VaultUiPreferencesBlock {
  if (!value || typeof value !== 'object') return { ...DEFAULT_VAULT_UI_PREFERENCES_BLOCK }
  const record = value as Partial<VaultUiPreferencesBlock>
  return {
    explorerIconStyle: normalizeExplorerIconStyleBlock(record.explorerIconStyle),
  }
}

export function serializeVaultUiPreferencesBlock(preferences: VaultUiPreferencesBlock): string {
  return `${JSON.stringify(preferences, null, 2)}\n`
}
