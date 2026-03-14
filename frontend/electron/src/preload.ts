require('./rt/electron-rt');
//////////////////////////////
// Expose vault filesystem and platform detection to renderer

import { contextBridge, ipcRenderer } from 'electron';

function normalizePersistedVaultRootBlock(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function readPersistedVaultRootSyncBlock(): string | null {
  try {
    const value = ipcRenderer.sendSync('vault:root:getPersistedSync')
    return normalizePersistedVaultRootBlock(value)
  } catch {
    return null
  }
}

let persistedVaultRootBlock: string | null = readPersistedVaultRootSyncBlock()

function getPersistedVaultRootBlock(): string | null {
  const nextValue = readPersistedVaultRootSyncBlock()
  if (nextValue) {
    persistedVaultRootBlock = nextValue
    return nextValue
  }
  return persistedVaultRootBlock
}

const appVersion: string = (() => {
  try { return ipcRenderer.sendSync('app:version:getSync') as string } catch { return '' }
})()

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  versions: {
    app: appVersion,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    v8: process.versions.v8,
  },

  // Capability adapter management
  capabilitiesList: () =>
    ipcRenderer.invoke('capabilities:list'),
  capabilitiesInvoke: (payload: {
    vaultRoot: string
    request: {
      capability: string
      input: Record<string, unknown>
      actor?: { kind: 'human' | 'agent' | 'system'; id?: string }
      requestId?: string
      dryRun?: boolean
    }
    apiBaseUrl?: string
  }) => ipcRenderer.invoke('capabilities:invoke', payload),
  extensionRuntimeInvoke: (payload: {
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
  }) => ipcRenderer.invoke('extension-runtime:invoke', payload),

  // Window management
  newWindow: (route?: string) => ipcRenderer.invoke('window:new', route),
  markdownEditorOnPasteAsTable: (handler: () => void) => {
    const channel = 'markdown-editor:paste-as-table'
    const listener = () => {
      handler()
    }
    ipcRenderer.on(channel, listener)
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  },

  // Vault folder picker dialog
  selectVaultFolder: () => ipcRenderer.invoke('vault:selectFolder'),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  fetchText: (url: string) => ipcRenderer.invoke('net:fetchText', url) as Promise<{ status: number; body: string }>,
  googleOauthRequest: (payload: {
    method: 'GET' | 'POST' | 'PUT'
    url: string
    headers?: Record<string, string>
    body?: string
  }) => ipcRenderer.invoke('google:oauth:request', payload),
  vaultRootGetPersisted: () => getPersistedVaultRootBlock(),
  vaultRootSetPersisted: async (vaultRoot: string | null) => {
    const normalized = normalizePersistedVaultRootBlock(vaultRoot)
    await ipcRenderer.invoke('vault:root:setPersisted', normalized)
    persistedVaultRootBlock = normalized
  },

  // Filesystem operations (all take vaultRoot as first arg)
  read: (vaultRoot: string, relPath: string) =>
    ipcRenderer.invoke('vault:read', vaultRoot, relPath),
  write: (vaultRoot: string, relPath: string, data: string) =>
    ipcRenderer.invoke('vault:write', vaultRoot, relPath, data),
  readBytesBase64: (vaultRoot: string, relPath: string) =>
    ipcRenderer.invoke('vault:readBytesBase64', vaultRoot, relPath),
  writeBytesBase64: (vaultRoot: string, relPath: string, base64Data: string) =>
    ipcRenderer.invoke('vault:writeBytesBase64', vaultRoot, relPath, base64Data),
  list: (vaultRoot: string, relPath: string) =>
    ipcRenderer.invoke('vault:list', vaultRoot, relPath),
  walkVault: (vaultRoot: string, extensions: string[]) =>
    ipcRenderer.invoke('vault:walk', vaultRoot, extensions),
  stat: (vaultRoot: string, relPath: string) =>
    ipcRenderer.invoke('vault:stat', vaultRoot, relPath),
  exists: (vaultRoot: string, relPath: string) =>
    ipcRenderer.invoke('vault:exists', vaultRoot, relPath),
  mkdir: (vaultRoot: string, relPath: string) =>
    ipcRenderer.invoke('vault:mkdir', vaultRoot, relPath),
  rename: (vaultRoot: string, fromRelPath: string, toRelPath: string) =>
    ipcRenderer.invoke('vault:rename', vaultRoot, fromRelPath, toRelPath),
  deletePath: (vaultRoot: string, relPath: string, recursive = true) =>
    ipcRenderer.invoke('vault:delete', vaultRoot, relPath, recursive),
  copyPath: (vaultRoot: string, fromRelPath: string, toRelPath: string) =>
    ipcRenderer.invoke('vault:copy', vaultRoot, fromRelPath, toRelPath),
  revealPath: (vaultRoot: string, relPath: string) =>
    ipcRenderer.invoke('vault:reveal', vaultRoot, relPath),
  openPath: (vaultRoot: string, relPath: string) =>
    ipcRenderer.invoke('vault:openPath', vaultRoot, relPath),

  // Git (desktop-only)
  git: (vaultRoot: string, args: string[]) =>
    ipcRenderer.invoke('vault:git', vaultRoot, args),

  // Excalidraw community plugin management
  excalidrawPluginStatus: (vaultRoot: string) =>
    ipcRenderer.invoke('plugin:excalidraw:status', vaultRoot),
  installLatestExcalidrawPlugin: (vaultRoot: string) =>
    ipcRenderer.invoke('plugin:excalidraw:installLatest', vaultRoot),

  // Hierarchy sqlite management
  hierarchyDbStatus: (vaultRoot: string) =>
    ipcRenderer.invoke('hierarchy:status', vaultRoot),
  initHierarchyDb: (vaultRoot: string) =>
    ipcRenderer.invoke('hierarchy:init', vaultRoot),

  // Hierarchy CRUD + thought linking
  hierarchyListNodes: (
    vaultRoot: string,
    params: { parent_id: string | null; type?: 'project' | 'epic' | 'idea' | null },
  ) => ipcRenderer.invoke('hierarchy:nodes:list', vaultRoot, params),
  hierarchyGetNode: (vaultRoot: string, nodeId: string) =>
    ipcRenderer.invoke('hierarchy:nodes:get', vaultRoot, nodeId),
  hierarchyCreateNode: (
    vaultRoot: string,
    params: { type: 'project' | 'epic' | 'idea'; node_kind?: string | null; title: string; parent_id: string | null; slug?: string | null; sort_order: number },
  ) => ipcRenderer.invoke('hierarchy:nodes:create', vaultRoot, params),
  hierarchyUpdateNode: (
    vaultRoot: string,
    params: { node_id: string; type?: 'project' | 'epic' | 'idea' | null; node_kind?: string | null; title?: string | null; slug?: string | null; sort_order?: number | null },
  ) => ipcRenderer.invoke('hierarchy:nodes:update', vaultRoot, params),
  hierarchyMoveNode: (
    vaultRoot: string,
    params: { node_id: string; new_parent_id: string | null; sort_order?: number | null },
  ) => ipcRenderer.invoke('hierarchy:nodes:move', vaultRoot, params),
  hierarchyDeleteNode: (vaultRoot: string, nodeId: string) =>
    ipcRenderer.invoke('hierarchy:nodes:delete', vaultRoot, nodeId),

  hierarchyUpsertThought: (vaultRoot: string, params: { file_path: string; title?: string | null }) =>
    ipcRenderer.invoke('hierarchy:thoughts:upsert', vaultRoot, params),
  hierarchyListThoughts: (vaultRoot: string, params: { unlinked_only: boolean; limit: number }) =>
    ipcRenderer.invoke('hierarchy:thoughts:list', vaultRoot, params),

  hierarchyListThoughtLinks: (
    vaultRoot: string,
    params: { thought_id?: string | null; node_id?: string | null },
  ) => ipcRenderer.invoke('hierarchy:thought-links:list', vaultRoot, params),
  hierarchyCreateThoughtLink: (
    vaultRoot: string,
    params: { thought_id: string; node_id: string; link_kind?: string | null },
  ) => ipcRenderer.invoke('hierarchy:thought-links:create', vaultRoot, params),
  hierarchyDeleteThoughtLink: (vaultRoot: string, linkId: string) =>
    ipcRenderer.invoke('hierarchy:thought-links:delete', vaultRoot, linkId),
  hierarchyListEdges: (
    vaultRoot: string,
    params: { from_node_id?: string | null; to_node_id?: string | null },
  ) => ipcRenderer.invoke('hierarchy:edges:list', vaultRoot, params),
  hierarchyCreateEdge: (
    vaultRoot: string,
    params: { from_node_id: string; to_node_id: string; edge_kind?: string | null },
  ) => ipcRenderer.invoke('hierarchy:edges:create', vaultRoot, params),
  hierarchyDeleteEdge: (vaultRoot: string, edgeId: string) =>
    ipcRenderer.invoke('hierarchy:edges:delete', vaultRoot, edgeId),
  hierarchyResolvePath: (vaultRoot: string, requestedPath: string) =>
    ipcRenderer.invoke('hierarchy:path:resolve', vaultRoot, requestedPath),

  // AI credential management
  aiGetClaudeCredentials: () =>
    ipcRenderer.invoke('ai:credentials:claude'),
  aiGetAzureCredentials: () =>
    ipcRenderer.invoke('ai:credentials:azure'),
  aiGetCodexCredentials: () =>
    ipcRenderer.invoke('ai:credentials:codex'),
  aiRefreshClaudeToken: (refreshToken: string) =>
    ipcRenderer.invoke('ai:credentials:claude:refresh', refreshToken),
  aiRefreshCodexToken: (refreshToken: string) =>
    ipcRenderer.invoke('ai:credentials:codex:refresh', refreshToken),
  aiChatCodex: (
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    accessToken: string,
    accountId?: string,
    model?: string,
  ) => ipcRenderer.invoke('ai:chat:codex', messages, accessToken, accountId, model),

  // F9 / Webull bridge (main-process network to bypass renderer CORS limits)
  f9WebullGet: (payload: {
    url: string
    headers: Record<string, string>
    method?: 'GET' | 'POST'
    body?: string
  }) => ipcRenderer.invoke('f9:webull:get', payload),
  f9WebullAccountList: (payload: {
    url: string
    headers: Record<string, string>
    method?: 'GET' | 'POST'
    body?: string
  }) => ipcRenderer.invoke('f9:webull:accountList', payload),
  f9WebullSignedRequest: (payload: {
    method: 'GET' | 'POST'
    url: string
    version?: string
    accessToken?: string
    body?: string
  }) => ipcRenderer.invoke('f9:webull:signedRequest', payload),
  f9WebullCredentialStatus: () =>
    ipcRenderer.invoke('f9:webull:credentials:status'),
  f9WebullCredentialSet: (payload: {
    appKey: string
    appSecret: string
  }) => ipcRenderer.invoke('f9:webull:credentials:set', payload),
  f9WebullCredentialClear: () =>
    ipcRenderer.invoke('f9:webull:credentials:clear'),
  f9WebullTokenGet: () =>
    ipcRenderer.invoke('f9:webull:token:get'),
  f9WebullTokenSet: (payload: {
    token: string
    expires: number | null
    status: string | null
  } | null) => ipcRenderer.invoke('f9:webull:token:set', payload),
});
