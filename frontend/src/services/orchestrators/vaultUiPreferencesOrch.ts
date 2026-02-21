import { getVaultFS } from '../lego_blocks/fsBlock'
import {
  DEFAULT_VAULT_UI_PREFERENCES_BLOCK,
  normalizeExplorerIconStyleBlock,
  normalizeVaultUiPreferencesBlock,
  serializeVaultUiPreferencesBlock,
  type ExplorerIconStyleBlock,
  type VaultUiPreferencesBlock,
} from '../lego_blocks/vaultUiPreferencesBlock'

const THINK_SPACE_DIR_ORCH = '.think-space'
const UI_PREFERENCES_DIR_ORCH = `${THINK_SPACE_DIR_ORCH}/preferences`
const UI_PREFERENCES_FILE_ORCH = `${UI_PREFERENCES_DIR_ORCH}/ui.json`

export type { ExplorerIconStyleBlock, VaultUiPreferencesBlock }

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

export async function setExplorerIconStylePreferenceOrch(
  style: ExplorerIconStyleBlock,
): Promise<VaultUiPreferencesBlock> {
  const next: VaultUiPreferencesBlock = {
    explorerIconStyle: normalizeExplorerIconStyleBlock(style),
  }
  const fs = getVaultFS()
  await ensurePreferencesDirOrch()
  await fs.write(UI_PREFERENCES_FILE_ORCH, serializeVaultUiPreferencesBlock(next))
  return next
}
