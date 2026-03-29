import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'

/**
 * Update or insert `sort_order` in a markdown file's YAML frontmatter.
 * Operates on raw text — does not require the full organizer schema.
 */
export function updateSortOrderInContentBlock(content: string, sortOrder: number): string {
  const trimmed = content.trimStart()

  if (!trimmed.startsWith('---')) {
    return `---\nsort_order: ${sortOrder}\n---\n${content}`
  }

  const firstNewline = trimmed.indexOf('\n')
  if (firstNewline === -1) return content

  const rest = trimmed.slice(firstNewline + 1)
  const closeMatch = rest.match(/^---\s*$/m)
  if (!closeMatch || closeMatch.index === undefined) return content

  const yamlPart = rest.slice(0, closeMatch.index)
  const afterClose = rest.slice(closeMatch.index)

  if (/^sort_order\s*:/m.test(yamlPart)) {
    const updated = yamlPart.replace(/^sort_order\s*:.*$/m, `sort_order: ${sortOrder}`)
    return `---\n${updated}${afterClose}`
  }

  return `---\n${yamlPart}sort_order: ${sortOrder}\n${afterClose}`
}

/**
 * Write sort_order to a single markdown file.
 */
export async function writeSortOrderToFileBlock(path: string, sortOrder: number): Promise<void> {
  const fs = getVaultFS()
  const content = await fs.read(path)
  const updated = updateSortOrderInContentBlock(content, sortOrder)
  if (updated !== content) {
    await fs.write(path, updated)
  }
}

/**
 * Write sequential sort_order values to all markdown files in a flat ordered list.
 * Non-markdown files are skipped (they can't store frontmatter) but still occupy positions.
 */
export async function writeSortOrdersBlock(
  orderedPaths: string[],
): Promise<void> {
  const writes: Promise<void>[] = []
  for (let i = 0; i < orderedPaths.length; i++) {
    const path = orderedPaths[i]
    if (/\.md$/i.test(path)) {
      writes.push(writeSortOrderToFileBlock(path, i + 1))
    }
  }
  await Promise.all(writes)
}
