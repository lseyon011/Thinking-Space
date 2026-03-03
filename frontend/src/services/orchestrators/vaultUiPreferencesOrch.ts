import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import {
  createDefaultVaultUiPreferencesBlock,
  DEFAULT_EXPLORER_FOLDER_COLOR_PRESET_BLOCK,
  normalizeExplorerFolderColorPreferencesBlock,
  normalizeExplorerIconStyleBlock,
  normalizeNewThoughtQuickDestinationsBlock,
  normalizeVaultUiPreferencesBlock,
  serializeVaultUiPreferencesBlock,
  type ExplorerFolderColorPreferenceBlock,
  type ExplorerIconStyleBlock,
  type NewThoughtQuickDestinationPreferenceBlock,
  type VaultUiPreferencesBlock,
} from '@/services/lego_blocks/units/vaultUiPreferencesBlock'

const THINK_SPACE_DIR_ORCH = '.thinking-space'
const LEGACY_THINK_SPACE_DIR_ORCH = '.think-space'
const UI_PREFERENCES_DIR_ORCH = `${THINK_SPACE_DIR_ORCH}/preferences`
const UI_PREFERENCES_FILE_ORCH = `${UI_PREFERENCES_DIR_ORCH}/ui.json`
const LEGACY_UI_PREFERENCES_DIR_ORCH = `${LEGACY_THINK_SPACE_DIR_ORCH}/preferences`
const LEGACY_UI_PREFERENCES_FILE_ORCH = `${LEGACY_UI_PREFERENCES_DIR_ORCH}/ui.json`

export type {
  ExplorerFolderColorPreferenceBlock,
  ExplorerIconStyleBlock,
  NewThoughtQuickDestinationPreferenceBlock,
  VaultUiPreferencesBlock,
}
export { DEFAULT_EXPLORER_FOLDER_COLOR_PRESET_BLOCK }

async function ensurePreferencesDirOrch(): Promise<void> {
  const fs = getVaultFS()
  try {
    await fs.mkdir(THINK_SPACE_DIR_ORCH)
  } catch {
    // Directory likely exists.
  }
  try {
    await fs.mkdir(UI_PREFERENCES_DIR_ORCH)
  } catch {
    // Directory likely exists.
  }
}

export async function readVaultUiPreferencesOrch(): Promise<VaultUiPreferencesBlock> {
  const fs = getVaultFS()
  try {
    const hasCurrent = await fs.exists(UI_PREFERENCES_FILE_ORCH)
    const targetPath = hasCurrent
      ? UI_PREFERENCES_FILE_ORCH
      : (await fs.exists(LEGACY_UI_PREFERENCES_FILE_ORCH))
        ? LEGACY_UI_PREFERENCES_FILE_ORCH
        : null
    if (!targetPath) {
      return createDefaultVaultUiPreferencesBlock()
    }
    const raw = await fs.read(targetPath)
    if (!raw.trim()) return createDefaultVaultUiPreferencesBlock()
    const normalized = normalizeVaultUiPreferencesBlock(JSON.parse(raw))
    if (targetPath === LEGACY_UI_PREFERENCES_FILE_ORCH) {
      // Best effort: migrate legacy location to canonical .thinking-space path.
      try {
        await ensurePreferencesDirOrch()
        await fs.write(UI_PREFERENCES_FILE_ORCH, serializeVaultUiPreferencesBlock(normalized))
      } catch {
        // Ignore migration write errors; return parsed preferences.
      }
    }
    return normalized
  } catch {
    return createDefaultVaultUiPreferencesBlock()
  }
}

async function writeVaultUiPreferencesOrch(
  preferences: VaultUiPreferencesBlock,
): Promise<VaultUiPreferencesBlock> {
  const normalized = normalizeVaultUiPreferencesBlock(preferences)
  const fs = getVaultFS()
  await ensurePreferencesDirOrch()
  await fs.write(UI_PREFERENCES_FILE_ORCH, serializeVaultUiPreferencesBlock(normalized))
  return normalized
}

async function updateVaultUiPreferencesOrch(
  partial: Partial<VaultUiPreferencesBlock>,
): Promise<VaultUiPreferencesBlock> {
  const current = await readVaultUiPreferencesOrch()
  return writeVaultUiPreferencesOrch({
    ...current,
    ...partial,
  })
}

export async function setExplorerIconStylePreferenceOrch(
  style: ExplorerIconStyleBlock,
): Promise<VaultUiPreferencesBlock> {
  return updateVaultUiPreferencesOrch({
    explorerIconStyle: normalizeExplorerIconStyleBlock(style),
  })
}

export async function readNewThoughtQuickDestinationsPreferenceOrch(): Promise<
  NewThoughtQuickDestinationPreferenceBlock[]
> {
  const preferences = await readVaultUiPreferencesOrch()
  return preferences.newThoughtQuickDestinations
}

export async function setNewThoughtQuickDestinationsPreferenceOrch(
  destinations: NewThoughtQuickDestinationPreferenceBlock[],
): Promise<VaultUiPreferencesBlock> {
  return updateVaultUiPreferencesOrch({
    newThoughtQuickDestinations: normalizeNewThoughtQuickDestinationsBlock(destinations),
  })
}

export async function readExplorerFolderColorPreferencesOrch(): Promise<
  ExplorerFolderColorPreferenceBlock[]
> {
  const preferences = await readVaultUiPreferencesOrch()
  return preferences.explorerFolderColorRules
}

export async function setExplorerFolderColorPreferencesOrch(
  rules: ExplorerFolderColorPreferenceBlock[],
): Promise<VaultUiPreferencesBlock> {
  return updateVaultUiPreferencesOrch({
    explorerFolderColorRules: normalizeExplorerFolderColorPreferencesBlock(rules),
  })
}
