export interface OrganizerSidebarChromeStateBlock {
  enabled: boolean
  collapsed: boolean
  label: string
  headerVisible: boolean
  showHeaderToggle: boolean
}

export const ORGANIZER_SIDEBAR_CHROME_STATE_EVENT_BLOCK = 'ltm:organizer:sidebar-chrome-state'
export const ORGANIZER_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK = 'ltm:organizer:sidebar-chrome-toggle'
export const ORGANIZER_SIDEBAR_CHROME_TOGGLE_HEADER_EVENT_BLOCK = 'ltm:organizer:sidebar-chrome-toggle-header'

export function dispatchOrganizerSidebarChromeStateBlock(state: OrganizerSidebarChromeStateBlock): void {
  window.dispatchEvent(new CustomEvent<OrganizerSidebarChromeStateBlock>(
    ORGANIZER_SIDEBAR_CHROME_STATE_EVENT_BLOCK,
    { detail: state },
  ))
}

export function dispatchOrganizerSidebarChromeToggleBlock(): void {
  window.dispatchEvent(new CustomEvent<void>(ORGANIZER_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK))
}

export function dispatchOrganizerSidebarChromeToggleHeaderBlock(): void {
  window.dispatchEvent(new CustomEvent<void>(ORGANIZER_SIDEBAR_CHROME_TOGGLE_HEADER_EVENT_BLOCK))
}
