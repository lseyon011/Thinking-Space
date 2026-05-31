import { createSidebarChromeBlock, type SidebarChromeStateBlock } from './sidebarChromeBlock'

export interface OrganizerSidebarChromeStateBlock extends SidebarChromeStateBlock {
  headerVisible: boolean
  showHeaderToggle: boolean
}

const block = createSidebarChromeBlock<OrganizerSidebarChromeStateBlock>('organizer')

export const ORGANIZER_SIDEBAR_CHROME_STATE_EVENT_BLOCK = block.stateEvent
export const ORGANIZER_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK = block.toggleEvent
export const ORGANIZER_SIDEBAR_CHROME_TOGGLE_HEADER_EVENT_BLOCK = block.toggleHeaderEvent

export const dispatchOrganizerSidebarChromeStateBlock = block.dispatchState
export const dispatchOrganizerSidebarChromeToggleBlock = block.dispatchToggle
export const dispatchOrganizerSidebarChromeToggleHeaderBlock = block.dispatchToggleHeader

export const organizerSidebarChromeBlock = block
