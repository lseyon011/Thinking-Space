/**
 * Wikilink ↔ Excalidraw interop utilities.
 *
 * Handles extraction of [[wikilink]] targets from Excalidraw text elements
 * and generation of the Obsidian-compatible `## Text Elements` section.
 */

const WIKILINK_RE = /\[\[([^\]]+)\]\]/

/**
 * Extract the first wikilink target from element text.
 * Strips leading decorators like 📍.
 * Returns the raw target (before any `|alias`) or null if no wikilink found.
 */
export function extractFirstWikilinkTargetBlock(text: string): string | null {
  if (!text) return null
  const match = WIKILINK_RE.exec(text)
  if (!match) return null
  const inner = match[1]
  // If there's an alias separator, take only the path portion
  const pipeIndex = inner.indexOf('|')
  return pipeIndex >= 0 ? inner.slice(0, pipeIndex) : inner
}

/**
 * Build the Obsidian `## Text Elements` section content from scene elements.
 *
 * Each text element becomes a line: `{originalText} ^{elementId}`
 * This matches Obsidian Excalidraw plugin's parsed format.
 */
export function buildTextElementsSectionBlock(elements: unknown[]): string {
  const lines: string[] = []

  for (const el of elements) {
    if (!el || typeof el !== 'object') continue
    const record = el as Record<string, unknown>
    if (record.type !== 'text') continue

    const text = (typeof record.originalText === 'string' ? record.originalText : null)
      ?? (typeof record.text === 'string' ? record.text : null)
    const id = typeof record.id === 'string' ? record.id : null
    if (!text || !id) continue

    lines.push(`${text} ^${id}`)
    lines.push('')
  }

  return lines.length > 0 ? lines.join('\n') : ''
}
