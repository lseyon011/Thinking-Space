import type { GitInsightsData } from '@/services/lego_blocks/units/typesBlock'
import { isElectron } from './runtimeOrch'
import { getGitInsightsLocal } from '@/services/lego_blocks/units/gitInsightsBlock'
import { getStoredVaultRoot } from '@/services/lego_blocks/units/storageKeyBlock'

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
