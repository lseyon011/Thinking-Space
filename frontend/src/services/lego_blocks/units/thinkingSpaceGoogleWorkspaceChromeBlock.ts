import { createSidebarChromeBlock, type SidebarChromeStateBlock } from './sidebarChromeBlock'

export interface ThinkingSpaceGoogleWorkspaceChromeStateBlock extends SidebarChromeStateBlock {
  explorerCollapsed: boolean
  headerVisible: boolean
  /** Whether to show the header toggle button (only when a document is open). */
  showHeaderToggle: boolean
}

const block = createSidebarChromeBlock<ThinkingSpaceGoogleWorkspaceChromeStateBlock>('thinking-space-explorer')

export const THINKING_SPACE_GOOGLE_WORKSPACE_CHROME_STATE_EVENT_BLOCK = block.stateEvent
export const THINKING_SPACE_GOOGLE_WORKSPACE_TOGGLE_EXPLORER_EVENT_BLOCK = block.toggleEvent
export const THINKING_SPACE_GOOGLE_WORKSPACE_TOGGLE_HEADER_EVENT_BLOCK = block.toggleHeaderEvent

export const dispatchThinkingSpaceGoogleWorkspaceChromeStateBlock = block.dispatchState
export const dispatchThinkingSpaceGoogleWorkspaceToggleExplorerBlock = block.dispatchToggle
export const dispatchThinkingSpaceGoogleWorkspaceToggleHeaderBlock = block.dispatchToggleHeader

export const thinkingSpaceGoogleWorkspaceChromeBlock = block
