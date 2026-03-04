import {
  getDefaultF9ExecutionSettingsBlock,
  readF9ExecutionSettingsBlock,
  writeF9ExecutionSettingsBlock,
  type F9ExecutionSettingsBlock,
} from '../lego_blocks/units/f9ExecutionSettingsBlock'
import {
  readF9ExecutionSettingsFromVaultBlock,
  writeF9ExecutionSettingsToVaultBlock,
} from '../lego_blocks/integrations/f9ExecutionSettingsStorageBlock'

export type { F9ExecutionSettingsBlock }

export function getDefaultF9ExecutionSettingsOrch(): F9ExecutionSettingsBlock {
  return getDefaultF9ExecutionSettingsBlock()
}

export async function readF9ExecutionSettingsOrch(): Promise<F9ExecutionSettingsBlock> {
  const fromVault = await readF9ExecutionSettingsFromVaultBlock()
  if (fromVault) {
    writeF9ExecutionSettingsBlock(fromVault)
    return fromVault
  }

  const legacyLocal = readF9ExecutionSettingsBlock()
  if (legacyLocal.executionFolderPath) {
    await writeF9ExecutionSettingsToVaultBlock(legacyLocal).catch(() => {
      // Ignore migration write errors; local fallback still works.
    })
  }
  return legacyLocal
}

export async function writeF9ExecutionSettingsOrch(
  settings: F9ExecutionSettingsBlock,
): Promise<F9ExecutionSettingsBlock> {
  const normalized = writeF9ExecutionSettingsBlock(settings)
  await writeF9ExecutionSettingsToVaultBlock(normalized)
  return normalized
}
