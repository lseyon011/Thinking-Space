export type RuledNotebookBlockKind =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'quote'
  | 'code'
  | 'hr'
  | 'blank'

export interface RuledNotebookBlock {
  source: string
  kind: RuledNotebookBlockKind
}

export interface RuledNotebookPageBlock {
  index: number
  source: string
  blocks: RuledNotebookBlock[]
}

function classifyBlockKind(source: string): RuledNotebookBlockKind {
  const trimmed = source.trim()
  if (!trimmed) return 'blank'
  if (/^#{1,6}\s+/.test(trimmed)) return 'heading'
  if (/^(?:[-*+]|\d+\.)\s+/m.test(trimmed)) return 'list'
  if (/^>\s?/m.test(trimmed)) return 'quote'
  if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) return 'code'
  if (/^[-*_]{3,}$/.test(trimmed)) return 'hr'
  return 'paragraph'
}

export function splitMarkdownIntoBlocksBlock(markdown: string): RuledNotebookBlock[] {
  const normalized = markdown.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const lines = normalized.split('\n')
  const blocks: RuledNotebookBlock[] = []
  let buffer: string[] = []
  let inFence = false
  let fenceMarker: string | null = null

  const flush = () => {
    if (buffer.length === 0) return
    const source = buffer.join('\n')
    if (source.trim()) {
      blocks.push({ source, kind: classifyBlockKind(source) })
    }
    buffer = []
  }

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()

    if (inFence) {
      buffer.push(rawLine)
      if (fenceMarker && trimmed.startsWith(fenceMarker)) {
        inFence = false
        fenceMarker = null
        flush()
      }
      continue
    }

    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      flush()
      inFence = true
      fenceMarker = trimmed.slice(0, 3)
      buffer.push(rawLine)
      continue
    }

    if (!trimmed) {
      flush()
      continue
    }

    // Headings are always their own block
    if (/^#{1,6}\s+/.test(trimmed)) {
      flush()
      buffer.push(rawLine)
      flush()
      continue
    }

    buffer.push(rawLine)
  }
  flush()

  return blocks
}

export function paginateBlocksByHeightBlock(
  blocks: RuledNotebookBlock[],
  heights: number[],
  pageBudgetPx: number,
): RuledNotebookPageBlock[] {
  if (blocks.length === 0 || pageBudgetPx <= 0) {
    return [{ index: 0, source: '', blocks: [] }]
  }

  const pages: RuledNotebookPageBlock[] = []
  let currentBlocks: RuledNotebookBlock[] = []
  let currentHeight = 0

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]
    const height = heights[i] ?? 0
    if (currentBlocks.length > 0 && currentHeight + height > pageBudgetPx) {
      pages.push({
        index: pages.length,
        source: currentBlocks.map((b) => b.source).join('\n\n'),
        blocks: currentBlocks,
      })
      currentBlocks = []
      currentHeight = 0
    }
    currentBlocks.push(block)
    currentHeight += height
  }

  if (currentBlocks.length > 0) {
    pages.push({
      index: pages.length,
      source: currentBlocks.map((b) => b.source).join('\n\n'),
      blocks: currentBlocks,
    })
  }

  if (pages.length === 0) {
    pages.push({ index: 0, source: '', blocks: [] })
  }

  return pages
}
