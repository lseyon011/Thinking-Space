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

// Cache the sync IPC result so we only make ONE synchronous round-trip at preload time.
// Subsequent calls return the cached value without blocking the renderer.
let persistedVaultRootBlock: string | null = readPersistedVaultRootSyncBlock()

function getPersistedVaultRootBlock(): string | null {
  // Return cached value — no additional sync IPC calls needed.
  // The value is updated via vaultRootSetPersisted below.
  return persistedVaultRootBlock
}

// Fetch app version asynchronously to avoid blocking the renderer at preload.
// The contextBridge getter returns '' until the async call resolves.
let appVersion = ''
ipcRenderer.invoke('app:version:get').then((v: unknown) => {
  if (typeof v === 'string') appVersion = v
}).catch(() => { /* ignore */ })

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

  // Live source config
  sourceConfigGet: (): Promise<{ mode: string; sourcePath: string | null; vitePort: number; viteRunning: boolean }> =>
    ipcRenderer.invoke('source:config:get'),
  sourceConfigSet: (config: { mode?: string; sourcePath?: string | null; vitePort?: number }): Promise<{ mode: string; sourcePath: string | null; vitePort: number; requiresRestart: boolean }> =>
    ipcRenderer.invoke('source:config:set', config),

  // Node / dependency environment check
  sourceEnvCheck: (): Promise<{ nodeVersion: string | null; nodeMeetsMinimum: boolean; npmVersion: string | null; depsInstalled: boolean; isGitRepo: boolean; gitBranch: string | null }> =>
    ipcRenderer.invoke('source:env:check'),
  sourceInstallDeps: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('source:install:deps'),
  onSourceInstallProgress: (handler: (entry: { step: string; message: string; type: string }) => void) => {
    const channel = 'source:install:progress';
    const listener = (_: unknown, data: unknown) => handler(data as { step: string; message: string; type: string });
    ipcRenderer.on(channel, listener);
    return () => { ipcRenderer.removeListener(channel, listener); };
  },
  onSourceInstallDone: (handler: (result: { ok: boolean; error?: string }) => void) => {
    const channel = 'source:install:done';
    const listener = (_: unknown, data: unknown) => handler(data as { ok: boolean; error?: string });
    ipcRenderer.on(channel, listener);
    return () => { ipcRenderer.removeListener(channel, listener); };
  },

  // App rebuild
  sourceRebuildStart: (): Promise<{ ok: boolean; started?: boolean; error?: string }> =>
    ipcRenderer.invoke('source:rebuild:start'),
  sourceRebuildApply: (newAppPath: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('source:rebuild:apply', newAppPath),
  onSourceRebuildProgress: (handler: (event: { step: string; message: string; type: string }) => void) => {
    const channel = 'source:rebuild:progress';
    const listener = (_: unknown, data: unknown) => handler(data as { step: string; message: string; type: string });
    ipcRenderer.on(channel, listener);
    return () => { ipcRenderer.removeListener(channel, listener); };
  },
  onSourceRebuildDone: (handler: (result: { ok: boolean; newAppPath?: string; error?: string }) => void) => {
    const channel = 'source:rebuild:done';
    const listener = (_: unknown, data: unknown) => handler(data as { ok: boolean; newAppPath?: string; error?: string });
    ipcRenderer.on(channel, listener);
    return () => { ipcRenderer.removeListener(channel, listener); };
  },

  // Embedded terminal
  terminalCreate: (opts: { cwd?: string; cols: number; rows: number; env?: Record<string, string> }): Promise<{ id: string }> =>
    ipcRenderer.invoke('terminal:create', opts),
  terminalInput: (id: string, data: string): Promise<void> =>
    ipcRenderer.invoke('terminal:input', { id, data }),
  terminalResize: (id: string, cols: number, rows: number): Promise<void> =>
    ipcRenderer.invoke('terminal:resize', { id, cols, rows }),
  terminalKill: (id: string): Promise<void> =>
    ipcRenderer.invoke('terminal:kill', { id }),
  terminalDetach: (id: string): Promise<void> =>
    ipcRenderer.invoke('terminal:detach', { id }),
  terminalReattach: (id: string): Promise<{ buffer: string } | null> =>
    ipcRenderer.invoke('terminal:reattach', { id }),
  codexProfilesList: (siteIds: string[]): Promise<{
    activeHomePath: string
    launchctlHomePath: string | null
    profileRootPath: string
    profiles: Array<{
      siteId: string
      profileId: string
      homePath: string
      active: boolean
      exists: boolean
      hasAuthFile: boolean
      accountId: string | null
      authMode: string | null
      lastRefresh: string | null
      expiresAt: string | null
      authFileUpdatedAt: string | null
      launchctlMatches: boolean
      error?: string
    }>
  }> => ipcRenderer.invoke('codex:profiles:list', siteIds),
  codexProfileActivate: (siteId: string): Promise<{
    activeHomePath: string
    launchctlHomePath: string | null
    launchctlApplied: boolean
    warning: string | null
    profile: {
      siteId: string
      profileId: string
      homePath: string
      active: boolean
      exists: boolean
      hasAuthFile: boolean
      accountId: string | null
      authMode: string | null
      lastRefresh: string | null
      expiresAt: string | null
      authFileUpdatedAt: string | null
      launchctlMatches: boolean
      error?: string
    }
  }> => ipcRenderer.invoke('codex:profiles:activate', siteId),
  onTerminalData: (id: string, handler: (data: string) => void) => {
    const channel = 'terminal:data';
    const listener = (_: unknown, payload: { id: string; data: string }) => {
      if (payload.id === id) handler(payload.data);
    };
    ipcRenderer.on(channel, listener);
    return () => { ipcRenderer.removeListener(channel, listener); };
  },
  onTerminalExit: (id: string, handler: (exitCode: number) => void) => {
    const channel = 'terminal:exit';
    const listener = (_: unknown, payload: { id: string; exitCode: number }) => {
      if (payload.id === id) handler(payload.exitCode);
    };
    ipcRenderer.on(channel, listener);
    return () => { ipcRenderer.removeListener(channel, listener); };
  },

  // Window management
  newWindow: (route?: string) => ipcRenderer.invoke('window:new', route),
  debugPerformanceSnapshot: (): Promise<{
    appCpuPercent: number
    appMemoryWorkingSetBytes: number
    appMemoryPeakWorkingSetBytes: number
    processCount: number
    threadCount: number | null
    browserProcessCount: number
    rendererProcessCount: number
    utilityProcessCount: number
    gpuProcessCount: number
    logicalCpuCount: number
    gpuProcessCpuPercent: number | null
    gpuProcessMemoryWorkingSetBytes: number | null
    gpuRenderer: string | null
    gpuModel: string | null
    gpuFeatureStatus: Record<string, string>
    topProcesses: Array<{
      pid: number
      type: string
      name: string | null
      serviceName: string | null
      cpuPercent: number
      idleWakeupsPerSecond: number
      workingSetBytes: number
      peakWorkingSetBytes: number
      threads: number | null
    }>
  }> => ipcRenderer.invoke('debug:performance:get'),
  // Webview swipe navigation (macOS 2-finger swipe via BrowserWindow 'swipe' event)
  onWebviewSwipe: (handler: (direction: 'left' | 'right') => void) => {
    const channel = 'webview:swipe'
    const listener = (_: unknown, dir: string) => handler(dir as 'left' | 'right')
    ipcRenderer.on(channel, listener)
    return () => { ipcRenderer.removeListener(channel, listener) }
  },

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

  // Webull / Webull bridge (main-process network to bypass renderer CORS limits)
  webullGet: (payload: {
    url: string
    headers: Record<string, string>
    method?: 'GET' | 'POST'
    body?: string
  }) => ipcRenderer.invoke('webull:get', payload),
  webullAccountList: (payload: {
    url: string
    headers: Record<string, string>
    method?: 'GET' | 'POST'
    body?: string
  }) => ipcRenderer.invoke('webull:accountList', payload),
  webullSignedRequest: (payload: {
    method: 'GET' | 'POST'
    url: string
    version?: string
    accessToken?: string
    body?: string
  }) => ipcRenderer.invoke('webull:signedRequest', payload),
  webullCredentialStatus: () =>
    ipcRenderer.invoke('webull:credentials:status'),
  webullCredentialSet: (payload: {
    appKey: string
    appSecret: string
  }) => ipcRenderer.invoke('webull:credentials:set', payload),
  webullCredentialClear: () =>
    ipcRenderer.invoke('webull:credentials:clear'),
  webullTokenGet: () =>
    ipcRenderer.invoke('webull:token:get'),
  webullTokenSet: (payload: {
    token: string
    expires: number | null
    status: string | null
  } | null) => ipcRenderer.invoke('webull:token:set', payload),
});
