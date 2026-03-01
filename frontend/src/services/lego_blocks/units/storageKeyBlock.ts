export const STORAGE_KEYS = {
  vaultRoot: 'ltm-vault-root',
  thinkingOrganizerTab: 'ltm-thinking-organizer-tab',
  thinkingOrganizerTemplates: 'ltm-thinking-organizer-level-templates',
  thinkingOrganizerRecentTemplates: 'ltm-thinking-organizer-recent-templates',
  thinkingOrganizerNodeKinds: 'ltm-thinking-organizer-node-kinds',
  thinkingOrganizerFolderRoots: 'ltm-thinking-organizer-folder-roots',
  thinkingOrganizerProjectRoots: 'ltm-thinking-organizer-project-roots',
  thinkingOrganizerSelectedProjectRoot: 'ltm-thinking-organizer-selected-project-root',
  thinkingOrganizerProjects: 'ltm-thinking-organizer-projects',
  thinkingOrganizerProjectPresetTags: 'ltm-thinking-organizer-project-preset-tags',
  thinkingOrganizerProjectTagColors: 'ltm-thinking-organizer-project-tag-colors',
  thinkingOrganizerProjectProgramGroups: 'ltm-thinking-organizer-project-program-groups',
  thinkingOrganizerProjectCreateDestination: 'ltm-thinking-organizer-project-create-destination',
  appShellSidebarCollapsed: 'ltm-app-shell-sidebar-collapsed',
  appShellExcalidrawExpanded: 'ltm-app-shell-excalidraw-expanded',
  appShellTabs: 'ltm-app-shell-tabs',
  appShellActiveTabId: 'ltm-app-shell-active-tab-id',
  appTheme: 'ltm-app-theme',
  thinkingSpaceExplorerCollapsed: 'ltm-thinking-space-explorer-collapsed',
  thinkingSpaceExplorerWidthPx: 'ltm-thinking-space-explorer-width-px',
  capabilityFeatureFlags: 'ltm-capability-feature-flags',
  stewardProposalQueue: 'ltm-steward-proposal-queue',
  aiTelemetryEvents: 'ltm-ai-telemetry-events',
  aiSettings: 'ltm-ai-settings',
  markdownEditorSettings: 'ltm-markdown-editor-settings',
  markdownDocumentTopBarHidden: 'ltm-markdown-document-top-bar-hidden',
  userProfileCache: 'ltm-user-profile-cache',
  f9ExecutionSettings: 'ltm-f9-execution-settings',
  f9ProjectPresetTags: 'ltm-f9-project-preset-tags',
  f9OverallRememberByProjectRoot: 'ltm-f9-overall-remember-by-project-root',
  aiManualCredentials: 'ltm-ai-manual-credentials',
  aiOauthCredentials: 'ltm-ai-oauth-credentials',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

export function getStorageItem(key: StorageKey): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function setStorageItem(key: StorageKey, value: string): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(key, value)
  } catch {
    // Ignore storage write failures in restricted runtimes.
  }
}

export function getJsonStorageItem<T>(key: StorageKey, fallback: T): T {
  const raw = getStorageItem(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function setJsonStorageItem<T>(key: StorageKey, value: T): void {
  setStorageItem(key, JSON.stringify(value))
}

export function getStoredVaultRoot(): string | null {
  return getStorageItem(STORAGE_KEYS.vaultRoot)
}

export function setStoredVaultRoot(path: string): void {
  setStorageItem(STORAGE_KEYS.vaultRoot, path)
}
