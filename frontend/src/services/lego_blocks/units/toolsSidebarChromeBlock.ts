import { createSidebarChromeBlock, type SidebarChromeStateBlock } from './sidebarChromeBlock'

export interface ToolsSidebarChromeStateBlock extends SidebarChromeStateBlock {}

const block = createSidebarChromeBlock<ToolsSidebarChromeStateBlock>('tools')

export const TOOLS_SIDEBAR_CHROME_STATE_EVENT_BLOCK = block.stateEvent
export const TOOLS_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK = block.toggleEvent

export const dispatchToolsSidebarChromeStateBlock = block.dispatchState
export const dispatchToolsSidebarChromeToggleBlock = block.dispatchToggle

export const toolsSidebarChromeBlock = block
