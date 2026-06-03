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
  /** User-configured label for the Webull tab in the native iPhone rail. */
  webullTabLabel?: string
}

export type TopChromeEventPayload = {
  tabId?: string
  navItemId?: string
  path?: string
  /** Used by topChromeNavRequestRender to indicate forward push vs back pop. */
  direction?: 'forward' | 'back'
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
  | 'topChromeNavRequestRender'
  | 'topChromeNavDidFinish'

interface TopChromePluginBlock {
  setState(options: Omit<TopChromeStateBlock, 'tabs'> & { tabsPayload?: string }): Promise<void>
  show(): Promise<void>
  hide(): Promise<void>
  addListener(
    eventName: TopChromeEventName,
    listenerFunc: (payload: TopChromeEventPayload) => void,
  ): Promise<PluginListenerHandle>
  // Native push navigation (iOS phone shell). No-op on platforms where the
  // plugin doesn't implement it (Capacitor falls back gracefully).
  pushNavigation(options: { path: string }): Promise<void>
  popNavigation(): Promise<void>
  didCommitNavigation(options: { path: string }): Promise<void>
  setNavigationStack(options: { stack: string[] }): Promise<void>
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

// MARK: - Native push navigation bridge (iPhone shell)

export async function pushNativeNavigationBlock(path: string): Promise<void> {
  await TopChrome.pushNavigation({ path })
}

export async function popNativeNavigationBlock(): Promise<void> {
  await TopChrome.popNavigation()
}

export async function commitNativeNavigationBlock(path: string): Promise<void> {
  await TopChrome.didCommitNavigation({ path })
}

export async function setNativeNavigationStackBlock(stack: string[]): Promise<void> {
  await TopChrome.setNavigationStack({ stack })
}
