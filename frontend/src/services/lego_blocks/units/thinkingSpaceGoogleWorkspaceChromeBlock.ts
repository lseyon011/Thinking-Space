export interface ThinkingSpaceGoogleWorkspaceChromeStateBlock {
  enabled: boolean
  explorerCollapsed: boolean
  headerVisible: boolean
}

export const THINKING_SPACE_GOOGLE_WORKSPACE_CHROME_STATE_EVENT_BLOCK = 'ltm:thinking-space:google-workspace-chrome-state'
export const THINKING_SPACE_GOOGLE_WORKSPACE_TOGGLE_EXPLORER_EVENT_BLOCK = 'ltm:thinking-space:google-workspace-toggle-explorer'
export const THINKING_SPACE_GOOGLE_WORKSPACE_TOGGLE_HEADER_EVENT_BLOCK = 'ltm:thinking-space:google-workspace-toggle-header'

export function dispatchThinkingSpaceGoogleWorkspaceChromeStateBlock(
  state: ThinkingSpaceGoogleWorkspaceChromeStateBlock,
): void {
  window.dispatchEvent(new CustomEvent<ThinkingSpaceGoogleWorkspaceChromeStateBlock>(
    THINKING_SPACE_GOOGLE_WORKSPACE_CHROME_STATE_EVENT_BLOCK,
    { detail: state },
  ))
}

export function dispatchThinkingSpaceGoogleWorkspaceToggleExplorerBlock(): void {
  window.dispatchEvent(new CustomEvent<void>(THINKING_SPACE_GOOGLE_WORKSPACE_TOGGLE_EXPLORER_EVENT_BLOCK))
}

export function dispatchThinkingSpaceGoogleWorkspaceToggleHeaderBlock(): void {
  window.dispatchEvent(new CustomEvent<void>(THINKING_SPACE_GOOGLE_WORKSPACE_TOGGLE_HEADER_EVENT_BLOCK))
}
