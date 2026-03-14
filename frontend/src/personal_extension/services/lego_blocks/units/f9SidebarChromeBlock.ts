export interface F9SidebarChromeStateBlock {
  enabled: boolean
  collapsed: boolean
  label: string
}

export const F9_SIDEBAR_CHROME_STATE_EVENT_BLOCK = 'ltm:f9:sidebar-chrome-state'
export const F9_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK = 'ltm:f9:sidebar-chrome-toggle'

export function dispatchF9SidebarChromeStateBlock(state: F9SidebarChromeStateBlock): void {
  window.dispatchEvent(new CustomEvent<F9SidebarChromeStateBlock>(
    F9_SIDEBAR_CHROME_STATE_EVENT_BLOCK,
    { detail: state },
  ))
}

export function dispatchF9SidebarChromeToggleBlock(): void {
  window.dispatchEvent(new CustomEvent<void>(F9_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK))
}
