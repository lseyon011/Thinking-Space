export interface WebSiteBlock {
  id: string           // "ws-abc123"
  name: string         // "GitHub - Work"
  url: string          // "https://github.com"
  partition: string    // "persist:ws-abc123" — set once at creation, never changes
  groupId: string | null
}

export interface WebSiteGroupBlock {
  id: string
  name: string
  parentGroupId: string | null
}

export interface WebSiteGroupTreeNodeBlock {
  group: WebSiteGroupBlock | null
  bookmarks: WebSiteBlock[]
  children: WebSiteGroupTreeNodeBlock[]
}

export function buildWebSiteGroupTreeBlock(
  groups: WebSiteGroupBlock[],
  bookmarks: WebSiteBlock[],
): WebSiteGroupTreeNodeBlock[] {
  const groupMap = new Map<string, WebSiteGroupBlock>(groups.map(g => [g.id, g]))

  const childGroupsByParent = new Map<string | null, WebSiteGroupBlock[]>()
  for (const group of groups) {
    const parentId = group.parentGroupId ?? null
    const list = childGroupsByParent.get(parentId) ?? []
    list.push(group)
    childGroupsByParent.set(parentId, list)
  }

  const bookmarksByGroup = new Map<string | null, WebSiteBlock[]>()
  for (const b of bookmarks) {
    const gid = b.groupId && groupMap.has(b.groupId) ? b.groupId : null
    const list = bookmarksByGroup.get(gid) ?? []
    list.push(b)
    bookmarksByGroup.set(gid, list)
  }

  function buildNode(group: WebSiteGroupBlock | null): WebSiteGroupTreeNodeBlock {
    const gid = group?.id ?? null
    return {
      group,
      bookmarks: bookmarksByGroup.get(gid) ?? [],
      children: (childGroupsByParent.get(gid) ?? []).map(child => buildNode(child)),
    }
  }

  const rootBookmarks = bookmarksByGroup.get(null) ?? []
  const rootGroups = childGroupsByParent.get(null) ?? []
  const rootChildren = rootGroups.map(g => buildNode(g))

  if (rootBookmarks.length > 0 || rootChildren.length > 0) {
    return [{ group: null, bookmarks: rootBookmarks, children: rootChildren }]
  }
  return []
}

export interface WebSitePreferencesBlock {
  bookmarks: WebSiteBlock[]
  groups: WebSiteGroupBlock[]
}

export function generateWebSiteIdBlock(): string {
  return `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function generateWebSiteGroupIdBlock(): string {
  return `wsg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function buildWebSitePartitionBlock(id: string): string {
  return `persist:${id}`
}

export function domainLabelWebSiteBlock(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return 'Website' }
}

export function normalizeWebSitePreferencesBlock(raw: unknown): WebSitePreferencesBlock {
  if (!raw || typeof raw !== 'object') return { bookmarks: [], groups: [] }
  const obj = raw as Record<string, unknown>
  return {
    bookmarks: normalizeSitesBlock(obj.bookmarks),
    groups: normalizeGroupsBlock(obj.groups),
  }
}

function normalizeSitesBlock(raw: unknown): WebSiteBlock[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isValidWebSite)
}

function normalizeGroupsBlock(raw: unknown): WebSiteGroupBlock[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isValidWebSiteGroup).map(normalizeWebSiteGroupBlock)
}

function isValidWebSite(item: unknown): item is WebSiteBlock {
  return (
    item !== null &&
    typeof item === 'object' &&
    typeof (item as WebSiteBlock).id === 'string' &&
    typeof (item as WebSiteBlock).name === 'string' &&
    typeof (item as WebSiteBlock).url === 'string' &&
    typeof (item as WebSiteBlock).partition === 'string'
  )
}

function isValidWebSiteGroup(item: unknown): item is Omit<WebSiteGroupBlock, 'parentGroupId'> {
  return (
    item !== null &&
    typeof item === 'object' &&
    typeof (item as WebSiteGroupBlock).id === 'string' &&
    typeof (item as WebSiteGroupBlock).name === 'string'
  )
}

function normalizeWebSiteGroupBlock(item: unknown): WebSiteGroupBlock {
  const raw = item as Record<string, unknown>
  return {
    id: String(raw.id),
    name: String(raw.name),
    parentGroupId: typeof raw.parentGroupId === 'string' ? raw.parentGroupId : null,
  }
}
