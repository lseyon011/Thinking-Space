// Filesystem abstraction for vault operations.
// API aligned with Obsidian's Vault / DataAdapter where possible.
// Platform-specific implementations let the same scanner code run
// on web (via backend), Capacitor (mobile), or Electron (desktop).

import { Capacitor } from '@capacitor/core'
import { EXCLUDED_DIRS } from './vaultConstantsBlock'
import { getStoredVaultRoot, setStoredVaultRoot } from './storageKeyBlock'

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
    capabilities?: Array<{ name: string }>
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
  selectVaultFolder(): Promise<string | null>
  read(vaultRoot: string, relPath: string): Promise<string>
  write(vaultRoot: string, relPath: string, data: string): Promise<void>
  list(vaultRoot: string, relPath: string): Promise<ListedFiles>
  walkVault(vaultRoot: string, extensions: string[]): Promise<VaultEntry[]>
  stat(vaultRoot: string, relPath: string): Promise<VaultStat>
  exists(vaultRoot: string, relPath: string): Promise<boolean>
  mkdir(vaultRoot: string, relPath: string): Promise<void>
  git(vaultRoot: string, args: string[]): Promise<string>
  excalidrawPluginStatus(vaultRoot: string): Promise<import('./typesBlock').ExcalidrawPluginStatus>
  installLatestExcalidrawPlugin(vaultRoot: string): Promise<import('./typesBlock').ExcalidrawPluginStatus>
  hierarchyDbStatus(vaultRoot: string): Promise<import('./typesBlock').HierarchyDbStatus>
  initHierarchyDb(vaultRoot: string): Promise<import('./typesBlock').HierarchyDbStatus>
  hierarchyListNodes(
    vaultRoot: string,
    params: { parent_id: string | null; type?: import('./typesBlock').HierarchyNodeType | null },
  ): Promise<import('./typesBlock').HierarchyNode[]>
  hierarchyGetNode(vaultRoot: string, nodeId: string): Promise<import('./typesBlock').HierarchyNode>
  hierarchyCreateNode(
    vaultRoot: string,
    params: { type: import('./typesBlock').HierarchyNodeType; node_kind?: string | null; title: string; parent_id: string | null; slug?: string | null; sort_order: number },
  ): Promise<import('./typesBlock').HierarchyNode>
  hierarchyUpdateNode(
    vaultRoot: string,
    params: { node_id: string; type?: import('./typesBlock').HierarchyNodeType | null; node_kind?: string | null; title?: string | null; slug?: string | null; sort_order?: number | null },
  ): Promise<import('./typesBlock').HierarchyNode>
  hierarchyMoveNode(
    vaultRoot: string,
    params: { node_id: string; new_parent_id: string | null; sort_order?: number | null },
  ): Promise<import('./typesBlock').HierarchyNode>
  hierarchyDeleteNode(vaultRoot: string, nodeId: string): Promise<{ success: boolean }>
  hierarchyUpsertThought(
    vaultRoot: string,
    params: { file_path: string; title?: string | null },
  ): Promise<import('./typesBlock').HierarchyThought>
  hierarchyListThoughts(
    vaultRoot: string,
    params: { unlinked_only: boolean; limit: number },
  ): Promise<import('./typesBlock').HierarchyThought[]>
  hierarchyListThoughtLinks(
    vaultRoot: string,
    params: { thought_id?: string | null; node_id?: string | null },
  ): Promise<import('./typesBlock').HierarchyThoughtLink[]>
  hierarchyCreateThoughtLink(
    vaultRoot: string,
    params: { thought_id: string; node_id: string; link_kind?: string | null },
  ): Promise<import('./typesBlock').HierarchyThoughtLink>
  hierarchyDeleteThoughtLink(vaultRoot: string, linkId: string): Promise<{ success: boolean }>
  hierarchyListEdges(
    vaultRoot: string,
    params: { from_node_id?: string | null; to_node_id?: string | null },
  ): Promise<import('./typesBlock').HierarchyEdge[]>
  hierarchyCreateEdge(
    vaultRoot: string,
    params: { from_node_id: string; to_node_id: string; edge_kind?: string | null },
  ): Promise<import('./typesBlock').HierarchyEdge>
  hierarchyDeleteEdge(vaultRoot: string, edgeId: string): Promise<{ success: boolean }>
  hierarchyResolvePath(
    vaultRoot: string,
    requestedPath: string,
  ): Promise<import('./typesBlock').HierarchyPathResolution>

  // AI credential management
  aiGetClaudeCredentials(): Promise<{ accessToken: string; refreshToken: string; expiresAt: string } | null>
  aiGetCodexCredentials(): Promise<{ accessToken: string; refreshToken: string; expiresAt: string; accountId?: string } | null>
  aiGetAzureCredentials(): Promise<{ accessToken: string; expiresOn: string } | null>
  aiRefreshClaudeToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: string }>
  aiRefreshCodexToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: string; accountId?: string }>
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
    return this.api.write(this.vaultRoot, path, data)
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

class CapacitorVaultFS implements VaultFS {
  private vaultRoot: string

  constructor(vaultRoot: string) {
    this.vaultRoot = vaultRoot
  }

  private resolve(path: string): string {
    return `${this.vaultRoot}/${path}`
  }

  async read(path: string): Promise<string> {
    const { Filesystem, Encoding } = await import('@capacitor/filesystem')
    const result = await Filesystem.readFile({
      path: this.resolve(path),
      encoding: Encoding.UTF8,
    })
    return result.data as string
  }

  async write(path: string, data: string): Promise<void> {
    const { Filesystem, Encoding } = await import('@capacitor/filesystem')
    await Filesystem.writeFile({
      path: this.resolve(path),
      data,
      encoding: Encoding.UTF8,
      recursive: true,
    })
  }

  async create(path: string, data: string): Promise<void> {
    if (await this.exists(path)) throw new Error(`File already exists: ${path}`)
    await this.write(path, data)
  }

  async list(path: string): Promise<ListedFiles> {
    const { Filesystem } = await import('@capacitor/filesystem')
    const result = await Filesystem.readdir({ path: this.resolve(path) })
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

    const walk = async (dir: string, relPrefix: string) => {
      const { Filesystem } = await import('@capacitor/filesystem')
      const result = await Filesystem.readdir({ path: dir })
      for (const item of result.files) {
        if (item.name.startsWith('.') || EXCLUDED_DIRS.has(item.name)) continue
        const fullPath = `${dir}/${item.name}`
        const relPath = relPrefix ? `${relPrefix}/${item.name}` : item.name

        if (item.type === 'directory') {
          await walk(fullPath, relPath)
        } else {
          const ext = '.' + item.name.split('.').pop()?.toLowerCase()
          if (!extSet.has(ext || '')) continue
          const st = await Filesystem.stat({ path: fullPath })
          entries.push({
            path: relPath,
            size: st.size,
            mtime: (st.mtime || 0) / 1000,
            ctime: (st.ctime || st.mtime || 0) / 1000,
          })
        }
      }
    }

    await walk(this.vaultRoot, '')
    return entries
  }

  async stat(path: string): Promise<VaultStat> {
    const { Filesystem } = await import('@capacitor/filesystem')
    const st = await Filesystem.stat({ path: this.resolve(path) })
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
    await Filesystem.mkdir({
      path: this.resolve(path),
      recursive: true,
    })
  }

  async process(path: string, fn: (data: string) => string): Promise<void> {
    const content = await this.read(path)
    await this.write(path, fn(content))
  }
}

// ── Platform detection + singleton ──

let _instance: VaultFS | null = null

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
    const vaultRoot = getStoredVaultRoot() ?? ''
    return new CapacitorVaultFS(vaultRoot)
  }
  // Web fallback
  return new WebVaultFS()
}

export function isElectron(): boolean {
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
