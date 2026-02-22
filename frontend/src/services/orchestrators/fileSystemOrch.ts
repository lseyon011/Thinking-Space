import type { FileStat } from '../lego_blocks/typesBlock'
import { getVaultFS, type VaultEntry } from '../lego_blocks/fsBlock'
import { getStoredVaultRoot } from './storageOrch'
import { isElectron } from './runtimeOrch'

export interface FolderEntries {
  folders: string[]
  files: string[]
}

export type VaultPathKind = 'file' | 'folder' | 'missing'

const DRAWING_TEMPLATE = `---
excalidraw-plugin: parsed
---

# Drawing

\`\`\`json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://github.com/anthropics/thinking-space",
  "elements": [],
  "appState": {},
  "files": {}
}
\`\`\`
`

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

function splitExtension(name: string): { stem: string; ext: string } {
  const idx = name.lastIndexOf('.')
  if (idx <= 0) return { stem: name, ext: '' }
  return { stem: name.slice(0, idx), ext: name.slice(idx) }
}

function appendNumberSuffix(name: string, n: number): string {
  if (n <= 1) return name
  const { stem, ext } = splitExtension(name)
  return `${stem} (${n})${ext}`
}

function getElectronVaultRoot(): string {
  const root = getStoredVaultRoot()?.trim()
  if (!root) throw new Error('Vault root is not configured')
  return root
}

function normalizeNewName(name: string): string {
  const next = name.trim()
  if (!next) throw new Error('Name cannot be empty')
  if (next === '.' || next === '..') throw new Error('Invalid name')
  if (next.includes('/') || next.includes('\\')) throw new Error('Name cannot include path separators')
  return next
}

function isAbsoluteRoot(root: string): boolean {
  return root.startsWith('/') || /^[A-Za-z]:[\\/]/.test(root) || root.startsWith('\\\\')
}

function decodeFileUriPath(raw: string): string | null {
  if (!raw.toLowerCase().startsWith('file://')) return null
  const noScheme = raw.replace(/^file:\/\//i, '')
  if (!noScheme) return null
  const decoded = decodeURIComponent(noScheme)
  // file:///Users/... -> /Users/...
  if (decoded.startsWith('/')) return decoded
  // file://C:/... -> C:/...
  if (/^[A-Za-z]:\//.test(decoded)) return decoded
  return decoded
}

function resolveAbsoluteVaultRoot(rawRoot: string | null): string | null {
  const raw = (rawRoot ?? '').trim()
  if (!raw) return null
  if (raw === 'browser-fs') return null
  if (raw.startsWith('cap-picker:')) {
    const candidate = raw.slice('cap-picker:'.length).trim()
    return isAbsoluteRoot(candidate) ? candidate : null
  }
  const fromFileUri = decodeFileUriPath(raw)
  if (fromFileUri && isAbsoluteRoot(fromFileUri)) return fromFileUri
  if (isAbsoluteRoot(raw)) return raw
  return null
}

async function postVaultApi<T = unknown>(path: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    let detail = ''
    try {
      const body = await response.json()
      detail = typeof body?.detail === 'string' ? body.detail : ''
    } catch {
      detail = ''
    }
    throw new Error(detail || `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

async function nextAvailableSiblingName(parentPath: string, preferredName: string): Promise<string> {
  const fs = getVaultFS()
  let folders: string[] = []
  let files: string[] = []
  try {
    const listed = await fs.list(parentPath)
    folders = listed.folders
    files = listed.files
  } catch {
    // If parent listing fails, fallback to preferred name and let filesystem call surface any errors.
    return preferredName
  }

  const taken = new Set([...folders, ...files].map(name => name.toLowerCase()))
  let n = 1
  while (true) {
    const candidate = appendNumberSuffix(preferredName, n)
    if (!taken.has(candidate.toLowerCase())) return candidate
    n += 1
  }
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

export function getRelativePathForClipboardOrch(path: string): string {
  return normalizeRelPath(path)
}

export function getAbsolutePathForClipboardOrch(path: string): string | null {
  const root = resolveAbsoluteVaultRoot(getStoredVaultRoot())
  if (!root) return null
  const normalizedRoot = root.replace(/[\\/]+$/g, '')
  const normalizedRel = normalizeRelPath(path)
  if (!normalizedRel) return normalizedRoot
  const separator = normalizedRoot.includes('\\') && !normalizedRoot.includes('/') ? '\\' : '/'
  const relWithSeparator = normalizedRel.replace(/[\\/]+/g, separator)
  return `${normalizedRoot}${separator}${relWithSeparator}`
}

export async function createFolderOrch(parentPath: string, preferredName = 'New Folder'): Promise<string> {
  const fs = getVaultFS()
  const cleanParent = normalizeRelPath(parentPath)
  const cleanPreferred = normalizeNewName(preferredName)
  const name = await nextAvailableSiblingName(cleanParent, cleanPreferred)
  const outputPath = joinRel(cleanParent, name)
  await fs.mkdir(outputPath)
  return outputPath
}

export async function createFileOrch(
  parentPath: string,
  preferredName = 'New File.md',
  content = '',
): Promise<string> {
  const fs = getVaultFS()
  const cleanParent = normalizeRelPath(parentPath)
  const cleanPreferred = normalizeNewName(preferredName)
  const name = await nextAvailableSiblingName(cleanParent, cleanPreferred)
  const outputPath = joinRel(cleanParent, name)
  await fs.create(outputPath, content)
  return outputPath
}

export async function createDrawingOrch(
  parentPath: string,
  preferredName = 'New Drawing.excalidraw.md',
): Promise<string> {
  return createFileOrch(parentPath, preferredName, DRAWING_TEMPLATE)
}

export async function renameVaultPathOrch(path: string, nextName: string): Promise<string> {
  const currentPath = normalizeRelPath(path)
  if (!currentPath) throw new Error('Cannot rename vault root')
  const { parent } = splitParent(currentPath)
  const targetPath = joinRel(parent, normalizeNewName(nextName))
  if (targetPath === currentPath) return currentPath

  const fs = getVaultFS()
  if (await fs.exists(targetPath)) {
    throw new Error(`A file or folder already exists at "${targetPath}"`)
  }

  if (isElectron()) {
    const api = window.electronAPI
    if (!api?.rename) throw new Error('Rename is unavailable in this desktop build')
    await api.rename(getElectronVaultRoot(), currentPath, targetPath)
    return targetPath
  }

  await postVaultApi('/api/tools/vault/rename', { from_path: currentPath, to_path: targetPath })
  return targetPath
}

export async function deleteVaultPathOrch(path: string): Promise<void> {
  const targetPath = normalizeRelPath(path)
  if (!targetPath) throw new Error('Cannot delete vault root')

  if (isElectron()) {
    const api = window.electronAPI
    if (!api?.deletePath) throw new Error('Delete is unavailable in this desktop build')
    await api.deletePath(getElectronVaultRoot(), targetPath, true)
    return
  }

  await postVaultApi('/api/tools/vault/delete', { path: targetPath, recursive: true })
}

export async function copyVaultPathOrch(sourcePath: string, targetPath: string): Promise<void> {
  const fromPath = normalizeRelPath(sourcePath)
  const toPath = normalizeRelPath(targetPath)
  if (!fromPath || !toPath) throw new Error('Invalid copy path')

  if (isElectron()) {
    const api = window.electronAPI
    if (!api?.copyPath) throw new Error('Copy is unavailable in this desktop build')
    await api.copyPath(getElectronVaultRoot(), fromPath, toPath)
    return
  }

  await postVaultApi('/api/tools/vault/copy', { from_path: fromPath, to_path: toPath })
}

export async function duplicateFileOrch(filePath: string): Promise<string> {
  const source = normalizeRelPath(filePath)
  const { parent, name } = splitParent(source)
  if (!name) throw new Error('Invalid file path')
  const { stem, ext } = splitExtension(name)
  const copyBase = `${stem} copy${ext}`
  const nextName = await nextAvailableSiblingName(parent, copyBase)
  const targetPath = joinRel(parent, nextName)
  await copyVaultPathOrch(source, targetPath)
  return targetPath
}

export async function revealVaultPathOrch(path: string): Promise<void> {
  if (!isElectron()) throw new Error('Open in Finder is available only on desktop Electron')
  const api = window.electronAPI
  if (!api?.revealPath) throw new Error('Open in Finder is unavailable in this desktop build')
  await api.revealPath(getElectronVaultRoot(), normalizeRelPath(path))
}

export function buildThinkingSpaceFileUrlOrch(path: string): string {
  const normalizedPath = normalizeRelPath(path)
  const encodedPath = encodeURIComponent(normalizedPath)
  const route = `/thinking-space?file=${encodedPath}`
  if (window.location.hash.startsWith('#/')) {
    const base = window.location.href.split('#')[0]
    return `${base}#${route}`
  }
  const basePath = '/thinking-space'
  return `${window.location.origin}${basePath}?file=${encodedPath}`
}

export function openFileInNewTabOrch(path: string): void {
  const normalizedPath = normalizeRelPath(path)
  const route = `/thinking-space?file=${encodeURIComponent(normalizedPath)}`
  window.dispatchEvent(new CustomEvent<string>('ltm:workspace-open-route-in-new-tab', { detail: route }))
}

export function openFileInNewWindowOrch(path: string): void {
  const normalizedPath = normalizeRelPath(path)
  const route = `/thinking-space?file=${encodeURIComponent(normalizedPath)}`

  if (isElectron()) {
    const api = window.electronAPI
    if (!api?.newWindow) throw new Error('Open in New Window is unavailable in this desktop build')
    void api.newWindow(route)
    return
  }

  const url = buildThinkingSpaceFileUrlOrch(path)
  window.open(url, '_blank', 'noopener,noreferrer,popup=yes,width=1280,height=900')
}
