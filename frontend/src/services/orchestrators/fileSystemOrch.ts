import type { FileStat } from '../lego_blocks/typesBlock'
import { getVaultFS, type VaultEntry } from '../lego_blocks/fsBlock'

export interface FolderEntries {
  folders: string[]
  files: string[]
}

export type VaultPathKind = 'file' | 'folder' | 'missing'

function normalizeRelPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

function splitParent(path: string): { parent: string; name: string } {
  const normalized = normalizeRelPath(path)
  const idx = normalized.lastIndexOf('/')
  if (idx < 0) return { parent: '', name: normalized }
  return {
    parent: normalized.slice(0, idx),
    name: normalized.slice(idx + 1),
  }
}

function joinRel(parent: string, child: string): string {
  const base = normalizeRelPath(parent)
  return base ? `${base}/${child}` : child
}

export async function getFileContent(path: string): Promise<{ content: string; size_bytes: number }> {
  const fs = getVaultFS()
  const content = await fs.read(path)
  return { content, size_bytes: new Blob([content]).size }
}

export async function getFileStats(paths: string[]): Promise<FileStat[]> {
  const fs = getVaultFS()
  const results: FileStat[] = []
  for (const p of paths) {
    try {
      const content = await fs.read(p)
      results.push({
        path: p,
        lines: content.split('\n').length,
        words: content.split(/\s+/).filter(Boolean).length,
        size_bytes: new Blob([content]).size,
      })
    } catch {
      // Skip files that can't be read
    }
  }
  return results
}

export async function listFiles(limit = 1000): Promise<string[]> {
  const fs = getVaultFS()
  const entries = await fs.walkVault(['.md'])
  return entries
    .map(e => e.path)
    .filter(p => !p.includes('.excalidraw'))
    .sort()
    .slice(0, limit)
}

export async function listFolders(limit = 1000): Promise<string[]> {
  // Walk vault and collect unique directory paths
  const fs = getVaultFS()
  const entries = await fs.walkVault(['.md'])
  const folderSet = new Set<string>()
  for (const entry of entries) {
    const parts = entry.path.split('/')
    // Add all parent directories
    for (let i = 1; i < parts.length; i++) {
      folderSet.add(parts.slice(0, i).join('/'))
    }
  }
  return [...folderSet].sort().slice(0, limit)
}

export async function listPdfFiles(limit = 500): Promise<string[]> {
  const fs = getVaultFS()
  const entries = await fs.walkVault(['.pdf'])
  return entries
    .map(e => e.path)
    .sort()
    .slice(0, limit)
}

export async function listChildFolders(path: string): Promise<string[]> {
  const fs = getVaultFS()
  try {
    const { folders } = await fs.list(path)
    return folders.sort()
  } catch {
    return []
  }
}

export async function listFolderEntries(path: string): Promise<FolderEntries> {
  const fs = getVaultFS()
  try {
    const { folders, files } = await fs.list(path)
    return {
      folders: folders.filter(name => !name.startsWith('.')).sort(),
      files: files.filter(name => !name.startsWith('.')).sort(),
    }
  } catch {
    return { folders: [], files: [] }
  }
}

export async function listMarkdownEntries(): Promise<VaultEntry[]> {
  const fs = getVaultFS()
  return fs.walkVault(['.md'])
}

export async function listVaultEntries(extensions: string[]): Promise<VaultEntry[]> {
  const fs = getVaultFS()
  return fs.walkVault(extensions)
}

export async function getVaultPathKind(path: string): Promise<VaultPathKind> {
  const normalized = normalizeRelPath(path)
  if (!normalized) return 'folder'

  const fs = getVaultFS()
  try {
    const stat = await fs.stat(normalized)
    if (stat.isDirectory === true) return 'folder'
    if (stat.isDirectory === false) return 'file'
  } catch {
    // fall through to parent listing fallback
  }

  const { parent, name } = splitParent(normalized)
  try {
    const listed = await fs.list(parent)
    if (listed.folders.includes(name)) return 'folder'
    if (listed.files.includes(name)) return 'file'
    return 'missing'
  } catch {
    return 'missing'
  }
}

export async function listFolderDescendantPaths(folderPath: string): Promise<string[]> {
  const fs = getVaultFS()
  const root = normalizeRelPath(folderPath)
  if (!root) return []

  const output: string[] = []
  const queue: string[] = [root]
  const seen = new Set<string>()

  while (queue.length > 0) {
    const current = queue.shift()!
    if (seen.has(current)) continue
    seen.add(current)
    output.push(current)

    let listed: { folders: string[]; files: string[] }
    try {
      listed = await fs.list(current)
    } catch {
      // If listing fails this path is likely not a folder; keep it as-is.
      continue
    }

    for (const folderName of listed.folders) {
      queue.push(joinRel(current, folderName))
    }
    for (const fileName of listed.files) {
      output.push(joinRel(current, fileName))
    }
  }

  return output
}
