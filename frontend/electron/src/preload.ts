require('./rt/electron-rt');
//////////////////////////////
// Expose vault filesystem and platform detection to renderer

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

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

  // Vault folder picker dialog
  selectVaultFolder: () => ipcRenderer.invoke('vault:selectFolder'),

  // Filesystem operations (all take vaultRoot as first arg)
  read: (vaultRoot: string, relPath: string) =>
    ipcRenderer.invoke('vault:read', vaultRoot, relPath),
  write: (vaultRoot: string, relPath: string, data: string) =>
    ipcRenderer.invoke('vault:write', vaultRoot, relPath, data),
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
});
