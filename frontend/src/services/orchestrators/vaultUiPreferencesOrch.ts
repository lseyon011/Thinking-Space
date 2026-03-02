import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import {
  DEFAULT_VAULT_UI_PREFERENCES_BLOCK,
  normalizeExplorerIconStyleBlock,
  normalizeNewThoughtQuickDestinationsBlock,
  normalizeVaultUiPreferencesBlock,
  serializeVaultUiPreferencesBlock,
  type ExplorerIconStyleBlock,
  type NewThoughtQuickDestinationPreferenceBlock,
  type VaultUiPreferencesBlock,
} from '@/services/lego_blocks/units/vaultUiPreferencesBlock'

const THINK_SPACE_DIR_ORCH = '.think-space'
const UI_PREFERENCES_DIR_ORCH = `${THINK_SPACE_DIR_ORCH}/preferences`
const UI_PREFERENCES_FILE_ORCH = `${UI_PREFERENCES_DIR_ORCH}/ui.json`

export type {
  ExplorerIconStyleBlock,
  NewThoughtQuickDestinationPreferenceBlock,
  VaultUiPreferencesBlock,
}

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
    if (!(await fs.exists(UI_PREFERENCES_FILE_ORCH))) {
      return { ...DEFAULT_VAULT_UI_PREFERENCES_BLOCK }
    }
    const raw = await fs.read(UI_PREFERENCES_FILE_ORCH)
    if (!raw.trim()) return { ...DEFAULT_VAULT_UI_PREFERENCES_BLOCK }
    return normalizeVaultUiPreferencesBlock(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_VAULT_UI_PREFERENCES_BLOCK }
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
