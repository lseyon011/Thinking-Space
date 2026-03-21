import { getVaultFS, isElectron } from '@/services/lego_blocks/integrations/fsBlock'
import {
  buildCodexDashboardGroupOptionsBlock,
  listWebSitesForCodexDashboardGroupBlock,
  normalizeCodexProfileDashboardPreferencesBlock,
  resolveCodexDashboardSourceGroupIdBlock,
  type CodexProfileDashboardGroupOptionBlock,
  type CodexProfileDashboardPreferencesBlock,
  type CodexProfileRuntimeStatusBlock,
} from '@/services/lego_blocks/units/codexProfileBlock'
import { readWebSitePreferencesOrch } from '@/services/orchestrators/webSiteOrch'
import type { WebSiteBlock } from '@/services/lego_blocks/units/webSiteBlock'

const CODEX_PROFILE_DIR_ORCH = '.thinking-space/preferences'
const CODEX_PROFILE_FILE_ORCH = `${CODEX_PROFILE_DIR_ORCH}/codex-profile-dashboard.json`

export interface CodexProfileDashboardRowOrch {
  site: WebSiteBlock
  runtime: CodexProfileRuntimeStatusBlock | null
}

export interface CodexProfileDashboardDataOrch {
  preferences: CodexProfileDashboardPreferencesBlock
  sourceGroupId: string | null
  groups: CodexProfileDashboardGroupOptionBlock[]
  rows: CodexProfileDashboardRowOrch[]
  activeHomePath: string | null
  launchctlHomePath: string | null
  profileRootPath: string | null
}

async function ensureCodexProfileDirOrch(): Promise<void> {
  const fs = getVaultFS()
  try { await fs.mkdir('.thinking-space') } catch { /* exists */ }
  try { await fs.mkdir(CODEX_PROFILE_DIR_ORCH) } catch { /* exists */ }
}

export async function readCodexProfileDashboardPreferencesOrch(): Promise<CodexProfileDashboardPreferencesBlock> {
  const fs = getVaultFS()
  try {
    const raw = await fs.read(CODEX_PROFILE_FILE_ORCH)
    return normalizeCodexProfileDashboardPreferencesBlock(JSON.parse(raw))
  } catch {
    return normalizeCodexProfileDashboardPreferencesBlock(null)
  }
}

export async function saveCodexProfileDashboardPreferencesOrch(
  preferences: CodexProfileDashboardPreferencesBlock,
): Promise<CodexProfileDashboardPreferencesBlock> {
  const normalized = normalizeCodexProfileDashboardPreferencesBlock(preferences)
  await ensureCodexProfileDirOrch()
  await getVaultFS().write(CODEX_PROFILE_FILE_ORCH, `${JSON.stringify(normalized, null, 2)}\n`)
  return normalized
}

export async function listCodexProfileDashboardDataOrch(): Promise<CodexProfileDashboardDataOrch> {
  const [preferences, webPrefs] = await Promise.all([
    readCodexProfileDashboardPreferencesOrch(),
    readWebSitePreferencesOrch(),
  ])

  const sourceGroupId = resolveCodexDashboardSourceGroupIdBlock(webPrefs, preferences.sourceGroupId)
  const groups = buildCodexDashboardGroupOptionsBlock(webPrefs)
  const sites = listWebSitesForCodexDashboardGroupBlock(webPrefs, sourceGroupId)

  if (!isElectron() || !window.electronAPI?.codexProfilesList) {
    return {
      preferences,
      sourceGroupId,
      groups,
      rows: sites.map((site) => ({ site, runtime: null })),
      activeHomePath: null,
      launchctlHomePath: null,
      profileRootPath: null,
    }
  }

  const runtime = await window.electronAPI.codexProfilesList(sites.map((site) => site.id))
  const runtimeBySiteId = new Map<string, CodexProfileRuntimeStatusBlock>(
    runtime.profiles.map((profile) => [profile.siteId, profile]),
  )

  return {
    preferences,
    sourceGroupId,
    groups,
    rows: sites.map((site) => ({
      site,
      runtime: runtimeBySiteId.get(site.id) ?? null,
    })),
    activeHomePath: runtime.activeHomePath,
    launchctlHomePath: runtime.launchctlHomePath,
    profileRootPath: runtime.profileRootPath,
  }
}

export async function activateCodexProfileOrch(siteId: string): Promise<{
  activeHomePath: string
  launchctlHomePath: string | null
  launchctlApplied: boolean
  warning: string | null
  profile: CodexProfileRuntimeStatusBlock
}> {
  if (!isElectron() || !window.electronAPI?.codexProfileActivate) {
    throw new Error('Codex profile activation is only available in the desktop app.')
  }
  return window.electronAPI.codexProfileActivate(siteId)
}
