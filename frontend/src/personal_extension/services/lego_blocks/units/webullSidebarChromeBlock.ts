import { createSidebarChromeBlock, type SidebarChromeStateBlock } from '@/services/lego_blocks/units/sidebarChromeBlock'

export interface WebullSidebarChromeStateBlock extends SidebarChromeStateBlock {}

const block = createSidebarChromeBlock<WebullSidebarChromeStateBlock>('webull')

export const Webull_SIDEBAR_CHROME_STATE_EVENT_BLOCK = block.stateEvent
export const Webull_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK = block.toggleEvent

export const dispatchWebullSidebarChromeStateBlock = block.dispatchState
export const dispatchWebullSidebarChromeToggleBlock = block.dispatchToggle

export const webullSidebarChromeBlock = block
