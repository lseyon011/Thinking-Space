import { createSidebarChromeBlock, type SidebarChromeStateBlock } from './sidebarChromeBlock'

export interface WebSidebarChromeStateBlock extends SidebarChromeStateBlock {
  headerVisible: boolean
  showHeaderToggle: boolean
  siteLabels?: Record<string, string>
}

const block = createSidebarChromeBlock<WebSidebarChromeStateBlock>('web')

export const WEB_SIDEBAR_CHROME_STATE_EVENT_BLOCK = block.stateEvent
export const WEB_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK = block.toggleEvent
export const WEB_SIDEBAR_CHROME_TOGGLE_HEADER_EVENT_BLOCK = block.toggleHeaderEvent

export const dispatchWebSidebarChromeStateBlock = block.dispatchState
export const dispatchWebSidebarChromeToggleBlock = block.dispatchToggle
export const dispatchWebSidebarChromeToggleHeaderBlock = block.dispatchToggleHeader

export const webSidebarChromeBlock = block

export interface NewThoughtSidebarChromeStateBlock extends SidebarChromeStateBlock {}

const newThoughtBlock = createSidebarChromeBlock<NewThoughtSidebarChromeStateBlock>('new-thought')

export const NEW_THOUGHT_SIDEBAR_CHROME_STATE_EVENT_BLOCK = newThoughtBlock.stateEvent
export const NEW_THOUGHT_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK = newThoughtBlock.toggleEvent

export const dispatchNewThoughtSidebarChromeStateBlock = (state: Pick<WebSidebarChromeStateBlock, 'enabled' | 'collapsed'>) =>
  newThoughtBlock.dispatchState({ ...state, label: 'New Note' })
export const dispatchNewThoughtSidebarChromeToggleBlock = newThoughtBlock.dispatchToggle

export const newThoughtSidebarChromeBlock = newThoughtBlock
