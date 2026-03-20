import {
  getDefaultWebullExecutionSettingsBlock,
  readWebullExecutionSettingsBlock,
  writeWebullExecutionSettingsBlock,
  type WebullExecutionSettingsBlock,
} from '../lego_blocks/units/webullExecutionSettingsBlock'
import {
  readWebullExecutionSettingsFromVaultBlock,
  writeWebullExecutionSettingsToVaultBlock,
} from '../lego_blocks/integrations/webullExecutionSettingsStorageBlock'

export type { WebullExecutionSettingsBlock }

export function getDefaultWebullExecutionSettingsOrch(): WebullExecutionSettingsBlock {
  return getDefaultWebullExecutionSettingsBlock()
}

export async function readWebullExecutionSettingsOrch(): Promise<WebullExecutionSettingsBlock> {
  const fromVault = await readWebullExecutionSettingsFromVaultBlock()
  if (fromVault) {
    writeWebullExecutionSettingsBlock(fromVault)
    return fromVault
  }

  const legacyLocal = readWebullExecutionSettingsBlock()
  if (legacyLocal.executionFolderPath) {
    await writeWebullExecutionSettingsToVaultBlock(legacyLocal).catch(() => {
      // Ignore migration write errors; local fallback still works.
    })
  }
  return legacyLocal
}

export async function writeWebullExecutionSettingsOrch(
  settings: WebullExecutionSettingsBlock,
): Promise<WebullExecutionSettingsBlock> {
  const normalized = writeWebullExecutionSettingsBlock(settings)
  await writeWebullExecutionSettingsToVaultBlock(normalized)
  return normalized
}
