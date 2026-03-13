export interface RssFeedConfigBlock {
  id: string
  url: string
  title: string
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
