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
import {
  addSyncExcludedPathPrefix,
  getSyncExcludedPathPrefixes,
  removeSyncExcludedPathPrefix,
} from '@/services/lego_blocks/units/vaultSyncExclusionsBlock'
import {
  bulkDeleteLinksForFiles,
  bulkDeleteNodesByPaths,
  getAllFilePaths,
} from '@/services/lego_blocks/integrations/dbBlock'
import { setManagedVaultGitignorePrefixes } from '@/services/lego_blocks/units/vaultGitignoreBlock'

export type { WebullExecutionSettingsBlock }

export function getDefaultWebullExecutionSettingsOrch(): WebullExecutionSettingsBlock {
  return getDefaultWebullExecutionSettingsBlock()
}

// Tracks the currently-registered Webull prefix so changes can swap cleanly.
let registeredWebullPrefix: string | null = null

async function purgeCachedNodesUnderPrefix(prefix: string): Promise<void> {
  const allPaths = await getAllFilePaths()
  const scoped: string[] = []
  for (const path of allPaths) {
    if (path === prefix || path.startsWith(`${prefix}/`)) scoped.push(path)
  }
  if (scoped.length === 0) return
  await bulkDeleteNodesByPaths(scoped)
  await bulkDeleteLinksForFiles(scoped)
}

async function syncManagedGitignore(): Promise<void> {
  try {
    await setManagedVaultGitignorePrefixes(getSyncExcludedPathPrefixes())
  } catch {
    // Best effort — .gitignore may be read-only or unreachable on some
    // platforms; sync correctness doesn't depend on it.
  }
}

async function syncExclusionToWebullPath(path: string): Promise<void> {
  const next = path.trim().replace(/^\/+|\/+$/g, '') || null
  if (next === registeredWebullPrefix) {
    // Still ensure registry reflects state (handles cold start where in-memory
    // var is null but localStorage already has it).
    if (next && !getSyncExcludedPathPrefixes().includes(next)) {
      addSyncExcludedPathPrefix(next)
      await purgeCachedNodesUnderPrefix(next).catch(() => { /* best effort */ })
      await syncManagedGitignore()
    }
    return
  }

  if (registeredWebullPrefix) {
    removeSyncExcludedPathPrefix(registeredWebullPrefix)
  }
  registeredWebullPrefix = next
  if (next) {
    addSyncExcludedPathPrefix(next)
    await purgeCachedNodesUnderPrefix(next).catch(() => { /* best effort */ })
  }
  await syncManagedGitignore()
}

export async function readWebullExecutionSettingsOrch(): Promise<WebullExecutionSettingsBlock> {
  const fromVault = await readWebullExecutionSettingsFromVaultBlock()
  if (fromVault) {
    writeWebullExecutionSettingsBlock(fromVault)
    await syncExclusionToWebullPath(fromVault.executionFolderPath)
    return fromVault
  }

  const legacyLocal = readWebullExecutionSettingsBlock()
  if (legacyLocal.executionFolderPath) {
    await writeWebullExecutionSettingsToVaultBlock(legacyLocal).catch(() => {
      // Ignore migration write errors; local fallback still works.
    })
  }
  await syncExclusionToWebullPath(legacyLocal.executionFolderPath)
  return legacyLocal
}

export async function writeWebullExecutionSettingsOrch(
  settings: WebullExecutionSettingsBlock,
): Promise<WebullExecutionSettingsBlock> {
  const normalized = writeWebullExecutionSettingsBlock(settings)
  await writeWebullExecutionSettingsToVaultBlock(normalized)
  await syncExclusionToWebullPath(normalized.executionFolderPath)
  return normalized
}
