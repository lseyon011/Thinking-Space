export interface WebSidebarChromeStateBlock {
  enabled: boolean
  collapsed: boolean
  headerVisible: boolean
  showHeaderToggle: boolean
  label: string
  siteLabels?: Record<string, string>
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

export const NEW_THOUGHT_SIDEBAR_CHROME_STATE_EVENT_BLOCK = 'ltm:new-thought:sidebar-chrome-state'
export const NEW_THOUGHT_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK = 'ltm:new-thought:sidebar-chrome-toggle'

export function dispatchNewThoughtSidebarChromeStateBlock(state: Pick<WebSidebarChromeStateBlock, 'enabled' | 'collapsed'>): void {
  window.dispatchEvent(new CustomEvent(NEW_THOUGHT_SIDEBAR_CHROME_STATE_EVENT_BLOCK, { detail: state }))
}

export function dispatchNewThoughtSidebarChromeToggleBlock(): void {
  window.dispatchEvent(new CustomEvent<void>(NEW_THOUGHT_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK))
}
