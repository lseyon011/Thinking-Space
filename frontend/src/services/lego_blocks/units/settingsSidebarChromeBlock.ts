import { createSidebarChromeBlock, type SidebarChromeStateBlock } from './sidebarChromeBlock'

export interface SettingsSidebarChromeStateBlock extends SidebarChromeStateBlock {}

const block = createSidebarChromeBlock<SettingsSidebarChromeStateBlock>('settings')

export const SETTINGS_SIDEBAR_CHROME_STATE_EVENT_BLOCK = block.stateEvent
export const SETTINGS_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK = block.toggleEvent

export const dispatchSettingsSidebarChromeStateBlock = block.dispatchState
export const dispatchSettingsSidebarChromeToggleBlock = block.dispatchToggle

export const settingsSidebarChromeBlock = block
