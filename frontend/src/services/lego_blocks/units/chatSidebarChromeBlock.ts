export interface ChatSidebarChromeStateBlock {
  enabled: boolean      // true while the chat orch is mounted (sidebar toggle always available)
  collapsed: boolean    // true when sidebar is collapsed
  headerVisible: boolean   // true when the webview URL bar is visible
  showHeaderToggle: boolean // true when a web site is active (header toggle makes sense)
  label: string         // tab display label, e.g. "Chat · Grok - Work"
}

export const CHAT_SIDEBAR_CHROME_STATE_EVENT_BLOCK = 'ltm:chat:sidebar-chrome-state'
export const CHAT_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK = 'ltm:chat:sidebar-chrome-toggle'
export const CHAT_SIDEBAR_CHROME_TOGGLE_HEADER_EVENT_BLOCK = 'ltm:chat:sidebar-chrome-toggle-header'

export function dispatchChatSidebarChromeStateBlock(state: ChatSidebarChromeStateBlock): void {
  window.dispatchEvent(new CustomEvent<ChatSidebarChromeStateBlock>(
    CHAT_SIDEBAR_CHROME_STATE_EVENT_BLOCK,
    { detail: state },
  ))
}

export function dispatchChatSidebarChromeToggleBlock(): void {
  window.dispatchEvent(new CustomEvent<void>(CHAT_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK))
}

export function dispatchChatSidebarChromeToggleHeaderBlock(): void {
  window.dispatchEvent(new CustomEvent<void>(CHAT_SIDEBAR_CHROME_TOGGLE_HEADER_EVENT_BLOCK))
}
