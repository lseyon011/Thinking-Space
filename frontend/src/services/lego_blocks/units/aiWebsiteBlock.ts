export interface AiWebsiteBlock {
  id: string        // stable unique id, e.g. "ai-site-abc123"
  name: string      // display name, e.g. "Grok - Work Account"
  url: string       // e.g. "https://grok.com"
  partition: string // Electron session partition, set once at creation — never changes
}

export function generateAiWebsiteIdBlock(): string {
  return `ai-site-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function buildAiWebsitePartitionBlock(id: string): string {
  return `persist:${id}`
}

export function normalizeAiWebsitesBlock(raw: unknown): AiWebsiteBlock[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isValidAiWebsite)
}

function isValidAiWebsite(item: unknown): item is AiWebsiteBlock {
  return (
    item !== null &&
    typeof item === 'object' &&
    typeof (item as AiWebsiteBlock).id === 'string' &&
    typeof (item as AiWebsiteBlock).name === 'string' &&
    typeof (item as AiWebsiteBlock).url === 'string' &&
    typeof (item as AiWebsiteBlock).partition === 'string'
  )
}
