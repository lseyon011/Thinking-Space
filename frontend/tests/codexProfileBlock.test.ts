import { describe, expect, it } from 'vitest'
import {
  buildCodexDashboardGroupOptionsBlock,
  buildCodexTerminalRouteBlock,
  formatCodexProfileStateLabelBlock,
  listWebSitesForCodexDashboardGroupBlock,
  resolveCodexDashboardSourceGroupIdBlock,
  type CodexProfileRuntimeStatusBlock,
} from '@/services/lego_blocks/units/codexProfileBlock'
import type { WebSitePreferencesBlock } from '@/services/lego_blocks/units/webSiteBlock'

const webPrefs: WebSitePreferencesBlock = {
  groups: [
    { id: 'accounts', name: 'Accounts', parentGroupId: null },
    { id: 'nested', name: 'Nested', parentGroupId: 'accounts' },
    { id: 'other', name: 'Other', parentGroupId: null },
  ],
  bookmarks: [
    { id: 'site-1', name: 'Alpha', url: 'https://chatgpt.com', partition: 'persist:site-1', groupId: 'accounts' },
    { id: 'site-2', name: 'Bravo', url: 'https://chatgpt.com', partition: 'persist:site-2', groupId: 'nested' },
    { id: 'site-3', name: 'Zulu', url: 'https://example.com', partition: 'persist:site-3', groupId: 'other' },
  ],
}

const readyStatus: CodexProfileRuntimeStatusBlock = {
  siteId: 'site-1',
  profileId: 'codex-site-1',
  homePath: '/tmp/site-1',
  active: false,
  exists: true,
  hasAuthFile: true,
  accountId: 'acct_123',
  authMode: 'chatgpt',
  lastRefresh: '2026-03-21T00:00:00.000Z',
  expiresAt: '2026-03-21T01:00:00.000Z',
  authFileUpdatedAt: '2026-03-21T00:00:00.000Z',
  launchctlMatches: false,
}

describe('codexProfileBlock', () => {
  it('collects bookmarks from the selected group and descendants', () => {
    expect(listWebSitesForCodexDashboardGroupBlock(webPrefs, 'accounts').map((site) => site.id)).toEqual(['site-1', 'site-2'])
  })

  it('builds dashboard group options with bookmark counts', () => {
    expect(buildCodexDashboardGroupOptionsBlock(webPrefs)).toEqual([
      { id: 'accounts', name: 'Accounts', bookmarkCount: 2 },
      { id: 'nested', name: 'Nested', bookmarkCount: 1 },
      { id: 'other', name: 'Other', bookmarkCount: 1 },
    ])
  })

  it('falls back to the first populated group when requested group is missing', () => {
    expect(resolveCodexDashboardSourceGroupIdBlock(webPrefs, 'missing')).toBe('accounts')
  })

  it('formats state labels for dashboard rows', () => {
    expect(formatCodexProfileStateLabelBlock(readyStatus)).toBe('Ready')
    expect(formatCodexProfileStateLabelBlock({ ...readyStatus, active: true })).toBe('Active')
    expect(formatCodexProfileStateLabelBlock({ ...readyStatus, hasAuthFile: false })).toBe('Needs login')
    expect(formatCodexProfileStateLabelBlock(null)).toBe('Unavailable')
  })

  it('builds terminal routes that carry the selected profile and label', () => {
    const route = buildCodexTerminalRouteBlock('site-1', 'Alpha')
    expect(route).toContain('/terminal?')
    expect(route).toContain('codexProfile=site-1')
    expect(route).toContain('label=Alpha')
  })
})
