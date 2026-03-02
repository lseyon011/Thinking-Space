import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EXPLORER_FOLDER_COLOR_PRESET_BLOCK,
  createDefaultVaultUiPreferencesBlock,
  normalizeVaultUiPreferencesBlock,
} from '@/services/lego_blocks/units/vaultUiPreferencesBlock'

describe('vaultUiPreferencesBlock', () => {
  it('uses the legacy folder color preset by default', () => {
    const defaults = createDefaultVaultUiPreferencesBlock()
    expect(defaults.explorerFolderColorRules).toEqual(DEFAULT_EXPLORER_FOLDER_COLOR_PRESET_BLOCK)
  })

  it('applies default preset when explorer folder color rules are missing in stored data', () => {
    const normalized = normalizeVaultUiPreferencesBlock({
      explorerIconStyle: 'filled',
      newThoughtQuickDestinations: [],
    })
    expect(normalized.explorerFolderColorRules).toEqual(DEFAULT_EXPLORER_FOLDER_COLOR_PRESET_BLOCK)
  })

  it('keeps explicit empty explorer folder color rules when user clears them', () => {
    const normalized = normalizeVaultUiPreferencesBlock({
      explorerFolderColorRules: [],
    })
    expect(normalized.explorerFolderColorRules).toEqual([])
  })
})
