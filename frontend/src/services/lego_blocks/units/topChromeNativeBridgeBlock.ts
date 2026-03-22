import { registerPlugin } from '@capacitor/core'
import type { PluginListenerHandle } from '@capacitor/core'

export interface NativeTopChromeTabBridgeItem {
  id: string
  label: string
  active: boolean
}

export interface TopChromeStateBlock {
  title: string
  visible?: boolean
  activeNavItemId?: string
  topBarCollapsed?: boolean
  bottomBarCollapsed?: boolean
  showSearch?: boolean
  showTools?: boolean
  toolsBadgeCount?: number
  canToggleSidebar?: boolean
  sidebarToggleActive?: boolean
  sidebarToggleLabel?: string
  canToggleHeader?: boolean
  headerToggleLabel?: string
  tabs?: NativeTopChromeTabBridgeItem[]
  bottomBarHidden?: boolean
  canRefresh?: boolean
  canSync?: boolean
  canRebuild?: boolean
  canGitCommit?: boolean
  canGitPush?: boolean
}

export type TopChromeEventPayload = {
  tabId?: string
  navItemId?: string
}

export type TopChromeEventName =
  | 'topChromeMenuTap'
  | 'topChromeSearchTap'
  | 'topChromeOpenDebugTap'
  | 'topChromeRefreshTap'
  | 'topChromeSyncTap'
  | 'topChromeRebuildTap'
  | 'topChromeGitCommitTap'
  | 'topChromeGitPushTap'
  | 'topChromeHeaderToggleTap'
  | 'topChromeSidebarToggleTap'
  | 'topChromeCreateTap'
  | 'topChromeExpandBottomTap'
  | 'topChromeSelectTab'
  | 'topChromeCloseTab'
  | 'topChromeNavItemTap'

interface TopChromePluginBlock {
  setState(options: Omit<TopChromeStateBlock, 'tabs'> & { tabsPayload?: string }): Promise<void>
  show(): Promise<void>
  hide(): Promise<void>
  addListener(
    eventName: TopChromeEventName,
    listenerFunc: (payload: TopChromeEventPayload) => void,
  ): Promise<PluginListenerHandle>
}

const TopChrome = registerPlugin<TopChromePluginBlock>('TopChrome')

export async function setTopChromeStateBlock(options: TopChromeStateBlock): Promise<void> {
  const { tabs, ...rest } = options
  await TopChrome.setState({
    ...rest,
    tabsPayload: JSON.stringify(tabs ?? []),
  })
}

export async function showTopChromeBlock(): Promise<void> {
  await TopChrome.show()
}

export async function hideTopChromeBlock(): Promise<void> {
  await TopChrome.hide()
}

export async function addTopChromeListenerBlock(
  eventName: TopChromeEventName,
  handler: (payload: TopChromeEventPayload) => void,
): Promise<PluginListenerHandle> {
  return TopChrome.addListener(eventName, handler)
}
