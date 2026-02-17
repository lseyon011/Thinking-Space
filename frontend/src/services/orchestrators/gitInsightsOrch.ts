import type { GitInsightsData } from '../lego_blocks/typesBlock'
import { isElectron } from './runtimeOrch'
import { getGitInsightsLocal } from '../lego_blocks/gitInsightsBlock'
import { getStoredVaultRoot } from '../lego_blocks/storageKeyBlock'

export async function getGitInsights(days: number): Promise<GitInsightsData> {
  // On Electron desktop, run git commands locally
  if (isElectron()) {
    const vaultRoot = getStoredVaultRoot()
    if (!vaultRoot) throw new Error('Vault root not configured')
    return getGitInsightsLocal(vaultRoot, days)
  }

  // Web fallback — call backend
  const res = await fetch(`/api/tools/git-insights?days=${days}`)
  if (!res.ok) throw new Error('Failed to load insights')
  const json = await res.json()
  return json.data
}
