import { createSidebarChromeBlock, type SidebarChromeStateBlock } from './sidebarChromeBlock'

export interface ChatSidebarChromeStateBlock extends SidebarChromeStateBlock {
  headerVisible: boolean
  showHeaderToggle: boolean
}

const block = createSidebarChromeBlock<ChatSidebarChromeStateBlock>('chat')

export const CHAT_SIDEBAR_CHROME_STATE_EVENT_BLOCK = block.stateEvent
export const CHAT_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK = block.toggleEvent
export const CHAT_SIDEBAR_CHROME_TOGGLE_HEADER_EVENT_BLOCK = block.toggleHeaderEvent

export const dispatchChatSidebarChromeStateBlock = block.dispatchState
export const dispatchChatSidebarChromeToggleBlock = block.dispatchToggle
export const dispatchChatSidebarChromeToggleHeaderBlock = block.dispatchToggleHeader

export const chatSidebarChromeBlock = block
