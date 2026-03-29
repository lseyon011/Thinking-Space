import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'

const SIDECAR_FILENAME = '.notebook.yaml'

/**
 * Build the sidecar path for a given folder.
 */
function sidecarPath(folderPath: string): string {
  return folderPath ? `${folderPath}/${SIDECAR_FILENAME}` : SIDECAR_FILENAME
}

/**
 * Write a .notebook.yaml sidecar that persists the full file ordering
 * (including non-markdown files that can't store sort_order in frontmatter).
 *
 * Format:
 * ```yaml
 * order:
 *   - file1.png
 *   - notes.md
 *   - sketch.excalidraw
 * ```
 */
export async function writeNotebookSidecarBlock(
  folderPath: string,
  orderedPaths: string[],
): Promise<void> {
  const fs = getVaultFS()
  const prefix = folderPath ? `${folderPath}/` : ''

  // Extract just filenames relative to the folder
  const filenames = orderedPaths.map((p) =>
    p.startsWith(prefix) ? p.slice(prefix.length) : p,
  )

  const lines = ['order:']
  for (const name of filenames) {
    lines.push(`  - ${name}`)
  }
  lines.push('') // trailing newline

  await fs.write(sidecarPath(folderPath), lines.join('\n'))
}

/**
 * Read the .notebook.yaml sidecar and return the ordered filename list.
 * Returns null if the sidecar doesn't exist or is unparseable.
 */
export async function readNotebookSidecarBlock(
  folderPath: string,
): Promise<string[] | null> {
  const fs = getVaultFS()
  const path = sidecarPath(folderPath)

  try {
    const exists = await fs.exists(path)
    if (!exists) return null

    const content = await fs.read(path)
    // Simple YAML parse: extract lines after "order:" that start with "  - "
    const lines = content.split('\n')
    const orderIdx = lines.findIndex((l) => l.trim() === 'order:')
    if (orderIdx === -1) return null

    const filenames: string[] = []
    for (let i = orderIdx + 1; i < lines.length; i++) {
      const match = lines[i].match(/^\s+-\s+(.+)$/)
      if (!match) break
      filenames.push(match[1].trim())
    }

    return filenames.length > 0 ? filenames : null
  } catch {
    return null
  }
}
