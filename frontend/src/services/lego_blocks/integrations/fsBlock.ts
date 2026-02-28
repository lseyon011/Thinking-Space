// Filesystem abstraction for vault operations.
// API aligned with Obsidian's Vault / DataAdapter where possible.
// Platform-specific implementations let the same scanner code run
// on web (via backend), Capacitor (mobile), or Electron (desktop).

import { Capacitor } from '@capacitor/core'
import { EXCLUDED_DIRS } from '@/services/lego_blocks/units/vaultConstantsBlock'
import { getStoredVaultRoot, setStoredVaultRoot } from '@/services/lego_blocks/units/storageKeyBlock'
import { notifyFileChanged } from '@/services/lego_blocks/units/crossWindowSyncBlock'
import {
  base64ToBytesBlock,
  bytesToBase64Block,
  utf8ToBytesBlock,
  bytesToUtf8Block,
} from '@/services/lego_blocks/units/byteEncodingBlock'

// ── Types ──

export interface ListedFiles {
  files: string[]    // filenames (not full paths)
  folders: string[]  // folder names (not full paths)
}

export interface VaultEntry {
  path: string       // relative to vault root
  size: number
  mtime: number      // unix timestamp (seconds)
  ctime: number      // unix timestamp (seconds), creation time
}

export interface VaultStat {
  size: number
  mtime: number
  ctime?: number
  isDirectory?: boolean
}

// ── Electron API type declaration ──

interface ElectronAPI {
  isElectron: true
  capabilitiesList(): Promise<{
    ok: boolean
    capabilities?: Array<{ name: string; description: string; readOnly: boolean }>
  }>
  capabilitiesInvoke(payload: {
    vaultRoot: string
    request: {
      capability: string
      input: Record<string, unknown>
      actor?: { kind: 'human' | 'agent' | 'system'; id?: string }
      requestId?: string
      dryRun?: boolean
    }
    apiBaseUrl?: string
  }): Promise<unknown>
  extensionRuntimeInvoke(payload: {
    vaultRoot: string
    extensionId: string
    extensionRegistryKey: string
    extensionPermissions: string[]
    runtimeEntry: string
    runtimeHandler: string
    actionId: string
    input: Record<string, unknown>
    context?: Record<string, unknown>
    actor?: { kind: 'human' | 'agent' | 'system'; id?: string }
    requestId?: string
    dryRun?: boolean
  }): Promise<unknown>
  selectVaultFolder(): Promise<string | null>
  newWindow?(route?: string): Promise<void>
  read(vaultRoot: string, relPath: string): Promise<string>
  write(vaultRoot: string, relPath: string, data: string): Promise<void>
  readBytesBase64?(vaultRoot: string, relPath: string): Promise<string>
  writeBytesBase64?(vaultRoot: string, relPath: string, base64Data: string): Promise<void>
  list(vaultRoot: string, relPath: string): Promise<ListedFiles>
  walkVault(vaultRoot: string, extensions: string[]): Promise<VaultEntry[]>
  stat(vaultRoot: string, relPath: string): Promise<VaultStat>
  exists(vaultRoot: string, relPath: string): Promise<boolean>
  mkdir(vaultRoot: string, relPath: string): Promise<void>
  rename?(vaultRoot: string, fromRelPath: string, toRelPath: string): Promise<void>
  deletePath?(vaultRoot: string, relPath: string, recursive?: boolean): Promise<void>
  copyPath?(vaultRoot: string, fromRelPath: string, toRelPath: string): Promise<void>
  revealPath?(vaultRoot: string, relPath: string): Promise<void>
  git(vaultRoot: string, args: string[]): Promise<string>
  excalidrawPluginStatus(vaultRoot: string): Promise<import('@/services/lego_blocks/units/typesBlock').ExcalidrawPluginStatus>
  installLatestExcalidrawPlugin(vaultRoot: string): Promise<import('@/services/lego_blocks/units/typesBlock').ExcalidrawPluginStatus>
  hierarchyDbStatus(vaultRoot: string): Promise<import('@/services/lego_blocks/units/typesBlock').HierarchyDbStatus>
  initHierarchyDb(vaultRoot: string): Promise<import('@/services/lego_blocks/units/typesBlock').HierarchyDbStatus>
  hierarchyListNodes(
    vaultRoot: string,
    params: { parent_id: string | null; type?: import('@/services/lego_blocks/units/typesBlock').HierarchyNodeType | null },
  ): Promise<import('@/services/lego_blocks/units/typesBlock').HierarchyNode[]>
  hierarchyGetNode(vaultRoot: string, nodeId: string): Promise<import('@/services/lego_blocks/units/typesBlock').HierarchyNode>
  hierarchyCreateNode(
    vaultRoot: string,
    params: { type: import('@/services/lego_blocks/units/typesBlock').HierarchyNodeType; node_kind?: string | null; title: string; parent_id: string | null; slug?: string | null; sort_order: number },
  ): Promise<import('@/services/lego_blocks/units/typesBlock').HierarchyNode>
  hierarchyUpdateNode(
    vaultRoot: string,
    params: { node_id: string; type?: import('@/services/lego_blocks/units/typesBlock').HierarchyNodeType | null; node_kind?: string | null; title?: string | null; slug?: string | null; sort_order?: number | null },
  ): Promise<import('@/services/lego_blocks/units/typesBlock').HierarchyNode>
  hierarchyMoveNode(
    vaultRoot: string,
    params: { node_id: string; new_parent_id: string | null; sort_order?: number | null },
  ): Promise<import('@/services/lego_blocks/units/typesBlock').HierarchyNode>
  hierarchyDeleteNode(vaultRoot: string, nodeId: string): Promise<{ success: boolean }>
  hierarchyUpsertThought(
    vaultRoot: string,
    params: { file_path: string; title?: string | null },
  ): Promise<import('@/services/lego_blocks/units/typesBlock').HierarchyThought>
  hierarchyListThoughts(
    vaultRoot: string,
    params: { unlinked_only: boolean; limit: number },
  ): Promise<import('@/services/lego_blocks/units/typesBlock').HierarchyThought[]>
  hierarchyListThoughtLinks(
    vaultRoot: string,
    params: { thought_id?: string | null; node_id?: string | null },
  ): Promise<import('@/services/lego_blocks/units/typesBlock').HierarchyThoughtLink[]>
  hierarchyCreateThoughtLink(
    vaultRoot: string,
    params: { thought_id: string; node_id: string; link_kind?: string | null },
  ): Promise<import('@/services/lego_blocks/units/typesBlock').HierarchyThoughtLink>
  hierarchyDeleteThoughtLink(vaultRoot: string, linkId: string): Promise<{ success: boolean }>
  hierarchyListEdges(
    vaultRoot: string,
    params: { from_node_id?: string | null; to_node_id?: string | null },
  ): Promise<import('@/services/lego_blocks/units/typesBlock').HierarchyEdge[]>
  hierarchyCreateEdge(
    vaultRoot: string,
    params: { from_node_id: string; to_node_id: string; edge_kind?: string | null },
  ): Promise<import('@/services/lego_blocks/units/typesBlock').HierarchyEdge>
  hierarchyDeleteEdge(vaultRoot: string, edgeId: string): Promise<{ success: boolean }>
  hierarchyResolvePath(
    vaultRoot: string,
    requestedPath: string,
  ): Promise<import('@/services/lego_blocks/units/typesBlock').HierarchyPathResolution>

  // AI credential management
  aiGetClaudeCredentials(): Promise<{ accessToken: string; refreshToken: string; expiresAt: string } | null>
  aiGetCodexCredentials(): Promise<{ accessToken: string; refreshToken: string; expiresAt: string; accountId?: string } | null>
  aiGetAzureCredentials(): Promise<{ accessToken: string; expiresOn: string } | null>
  aiRefreshClaudeToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: string }>
  aiRefreshCodexToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: string; accountId?: string }>
  aiChatCodex(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    accessToken: string,
    accountId?: string,
    model?: string,
  ): Promise<{ text: string; model: string; inputTokens?: number; outputTokens?: number; totalTokens?: number }>
  f9WebullGet?(payload: {
    url: string
    headers: Record<string, string>
    method?: 'GET' | 'POST'
    body?: string
  }): Promise<{ status: number; body: string }>
  f9WebullAccountList?(payload: {
    url: string
    headers: Record<string, string>
    method?: 'GET' | 'POST'
    body?: string
  }): Promise<{ status: number; body: string }>
  f9WebullSignedRequest?(payload: {
    method: 'GET' | 'POST'
    url: string
    appKey: string
    appSecret: string
    version?: string
    accessToken?: string
    body?: string
  }): Promise<{ status: number; body: string }>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

// ── Interface ──

export interface VaultFS {
  read(path: string): Promise<string>
  write(path: string, data: string): Promise<void>
  readBytes(path: string): Promise<Uint8Array>
  writeBytes(path: string, data: Uint8Array): Promise<void>
  create(path: string, data: string): Promise<void>
  list(path: string): Promise<ListedFiles>
  walkVault(extensions?: string[]): Promise<VaultEntry[]>
  stat(path: string): Promise<VaultStat>
  exists(path: string): Promise<boolean>
  mkdir(path: string): Promise<void>
  process(path: string, fn: (data: string) => string): Promise<void>
}

// ── WebVaultFS (calls Python backend) ──

class WebVaultFS implements VaultFS {
  async read(path: string): Promise<string> {
    const res = await fetch(`/api/tools/file-content?path=${encodeURIComponent(path)}`)
    if (!res.ok) {
      let detail = ''
      try {
        const payload = await res.json()
        if (payload?.detail) detail = String(payload.detail)
      } catch {
        // ignore JSON parse errors; fallback to status text
      }
      const suffix = detail || res.statusText || `HTTP ${res.status}`
      throw new Error(`Failed to read file: ${path} (${suffix})`)
    }
    const data = await res.json()
    return data.content
  }

  async write(path: string, data: string): Promise<void> {
    const res = await fetch('/api/tools/vault/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content: data }),
    })
    if (!res.ok) throw new Error(`Failed to write file: ${path}`)
    notifyFileChanged(path)
  }

  async readBytes(path: string): Promise<Uint8Array> {
    const res = await fetch(`/api/tools/vault/read-bytes?path=${encodeURIComponent(path)}`)
    if (!res.ok) {
      let detail = ''
      try {
        const payload = await res.json()
        if (payload?.detail) detail = String(payload.detail)
      } catch {
        // ignore JSON parse errors
      }
      const suffix = detail || res.statusText || `HTTP ${res.status}`
      throw new Error(`Failed to read bytes: ${path} (${suffix})`)
    }
    const payload = await res.json() as { data_base64?: string }
    return base64ToBytesBlock(payload.data_base64 || '')
  }

  async writeBytes(path: string, data: Uint8Array): Promise<void> {
    const res = await fetch('/api/tools/vault/write-bytes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path,
        data_base64: bytesToBase64Block(data),
      }),
    })
    if (!res.ok) throw new Error(`Failed to write bytes: ${path}`)
    notifyFileChanged(path)
  }

  async create(path: string, data: string): Promise<void> {
    if (await this.exists(path)) throw new Error(`File already exists: ${path}`)
    await this.write(path, data)
  }

  async list(path: string): Promise<ListedFiles> {
    const res = await fetch(`/api/tools/vault/readdir?path=${encodeURIComponent(path)}`)
    if (!res.ok) throw new Error(`Failed to list directory: ${path}`)
    const json = await res.json()
    // Backend returns { entries: [{ name, isDirectory }] } — transform to ListedFiles
    const files: string[] = []
    const folders: string[] = []
    for (const e of json.entries) {
      if (e.isDirectory) folders.push(e.name)
      else files.push(e.name)
    }
    return { files, folders }
  }

  async walkVault(extensions: string[] = ['.md']): Promise<VaultEntry[]> {
    const ext = extensions.join(',')
    const res = await fetch(`/api/tools/vault/walk?extensions=${encodeURIComponent(ext)}`)
    if (!res.ok) throw new Error('Failed to walk vault')
    const data = await res.json()
    // Backend returns { birthtime } — map to { ctime }
    return data.files.map((f: any) => ({
      path: f.path,
      size: f.size,
      mtime: f.mtime,
      ctime: f.birthtime ?? f.ctime ?? f.mtime,
    }))
  }

  async stat(path: string): Promise<VaultStat> {
    const res = await fetch(`/api/tools/vault/stat?path=${encodeURIComponent(path)}`)
    if (!res.ok) throw new Error(`Failed to stat: ${path}`)
    const s = await res.json()
    return {
      size: s.size,
      mtime: s.mtime,
      ctime: s.birthtime ?? s.ctime,
      isDirectory: Boolean(s.isDirectory),
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.stat(path)
      return true
    } catch {
      return false
    }
  }

  async mkdir(path: string): Promise<void> {
    const res = await fetch('/api/tools/vault/mkdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    })
    if (!res.ok) throw new Error(`Failed to mkdir: ${path}`)
  }

  async process(path: string, fn: (data: string) => string): Promise<void> {
    const content = await this.read(path)
    await this.write(path, fn(content))
  }
}

// ── ElectronVaultFS (Node.js filesystem via IPC) ──

class ElectronVaultFS implements VaultFS {
  private vaultRoot: string

  constructor(vaultRoot: string) {
    this.vaultRoot = vaultRoot
  }

  private get api(): ElectronAPI {
    return window.electronAPI!
  }

  async read(path: string): Promise<string> {
    return this.api.read(this.vaultRoot, path)
  }

  async write(path: string, data: string): Promise<void> {
    await this.api.write(this.vaultRoot, path, data)
    notifyFileChanged(path)
  }

  async readBytes(path: string): Promise<Uint8Array> {
    if (this.api.readBytesBase64) {
      const base64 = await this.api.readBytesBase64(this.vaultRoot, path)
      return base64ToBytesBlock(base64)
    }
    const text = await this.read(path)
    return utf8ToBytesBlock(text)
  }

  async writeBytes(path: string, data: Uint8Array): Promise<void> {
    if (this.api.writeBytesBase64) {
      await this.api.writeBytesBase64(this.vaultRoot, path, bytesToBase64Block(data))
      notifyFileChanged(path)
      return
    }
    await this.write(path, bytesToUtf8Block(data))
  }

  async create(path: string, data: string): Promise<void> {
    if (await this.exists(path)) throw new Error(`File already exists: ${path}`)
    await this.write(path, data)
  }

  async list(path: string): Promise<ListedFiles> {
    return this.api.list(this.vaultRoot, path || '.')
  }

  async walkVault(extensions: string[] = ['.md']): Promise<VaultEntry[]> {
    return this.api.walkVault(this.vaultRoot, extensions)
  }

  async stat(path: string): Promise<VaultStat> {
    return this.api.stat(this.vaultRoot, path)
  }

  async exists(path: string): Promise<boolean> {
    return this.api.exists(this.vaultRoot, path)
  }

  async mkdir(path: string): Promise<void> {
    return this.api.mkdir(this.vaultRoot, path)
  }

  async process(path: string, fn: (data: string) => string): Promise<void> {
    const content = await this.read(path)
    await this.write(path, fn(content))
  }
}

// ── CapacitorVaultFS (reads local device filesystem) ──
// Two modes:
//   1. Relative mode: vaultRoot is relative (e.g. "LTM-Vault"), uses Directory.Documents
//   2. Absolute mode: vaultRoot starts with "/", converted to file:// URI, no directory param
// The absolute mode is used when the user picks a folder via UIDocumentPickerViewController
// (including iCloud Drive folders).

class CapacitorVaultFS implements VaultFS {
  private vaultRoot: string
  private isAbsolute: boolean

  constructor(vaultRoot: string) {
    this.isAbsolute = vaultRoot.startsWith('/')
    this.vaultRoot = vaultRoot
  }

  private resolve(path: string): string {
    const base = path ? `${this.vaultRoot}/${path}` : this.vaultRoot
    // Capacitor Filesystem needs file:// URIs for absolute paths.
    // Don't pre-encode — the native Filesystem plugin handles encoding internally.
    if (this.isAbsolute) return `file://${base}`
    return base
  }

  private async fsOpts(path: string) {
    if (this.isAbsolute) {
      return { path: this.resolve(path) }
    }
    const { Directory } = await import('@capacitor/filesystem')
    return { path: this.resolve(path), directory: Directory.Documents }
  }

  async read(path: string): Promise<string> {
    const { Filesystem, Encoding } = await import('@capacitor/filesystem')
    const opts = await this.fsOpts(path)
    const result = await Filesystem.readFile({ ...opts, encoding: Encoding.UTF8 })
    return result.data as string
  }

  async write(path: string, data: string): Promise<void> {
    const { Filesystem, Encoding } = await import('@capacitor/filesystem')
    const opts = await this.fsOpts(path)
    await Filesystem.writeFile({ ...opts, data, encoding: Encoding.UTF8, recursive: true })
    notifyFileChanged(path)
  }

  async readBytes(path: string): Promise<Uint8Array> {
    const { Filesystem } = await import('@capacitor/filesystem')
    const opts = await this.fsOpts(path)
    const result = await Filesystem.readFile(opts)
    if (typeof result.data === 'string') {
      return base64ToBytesBlock(result.data)
    }
    const arrayBuffer = await (result.data as Blob).arrayBuffer()
    return new Uint8Array(arrayBuffer)
  }

  async writeBytes(path: string, data: Uint8Array): Promise<void> {
    const { Filesystem } = await import('@capacitor/filesystem')
    const opts = await this.fsOpts(path)
    await Filesystem.writeFile({
      ...opts,
      data: bytesToBase64Block(data),
      recursive: true,
    })
    notifyFileChanged(path)
  }

  async create(path: string, data: string): Promise<void> {
    if (await this.exists(path)) throw new Error(`File already exists: ${path}`)
    await this.write(path, data)
  }

  async list(path: string): Promise<ListedFiles> {
    const { Filesystem } = await import('@capacitor/filesystem')
    const opts = await this.fsOpts(path)
    const result = await Filesystem.readdir(opts)
    const files: string[] = []
    const folders: string[] = []
    for (const f of result.files) {
      if (f.name.startsWith('.')) continue
      if (f.type === 'directory') folders.push(f.name)
      else files.push(f.name)
    }
    return { files, folders }
  }

  async walkVault(extensions: string[] = ['.md']): Promise<VaultEntry[]> {
    const extSet = new Set(extensions)
    const entries: VaultEntry[] = []

    // walkByUri: use native-provided URIs from readdir results to avoid
    // encoding issues with special characters (?, #, %) in filenames.
    const walk = async (dirPath: string, dirUri: string | null, relPrefix: string) => {
      const { Filesystem } = await import('@capacitor/filesystem')
      // Use the native URI when available (properly encoded); fall back to constructing our own
      const opts = dirUri
        ? { path: dirUri }
        : this.isAbsolute
          ? { path: `file://${dirPath}` }
          : { path: dirPath, directory: (await import('@capacitor/filesystem')).Directory.Documents }
      const result = await Filesystem.readdir(opts)
      for (const item of result.files) {
        if (item.name.startsWith('.') || EXCLUDED_DIRS.has(item.name)) continue
        const relPath = relPrefix ? `${relPrefix}/${item.name}` : item.name
        // readdir returns a `uri` for each item that's already properly encoded
        const itemUri: string | undefined = (item as any).uri

        if (item.type === 'directory') {
          const childDir = `${dirPath}/${item.name}`
          await walk(childDir, itemUri ?? null, relPath)
        } else {
          const ext = '.' + item.name.split('.').pop()?.toLowerCase()
          if (!extSet.has(ext || '')) continue
          // Use the native URI for stat to avoid encoding issues
          const stOpts = itemUri
            ? { path: itemUri }
            : this.isAbsolute
              ? { path: `file://${dirPath}/${item.name}` }
              : { path: `${dirPath}/${item.name}`, directory: (await import('@capacitor/filesystem')).Directory.Documents }
          try {
            const st = await Filesystem.stat(stOpts)
            entries.push({
              path: relPath,
              size: st.size,
              mtime: (st.mtime || 0) / 1000,
              ctime: (st.ctime || st.mtime || 0) / 1000,
            })
          } catch (err) {
            // Skip files that can't be stat'd (e.g. iCloud placeholders not yet downloaded)
            console.warn(`[CapacitorVaultFS] Skipping file that failed stat: ${relPath}`, err)
          }
        }
      }
    }

    await walk(this.vaultRoot, null, '')
    return entries
  }

  async stat(path: string): Promise<VaultStat> {
    const { Filesystem } = await import('@capacitor/filesystem')
    const opts = await this.fsOpts(path)
    const st = await Filesystem.stat(opts)
    return {
      size: st.size,
      mtime: (st.mtime || 0) / 1000,
      ctime: (st.ctime || st.mtime || 0) / 1000,
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.stat(path)
      return true
    } catch {
      return false
    }
  }

  async mkdir(path: string): Promise<void> {
    const { Filesystem } = await import('@capacitor/filesystem')
    const opts = await this.fsOpts(path)
    await Filesystem.mkdir({ ...opts, recursive: true })
  }

  async process(path: string, fn: (data: string) => string): Promise<void> {
    const content = await this.read(path)
    await this.write(path, fn(content))
  }
}

// ── BrowserVaultFS (File System Access API — serverless web) ──

// Store the directory handle in IndexedDB for persistence across sessions.
const FS_HANDLE_DB = 'ltm-fs-handles'
const FS_HANDLE_STORE = 'handles'
const FS_HANDLE_KEY = 'vault-root'

async function persistDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FS_HANDLE_DB, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(FS_HANDLE_STORE)
    }
    req.onsuccess = () => {
      const tx = req.result.transaction(FS_HANDLE_STORE, 'readwrite')
      tx.objectStore(FS_HANDLE_STORE).put(handle, FS_HANDLE_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function getPersistedDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FS_HANDLE_DB, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(FS_HANDLE_STORE)
    }
    req.onsuccess = () => {
      const tx = req.result.transaction(FS_HANDLE_STORE, 'readonly')
      const get = tx.objectStore(FS_HANDLE_STORE).get(FS_HANDLE_KEY)
      get.onsuccess = () => resolve(get.result ?? null)
      get.onerror = () => reject(get.error)
    }
    req.onerror = () => reject(req.error)
  })
}

export class BrowserVaultFS implements VaultFS {
  private root: FileSystemDirectoryHandle

  constructor(root: FileSystemDirectoryHandle) {
    this.root = root
  }

  private async resolveFile(filePath: string, create = false): Promise<FileSystemFileHandle> {
    const parts = filePath.split('/').filter(Boolean)
    const fileName = parts.pop()!
    let dir = this.root
    for (const segment of parts) {
      dir = await dir.getDirectoryHandle(segment, { create })
    }
    return dir.getFileHandle(fileName, { create })
  }

  private async resolveDir(dirPath: string, create = false): Promise<FileSystemDirectoryHandle> {
    const parts = dirPath.split('/').filter(Boolean)
    let dir = this.root
    for (const segment of parts) {
      dir = await dir.getDirectoryHandle(segment, { create })
    }
    return dir
  }

  async read(filePath: string): Promise<string> {
    const handle = await this.resolveFile(filePath)
    const file = await handle.getFile()
    return file.text()
  }

  async write(filePath: string, data: string): Promise<void> {
    const handle = await this.resolveFile(filePath, true)
    const writable = await handle.createWritable()
    await writable.write(data)
    await writable.close()
    notifyFileChanged(filePath)
  }

  async readBytes(filePath: string): Promise<Uint8Array> {
    const handle = await this.resolveFile(filePath)
    const file = await handle.getFile()
    const buffer = await file.arrayBuffer()
    return new Uint8Array(buffer)
  }

  async writeBytes(filePath: string, data: Uint8Array): Promise<void> {
    const handle = await this.resolveFile(filePath, true)
    const writable = await handle.createWritable()
    const copy = new Uint8Array(data.byteLength)
    copy.set(data)
    await writable.write(copy)
    await writable.close()
    notifyFileChanged(filePath)
  }

  async create(filePath: string, data: string): Promise<void> {
    if (await this.exists(filePath)) throw new Error(`File already exists: ${filePath}`)
    await this.write(filePath, data)
  }

  async list(dirPath: string): Promise<ListedFiles> {
    const dir = await this.resolveDir(dirPath)
    const files: string[] = []
    const folders: string[] = []
    for await (const [name, handle] of (dir as any).entries()) {
      if (name.startsWith('.')) continue
      if (handle.kind === 'directory') folders.push(name)
      else files.push(name)
    }
    return { files, folders }
  }

  async walkVault(extensions: string[] = ['.md']): Promise<VaultEntry[]> {
    const extSet = new Set(extensions)
    const entries: VaultEntry[] = []

    const walk = async (dir: FileSystemDirectoryHandle, prefix: string) => {
      for await (const [name, handle] of (dir as any).entries()) {
        if (name.startsWith('.') || EXCLUDED_DIRS.has(name)) continue
        const relPath = prefix ? `${prefix}/${name}` : name

        if (handle.kind === 'directory') {
          await walk(handle as FileSystemDirectoryHandle, relPath)
        } else {
          const ext = '.' + name.split('.').pop()?.toLowerCase()
          if (!extSet.has(ext || '')) continue
          const file = await (handle as FileSystemFileHandle).getFile()
          entries.push({
            path: relPath,
            size: file.size,
            mtime: file.lastModified / 1000,
            ctime: file.lastModified / 1000, // File System Access API doesn't expose ctime
          })
        }
      }
    }

    await walk(this.root, '')
    return entries
  }

  async stat(filePath: string): Promise<VaultStat> {
    // Try as file first, then as directory
    try {
      const handle = await this.resolveFile(filePath)
      const file = await handle.getFile()
      return {
        size: file.size,
        mtime: file.lastModified / 1000,
        ctime: file.lastModified / 1000,
        isDirectory: false,
      }
    } catch {
      // Try as directory
      await this.resolveDir(filePath)
      return { size: 0, mtime: 0, ctime: 0, isDirectory: true }
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await this.stat(filePath)
      return true
    } catch {
      return false
    }
  }

  async mkdir(dirPath: string): Promise<void> {
    await this.resolveDir(dirPath, true)
  }

  async process(filePath: string, fn: (data: string) => string): Promise<void> {
    const content = await this.read(filePath)
    await this.write(filePath, fn(content))
  }
}

export function isBrowserFSAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

export async function initBrowserVaultFS(): Promise<BrowserVaultFS | null> {
  if (!isBrowserFSAvailable()) return null

  // Try to restore a persisted handle
  const handle = await getPersistedDirectoryHandle()
  if (!handle) return null

  // Request permission — if denied, the user will need to re-pick
  const perm = await (handle as any).requestPermission({ mode: 'readwrite' })
  if (perm !== 'granted') return null

  return new BrowserVaultFS(handle)
}

export async function pickAndInitBrowserVaultFS(): Promise<BrowserVaultFS> {
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
  await persistDirectoryHandle(handle)
  return new BrowserVaultFS(handle)
}

// ── Platform detection + singleton ──

let _instance: VaultFS | null = null
const DEFAULT_CAPACITOR_VAULT_ROOT = 'LTM-Vault'

export function getVaultFS(): VaultFS {
  if (_instance) return _instance
  _instance = createVaultFS()
  return _instance
}

function createVaultFS(): VaultFS {
  // Electron desktop
  if (isElectron()) {
    const vaultRoot = getStoredVaultRoot() ?? ''
    return new ElectronVaultFS(vaultRoot)
  }
  // Capacitor mobile
  if (isCapacitorNative()) {
    const { vaultRoot, normalizedStoredRoot } = normalizeCapacitorStoredVaultRoot(getStoredVaultRoot())
    if (normalizedStoredRoot) {
      setStoredVaultRoot(normalizedStoredRoot)
    }
    return new CapacitorVaultFS(vaultRoot)
  }
  // Web fallback
  return new WebVaultFS()
}

export function isElectron(): boolean {
  if (typeof window === 'undefined') return false
  return !!window.electronAPI?.isElectron
}

export function isCapacitorNative(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

export function isDesktop(): boolean {
  return isElectron()
}

export function getPlatformName(): 'electron' | 'ios' | 'android' | 'web' {
  if (isElectron()) return 'electron'
  if (isCapacitorNative()) {
    try {
      const platform = Capacitor.getPlatform()
      if (platform === 'ios') return 'ios'
      if (platform === 'android') return 'android'
    } catch { /* fallthrough */ }
  }
  return 'web'
}

export function setVaultFSInstance(fs: VaultFS): void {
  _instance = fs
}

export function setVaultRoot(path: string): void {
  setStoredVaultRoot(path)
  // Reset singleton so next getVaultFS() uses new root
  _instance = null
}

export async function selectAndSetVaultRoot(): Promise<string | null> {
  if (!isElectron()) return null
  const selected = await window.electronAPI!.selectVaultFolder()
  if (selected) {
    setVaultRoot(selected)
  }
  return selected
}

export function normalizeCapacitorStoredVaultRoot(storedRoot: string | null): {
  vaultRoot: string
  normalizedStoredRoot: string | null
} {
  const stored = storedRoot ?? ''
  // cap-picker: prefix means a folder picked via native UIDocumentPickerViewController
  // The path after the prefix is an absolute POSIX path (e.g. /private/var/mobile/...)
  if (stored.startsWith('cap-picker:')) {
    return {
      vaultRoot: stored.slice('cap-picker:'.length),
      normalizedStoredRoot: null,
    }
  }
  // Relative path within Documents (e.g. "LTM-Vault")
  // Reject stale absolute paths from older versions
  if (stored.startsWith('/')) {
    return {
      vaultRoot: DEFAULT_CAPACITOR_VAULT_ROOT,
      normalizedStoredRoot: DEFAULT_CAPACITOR_VAULT_ROOT,
    }
  }
  const resolved = stored || DEFAULT_CAPACITOR_VAULT_ROOT
  return {
    vaultRoot: resolved,
    normalizedStoredRoot: null,
  }
}
