import {
  getExcalidrawPluginStatusBlock,
  installLatestExcalidrawPluginBlock,
} from '@/services/lego_blocks/integrations/excalidrawPluginBlock'
import type { ExcalidrawPluginStatus } from '@/services/lego_blocks/units/typesBlock'
import { getStoredVaultRoot } from '@/services/lego_blocks/units/storageKeyBlock'

function getConfiguredVaultRoot(): string {
  const vaultRoot = getStoredVaultRoot()
  if (!vaultRoot) throw new Error('Vault root not configured')
  return vaultRoot
}

export async function getExcalidrawPluginStatus(): Promise<ExcalidrawPluginStatus> {
  return getExcalidrawPluginStatusBlock(getConfiguredVaultRoot())
}

export async function installOrUpdateExcalidrawPlugin(): Promise<ExcalidrawPluginStatus> {
  return installLatestExcalidrawPluginBlock(getConfiguredVaultRoot())
}
