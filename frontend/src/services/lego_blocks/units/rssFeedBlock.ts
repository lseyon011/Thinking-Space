export interface RssFeedConfigBlock {
  id: string
  url: string
  title: string
  groupId?: string | null
}

export interface RssFeedGroupBlock {
  id: string
  name: string
  parentGroupId: string | null
}

export interface RssFeedPreferencesBlock {
  schemaVersion: number
  feeds: RssFeedConfigBlock[]
  groups: RssFeedGroupBlock[]
  presetTags: string[]
  tagColors: Record<string, string>
}

export interface RssFeedGroupTreeNodeBlock {
  group: RssFeedGroupBlock | null
  feeds: RssFeedConfigBlock[]
  children: RssFeedGroupTreeNodeBlock[]
}

export interface RssFeedItemBlock {
  id: string
  feedId: string
  title: string
  link: string
  description: string
  pubDate: string | null
  read: boolean
  tags: string[]
  keep: boolean
  important: boolean
}

export interface RssFeedResultBlock {
  feedId: string
  feedTitle: string
  items: RssFeedItemBlock[]
  error: string | null
}

export function generateFeedIdBlock(): string {
  return `feed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function generateGroupIdBlock(): string {
  return `rss-group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function normalizeRssFeedPreferencesBlock(raw: unknown): RssFeedPreferencesBlock {
  if (Array.isArray(raw)) {
    // Legacy: plain array of feed configs
    return {
      schemaVersion: 1,
      feeds: raw.filter(isValidFeedConfig),
      groups: [],
      presetTags: [],
      tagColors: {},
    }
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    return {
      schemaVersion: typeof obj.schemaVersion === 'number' ? obj.schemaVersion : 1,
      feeds: Array.isArray(obj.feeds) ? obj.feeds.filter(isValidFeedConfig) : [],
      groups: Array.isArray(obj.groups) ? obj.groups.filter(isValidGroup) : [],
      presetTags: Array.isArray(obj.presetTags)
        ? obj.presetTags.filter((t): t is string => typeof t === 'string')
        : [],
      tagColors: obj.tagColors && typeof obj.tagColors === 'object'
        ? obj.tagColors as Record<string, string>
        : {},
    }
  }
  return { schemaVersion: 1, feeds: [], groups: [], presetTags: [], tagColors: {} }
}

function isValidFeedConfig(item: unknown): item is RssFeedConfigBlock {
  return (
    item !== null &&
    typeof item === 'object' &&
    typeof (item as RssFeedConfigBlock).id === 'string' &&
    typeof (item as RssFeedConfigBlock).url === 'string' &&
    typeof (item as RssFeedConfigBlock).title === 'string'
  )
}

function isValidGroup(item: unknown): item is RssFeedGroupBlock {
  return (
    item !== null &&
    typeof item === 'object' &&
    typeof (item as RssFeedGroupBlock).id === 'string' &&
    typeof (item as RssFeedGroupBlock).name === 'string'
  )
}

export function buildFeedGroupTreeBlock(
  groups: RssFeedGroupBlock[],
  feeds: RssFeedConfigBlock[],
): RssFeedGroupTreeNodeBlock[] {
  const groupMap = new Map<string, RssFeedGroupBlock>(groups.map(g => [g.id, g]))

  // Build child → parent mapping
  const childGroupsByParent = new Map<string | null, RssFeedGroupBlock[]>()
  for (const group of groups) {
    const parentId = group.parentGroupId
    const list = childGroupsByParent.get(parentId) ?? []
    list.push(group)
    childGroupsByParent.set(parentId, list)
  }

  // Build feeds by group
  const feedsByGroup = new Map<string | null, RssFeedConfigBlock[]>()
  for (const feed of feeds) {
    const gid = feed.groupId && groupMap.has(feed.groupId) ? feed.groupId : null
    const list = feedsByGroup.get(gid) ?? []
    list.push(feed)
    feedsByGroup.set(gid, list)
  }

  function buildNode(group: RssFeedGroupBlock | null): RssFeedGroupTreeNodeBlock {
    const gid = group?.id ?? null
    return {
      group,
      feeds: feedsByGroup.get(gid) ?? [],
      children: (childGroupsByParent.get(gid) ?? []).map(child => buildNode(child)),
    }
  }

  // Root level: ungrouped feeds + root-level groups
  const rootFeeds = feedsByGroup.get(null) ?? []
  const rootGroups = childGroupsByParent.get(null) ?? []
  const rootChildren = rootGroups.map(g => buildNode(g))

  // If there are root-level feeds, wrap them in a single root node
  if (rootFeeds.length > 0 || rootChildren.length > 0) {
    return [{ group: null, feeds: rootFeeds, children: rootChildren }]
  }
  return []
}

/**
 * Stable ID for an RSS item from its GUID or link hash.
 */
export function normalizeRssFeedItemIdBlock(
  feedId: string,
  guid: string | undefined,
  link: string | undefined,
  title: string | undefined,
): string {
  const raw = guid || link || title || ''
  return `${feedId}::${simpleHashBlock(raw)}`
}

export function mergeReadStateBlock(
  items: RssFeedItemBlock[],
  readIds: Set<string>,
): RssFeedItemBlock[] {
  return items.map(item => ({
    ...item,
    read: readIds.has(item.id),
  }))
}

function simpleHashBlock(value: string): string {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}
