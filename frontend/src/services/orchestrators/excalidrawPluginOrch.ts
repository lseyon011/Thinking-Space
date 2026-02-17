import {
  getExcalidrawPluginStatusBlock,
  installLatestExcalidrawPluginBlock,
} from '../lego_blocks/excalidrawPluginBlock'
import type { ExcalidrawPluginStatus } from '../lego_blocks/typesBlock'
import { getStoredVaultRoot } from '../lego_blocks/storageKeyBlock'

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
