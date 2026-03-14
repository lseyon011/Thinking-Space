export interface WebSidebarChromeStateBlock {
  enabled: boolean
  collapsed: boolean
  headerVisible: boolean
  showHeaderToggle: boolean
  label: string
}

export const WEB_SIDEBAR_CHROME_STATE_EVENT_BLOCK = 'ltm:web:sidebar-chrome-state'
export const WEB_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK = 'ltm:web:sidebar-chrome-toggle'
export const WEB_SIDEBAR_CHROME_TOGGLE_HEADER_EVENT_BLOCK = 'ltm:web:sidebar-chrome-toggle-header'

export function dispatchWebSidebarChromeStateBlock(state: WebSidebarChromeStateBlock): void {
  window.dispatchEvent(new CustomEvent<WebSidebarChromeStateBlock>(
    WEB_SIDEBAR_CHROME_STATE_EVENT_BLOCK,
    { detail: state },
  ))
}

export function dispatchWebSidebarChromeToggleBlock(): void {
  window.dispatchEvent(new CustomEvent<void>(WEB_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK))
}

export function dispatchWebSidebarChromeToggleHeaderBlock(): void {
  window.dispatchEvent(new CustomEvent<void>(WEB_SIDEBAR_CHROME_TOGGLE_HEADER_EVENT_BLOCK))
}
