import type { WebSiteBlock, WebSiteGroupBlock, WebSitePreferencesBlock } from '@/services/lego_blocks/units/webSiteBlock'

export interface CodexProfileDashboardPreferencesBlock {
  sourceGroupId: string | null
}

export interface CodexProfileRuntimeStatusBlock {
  siteId: string
  profileId: string
  homePath: string
  active: boolean
  exists: boolean
  hasAuthFile: boolean
  accountId: string | null
  authMode: string | null
  lastRefresh: string | null
  expiresAt: string | null
  authFileUpdatedAt: string | null
  launchctlMatches: boolean
  error?: string
}

export interface CodexProfileDashboardGroupOptionBlock {
  id: string
  name: string
  bookmarkCount: number
}

export const DEFAULT_CODEX_PROFILE_DASHBOARD_PREFERENCES_BLOCK: CodexProfileDashboardPreferencesBlock = {
  sourceGroupId: null,
}

export function normalizeCodexProfileDashboardPreferencesBlock(raw: unknown): CodexProfileDashboardPreferencesBlock {
  if (!raw || typeof raw !== 'object') return DEFAULT_CODEX_PROFILE_DASHBOARD_PREFERENCES_BLOCK
  const record = raw as Record<string, unknown>
  return {
    sourceGroupId: typeof record.sourceGroupId === 'string' && record.sourceGroupId.trim()
      ? record.sourceGroupId
      : null,
  }
}

function collectDescendantGroupIdsBlock(groups: WebSiteGroupBlock[], rootGroupId: string): Set<string> {
  const ids = new Set<string>([rootGroupId])
  const queue = [rootGroupId]

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const group of groups) {
      if (group.parentGroupId !== current || ids.has(group.id)) continue
      ids.add(group.id)
      queue.push(group.id)
    }
  }

  return ids
}

export function listWebSitesForCodexDashboardGroupBlock(
  prefs: WebSitePreferencesBlock,
  sourceGroupId: string | null,
): WebSiteBlock[] {
  if (!sourceGroupId) return []
  const scopedGroupIds = collectDescendantGroupIdsBlock(prefs.groups, sourceGroupId)
  return prefs.bookmarks
    .filter((bookmark) => bookmark.groupId && scopedGroupIds.has(bookmark.groupId))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function buildCodexDashboardGroupOptionsBlock(
  prefs: WebSitePreferencesBlock,
): CodexProfileDashboardGroupOptionBlock[] {
  return prefs.groups
    .map((group) => ({
      id: group.id,
      name: group.name,
      bookmarkCount: listWebSitesForCodexDashboardGroupBlock(prefs, group.id).length,
    }))
    .filter((group) => group.bookmarkCount > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function resolveCodexDashboardSourceGroupIdBlock(
  prefs: WebSitePreferencesBlock,
  requestedGroupId: string | null,
): string | null {
  const options = buildCodexDashboardGroupOptionsBlock(prefs)
  if (requestedGroupId && options.some((group) => group.id === requestedGroupId)) return requestedGroupId
  return options[0]?.id ?? null
}

export function formatCodexProfileStateLabelBlock(status: CodexProfileRuntimeStatusBlock | null): string {
  if (!status) return 'Unavailable'
  if (status.hasAuthFile) return status.active ? 'Active' : 'Ready'
  if (status.exists) return status.active ? 'Active, needs login' : 'Needs login'
  return 'Not set up'
}

export function buildCodexTerminalRouteBlock(siteId: string, siteName: string): string {
  const params = new URLSearchParams({
    codexProfile: siteId,
    label: siteName,
    nonce: String(Date.now()),
  })
  return `/terminal?${params.toString()}`
}
