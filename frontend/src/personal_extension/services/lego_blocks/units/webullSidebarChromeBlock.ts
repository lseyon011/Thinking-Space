export interface WebullSidebarChromeStateBlock {
  enabled: boolean
  collapsed: boolean
  label: string
}

export const Webull_SIDEBAR_CHROME_STATE_EVENT_BLOCK = 'ltm:webull:sidebar-chrome-state'
export const Webull_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK = 'ltm:webull:sidebar-chrome-toggle'

export function dispatchWebullSidebarChromeStateBlock(state: WebullSidebarChromeStateBlock): void {
  window.dispatchEvent(new CustomEvent<WebullSidebarChromeStateBlock>(
    Webull_SIDEBAR_CHROME_STATE_EVENT_BLOCK,
    { detail: state },
  ))
}

export function dispatchWebullSidebarChromeToggleBlock(): void {
  window.dispatchEvent(new CustomEvent<void>(Webull_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK))
}
