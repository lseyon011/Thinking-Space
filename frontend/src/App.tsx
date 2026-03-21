import { Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  Bot,
  Bug,
  ChevronDown,
  Compass,
  FolderKanban,
  FileText,
  GitBranch,
  Loader2,
  Menu,
  Eye,
  EyeOff,
  PanelLeft,
  PanelLeftClose,
  PlusSquare,
  RefreshCw,
  KeyRound,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react'
import treeOfLifeLogo from './assets/tree-of-life-logo.jpg'
import excalidrawLogo from './assets/excalidraw-logo.svg'
import Home from './pages/Home'
import ExcalidrawPlus from './pages/ExcalidrawPlus'
import FormatExcalidraw from './pages/FormatExcalidraw'
import ExcalidrawPlugin from './pages/ExcalidrawPlugin'
import MindmapBuilder from './pages/MindmapBuilder'
import PdfToMarkdown from './pages/PdfToMarkdown'
import GitInsights from './pages/GitInsights'
import TranscriptCleaner from './pages/TranscriptCleaner'
import NewThought from './pages/NewThought'
import ThinkingSpace from './pages/ThinkingSpace'
import ThinkingOrganizer from './pages/ThinkingOrganizer'
import Chat from './pages/Chat'
import Web from './pages/Web'
import CapabilityDiscovery from './pages/CapabilityDiscovery'
import ExtensionBuilder from './pages/ExtensionBuilder'
import PasswordManager from './pages/PasswordManager'
import Settings from './pages/Settings'
import TerminalPage from './pages/TerminalPage'
import WebullPage from './personal_extension/pages/WebullPage'
import VaultSetup from './components/orchestrators/VaultSetupOrch'
import AppTabsBlock, { type AppWorkspaceTabBlockModel } from './components/lego_blocks/units/AppTabsBlock'
import { copyTextToClipboard } from './components/lego_blocks/units/BacklogListDomainBlock'
import { Button } from './components/lego_blocks/units/ui/button'
import RuntimeErrorBoundaryBlock from './components/lego_blocks/integrations/RuntimeErrorBoundaryBlock'
import RuntimeErrorSurfaceBlock from './components/lego_blocks/integrations/RuntimeErrorSurfaceBlock'
import DebugPanelBlock from './components/lego_blocks/integrations/DebugPanelBlock'
import DebugToastBlock from './components/lego_blocks/units/DebugToastBlock'
import {
  addDebugLogListenerBlock,
  dispatchDebugLogBlock,
  installConsoleInterceptBlock,
  type DebugLogEntryBlock,
} from './services/lego_blocks/units/debugLogBlock'
import {
  EXCALIDRAW_PLUS_ROOT_ROUTE,
  EXCALIDRAW_PLUS_TOOL_ROUTES,
  isExcalidrawPlusRoute,
} from './components/lego_blocks/units/ExcalidrawPlusRoutesBlock'
import UniversalSearchBlock from './components/lego_blocks/integrations/UniversalSearchBlock'
import { UNIVERSAL_SEARCH_COMMAND_MODAL_PRESET_BLOCK } from './components/lego_blocks/integrations/universalSearchPresetBlock'
import { useUILayoutBlock } from './components/lego_blocks/hooks/shared/useUILayoutBlock'
import { useNativeTopChromeBlock } from './components/lego_blocks/hooks/shared/useNativeTopChromeBlock'
import { deriveAdaptiveShellStateOrch } from './services/orchestrators/uiNavigationOrch'
import { isElectron, setVaultRoot } from './services/orchestrators/runtimeOrch'
import { fullSync, getLastSyncTimestamp, setLastSyncTimestamp, smartSync, type SyncResult } from './services/orchestrators/vaultSyncOrch'
import { listMarkdownEntries } from './services/orchestrators/fileSystemOrch'
import { dispatchGlobalSyncRefreshBlock } from '@/services/lego_blocks/units/globalSyncRefreshBlock'
import {
  gitCommitAllOrch,
  gitPushOrch,
  isGitSyncToolsSupportedOrch,
  readGitSyncStatusOrch,
} from '@/services/orchestrators/gitSyncToolsOrch'
import {
  STORAGE_KEYS,
  getJsonStorageItem,
  getStoredVaultRoot,
  getStorageItem,
  setJsonStorageItem,
  setStorageItem,
} from './services/orchestrators/storageOrch'
import { getCapabilityFeatureFlags } from './services/orchestrators/capabilityFeatureFlagsOrch'
import { isCapacitorNative, initBrowserVaultFS, setVaultFSInstance } from '@/services/lego_blocks/integrations/fsBlock'
import { readUserProfileOrch } from './services/orchestrators/userProfileOrch'
import {
  setExplorerFolderColorPreferencesOrch,
  setWebullTabPreferencesOrch,
  type ExplorerFolderColorPreferenceBlock,
  readVaultUiPreferencesOrch,
  setExplorerIconStylePreferenceOrch,
  type ExplorerIconStyleBlock,
} from './services/orchestrators/vaultUiPreferencesOrch'
import {
  shouldCloseDrawerFromSwipeBlock,
  shouldIgnoreEdgeSwipeFromTargetBlock,
  shouldOpenDrawerFromSwipeBlock,
  shouldStartEdgeSwipeOpenBlock,
} from '@/services/lego_blocks/units/uiGestureBlock'
import {
  dispatchThinkingSpaceGoogleWorkspaceToggleExplorerBlock,
  dispatchThinkingSpaceGoogleWorkspaceToggleHeaderBlock,
  THINKING_SPACE_GOOGLE_WORKSPACE_CHROME_STATE_EVENT_BLOCK,
  type ThinkingSpaceGoogleWorkspaceChromeStateBlock,
} from '@/services/lego_blocks/units/thinkingSpaceGoogleWorkspaceChromeBlock'
import {
  CHAT_SIDEBAR_CHROME_STATE_EVENT_BLOCK,
  dispatchChatSidebarChromeToggleBlock,
  dispatchChatSidebarChromeToggleHeaderBlock,
  type ChatSidebarChromeStateBlock,
} from '@/services/lego_blocks/units/chatSidebarChromeBlock'
import {
  WEB_SIDEBAR_CHROME_STATE_EVENT_BLOCK,
  NEW_THOUGHT_SIDEBAR_CHROME_STATE_EVENT_BLOCK,
  dispatchWebSidebarChromeToggleBlock,
  dispatchWebSidebarChromeToggleHeaderBlock,
  dispatchNewThoughtSidebarChromeToggleBlock,
  type WebSidebarChromeStateBlock,
} from '@/services/lego_blocks/units/webSidebarChromeBlock'
import {
  ORGANIZER_SIDEBAR_CHROME_STATE_EVENT_BLOCK,
  dispatchOrganizerSidebarChromeToggleBlock,
  dispatchOrganizerSidebarChromeToggleHeaderBlock,
  type OrganizerSidebarChromeStateBlock,
} from '@/services/lego_blocks/units/organizerSidebarChromeBlock'
import {
  Webull_SIDEBAR_CHROME_STATE_EVENT_BLOCK,
  dispatchWebullSidebarChromeToggleBlock,
  type WebullSidebarChromeStateBlock,
} from '@/personal_extension/services/lego_blocks/units/webullSidebarChromeBlock'
import {
  captureUnhandledRejectionReportBlock,
  captureWindowErrorReportBlock,
  createRuntimeErrorReportBlock,
  formatRuntimeErrorReportForClipboardBlock,
  formatRuntimeErrorReportsForClipboardBlock,
  type RuntimeErrorReportBlock,
} from '@/services/lego_blocks/units/runtimeErrorBlock'
import { consumeRecentExcalidrawCrashMarkerBlock } from '@/services/lego_blocks/units/excalidrawCrashMarkerBlock'
import { folderPickerPluginBlock } from '@/services/lego_blocks/units/folderPickerPluginBlock'

type NavIcon = ComponentType<{ className?: string }>

interface NavItem {
  to: string
  label: string
  icon: NavIcon
  activePaths?: string[]
}

interface CommandItem {
  to: string
  label: string
  group: 'Core' | 'Workspace' | 'Excalidraw++' | 'Files'
  activePaths?: string[]
  keywords?: string
  description?: string
}

interface AppWorkspaceTab {
  id: string
  route: string
  label?: string
}

interface SyncRunSummary {
  mode: 'sync' | 'rebuild'
  finishedAt: number
  result?: SyncResult
  error?: string
}

interface GitActionSummary {
  mode: 'commit' | 'push'
  finishedAt: number
  message?: string
  error?: string
}

interface SyncPanelAnchor {
  top: number
  right: number
}

function sameRuntimeErrorReport(left: RuntimeErrorReportBlock, right: RuntimeErrorReportBlock): boolean {
  return left.source === right.source
    && left.title === right.title
    && left.message === right.message
    && left.detail === right.detail
    && left.stack === right.stack
    && left.componentStack === right.componentStack
    && left.location === right.location
}

function formatRuntimeErrorDebugDetailsBlock(report: RuntimeErrorReportBlock): string {
  const sections = [
    `Title: ${report.title}`,
    report.location ? `Route: ${report.location}` : null,
    `Captured: ${new Date(report.capturedAt).toLocaleString()}`,
    '',
    report.detail,
    report.stack ? `\nStack:\n${report.stack}` : null,
    report.componentStack ? `\nComponent Stack:\n${report.componentStack}` : null,
  ]
  return sections
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join('\n')
}

function formatSyncTimestamp(value: number | null): string {
  if (!value) return 'none yet'
  return new Date(value).toLocaleString()
}

const PRIMARY_NAV_ITEMS: NavItem[] = [
  { to: '/thinking-space', label: 'Thinking Space', icon: Compass },
  { to: '/new-thought', label: 'New Note', icon: PlusSquare },
  { to: '/git-insights', label: 'Insights', icon: GitBranch },
  { to: '/chat', label: 'AI', icon: AINavIcon },
  { to: '/password-manager', label: 'Passwords', icon: KeyRound },
  { to: '/web', label: 'Web', icon: WebNavIcon },
  { to: '/webull', label: 'Webull', icon: WebullNavIcon },
  {
    to: '/thinking-organizer',
    label: 'Thinking Organizer',
    icon: FolderKanban,
    activePaths: ['/file-organizer'],
  },
]

function ExcalidrawPlusIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`${className} inline-block`}
      style={{
        backgroundColor: 'currentColor',
        maskImage: `url(${excalidrawLogo})`,
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        maskSize: 'contain',
        WebkitMaskImage: `url(${excalidrawLogo})`,
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        WebkitMaskSize: 'contain',
      }}
    />
  )
}

function WebullNavIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 70" className={className} fill="currentColor" aria-hidden="true">
      <path d="M4 8 C4 72 96 72 96 8 C72 52 28 52 4 8 Z" />
    </svg>
  )
}

function WebullTextNavIcon({ text, className = 'h-4 w-4' }: { text: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`${className} inline-flex items-center justify-center text-[10px] font-semibold leading-none tracking-tight`}>
      {text}
    </span>
  )
}

function AINavIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`${className} inline-flex items-center justify-center text-[10px] font-semibold leading-none tracking-tight`}>
      AI
    </span>
  )
}

function WebNavIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`${className} inline-flex items-center justify-center text-[10px] font-semibold leading-none tracking-tight`}>
      web
    </span>
  )
}

const EXCALIDRAW_NAV_ITEM: NavItem = {
  to: EXCALIDRAW_PLUS_ROOT_ROUTE,
  label: 'Excalidraw++',
  icon: ExcalidrawPlusIcon,
  activePaths: EXCALIDRAW_PLUS_TOOL_ROUTES.flatMap(tool => [tool.route, tool.legacyRoute]),
}

function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (pathname === item.to) return true
  return (item.activePaths ?? []).includes(pathname)
}

function createWorkspaceTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeTabRoute(route: string): string {
  const trimmed = route.trim()
  if (!trimmed) return '/'
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function parseTabRoute(route: string): { pathname: string; search: URLSearchParams } {
  try {
    const parsed = new URL(normalizeTabRoute(route), 'https://ltm.local')
    return { pathname: parsed.pathname, search: parsed.searchParams }
  } catch {
    return { pathname: '/', search: new URLSearchParams() }
  }
}

function toTitleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(part => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ')
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function getTabLabel(route: string, labelByPath: Map<string, string>, chatLabel?: string, webLabel?: string, webullLabel?: string, webSiteLabels?: Record<string, string>): string {
  const { pathname, search } = parseTabRoute(route)
  if (pathname === '/thinking-space') {
    const filePath = search.get('file')?.trim()
    if (filePath) {
      const name = safeDecodeURIComponent(filePath).split('/').filter(Boolean).pop() || 'File'
      return `Space · ${name}`
    }
  }

  if (pathname === '/thinking-organizer' || pathname === '/file-organizer') {
    const tab = search.get('tab')?.trim()
    if (tab) return `Organizer · ${toTitleCase(tab)}`
  }

  if (pathname === '/chat' && chatLabel) return chatLabel

  if (pathname === '/web') {
    const siteId = search.get('site')
    if (siteId && webSiteLabels) {
      const siteName = webSiteLabels[siteId]
      if (siteName) return `Web · ${siteName}`
    }
    if (webLabel) return webLabel
  }

  if (pathname === '/webull' && webullLabel) return webullLabel


  return labelByPath.get(pathname) ?? 'Workspace'
}

function buildThinkingSpaceFileRoute(path: string): string {
  return `/thinking-space?file=${encodeURIComponent(path)}`
}

function escapeCssAttrValueBlock(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
}

function buildExplorerFolderColorCssBlock(rules: ExplorerFolderColorPreferenceBlock[]): string {
  if (!Array.isArray(rules) || rules.length === 0) return ''
  const blocks: string[] = []
  for (const rule of rules) {
    const path = rule.folderPath.trim()
    const color = rule.color.trim()
    if (!path || !color) continue
    const escapedPath = escapeCssAttrValueBlock(path)
    const selectors = [
      `.ltm-app-shell .ltm-explorer-folder-row[data-path="${escapedPath}"] .ltm-explorer-folder-icon`,
    ]
    if (rule.includeDescendants) {
      selectors.push(
        `.ltm-app-shell .ltm-explorer-folder-row[data-path^="${escapedPath}/"] .ltm-explorer-folder-icon`,
      )
    }
    blocks.push(`${selectors.join(',\n')} { color: ${color}; }`)
  }
  return blocks.join('\n')
}

function AppBrandGlyph({ className = 'h-[14px] w-[14px]' }: { className?: string }) {
  return (
    <img
      src={treeOfLifeLogo}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`${className} rounded-full object-cover`}
    />
  )
}

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const { layout } = useUILayoutBlock()
  const currentRoute = `${location.pathname}${location.search}${location.hash}`

  const featureFlags = getCapabilityFeatureFlags()
  const extensionBuilderEnabled = featureFlags.extension_host_enabled && featureFlags.extension_builder_enabled
  const gitSyncToolsSupported = useMemo(() => isGitSyncToolsSupportedOrch(), [])

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = getStorageItem(STORAGE_KEYS.appShellSidebarCollapsed)
    if (stored === null) return true
    return stored === '1'
  })
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const [commandFileItems, setCommandFileItems] = useState<CommandItem[]>([])
  const [commandFilesLastLoadedAt, setCommandFilesLastLoadedAt] = useState(0)
  const [explorerIconStyle, setExplorerIconStyle] = useState<ExplorerIconStyleBlock>('outline')
  const [explorerFolderColorRules, setExplorerFolderColorRules] = useState<ExplorerFolderColorPreferenceBlock[]>([])
  const [refreshRunning, setRefreshRunning] = useState(false)
  const [thinkingSpaceGoogleWorkspaceChromeState, setThinkingSpaceGoogleWorkspaceChromeState] = useState<ThinkingSpaceGoogleWorkspaceChromeStateBlock>({
    enabled: false,
    explorerCollapsed: false,
    headerVisible: true,
    showHeaderToggle: false,
  })
  const [chatSidebarChromeState, setChatSidebarChromeState] = useState<ChatSidebarChromeStateBlock>({
    enabled: false,
    collapsed: false,
    headerVisible: true,
    showHeaderToggle: false,
    label: 'AI',
  })
  const [webullTabLabel, setWebullTabLabel] = useState('Webull')
  const [webullTabIconText, setWebullTabIconText] = useState('')
  const [webSidebarChromeState, setWebSidebarChromeState] = useState<WebSidebarChromeStateBlock>({
    enabled: false,
    collapsed: false,
    headerVisible: true,
    showHeaderToggle: false,
    label: 'Web',
    siteLabels: undefined,
  })
  const [organizerSidebarChromeState, setOrganizerSidebarChromeState] = useState<OrganizerSidebarChromeStateBlock>({
    enabled: false,
    collapsed: false,
    label: 'Organizer',
    headerVisible: true,
    showHeaderToggle: false,
  })
  const [webullSidebarChromeState, setWebullSidebarChromeState] = useState<WebullSidebarChromeStateBlock>({
    enabled: false,
    collapsed: false,
    label: 'webull',
  })
  const [newThoughtSidebarChromeState, setNewThoughtSidebarChromeState] = useState({ enabled: false, collapsed: false })
  const [syncPanelOpen, setSyncPanelOpen] = useState(false)
  const [syncActionRunning, setSyncActionRunning] = useState<'sync' | 'rebuild' | null>(null)
  const [gitActionRunning, setGitActionRunning] = useState<'commit' | 'push' | null>(null)
  const [syncToolsWidth, setSyncToolsWidth] = useState(96)
  const [topChromeMenuWidth, setTopChromeMenuWidth] = useState(0)
  const [syncPanelAnchor, setSyncPanelAnchor] = useState<SyncPanelAnchor>({ top: 52, right: 12 })
  const [lastSyncedAt, setLastSyncedAt] = useState(() => getLastSyncTimestamp())
  const [lastSyncAttemptAt, setLastSyncAttemptAt] = useState<number | null>(null)
  const [lastSyncSummary, setLastSyncSummary] = useState<SyncRunSummary | null>(null)
  const [lastGitCommitAt, setLastGitCommitAt] = useState<number | null>(null)
  const [lastGitPushAt, setLastGitPushAt] = useState<number | null>(null)
  const [lastGitActionSummary, setLastGitActionSummary] = useState<GitActionSummary | null>(null)
  const [gitCommitDialogOpen, setGitCommitDialogOpen] = useState(false)
  const [gitCommitMessageDraft, setGitCommitMessageDraft] = useState('')
  const [runtimeErrorReports, setRuntimeErrorReports] = useState<RuntimeErrorReportBlock[]>([])
  const [runtimeErrorCopiedToken, setRuntimeErrorCopiedToken] = useState<string | null>(null)
  const [debugPanelOpen, setDebugPanelOpen] = useState(false)
  const [debugLogEntries, setDebugLogEntries] = useState<DebugLogEntryBlock[]>([])
  const [debugToast, setDebugToast] = useState<DebugLogEntryBlock | null>(null)
  const [debugUnreadCount, setDebugUnreadCount] = useState(0)
  const debugToastTimerRef = useRef<number | null>(null)
  const commandInputRef = useRef<HTMLInputElement | null>(null)
  const gitCommitMessageInputRef = useRef<HTMLInputElement | null>(null)
  const syncToolsRef = useRef<HTMLDivElement | null>(null)
  const topChromeMenuRef = useRef<HTMLDivElement | null>(null)
  const syncPanelRef = useRef<HTMLDivElement | null>(null)
  const syncToggleButtonRef = useRef<HTMLButtonElement | null>(null)
  const appShellRef = useRef<HTMLDivElement | null>(null)
  const mainContentRef = useRef<HTMLElement | null>(null)
  const scrollbarActivityTimeoutRef = useRef<number | null>(null)
  const pendingWorkspaceTabNavigationRef = useRef<{ tabId: string; route: string } | null>(null)
  const drawerEdgeSwipeStartRef = useRef<{ x: number; y: number } | null>(null)
  const drawerPanelSwipeStartRef = useRef<{ x: number; y: number } | null>(null)
  const runtimeErrorCopyResetTimeoutRef = useRef<number | null>(null)
  const [vaultSwitchHardRefreshPending, setVaultSwitchHardRefreshPending] = useState(false)
  const [needsVaultSetup, setNeedsVaultSetup] = useState(() => {
    const stored = getStoredVaultRoot()
    if (!stored) return true
    // On Capacitor, reject stale absolute paths from older versions
    if (isCapacitorNative() && stored.startsWith('/')) return true
    return false
  })
  const [workspaceTabs, setWorkspaceTabs] = useState<AppWorkspaceTab[]>(() => {
    const savedTabs = getJsonStorageItem<AppWorkspaceTab[]>(STORAGE_KEYS.appShellTabs, [])
      .filter((candidate) => (
        !!candidate
        && typeof candidate.id === 'string'
        && typeof candidate.route === 'string'
        && candidate.id.trim().length > 0
        && candidate.route.trim().length > 0
      ))
      .slice(0, 24)
      .map((candidate) => ({
        id: candidate.id.trim(),
        route: normalizeTabRoute(candidate.route),
        label: typeof candidate.label === 'string' && candidate.label.trim().length > 0
          ? candidate.label.trim()
          : undefined,
      }))

    if (savedTabs.length > 0) return savedTabs

    return [{ id: createWorkspaceTabId(), route: normalizeTabRoute(currentRoute) }]
  })
  const [activeWorkspaceTabId, setActiveWorkspaceTabId] = useState(
    () => getStorageItem(STORAGE_KEYS.appShellActiveTabId) ?? '',
  )
  const [persistentChatTabIds, setPersistentChatTabIds] = useState<string[]>(
    () => workspaceTabs
      .filter((tab) => parseTabRoute(tab.route).pathname === '/chat')
      .map((tab) => tab.id),
  )
  const [persistentWebTabIds, setPersistentWebTabIds] = useState<string[]>(
    () => workspaceTabs
      .filter((tab) => parseTabRoute(tab.route).pathname === '/web')
      .map((tab) => tab.id),
  )
  const [persistentWebSiteIdByTabId, setPersistentWebSiteIdByTabId] = useState<Record<string, string | null>>(
    () => Object.fromEntries(
      workspaceTabs.map((tab) => {
        const parsed = parseTabRoute(tab.route)
        return [tab.id, parsed.pathname === '/web' ? parsed.search.get('site') : null]
      }),
    ),
  )
  const [persistentRouteMounts, setPersistentRouteMounts] = useState(() => ({
    organizer: location.pathname === '/thinking-organizer' || location.pathname === '/file-organizer',
    newThought: location.pathname === '/new-thought',
  }))
  const showGoogleWorkspaceChromeControls = location.pathname === '/thinking-space'
    && thinkingSpaceGoogleWorkspaceChromeState.enabled
  const showChatSidebarChromeControl = location.pathname === '/chat'
    && chatSidebarChromeState.enabled
  const showChatHeaderToggle = showChatSidebarChromeControl && chatSidebarChromeState.showHeaderToggle
  const showWebSidebarChromeControl = location.pathname === '/web' && webSidebarChromeState.enabled
  const showWebHeaderToggle = showWebSidebarChromeControl && webSidebarChromeState.showHeaderToggle
  const showOrganizerSidebarChromeControl = (location.pathname === '/thinking-organizer' || location.pathname === '/file-organizer')
    && organizerSidebarChromeState.enabled
  const showOrganizerHeaderToggle = showOrganizerSidebarChromeControl && organizerSidebarChromeState.showHeaderToggle
  const showWebullSidebarChromeControl = location.pathname === '/webull' && webullSidebarChromeState.enabled
  const showNewThoughtSidebarChromeControl = location.pathname === '/new-thought' && newThoughtSidebarChromeState.enabled
  // On Capacitor, each of these tabs owns its own edge-swipe gesture.
  // Suppress the global nav-drawer swipe so they don't conflict.
  const tabOwnsSidebarSwipe = showGoogleWorkspaceChromeControls
    || showChatSidebarChromeControl
    || showWebSidebarChromeControl
    || showOrganizerSidebarChromeControl
    || showWebullSidebarChromeControl
    || showNewThoughtSidebarChromeControl
  const isElectronDesktopSurface = layout.surface === 'electron' && layout.mode === 'desktop'
  const isMacDesktopSurface = isElectronDesktopSurface
    && typeof navigator !== 'undefined'
    && /(Mac|iPhone|iPad|iPod)/i.test(navigator.platform || navigator.userAgent || '')
  const showLeftAlignedGoogleWorkspaceChromeControls = showGoogleWorkspaceChromeControls && isElectronDesktopSurface
  const showRightAlignedGoogleWorkspaceChromeControls = showGoogleWorkspaceChromeControls
    && !showLeftAlignedGoogleWorkspaceChromeControls
    && layout.surface !== 'capacitor-ios'
    && layout.surface !== 'capacitor-android'
  const showThinkingSpaceHeaderToggle = showGoogleWorkspaceChromeControls
    && thinkingSpaceGoogleWorkspaceChromeState.showHeaderToggle
  const isChatRoute = location.pathname === '/chat'
  const isWebRoute = location.pathname === '/web'
  const isOrganizerRoute = location.pathname === '/thinking-organizer' || location.pathname === '/file-organizer'
  const isNewThoughtRoute = location.pathname === '/new-thought'
  const usesPersistentRouteSurface = isChatRoute || isWebRoute || isOrganizerRoute || isNewThoughtRoute

  const resolvedWebullIcon = useMemo(() => {
    if (!webullTabIconText) return WebullNavIcon
    const text = webullTabIconText
    return function ResolvedWebullTextIcon({ className = 'h-4 w-4' }: { className?: string }) {
      return <WebullTextNavIcon text={text} className={className} />
    }
  }, [webullTabIconText])

  const primaryNavItems = useMemo(
    () => PRIMARY_NAV_ITEMS.map(item =>
      item.to === '/webull'
        ? { ...item, label: webullTabLabel, icon: resolvedWebullIcon }
        : item,
    ),
    [webullTabLabel, resolvedWebullIcon],
  )
  const coreNavItems = useMemo(
    () => primaryNavItems.filter(item => item.to !== '/password-manager'),
    [primaryNavItems],
  )
  const passwordNavItem = useMemo(
    () => primaryNavItems.find(item => item.to === '/password-manager') ?? { to: '/password-manager', label: 'Passwords', icon: KeyRound },
    [primaryNavItems],
  )

  const utilityNavItems = useMemo(() => {
    const items: NavItem[] = [
      { to: '/terminal', label: 'Terminal', icon: Terminal },
      { to: '/settings', label: 'Settings', icon: SettingsIcon },
      { to: '/capabilities', label: 'Capabilities', icon: Bot },
    ]
    if (extensionBuilderEnabled) {
      items.splice(1, 0, { to: '/extension-builder', label: 'Extension Builder', icon: Sparkles })
    }
    return items
  }, [extensionBuilderEnabled])

  const baseCommandItems = useMemo<CommandItem[]>(() => ([
    { to: '/', label: 'Home', group: 'Core', keywords: 'dashboard start' },
    ...primaryNavItems.map(item => ({
      to: item.to,
      label: item.label,
      group: 'Core' as const,
      activePaths: item.activePaths,
      keywords: (item.activePaths ?? []).join(' '),
    })),
    ...utilityNavItems.map(item => ({
      to: item.to,
      label: item.label,
      group: 'Workspace' as const,
      activePaths: item.activePaths,
    })),
    {
      to: EXCALIDRAW_NAV_ITEM.to,
      label: EXCALIDRAW_NAV_ITEM.label,
      group: 'Excalidraw++' as const,
      activePaths: EXCALIDRAW_NAV_ITEM.activePaths,
    },
    ...EXCALIDRAW_PLUS_TOOL_ROUTES.map(tool => ({
      to: tool.route,
      label: tool.label,
      group: 'Excalidraw++' as const,
      activePaths: [tool.legacyRoute],
    })),
  ]), [primaryNavItems, utilityNavItems])

  const allCommandItems = useMemo<CommandItem[]>(
    () => [...baseCommandItems, ...commandFileItems],
    [baseCommandItems, commandFileItems],
  )

  const routeLabelByPath = useMemo(() => {
    const entries = new Map<string, string>()
    entries.set('/', 'Home')
    entries.set('/file-organizer', 'Thinking Organizer')
    baseCommandItems.forEach((item) => {
      entries.set(item.to, item.label)
    })
    return entries
  }, [baseCommandItems])

  const activeWorkspaceTab = useMemo(
    () => workspaceTabs.find(tab => tab.id === activeWorkspaceTabId) ?? null,
    [activeWorkspaceTabId, workspaceTabs],
  )

  const activeWorkspaceTabLabel = useMemo(
    () => getTabLabel(currentRoute, routeLabelByPath, chatSidebarChromeState.label, webSidebarChromeState.label, webullTabLabel, webSidebarChromeState.siteLabels),
    [currentRoute, routeLabelByPath, chatSidebarChromeState.label, webSidebarChromeState.label, webSidebarChromeState.siteLabels, webullTabLabel],
  )
  const renderedPersistentChatTabIds = useMemo(
    () => (isChatRoute && activeWorkspaceTabId && !persistentChatTabIds.includes(activeWorkspaceTabId)
      ? [...persistentChatTabIds, activeWorkspaceTabId]
      : persistentChatTabIds),
    [activeWorkspaceTabId, isChatRoute, persistentChatTabIds],
  )
  const renderedPersistentWebTabIds = useMemo(
    () => (isWebRoute && activeWorkspaceTabId && !persistentWebTabIds.includes(activeWorkspaceTabId)
      ? [...persistentWebTabIds, activeWorkspaceTabId]
      : persistentWebTabIds),
    [activeWorkspaceTabId, isWebRoute, persistentWebTabIds],
  )

  const workspaceTabItems = useMemo<AppWorkspaceTabBlockModel[]>(
    () => workspaceTabs.map(tab => ({
      id: tab.id,
      label: tab.id === activeWorkspaceTabId
        ? activeWorkspaceTabLabel
        : (typeof tab.label === 'string' && tab.label.trim().length > 0
            ? tab.label
            : getTabLabel(tab.route, routeLabelByPath, chatSidebarChromeState.label, webSidebarChromeState.label, webullTabLabel, webSidebarChromeState.siteLabels)),
    })),
    [activeWorkspaceTabId, activeWorkspaceTabLabel, routeLabelByPath, workspaceTabs, chatSidebarChromeState.label, webSidebarChromeState.label, webSidebarChromeState.siteLabels, webullTabLabel],
  )

  const shell = useMemo(() => deriveAdaptiveShellStateOrch(layout), [layout])
  const keyboardVisible = layout.keyboardVisible
  const forceCompactNavForIosKeyboard = layout.surface === 'capacitor-ios' && keyboardVisible
  const compactNav = shell.compactNav || forceCompactNavForIosKeyboard
  const showBottomNav = false
  const phoneMode = layout.mode === 'phone'
  const iPhoneMode = layout.surface === 'capacitor-ios' && phoneMode
  const useNativeTopChrome = iPhoneMode
  const iPhoneUserAgent = typeof navigator !== 'undefined' && /iPhone/i.test(navigator.userAgent || '')
  const iPhoneHandsetMode = phoneMode && (iPhoneMode || iPhoneUserAgent)
  const isCapacitorSurface = layout.surface === 'capacitor-ios' || layout.surface === 'capacitor-android'
  const showCapacitorTopChromeMenu = compactNav && !drawerOpen && isCapacitorSurface && !useNativeTopChrome
  const googleWorkspaceChromeLeftOffsetPx = isMacDesktopSurface ? 88 : 8
  const leftGoogleWorkspaceChromeControlsWidthPx = showLeftAlignedGoogleWorkspaceChromeControls
    ? googleWorkspaceChromeLeftOffsetPx + 76
    : 0
  const topChromeLeftWidth = showCapacitorTopChromeMenu
    ? Math.max(phoneMode ? 42 : 96, topChromeMenuWidth)
    : leftGoogleWorkspaceChromeControlsWidthPx
  const topChromeRightWidth = Math.max(phoneMode ? 86 : 120, syncToolsWidth)
  const topChromeBalancedWidth = Math.max(120, topChromeLeftWidth, topChromeRightWidth)
  const topChromePaddingLeft = phoneMode ? topChromeLeftWidth : topChromeBalancedWidth
  const topChromePaddingRight = phoneMode ? topChromeRightWidth : topChromeBalancedWidth
  const topInset = shell.topInset
  const rightInset = shell.rightInset
  const bottomInset = shell.bottomInset
  const leftInset = shell.leftInset
  const drawerBottomInset = shell.drawerBottomInset
  const shouldUsePhoneSafeBottomPadding = layout.surface === 'capacitor-ios' && layout.mode === 'phone' && !keyboardVisible
  const mainBottomPadding = keyboardVisible
    ? Math.max(0, Math.round(layout.keyboardInset))
    : (shouldUsePhoneSafeBottomPadding ? Math.max(bottomInset, 14) : 0)
  const routeOwnsMainScroll = !isChatRoute && !isWebRoute
  const mainStageStyle = useMemo<CSSProperties | undefined>(() => {
    const style: CSSProperties = {}
    if (mainBottomPadding) {
      style.paddingBottom = `${mainBottomPadding}px`
    }
    if (!routeOwnsMainScroll) {
      style.overflowY = 'hidden'
    }
    return Object.keys(style).length > 0 ? style : undefined
  }, [mainBottomPadding, routeOwnsMainScroll])
  const commandPaletteTopPadding = Math.max(80, topInset + 56)
  const commandPaletteBottomPadding = Math.max(16, bottomInset + 12)
  const compactDrawerBaseOffset = layout.surface === 'capacitor-ios' ? 24 : 16
  const compactDrawerTriggerBottom = Math.max(
    bottomInset + (showBottomNav ? 72 : compactDrawerBaseOffset),
    compactDrawerBaseOffset,
  )
  const compactDrawerTriggerLeft = Math.max(16, leftInset + 16)
  const excalidrawGroupActive = useMemo(
    () => isExcalidrawPlusRoute(location.pathname),
    [location.pathname],
  )
  const shellSafeAreaVars = useMemo<CSSProperties>(() => ({
    '--ltm-safe-top': `${topInset}px`,
    '--ltm-safe-right': `${rightInset}px`,
    '--ltm-safe-bottom': `${bottomInset}px`,
    '--ltm-safe-left': `${leftInset}px`,
  }) as CSSProperties, [bottomInset, leftInset, rightInset, topInset])
  const explorerFolderColorCss = useMemo(
    () => buildExplorerFolderColorCssBlock(explorerFolderColorRules),
    [explorerFolderColorRules],
  )

  const pushRuntimeErrorReport = useCallback((report: RuntimeErrorReportBlock) => {
    setRuntimeErrorReports((prev) => {
      if (prev.some(existing => sameRuntimeErrorReport(existing, report))) return prev
      dispatchDebugLogBlock({
        level: 'error',
        message: report.message,
        details: formatRuntimeErrorDebugDetailsBlock(report),
        stack: report.stack ?? report.componentStack ?? undefined,
        source: `runtime:${report.source}`,
      })
      return [report, ...prev].slice(0, 12)
    })
  }, [])

  const copyRuntimeErrorText = useCallback(async (text: string, token: string) => {
    try {
      await copyTextToClipboard(text)
      setRuntimeErrorCopiedToken(token)
      if (runtimeErrorCopyResetTimeoutRef.current !== null) {
        window.clearTimeout(runtimeErrorCopyResetTimeoutRef.current)
      }
      runtimeErrorCopyResetTimeoutRef.current = window.setTimeout(() => {
        setRuntimeErrorCopiedToken((current) => (current === token ? null : current))
        runtimeErrorCopyResetTimeoutRef.current = null
      }, 2200)
    } catch (error) {
      pushRuntimeErrorReport(createRuntimeErrorReportBlock(error, {
        source: 'clipboard',
        title: 'Failed to copy runtime error',
        location: currentRoute,
      }))
    }
  }, [currentRoute, pushRuntimeErrorReport])

  const handleCopyRuntimeErrorReport = useCallback((reportId: string) => {
    const report = runtimeErrorReports.find((candidate) => candidate.id === reportId)
    if (!report) return
    void copyRuntimeErrorText(formatRuntimeErrorReportForClipboardBlock(report), report.id)
  }, [copyRuntimeErrorText, runtimeErrorReports])

  const handleCopyAllRuntimeErrors = useCallback(() => {
    if (runtimeErrorReports.length === 0) return
    void copyRuntimeErrorText(formatRuntimeErrorReportsForClipboardBlock(runtimeErrorReports), 'all')
  }, [copyRuntimeErrorText, runtimeErrorReports])

  const handleDismissRuntimeErrorReport = useCallback((reportId: string) => {
    setRuntimeErrorReports(prev => prev.filter(report => report.id !== reportId))
    setRuntimeErrorCopiedToken(prev => (prev === reportId ? null : prev))
  }, [])

  const handleClearRuntimeErrors = useCallback(() => {
    setRuntimeErrorReports([])
    setRuntimeErrorCopiedToken(null)
  }, [])

  const handleFatalRuntimeError = useCallback((report: RuntimeErrorReportBlock) => {
    pushRuntimeErrorReport(report)
  }, [pushRuntimeErrorReport])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const viewportMeta = document.querySelector('meta[name="viewport"]')
    if (!(viewportMeta instanceof HTMLMetaElement)) return
    const defaultViewport = 'width=device-width, initial-scale=1.0, viewport-fit=cover'
    if (!iPhoneHandsetMode) {
      viewportMeta.setAttribute('content', defaultViewport)
      return
    }
    viewportMeta.setAttribute(
      'content',
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover',
    )
    return () => {
      viewportMeta.setAttribute('content', defaultViewport)
    }
  }, [iPhoneHandsetMode])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!isElectronDesktopSurface) return

    const htmlElement = document.documentElement
    const bodyElement = document.body
    const rootElement = document.getElementById('root')
    const previousHtmlBackground = htmlElement.style.backgroundColor
    const previousBodyBackground = bodyElement.style.backgroundColor
    const previousRootBackground = rootElement?.style.backgroundColor ?? ''

    htmlElement.style.backgroundColor = 'transparent'
    bodyElement.style.backgroundColor = 'transparent'
    if (rootElement) rootElement.style.backgroundColor = 'transparent'

    return () => {
      htmlElement.style.backgroundColor = previousHtmlBackground
      bodyElement.style.backgroundColor = previousBodyBackground
      if (rootElement) rootElement.style.backgroundColor = previousRootBackground
    }
  }, [isElectronDesktopSurface])

  useEffect(() => {
    return () => {
      if (runtimeErrorCopyResetTimeoutRef.current !== null) {
        window.clearTimeout(runtimeErrorCopyResetTimeoutRef.current)
        runtimeErrorCopyResetTimeoutRef.current = null
      }
      if (debugToastTimerRef.current !== null) {
        window.clearTimeout(debugToastTimerRef.current)
        debugToastTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const handleWindowError = (event: Event) => {
      pushRuntimeErrorReport(captureWindowErrorReportBlock(event, currentRoute))
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      pushRuntimeErrorReport(captureUnhandledRejectionReportBlock(event, currentRoute))
    }

    window.addEventListener('error', handleWindowError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleWindowError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [currentRoute, pushRuntimeErrorReport])

  useEffect(() => {
    const marker = consumeRecentExcalidrawCrashMarkerBlock()
    if (!marker) return
    pushRuntimeErrorReport(createRuntimeErrorReportBlock(
      new Error(
        `Excalidraw edit mode exited unexpectedly while opening "${marker.path}" during stage "${marker.stage}". ` +
        'The app appears to have restarted before the editor finished stabilizing.'
      ),
      {
        source: 'session-recovery',
        title: 'Excalidraw edit mode exited unexpectedly',
        location: marker.path,
      },
    ))
  }, [pushRuntimeErrorReport])

  // Install console intercept + subscribe to debug log events
  useEffect(() => {
    installConsoleInterceptBlock()
    return addDebugLogListenerBlock((entry) => {
      setDebugLogEntries(prev => [...prev, entry].slice(-500))
      if (entry.level === 'error' || entry.level === 'warn') {
        setDebugUnreadCount(prev => prev + 1)
        setDebugToast(entry)
        if (debugToastTimerRef.current !== null) window.clearTimeout(debugToastTimerRef.current)
        debugToastTimerRef.current = window.setTimeout(() => {
          setDebugToast(null)
          debugToastTimerRef.current = null
        }, 5000)
      }
    })
  }, [])

  const openDebugPanel = useCallback(() => {
    setDebugPanelOpen(true)
    setDebugUnreadCount(0)
    setDebugToast(null)
    if (debugToastTimerRef.current !== null) {
      window.clearTimeout(debugToastTimerRef.current)
      debugToastTimerRef.current = null
    }
  }, [])

  const openCommandPalette = useCallback(() => {
    setCommandQuery('')
    setCommandPaletteOpen(true)
  }, [])

  const closeCommandPalette = useCallback(() => {
    setCommandPaletteOpen(false)
  }, [])

  const ensureCommandFilesLoaded = useCallback(async () => {
    if (needsVaultSetup) return
    if (Date.now() - commandFilesLastLoadedAt < 20_000) return
    const entries = await listMarkdownEntries()
    const seen = new Set<string>()
    const fileItems: CommandItem[] = []
    for (const entry of entries) {
      const path = entry.path.trim()
      if (!path || seen.has(path)) continue
      seen.add(path)
      const fileName = path.split('/').pop() || path
      const label = fileName.replace(/\.md$/i, '')
      fileItems.push({
        to: buildThinkingSpaceFileRoute(path),
        label,
        description: path,
        group: 'Files',
        keywords: `file note markdown ${path}`,
      })
    }
    setCommandFileItems(fileItems)
    setCommandFilesLastLoadedAt(Date.now())
  }, [commandFilesLastLoadedAt, needsVaultSetup])

  const handleExplorerIconStyleChange = useCallback((nextStyle: ExplorerIconStyleBlock) => {
    setExplorerIconStyle(nextStyle)
    void setExplorerIconStylePreferenceOrch(nextStyle).catch((error) => {
      console.warn('[App] Failed to persist explorer icon style preference:', error)
    })
  }, [])

  const handleExplorerFolderColorRulesChange = useCallback(async (
    nextRules: ExplorerFolderColorPreferenceBlock[],
  ) => {
    setExplorerFolderColorRules(nextRules)
    try {
      await setExplorerFolderColorPreferencesOrch(nextRules)
    } catch (error) {
      console.warn('[App] Failed to persist explorer folder color rules:', error)
      throw error
    }
  }, [])

  const handleWebullTabPreferencesChange = useCallback(async (label: string, iconText: string) => {
    const normalized = label.trim() || 'Webull'
    setWebullTabLabel(normalized)
    setWebullTabIconText(iconText.trim())
    try {
      await setWebullTabPreferencesOrch(normalized, iconText.trim())
    } catch (error) {
      console.warn('[App] Failed to persist Webull tab preferences:', error)
      throw error
    }
  }, [])

  const handleRequestVaultSwitch = useCallback(() => {
    setDrawerOpen(false)
    setCommandPaletteOpen(false)
    setVaultSwitchHardRefreshPending(true)
    setNeedsVaultSetup(true)
  }, [])

  useEffect(() => {
    if (needsVaultSetup) return
    void readUserProfileOrch().catch((error) => {
      console.warn('[App] Failed to warm user profile cache:', error)
    })
  }, [needsVaultSetup])

  useEffect(() => {
    if (!needsVaultSetup || !isElectron()) return
    if (vaultSwitchHardRefreshPending) return
    const persistedRoot = getStoredVaultRoot()?.trim()
    if (!persistedRoot) return
    setVaultRoot(persistedRoot)
    setNeedsVaultSetup(false)
  }, [needsVaultSetup, vaultSwitchHardRefreshPending])

  useEffect(() => {
    if (needsVaultSetup) {
      setLastGitCommitAt(null)
      setLastGitPushAt(null)
      return
    }

    const root = getStoredVaultRoot()
    const status = readGitSyncStatusOrch(root)
    setLastGitCommitAt(status.lastCommitAt)
    setLastGitPushAt(status.lastPushAt)
  }, [needsVaultSetup])

  const handleGlobalRefresh = useCallback(() => {
    if (refreshRunning) return
    setRefreshRunning(true)
    dispatchGlobalSyncRefreshBlock({
      source: 'topbar',
      requestedAt: Date.now(),
      vaultSyncAttempted: false,
      vaultSyncSucceeded: false,
    })
    window.setTimeout(() => setRefreshRunning(false), 500)
  }, [refreshRunning])

  const updateSyncPanelAnchor = useCallback(() => {
    const trigger = syncToggleButtonRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    setSyncPanelAnchor({
      top: Math.round(rect.bottom + 8),
      right: Math.max(10, Math.round(window.innerWidth - rect.right)),
    })
  }, [])

  useEffect(() => {
    const syncToolsNode = syncToolsRef.current
    if (!syncToolsNode) return

    const updateSyncToolsWidth = () => {
      setSyncToolsWidth(Math.ceil(syncToolsNode.getBoundingClientRect().width))
    }

    updateSyncToolsWidth()

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updateSyncToolsWidth())
      observer.observe(syncToolsNode)
      return () => observer.disconnect()
    }

    window.addEventListener('resize', updateSyncToolsWidth)
    return () => window.removeEventListener('resize', updateSyncToolsWidth)
  }, [])

  useEffect(() => {
    if (!showCapacitorTopChromeMenu) {
      setTopChromeMenuWidth(0)
      return
    }

    const menuNode = topChromeMenuRef.current
    if (!menuNode) return

    const updateMenuWidth = () => {
      setTopChromeMenuWidth(Math.ceil(menuNode.getBoundingClientRect().width))
    }

    updateMenuWidth()

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updateMenuWidth())
      observer.observe(menuNode)
      return () => observer.disconnect()
    }

    window.addEventListener('resize', updateMenuWidth)
    return () => window.removeEventListener('resize', updateMenuWidth)
  }, [showCapacitorTopChromeMenu])

  const runSyncAction = useCallback(async (mode: 'sync' | 'rebuild') => {
    if (needsVaultSetup || syncActionRunning) return
    setSyncActionRunning(mode)

    let syncSucceeded = false
    try {
      const result = mode === 'sync'
        ? await smartSync()
        : await fullSync()

      if (mode === 'rebuild') {
        if (result.errors.length === 0) {
          setLastSyncTimestamp()
        } else {
          setLastSyncTimestamp(0)
        }
      }

      setLastSyncedAt(getLastSyncTimestamp())
      setLastSyncAttemptAt(Date.now())
      setLastSyncSummary({
        mode,
        finishedAt: Date.now(),
        result,
      })
      syncSucceeded = result.errors.length === 0
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed.'
      setLastSyncSummary({
        mode,
        finishedAt: Date.now(),
        error: message,
      })
      setLastSyncAttemptAt(Date.now())
      console.error('Vault sync action failed', error)
    } finally {
      dispatchGlobalSyncRefreshBlock({
        source: 'topbar',
        requestedAt: Date.now(),
        vaultSyncAttempted: true,
        vaultSyncSucceeded: syncSucceeded,
      })
      setSyncActionRunning(null)
    }
  }, [needsVaultSetup, syncActionRunning])

  const openGitCommitDialog = useCallback(() => {
    if (needsVaultSetup || gitActionRunning || !gitSyncToolsSupported) return
    setGitCommitMessageDraft(`chore: sync checkpoint ${new Date().toLocaleString()}`)
    setGitCommitDialogOpen(true)
  }, [gitActionRunning, gitSyncToolsSupported, needsVaultSetup])

  useEffect(() => {
    if (!gitCommitDialogOpen) return
    const timeout = window.setTimeout(() => {
      gitCommitMessageInputRef.current?.focus()
      gitCommitMessageInputRef.current?.select()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [gitCommitDialogOpen])

  const runGitAction = useCallback(async (
    mode: 'commit' | 'push',
    commitMessageInput?: string | null,
  ) => {
    if (needsVaultSetup || gitActionRunning || !gitSyncToolsSupported) return

    let commitMessage: string | null = null
    if (mode === 'commit') {
      const trimmed = (commitMessageInput ?? '').trim()
      if (!trimmed) {
        setLastGitActionSummary({
          mode,
          finishedAt: Date.now(),
          error: 'Commit message cannot be empty.',
        })
        return
      }
      commitMessage = trimmed
    }

    setGitActionRunning(mode)
    setLastGitActionSummary(null)
    try {
      if (mode === 'commit') {
        if (!commitMessage) {
          throw new Error('Commit message cannot be empty.')
        }
        const result = await gitCommitAllOrch(commitMessage)
        if (result.committed) {
          setLastGitCommitAt(result.finishedAt)
        }
        setLastGitActionSummary({
          mode,
          finishedAt: result.finishedAt,
          message: result.message,
        })
        setGitCommitDialogOpen(false)
        return
      }

      const result = await gitPushOrch()
      setLastGitPushAt(result.finishedAt)
      setLastGitActionSummary({
        mode,
        finishedAt: result.finishedAt,
        message: result.message,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : `Git ${mode} failed.`
      setLastGitActionSummary({
        mode,
        finishedAt: Date.now(),
        error: message,
      })
      console.error(`Git ${mode} failed`, error)
    } finally {
      setGitActionRunning(null)
    }
  }, [gitActionRunning, gitSyncToolsSupported, needsVaultSetup])

  const runCommandItem = useCallback((item: CommandItem) => {
    setCommandPaletteOpen(false)
    setCommandQuery('')
    navigate(item.to)
  }, [navigate])

  useEffect(() => {
    setPersistentRouteMounts(prev => (
      prev.organizer === isOrganizerRoute
        && prev.newThought === isNewThoughtRoute
        ? prev
        : {
            organizer: prev.organizer || isOrganizerRoute,
            newThought: prev.newThought || isNewThoughtRoute,
          }
    ))
    if (!activeWorkspaceTabId) return

    if (isChatRoute) {
      setPersistentChatTabIds((prev) => (
        prev.includes(activeWorkspaceTabId) ? prev : [...prev, activeWorkspaceTabId]
      ))
    }

    if (isWebRoute) {
      const selectedSiteId = new URLSearchParams(location.search).get('site')
      setPersistentWebTabIds((prev) => (
        prev.includes(activeWorkspaceTabId) ? prev : [...prev, activeWorkspaceTabId]
      ))
      setPersistentWebSiteIdByTabId((prev) => (
        prev[activeWorkspaceTabId] === selectedSiteId
          ? prev
          : { ...prev, [activeWorkspaceTabId]: selectedSiteId }
      ))
    }
  }, [activeWorkspaceTabId, isChatRoute, isNewThoughtRoute, isOrganizerRoute, isWebRoute, location.search])

  const handleCreateWorkspaceTab = useCallback(() => {
    const tab: AppWorkspaceTab = {
      id: createWorkspaceTabId(),
      route: '/',
    }
    pendingWorkspaceTabNavigationRef.current = {
      tabId: tab.id,
      route: normalizeTabRoute(tab.route),
    }
    setWorkspaceTabs(prev => [...prev, tab])
    setActiveWorkspaceTabId(tab.id)
    navigate(tab.route)
  }, [navigate])

  const openNativeCreateSurface = useCallback(() => {
    handleCreateWorkspaceTab()
    navigate('/new-thought')
  }, [handleCreateWorkspaceTab, navigate])

  const handleSelectWorkspaceTab = useCallback((tabId: string) => {
    if (tabId === activeWorkspaceTabId) return
    const target = workspaceTabs.find(tab => tab.id === tabId)
    if (!target) return
    if (target.route !== currentRoute) {
      pendingWorkspaceTabNavigationRef.current = {
        tabId,
        route: normalizeTabRoute(target.route),
      }
    } else if (pendingWorkspaceTabNavigationRef.current?.tabId === tabId) {
      pendingWorkspaceTabNavigationRef.current = null
    }
    setActiveWorkspaceTabId(tabId)
    if (target.route !== currentRoute) {
      navigate(target.route)
    }
  }, [activeWorkspaceTabId, currentRoute, navigate, workspaceTabs])

  const handleCloseWorkspaceTab = useCallback((tabId: string) => {
    if (workspaceTabs.length <= 1) return
    if (pendingWorkspaceTabNavigationRef.current?.tabId === tabId) {
      pendingWorkspaceTabNavigationRef.current = null
    }
    const closeIndex = workspaceTabs.findIndex(tab => tab.id === tabId)
    if (closeIndex === -1) return
    const nextTabs = workspaceTabs.filter(tab => tab.id !== tabId)
    setWorkspaceTabs(nextTabs)
    if (tabId !== activeWorkspaceTabId) return
    const nextActive = nextTabs[Math.max(0, closeIndex - 1)] ?? nextTabs[0]
    if (!nextActive) return
    setActiveWorkspaceTabId(nextActive.id)
    if (nextActive.route !== currentRoute) {
      pendingWorkspaceTabNavigationRef.current = {
        tabId: nextActive.id,
        route: normalizeTabRoute(nextActive.route),
      }
      navigate(nextActive.route)
    }
  }, [activeWorkspaceTabId, currentRoute, navigate, workspaceTabs])

  const handlePersistentWebSiteSelect = useCallback((tabId: string, siteId: string) => {
    const nextSearch = new URLSearchParams()
    nextSearch.set('site', siteId)
    setPersistentWebTabIds((prev) => (
      prev.includes(tabId) ? prev : [...prev, tabId]
    ))
    setPersistentWebSiteIdByTabId((prev) => (
      prev[tabId] === siteId ? prev : { ...prev, [tabId]: siteId }
    ))
    if (tabId !== activeWorkspaceTabId) return
    navigate(`/web?${nextSearch.toString()}`, { replace: true })
  }, [activeWorkspaceTabId, navigate])

  const handleDrawerTouchStart = useCallback((event: React.TouchEvent<HTMLElement>) => {
    const touch = event.touches[0]
    if (!touch) return
    drawerPanelSwipeStartRef.current = { x: touch.clientX, y: touch.clientY }
  }, [])

  const handleDrawerTouchMove = useCallback((event: React.TouchEvent<HTMLElement>) => {
    const start = drawerPanelSwipeStartRef.current
    if (!start) return
    const touch = event.touches[0]
    if (!touch) return
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (shouldCloseDrawerFromSwipeBlock(deltaX, deltaY)) {
      drawerPanelSwipeStartRef.current = null
      setDrawerOpen(false)
    }
  }, [])

  const handleDrawerTouchEnd = useCallback(() => {
    drawerPanelSwipeStartRef.current = null
  }, [])

  // On mount, restore security-scoped bookmark for picker-selected Capacitor vaults
  useEffect(() => {
    if (needsVaultSetup || !isCapacitorNative()) return
    const stored = getStoredVaultRoot()
    if (!stored?.startsWith('cap-picker:')) return

    folderPickerPluginBlock.restoreBookmark().catch((err: unknown) => {
      console.warn('[App] Failed to restore bookmark, re-prompting vault setup:', err)
      setNeedsVaultSetup(true)
    })
  }, [needsVaultSetup])

  // On mount, try to restore a persisted BrowserVaultFS handle
  useEffect(() => {
    if (needsVaultSetup || isElectron() || isCapacitorNative()) return
    const storedRoot = getStoredVaultRoot()
    if (storedRoot !== 'browser-fs') return

    initBrowserVaultFS()
      .then((fs) => {
        if (fs) {
          setVaultFSInstance(fs)
        } else {
          // Permission denied or handle lost — re-prompt
          setNeedsVaultSetup(true)
        }
      })
      .catch(() => {
        setNeedsVaultSetup(true)
      })
  }, [needsVaultSetup])

  useEffect(() => {
    setDrawerOpen(false)
    setCommandPaletteOpen(false)
  }, [currentRoute])

  useEffect(() => {
    if (routeOwnsMainScroll) return
    const mainElement = mainContentRef.current
    if (!mainElement) return
    mainElement.scrollTop = 0
    mainElement.scrollLeft = 0
  }, [activeWorkspaceTabId, currentRoute, routeOwnsMainScroll])

  useEffect(() => {
    if (!compactNav) {
      setDrawerOpen(false)
    }
  }, [compactNav])

  useEffect(() => {
    if (!compactNav || drawerOpen || keyboardVisible || tabOwnsSidebarSwipe) {
      drawerEdgeSwipeStartRef.current = null
      return
    }

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch) return
      if (shouldIgnoreEdgeSwipeFromTargetBlock(event.target)) {
        drawerEdgeSwipeStartRef.current = null
        return
      }
      if (!shouldStartEdgeSwipeOpenBlock(touch.clientX)) return
      drawerEdgeSwipeStartRef.current = { x: touch.clientX, y: touch.clientY }
    }

    const handleTouchMove = (event: TouchEvent) => {
      const start = drawerEdgeSwipeStartRef.current
      if (!start) return
      const touch = event.touches[0]
      if (!touch) return
      const deltaX = touch.clientX - start.x
      const deltaY = touch.clientY - start.y
      if (shouldOpenDrawerFromSwipeBlock(deltaX, deltaY)) {
        drawerEdgeSwipeStartRef.current = null
        setDrawerOpen(true)
      }
    }

    const clearGesture = () => {
      drawerEdgeSwipeStartRef.current = null
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', clearGesture)
    window.addEventListener('touchcancel', clearGesture)

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', clearGesture)
      window.removeEventListener('touchcancel', clearGesture)
    }
  }, [compactNav, drawerOpen, keyboardVisible, tabOwnsSidebarSwipe])

  useEffect(() => {
    if (keyboardVisible) {
      setDrawerOpen(false)
    }
  }, [keyboardVisible])

  useEffect(() => {
    setStorageItem(STORAGE_KEYS.appShellSidebarCollapsed, sidebarCollapsed ? '1' : '0')
  }, [sidebarCollapsed])

  useEffect(() => {
    if (!commandPaletteOpen) return
    setDrawerOpen(false)
    const handle = window.setTimeout(() => {
      commandInputRef.current?.focus()
      commandInputRef.current?.select()
    }, 0)
    return () => window.clearTimeout(handle)
  }, [commandPaletteOpen])

  useEffect(() => {
    if (!commandPaletteOpen) return
    if (needsVaultSetup) return
    let cancelled = false
    void ensureCommandFilesLoaded()
      .catch((error) => {
        if (!cancelled) {
          console.warn('[App] Failed to load command palette files:', error)
        }
      })
    return () => {
      cancelled = true
    }
  }, [commandPaletteOpen, ensureCommandFilesLoaded, needsVaultSetup])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const withMeta = event.metaKey || event.ctrlKey
      if (withMeta && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandQuery('')
        setCommandPaletteOpen(true)
        return
      }
      if (withMeta && event.key.toLowerCase() === 't') {
        event.preventDefault()
        handleCreateWorkspaceTab()
        return
      }
      if (withMeta && event.key.toLowerCase() === 'w') {
        event.preventDefault()
        if (activeWorkspaceTab) {
          handleCloseWorkspaceTab(activeWorkspaceTab.id)
        }
        return
      }
      if (withMeta && event.code === 'Backslash' && !compactNav) {
        event.preventDefault()
        setSidebarCollapsed(prev => !prev)
        return
      }
      if (event.key === 'Escape') {
        setCommandPaletteOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeWorkspaceTab, compactNav, handleCloseWorkspaceTab, handleCreateWorkspaceTab])

  useNativeTopChromeBlock({
    enabled: useNativeTopChrome && !needsVaultSetup,
    title: activeWorkspaceTabLabel,
    showSearch: true,
    showCreate: true,
    onMenuTap: () => setDrawerOpen(true),
    onSearchTap: openCommandPalette,
    onCreateTap: openNativeCreateSurface,
  })

  useEffect(() => {
    if (needsVaultSetup) return
    smartSync()
      .then((result) => {
        setLastSyncedAt(getLastSyncTimestamp())
        setLastSyncAttemptAt(Date.now())
        setLastSyncSummary({
          mode: 'sync',
          finishedAt: Date.now(),
          result,
        })
      })
      .catch((err) => {
        setLastSyncAttemptAt(Date.now())
        setLastSyncSummary({
          mode: 'sync',
          finishedAt: Date.now(),
          error: err instanceof Error ? err.message : 'Sync failed.',
        })
        console.error('Failed to sync vault to IndexedDB cache', err)
      })
  }, [needsVaultSetup])

  useEffect(() => {
    if (!syncPanelOpen) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (syncToolsRef.current?.contains(target)) return
      if (syncPanelRef.current?.contains(target)) return
      setSyncPanelOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [syncPanelOpen])

  useEffect(() => {
    if (!syncPanelOpen) return
    updateSyncPanelAnchor()
    const reposition = () => updateSyncPanelAnchor()
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [syncPanelOpen, updateSyncPanelAnchor])

  useEffect(() => {
    if (needsVaultSetup) return
    let cancelled = false
    void readVaultUiPreferencesOrch()
      .then((preferences) => {
        if (cancelled) return
        setExplorerIconStyle(preferences.explorerIconStyle)
        setExplorerFolderColorRules(preferences.explorerFolderColorRules)
        setWebullTabLabel(preferences.webullTabLabel || 'Webull')
        setWebullTabIconText(preferences.webullTabIconText || '')
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn('[App] Failed to load vault UI preferences:', error)
        }
      })
    return () => {
      cancelled = true
    }
  }, [needsVaultSetup])

  useEffect(() => {
    if (workspaceTabs.length === 0) {
      const fallbackTab: AppWorkspaceTab = {
        id: createWorkspaceTabId(),
        route: normalizeTabRoute(currentRoute),
      }
      setWorkspaceTabs([fallbackTab])
      setActiveWorkspaceTabId(fallbackTab.id)
      return
    }
    if (activeWorkspaceTabId && workspaceTabs.some(tab => tab.id === activeWorkspaceTabId)) return
    const matchingRouteTab = workspaceTabs.find(tab => tab.route === normalizeTabRoute(currentRoute))
    setActiveWorkspaceTabId((matchingRouteTab ?? workspaceTabs[0]).id)
  }, [activeWorkspaceTabId, currentRoute, workspaceTabs])

  useEffect(() => {
    const tabIds = new Set(workspaceTabs.map((tab) => tab.id))
    setPersistentChatTabIds((prev) => {
      const next = prev.filter((tabId) => tabIds.has(tabId))
      return next.length === prev.length ? prev : next
    })
    setPersistentWebTabIds((prev) => {
      const next = prev.filter((tabId) => tabIds.has(tabId))
      return next.length === prev.length ? prev : next
    })
    setPersistentWebSiteIdByTabId((prev) => {
      const nextEntries = Object.entries(prev).filter(([tabId]) => tabIds.has(tabId))
      return nextEntries.length === Object.keys(prev).length ? prev : Object.fromEntries(nextEntries)
    })
  }, [workspaceTabs])

  useEffect(() => {
    if (!activeWorkspaceTabId) return
    setWorkspaceTabs((prev) => {
      const index = prev.findIndex(tab => tab.id === activeWorkspaceTabId)
      if (index === -1) return prev
      const pending = pendingWorkspaceTabNavigationRef.current
      const normalizedCurrentRoute = normalizeTabRoute(currentRoute)
      if (pending) {
        if (activeWorkspaceTabId !== pending.tabId) return prev
        if (normalizedCurrentRoute !== pending.route) return prev
      }
      if (prev[index].route === normalizedCurrentRoute && prev[index].label === activeWorkspaceTabLabel) return prev
      const next = prev.slice()
      next[index] = { ...next[index], route: normalizedCurrentRoute, label: activeWorkspaceTabLabel }
      return next
    })
  }, [activeWorkspaceTabId, activeWorkspaceTabLabel, currentRoute])

  useEffect(() => {
    const pending = pendingWorkspaceTabNavigationRef.current
    if (!pending) return
    if (activeWorkspaceTabId !== pending.tabId) return
    if (!workspaceTabs.some(tab => tab.id === pending.tabId)) {
      pendingWorkspaceTabNavigationRef.current = null
      return
    }

    const normalizedCurrentRoute = normalizeTabRoute(currentRoute)
    if (normalizedCurrentRoute !== pending.route) {
      navigate(pending.route)
      return
    }

    pendingWorkspaceTabNavigationRef.current = null
  }, [activeWorkspaceTabId, currentRoute, navigate, workspaceTabs])

  useEffect(() => {
    setJsonStorageItem(STORAGE_KEYS.appShellTabs, workspaceTabs)
  }, [workspaceTabs])

  useEffect(() => {
    if (!activeWorkspaceTabId) return
    setStorageItem(STORAGE_KEYS.appShellActiveTabId, activeWorkspaceTabId)
  }, [activeWorkspaceTabId])

  useEffect(() => {
    const onOpenRouteInNewTab = (event: Event) => {
      const customEvent = event as CustomEvent<string>
      const route = normalizeTabRoute(customEvent.detail ?? '/')
      const tab: AppWorkspaceTab = {
        id: createWorkspaceTabId(),
        route,
      }
      pendingWorkspaceTabNavigationRef.current = { tabId: tab.id, route }
      setWorkspaceTabs(prev => [...prev, tab])
      setActiveWorkspaceTabId(tab.id)
    }

    window.addEventListener('ltm:workspace-open-route-in-new-tab', onOpenRouteInNewTab as EventListener)
    return () => {
      window.removeEventListener('ltm:workspace-open-route-in-new-tab', onOpenRouteInNewTab as EventListener)
    }
  }, [])

  useEffect(() => {
    const handleChromeState = (event: Event) => {
      const customEvent = event as CustomEvent<ThinkingSpaceGoogleWorkspaceChromeStateBlock>
      const detail = customEvent.detail
      if (!detail) return
      setThinkingSpaceGoogleWorkspaceChromeState({
        enabled: Boolean(detail.enabled),
        explorerCollapsed: Boolean(detail.explorerCollapsed),
        headerVisible: Boolean(detail.headerVisible),
        showHeaderToggle: Boolean(detail.showHeaderToggle),
      })
    }

    window.addEventListener(THINKING_SPACE_GOOGLE_WORKSPACE_CHROME_STATE_EVENT_BLOCK, handleChromeState as EventListener)
    return () => {
      window.removeEventListener(THINKING_SPACE_GOOGLE_WORKSPACE_CHROME_STATE_EVENT_BLOCK, handleChromeState as EventListener)
    }
  }, [])

  useEffect(() => {
    const handleChatChromeState = (event: Event) => {
      const customEvent = event as CustomEvent<ChatSidebarChromeStateBlock>
      const detail = customEvent.detail
      if (!detail) return
      setChatSidebarChromeState({
        enabled: Boolean(detail.enabled),
        collapsed: Boolean(detail.collapsed),
        headerVisible: detail.headerVisible !== false,
        showHeaderToggle: Boolean(detail.showHeaderToggle),
        label: typeof detail.label === 'string' ? detail.label : 'AI',
      })
    }
    window.addEventListener(CHAT_SIDEBAR_CHROME_STATE_EVENT_BLOCK, handleChatChromeState as EventListener)
    return () => {
      window.removeEventListener(CHAT_SIDEBAR_CHROME_STATE_EVENT_BLOCK, handleChatChromeState as EventListener)
    }
  }, [])

  useEffect(() => {
    const handleWebChromeState = (event: Event) => {
      const customEvent = event as CustomEvent<WebSidebarChromeStateBlock>
      const detail = customEvent.detail
      if (!detail) return
      setWebSidebarChromeState(prev => ({
        enabled: Boolean(detail.enabled),
        collapsed: Boolean(detail.collapsed),
        headerVisible: detail.headerVisible !== false,
        showHeaderToggle: Boolean(detail.showHeaderToggle),
        label: typeof detail.label === 'string' ? detail.label : 'Web',
        siteLabels: (detail.siteLabels && typeof detail.siteLabels === 'object') ? detail.siteLabels : prev.siteLabels,
      }))
    }
    window.addEventListener(WEB_SIDEBAR_CHROME_STATE_EVENT_BLOCK, handleWebChromeState as EventListener)
    return () => {
      window.removeEventListener(WEB_SIDEBAR_CHROME_STATE_EVENT_BLOCK, handleWebChromeState as EventListener)
    }
  }, [])

  useEffect(() => {
    const handleOrganizerChromeState = (event: Event) => {
      const customEvent = event as CustomEvent<OrganizerSidebarChromeStateBlock>
      const detail = customEvent.detail
      if (!detail) return
      setOrganizerSidebarChromeState({
        enabled: Boolean(detail.enabled),
        collapsed: Boolean(detail.collapsed),
        label: typeof detail.label === 'string' ? detail.label : 'Organizer',
        headerVisible: detail.headerVisible !== false,
        showHeaderToggle: Boolean(detail.showHeaderToggle),
      })
    }
    window.addEventListener(ORGANIZER_SIDEBAR_CHROME_STATE_EVENT_BLOCK, handleOrganizerChromeState as EventListener)
    return () => {
      window.removeEventListener(ORGANIZER_SIDEBAR_CHROME_STATE_EVENT_BLOCK, handleOrganizerChromeState as EventListener)
    }
  }, [])


  useEffect(() => {
    const handleWebullChromeState = (event: Event) => {
      const customEvent = event as CustomEvent<WebullSidebarChromeStateBlock>
      const detail = customEvent.detail
      if (!detail) return
      setWebullSidebarChromeState({
        enabled: Boolean(detail.enabled),
        collapsed: Boolean(detail.collapsed),
        label: typeof detail.label === 'string' ? detail.label : 'webull',
      })
    }
    window.addEventListener(Webull_SIDEBAR_CHROME_STATE_EVENT_BLOCK, handleWebullChromeState as EventListener)
    return () => {
      window.removeEventListener(Webull_SIDEBAR_CHROME_STATE_EVENT_BLOCK, handleWebullChromeState as EventListener)
    }
  }, [])

  useEffect(() => {
    const handleNewThoughtChromeState = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled: boolean; collapsed: boolean }>).detail
      if (!detail) return
      setNewThoughtSidebarChromeState({ enabled: Boolean(detail.enabled), collapsed: Boolean(detail.collapsed) })
    }
    window.addEventListener(NEW_THOUGHT_SIDEBAR_CHROME_STATE_EVENT_BLOCK, handleNewThoughtChromeState as EventListener)
    return () => {
      window.removeEventListener(NEW_THOUGHT_SIDEBAR_CHROME_STATE_EVENT_BLOCK, handleNewThoughtChromeState as EventListener)
    }
  }, [])

  useEffect(() => {
    const appShellNode = appShellRef.current
    if (!appShellNode) return

    const clearScrollbarActivityTimeout = () => {
      if (scrollbarActivityTimeoutRef.current === null) return
      window.clearTimeout(scrollbarActivityTimeoutRef.current)
      scrollbarActivityTimeoutRef.current = null
    }

    const markScrollActivity = () => {
      appShellNode.classList.add('ltm-scrollbar-scrolling')
      clearScrollbarActivityTimeout()
      scrollbarActivityTimeoutRef.current = window.setTimeout(() => {
        appShellNode.classList.remove('ltm-scrollbar-scrolling')
        scrollbarActivityTimeoutRef.current = null
      }, 340)
    }

    appShellNode.addEventListener('scroll', markScrollActivity, { capture: true, passive: true })
    return () => {
      clearScrollbarActivityTimeout()
      appShellNode.classList.remove('ltm-scrollbar-scrolling')
      appShellNode.removeEventListener('scroll', markScrollActivity, true)
    }
  }, [])

  const appContent = needsVaultSetup ? (
      <VaultSetup
        onComplete={(vaultRoot) => {
          setVaultRoot(vaultRoot)
          if (vaultSwitchHardRefreshPending) {
            window.location.reload()
            return
          }
          setNeedsVaultSetup(false)
        }}
      />
  ) : (
    <div
      ref={appShellRef}
      className="ltm-app-shell"
      style={shellSafeAreaVars}
      data-ltm-mode={layout.mode}
      data-ltm-surface={layout.surface}
      data-ltm-route={location.pathname}
      data-ltm-explorer-icon-style={explorerIconStyle}
      data-ltm-ios-phone={iPhoneHandsetMode ? 'true' : 'false'}
    >
      {explorerFolderColorCss && <style>{explorerFolderColorCss}</style>}
      <div className="ltm-shell-layer-base">
        <div
          className="ltm-shell-stage"
          style={topInset && !useNativeTopChrome ? { paddingTop: `calc(${topInset}px + var(--ltm-shell-inset))` } : undefined}
        >
        <section className="ltm-shell-main-stage">
          <header className="ltm-shell-top-chrome ltm-shell-motion-chrome relative">
            <div
              className={`absolute left-0 top-0 z-20 flex h-full items-center justify-start [-webkit-app-region:no-drag] ${
                iPhoneMode ? 'pl-2' : 'pl-0.5'
              }`}
              style={{ width: `${phoneMode ? topChromeLeftWidth : topChromeBalancedWidth}px` }}
            >
              {showCapacitorTopChromeMenu && (
                <div ref={topChromeMenuRef} className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    className={`ltm-mobile-drawer-trigger ltm-motion-fast ltm-shell-field-surface inline-flex h-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold uppercase tracking-[0.13em] text-foreground shadow-sm ${
                      phoneMode ? 'w-8 px-0' : 'min-w-[5.5rem] gap-1.5 px-3'
                    }`}
                    aria-label="Open navigation"
                  >
                    <Menu className="h-3 w-3" />
                    {!phoneMode && <span>Menu</span>}
                  </button>

                  {showGoogleWorkspaceChromeControls && (
                    <button
                      type="button"
                      onClick={dispatchThinkingSpaceGoogleWorkspaceToggleExplorerBlock}
                      className="ltm-motion-fast inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/50 bg-background/75 text-muted-foreground transition-colors hover:bg-background/90 hover:text-foreground"
                      aria-label={thinkingSpaceGoogleWorkspaceChromeState.explorerCollapsed ? 'Show explorer' : 'Hide explorer'}
                      title={thinkingSpaceGoogleWorkspaceChromeState.explorerCollapsed ? 'Show explorer' : 'Hide explorer'}
                    >
                      {thinkingSpaceGoogleWorkspaceChromeState.explorerCollapsed
                        ? <PanelLeft className="h-3.5 w-3.5" />
                        : <PanelLeftClose className="h-3.5 w-3.5" />}
                    </button>
                  )}

                  {showThinkingSpaceHeaderToggle && (
                    <button
                      type="button"
                      onClick={dispatchThinkingSpaceGoogleWorkspaceToggleHeaderBlock}
                      className="ltm-motion-fast inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/85 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={thinkingSpaceGoogleWorkspaceChromeState.headerVisible ? 'Hide URL bar' : 'Show URL bar'}
                      title={thinkingSpaceGoogleWorkspaceChromeState.headerVisible ? 'Hide URL bar' : 'Show URL bar'}
                    >
                      {thinkingSpaceGoogleWorkspaceChromeState.headerVisible
                        ? <EyeOff className="h-3.5 w-3.5" />
                        : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              )}

              {showChatSidebarChromeControl && (
                <div className="inline-flex items-center gap-2" style={{ marginLeft: `${googleWorkspaceChromeLeftOffsetPx}px` }}>
                  <button
                    type="button"
                    onClick={dispatchChatSidebarChromeToggleBlock}
                    className="ltm-motion-fast inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/85 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={chatSidebarChromeState.collapsed ? 'Show chat sidebar' : 'Hide chat sidebar'}
                    title={chatSidebarChromeState.collapsed ? 'Show chat sidebar' : 'Hide chat sidebar'}
                  >
                    {chatSidebarChromeState.collapsed
                      ? <PanelLeft className="h-3.5 w-3.5" />
                      : <PanelLeftClose className="h-3.5 w-3.5" />}
                  </button>

                  {showChatHeaderToggle && (
                    <button
                      type="button"
                      onClick={dispatchChatSidebarChromeToggleHeaderBlock}
                      className="ltm-motion-fast inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/85 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={chatSidebarChromeState.headerVisible ? 'Hide URL bar' : 'Show URL bar'}
                      title={chatSidebarChromeState.headerVisible ? 'Hide URL bar' : 'Show URL bar'}
                    >
                      {chatSidebarChromeState.headerVisible
                        ? <EyeOff className="h-3.5 w-3.5" />
                        : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              )}

              {showWebSidebarChromeControl && (
                <div className="inline-flex items-center gap-2" style={{ marginLeft: `${googleWorkspaceChromeLeftOffsetPx}px` }}>
                  <button
                    type="button"
                    onClick={dispatchWebSidebarChromeToggleBlock}
                    className="ltm-motion-fast inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/85 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={webSidebarChromeState.collapsed ? 'Show web sidebar' : 'Hide web sidebar'}
                    title={webSidebarChromeState.collapsed ? 'Show web sidebar' : 'Hide web sidebar'}
                  >
                    {webSidebarChromeState.collapsed
                      ? <PanelLeft className="h-3.5 w-3.5" />
                      : <PanelLeftClose className="h-3.5 w-3.5" />}
                  </button>

                  {showWebHeaderToggle && (
                    <button
                      type="button"
                      onClick={dispatchWebSidebarChromeToggleHeaderBlock}
                      className="ltm-motion-fast inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/85 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={webSidebarChromeState.headerVisible ? 'Hide URL bar' : 'Show URL bar'}
                      title={webSidebarChromeState.headerVisible ? 'Hide URL bar' : 'Show URL bar'}
                    >
                      {webSidebarChromeState.headerVisible
                        ? <EyeOff className="h-3.5 w-3.5" />
                        : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              )}

              {showOrganizerSidebarChromeControl && (
                <div className="inline-flex items-center gap-2" style={{ marginLeft: `${googleWorkspaceChromeLeftOffsetPx}px` }}>
                  <button
                    type="button"
                    onClick={dispatchOrganizerSidebarChromeToggleBlock}
                    className="ltm-motion-fast inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/85 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={organizerSidebarChromeState.collapsed ? 'Show organizer sidebar' : 'Hide organizer sidebar'}
                    title={organizerSidebarChromeState.collapsed ? 'Show organizer sidebar' : 'Hide organizer sidebar'}
                  >
                    {organizerSidebarChromeState.collapsed
                      ? <PanelLeft className="h-3.5 w-3.5" />
                      : <PanelLeftClose className="h-3.5 w-3.5" />}
                  </button>

                  {showOrganizerHeaderToggle && (
                    <button
                      type="button"
                      onClick={dispatchOrganizerSidebarChromeToggleHeaderBlock}
                      className="ltm-motion-fast inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/85 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={organizerSidebarChromeState.headerVisible ? 'Hide document headers' : 'Show document headers'}
                      title={organizerSidebarChromeState.headerVisible ? 'Hide document headers' : 'Show document headers'}
                    >
                      {organizerSidebarChromeState.headerVisible
                        ? <EyeOff className="h-3.5 w-3.5" />
                        : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              )}

              {showWebullSidebarChromeControl && (
                <div className="inline-flex items-center gap-2" style={{ marginLeft: `${googleWorkspaceChromeLeftOffsetPx}px` }}>
                  <button
                    type="button"
                    onClick={dispatchWebullSidebarChromeToggleBlock}
                    className="ltm-motion-fast inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/85 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={webullSidebarChromeState.collapsed ? 'Show sidebar' : 'Hide sidebar'}
                    title={webullSidebarChromeState.collapsed ? 'Show sidebar' : 'Hide sidebar'}
                  >
                    {webullSidebarChromeState.collapsed
                      ? <PanelLeft className="h-3.5 w-3.5" />
                      : <PanelLeftClose className="h-3.5 w-3.5" />}
                  </button>
                </div>
              )}

              {showNewThoughtSidebarChromeControl && (
                <div className="inline-flex items-center gap-2" style={{ marginLeft: `${googleWorkspaceChromeLeftOffsetPx}px` }}>
                  <button
                    type="button"
                    onClick={dispatchNewThoughtSidebarChromeToggleBlock}
                    className="ltm-motion-fast inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/85 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={newThoughtSidebarChromeState.collapsed ? 'Show left panel' : 'Hide left panel'}
                    title={newThoughtSidebarChromeState.collapsed ? 'Show left panel' : 'Hide left panel'}
                  >
                    {newThoughtSidebarChromeState.collapsed
                      ? <PanelLeft className="h-3.5 w-3.5" />
                      : <PanelLeftClose className="h-3.5 w-3.5" />}
                  </button>
                </div>
              )}

              {showLeftAlignedGoogleWorkspaceChromeControls && (
                <div className="inline-flex items-center gap-2" style={{ marginLeft: `${googleWorkspaceChromeLeftOffsetPx}px` }}>
                  <button
                    type="button"
                    onClick={dispatchThinkingSpaceGoogleWorkspaceToggleExplorerBlock}
                    className="ltm-motion-fast inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/50 bg-background/75 text-muted-foreground transition-colors hover:bg-background/90 hover:text-foreground"
                    aria-label={thinkingSpaceGoogleWorkspaceChromeState.explorerCollapsed ? 'Show explorer' : 'Hide explorer'}
                    title={thinkingSpaceGoogleWorkspaceChromeState.explorerCollapsed ? 'Show explorer' : 'Hide explorer'}
                  >
                    {thinkingSpaceGoogleWorkspaceChromeState.explorerCollapsed
                      ? <PanelLeft className="h-3.5 w-3.5" />
                      : <PanelLeftClose className="h-3.5 w-3.5" />}
                  </button>

                  {showThinkingSpaceHeaderToggle && (
                    <button
                      type="button"
                      onClick={dispatchThinkingSpaceGoogleWorkspaceToggleHeaderBlock}
                      className="ltm-motion-fast inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/85 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={thinkingSpaceGoogleWorkspaceChromeState.headerVisible ? 'Hide document header' : 'Show document header'}
                      title={thinkingSpaceGoogleWorkspaceChromeState.headerVisible ? 'Hide document header' : 'Show document header'}
                    >
                      {thinkingSpaceGoogleWorkspaceChromeState.headerVisible
                        ? <EyeOff className="h-3.5 w-3.5" />
                        : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div
              className="min-w-0 w-full"
              style={{
                paddingLeft: `${topChromePaddingLeft}px`,
                paddingRight: `${topChromePaddingRight}px`,
              }}
            >
              <AppTabsBlock
                tabs={workspaceTabItems}
                activeTabId={activeWorkspaceTabId}
                onSelectTab={handleSelectWorkspaceTab}
                onCreateTab={handleCreateWorkspaceTab}
                onCloseTab={handleCloseWorkspaceTab}
                className="ltm-shell-top-tab-capsule"
              />
            </div>

            <div
              className={`absolute top-0 z-20 flex h-full items-center justify-end gap-2 [-webkit-app-region:no-drag] ${
                iPhoneMode ? 'right-1' : 'right-8'
              }`}
              style={{ width: `${phoneMode ? topChromeRightWidth : topChromeBalancedWidth}px` }}
            >
              <div ref={syncToolsRef} className="inline-flex items-center gap-2">
                {showRightAlignedGoogleWorkspaceChromeControls && (
                  <>
                    <button
                      type="button"
                      onClick={dispatchThinkingSpaceGoogleWorkspaceToggleExplorerBlock}
                      className="ltm-motion-fast inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/50 bg-background/75 text-muted-foreground transition-colors hover:bg-background/90 hover:text-foreground"
                      aria-label={thinkingSpaceGoogleWorkspaceChromeState.explorerCollapsed ? 'Show explorer' : 'Hide explorer'}
                      title={thinkingSpaceGoogleWorkspaceChromeState.explorerCollapsed ? 'Show explorer' : 'Hide explorer'}
                    >
                      {thinkingSpaceGoogleWorkspaceChromeState.explorerCollapsed
                        ? <PanelLeft className="h-3.5 w-3.5" />
                        : <PanelLeftClose className="h-3.5 w-3.5" />}
                    </button>

                    {showThinkingSpaceHeaderToggle && (
                      <button
                        type="button"
                        onClick={dispatchThinkingSpaceGoogleWorkspaceToggleHeaderBlock}
                        className="ltm-motion-fast inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/85 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={thinkingSpaceGoogleWorkspaceChromeState.headerVisible ? 'Hide document header' : 'Show document header'}
                        title={thinkingSpaceGoogleWorkspaceChromeState.headerVisible ? 'Hide document header' : 'Show document header'}
                      >
                        {thinkingSpaceGoogleWorkspaceChromeState.headerVisible
                          ? <EyeOff className="h-3.5 w-3.5" />
                          : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </>
                )}

                {/* Debug console toggle */}
                <button
                  type="button"
                  onClick={openDebugPanel}
                  className="ltm-motion-fast relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/85 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Open debug console"
                  title="Debug console"
                >
                  <Bug className="h-3.5 w-3.5" />
                  {debugUnreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                      {debugUnreadCount > 99 ? '99+' : debugUnreadCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleGlobalRefresh}
                  disabled={refreshRunning || needsVaultSetup}
                  className={`ltm-motion-fast inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full border border-border/60 bg-background/85 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60 ${
                    phoneMode ? 'w-8 px-0' : 'px-3'
                  }`}
                  aria-label="Refresh current workspace"
                  title="Refresh current workspace"
                >
                  {refreshRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  {!phoneMode && <span className="hidden lg:inline">Refresh</span>}
                </button>

                <button
                  type="button"
                  ref={syncToggleButtonRef}
                  onClick={() => {
                    updateSyncPanelAnchor()
                    setSyncPanelOpen(prev => !prev)
                  }}
                  className={`ltm-motion-fast inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full border border-border/60 bg-background/85 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground ${
                    phoneMode ? 'w-8 px-0' : 'px-3'
                  }`}
                  aria-label="Toggle sync tools"
                  title="Toggle sync tools"
                >
                  {!phoneMode && <span className="hidden lg:inline">Sync Tools</span>}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${syncPanelOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
          </header>
          <div className="ltm-shell-body-stage">
            {!compactNav && (
              <aside className={`ltm-shell-sidebar ltm-shell-nav-surface hidden shrink-0 transition-[width] duration-200 lg:block ${
                sidebarCollapsed ? 'ltm-sidebar-collapsed' : 'ltm-sidebar-expanded'
              } ${
                sidebarCollapsed ? 'w-16' : 'w-64'
              }`} data-ltm-nav-region="rail">
                <div className={`flex h-full flex-col py-3 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
                <div className="ltm-nav-scroll ltm-sidebar-nav-scroll min-h-0 flex-1 overflow-y-auto">
                  <div className="ltm-sidebar-nav-group space-y-1">
                    {!sidebarCollapsed && (
                      <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Core
                      </div>
                    )}
                    {coreNavItems.map((item) => {
                      const Icon = item.icon
                      const active = isNavItemActive(location.pathname, item)
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          title={sidebarCollapsed ? item.label : undefined}
                          className={`ltm-motion-fast ltm-touch-row flex items-center rounded-lg py-2 text-sm transition-colors ${
                            sidebarCollapsed ? 'justify-center px-2' : 'gap-2 px-2.5'
                          } ${
                            active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                        </Link>
                      )
                    })}
                  </div>

                  <div className="ltm-sidebar-nav-group space-y-1">
                    {!sidebarCollapsed && (
                      <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Excalidraw++
                      </div>
                    )}
                    {sidebarCollapsed ? (
                      <Link
                        to={EXCALIDRAW_NAV_ITEM.to}
                        title="Excalidraw++"
                        className={`ltm-motion-fast ltm-touch-row flex items-center justify-center rounded-lg px-2 py-2 text-sm transition-colors ${
                          excalidrawGroupActive
                            ? 'bg-foreground text-background'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                      >
                        <ExcalidrawPlusIcon className="h-4 w-4" />
                      </Link>
                    ) : (
                      <Link
                        to={EXCALIDRAW_NAV_ITEM.to}
                        className={`ltm-motion-fast ltm-touch-row flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                          excalidrawGroupActive
                            ? 'bg-foreground text-background'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                      >
                        <ExcalidrawPlusIcon className="h-4 w-4" />
                        <span className="flex-1 truncate text-left">Excalidraw++</span>
                      </Link>
                    )}
                    {(() => {
                      const Icon = passwordNavItem.icon
                      const active = isNavItemActive(location.pathname, passwordNavItem)
                      return (
                        <Link
                          to={passwordNavItem.to}
                          title={sidebarCollapsed ? passwordNavItem.label : undefined}
                          className={`ltm-motion-fast ltm-touch-row flex items-center rounded-lg py-2 text-sm transition-colors ${
                            sidebarCollapsed ? 'justify-center px-2' : 'gap-2 px-2.5'
                          } ${
                            active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {!sidebarCollapsed && <span className="truncate">{passwordNavItem.label}</span>}
                        </Link>
                      )
                    })()}
                  </div>
                </div>

                <div className="ltm-sidebar-actions">
                  <div className="ltm-sidebar-actions-group space-y-1">
                    {utilityNavItems.map((item) => {
                      const Icon = item.icon
                      const active = isNavItemActive(location.pathname, item)
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          title={sidebarCollapsed ? item.label : undefined}
                          className={`ltm-motion-fast ltm-touch-row flex items-center rounded-lg py-2 text-sm transition-colors ${
                            sidebarCollapsed ? 'justify-center px-2' : 'gap-2 px-2.5'
                          } ${
                            active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                        </Link>
                      )
                    })}
                  </div>

                  <div className="ltm-sidebar-actions-group space-y-2">
                    <button
                      type="button"
                      onClick={openCommandPalette}
                      className={`ltm-shell-action ltm-shell-nav-action ltm-motion-fast ltm-touch-row inline-flex w-full items-center rounded-lg py-2 text-sm text-muted-foreground transition-colors hover:text-foreground ${
                        sidebarCollapsed ? 'justify-center px-2' : 'gap-2 px-2.5'
                      }`}
                      aria-label="Open quick search"
                    >
                      <Search className="h-4 w-4" />
                      {!sidebarCollapsed && <span className="ltm-shell-action-label truncate">Search</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSidebarCollapsed(prev => !prev)}
                      className={`ltm-shell-action ltm-shell-nav-action ltm-motion-fast ltm-touch-row inline-flex w-full items-center rounded-lg py-2 text-sm text-muted-foreground transition-colors hover:text-foreground ${
                        sidebarCollapsed ? 'justify-center px-2' : 'gap-2 px-2.5'
                      }`}
                      title={sidebarCollapsed ? 'Expand sidebar (Cmd/Ctrl+\\)' : 'Collapse sidebar (Cmd/Ctrl+\\)'}
                      aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                      {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                      {!sidebarCollapsed && <span className="ltm-shell-action-label truncate">{sidebarCollapsed ? 'Expand drawer' : 'Collapse drawer'}</span>}
                    </button>

                    <Link
                      to="/"
                      title={sidebarCollapsed ? 'Home' : undefined}
                      aria-label="Home"
                      className={`ltm-shell-logo ltm-motion-fast mt-2 inline-flex items-center rounded-lg ${
                        sidebarCollapsed
                          ? 'h-10 w-full justify-center'
                          : 'gap-2 px-2.5 py-2 text-sm font-semibold tracking-tight'
                      }`}
                    >
                      <span className="inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full">
                        <AppBrandGlyph className="h-full w-full" />
                      </span>
                      {!sidebarCollapsed && <span>Home</span>}
                    </Link>
                  </div>
                </div>
                </div>
              </aside>
            )}
          <main
            ref={mainContentRef}
            className="ltm-app-main ltm-shell-main ltm-shell-content-stage"
            style={mainStageStyle}
          >
            <div className="relative h-full min-h-0">
              {renderedPersistentChatTabIds.map((tabId) => {
                const chatTabMounted = workspaceTabs.some((tab) => tab.id === tabId)
                if (!chatTabMounted) return null
                const chatSurfaceActive = isChatRoute && activeWorkspaceTabId === tabId
                return (
                  <div
                    key={`chat-surface:${tabId}`}
                    className="absolute inset-0 overflow-hidden"
                    style={{ visibility: chatSurfaceActive ? 'visible' : 'hidden', pointerEvents: chatSurfaceActive ? 'auto' : 'none' }}
                    aria-hidden={!chatSurfaceActive}
                  >
                    <Chat active={chatSurfaceActive} />
                  </div>
                )
              })}
              {renderedPersistentWebTabIds.map((tabId) => {
                const webTabMounted = workspaceTabs.some((tab) => tab.id === tabId)
                if (!webTabMounted) return null
                const webSurfaceActive = isWebRoute && activeWorkspaceTabId === tabId
                return (
                  <div
                    key={`web-surface:${tabId}`}
                    className="absolute inset-0 overflow-hidden"
                    style={{ visibility: webSurfaceActive ? 'visible' : 'hidden', pointerEvents: webSurfaceActive ? 'auto' : 'none' }}
                    aria-hidden={!webSurfaceActive}
                  >
                    <Web
                      active={webSurfaceActive}
                      selectedSiteId={persistentWebSiteIdByTabId[tabId] ?? null}
                      onSelectSiteId={(siteId) => handlePersistentWebSiteSelect(tabId, siteId)}
                    />
                  </div>
                )
              })}
              {persistentRouteMounts.organizer && (
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ visibility: isOrganizerRoute ? 'visible' : 'hidden', pointerEvents: isOrganizerRoute ? 'auto' : 'none' }}
                  aria-hidden={!isOrganizerRoute}
                >
                  <ThinkingOrganizer />
                </div>
              )}
              {persistentRouteMounts.newThought && (
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ visibility: isNewThoughtRoute ? 'visible' : 'hidden', pointerEvents: isNewThoughtRoute ? 'auto' : 'none' }}
                  aria-hidden={!isNewThoughtRoute}
                >
                  <NewThought />
                </div>
              )}
              {!usesPersistentRouteSurface && (
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/thinking-space" element={<ThinkingSpace />} />
                  <Route path="/excalidraw-plus" element={<ExcalidrawPlus />}>
                    <Route index element={<Navigate to="plugin" replace />} />
                    <Route path="plugin" element={<ExcalidrawPlugin />} />
                    <Route path="format" element={<FormatExcalidraw />} />
                    <Route path="mindmap" element={<MindmapBuilder />} />
                    <Route path="pdf" element={<PdfToMarkdown />} />
                    <Route path="transcript" element={<TranscriptCleaner />} />
                  </Route>
                  <Route path="/excalidraw-plugin" element={<Navigate to="/excalidraw-plus/plugin" replace />} />
                  <Route path="/format-excalidraw" element={<Navigate to="/excalidraw-plus/format" replace />} />
                  <Route path="/mindmap-builder" element={<Navigate to="/excalidraw-plus/mindmap" replace />} />
                  <Route path="/pdf-to-markdown" element={<Navigate to="/excalidraw-plus/pdf" replace />} />
                  <Route path="/transcript-cleaner" element={<Navigate to="/excalidraw-plus/transcript" replace />} />
                  <Route path="/git-insights" element={<GitInsights />} />
                  <Route path="/terminal" element={<TerminalPage />} />
                  <Route path="/password-manager" element={<PasswordManager />} />
                  <Route path="/webull" element={<WebullPage pageLabel={webullTabLabel} />} />
                  <Route path="/personal-extension" element={<Navigate to="/webull" replace />} />
                  <Route
                    path="/settings"
                    element={
                      <Settings
                        explorerIconStyle={explorerIconStyle}
                        onExplorerIconStyleChange={handleExplorerIconStyleChange}
                        explorerFolderColorRules={explorerFolderColorRules}
                        onExplorerFolderColorRulesChange={handleExplorerFolderColorRulesChange}
                        onRequestVaultSwitch={handleRequestVaultSwitch}
                        webullTabLabel={webullTabLabel}
                        webullTabIconText={webullTabIconText}
                        onWebullTabPreferencesChange={handleWebullTabPreferencesChange}
                      />
                    }
                  />
                  <Route path="/ai-settings" element={<Navigate to="/settings?tab=ai" replace />} />
                  <Route
                    path="/extension-builder"
                    element={extensionBuilderEnabled ? <ExtensionBuilder /> : <Navigate to="/capabilities" replace />}
                  />
                  <Route path="/capabilities" element={<CapabilityDiscovery />} />
                </Routes>
              )}
            </div>
          </main>
          </div>
          </section>
        </div>
      </div>

      {compactNav && !drawerOpen && !isCapacitorSurface && (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="ltm-mobile-drawer-trigger ltm-motion-fast ltm-shell-fab-surface ltm-touch-target fixed z-30 inline-flex h-11 w-11 items-center justify-center rounded-full p-0 text-foreground shadow-lg"
          style={{ bottom: `${compactDrawerTriggerBottom}px`, left: `${compactDrawerTriggerLeft}px` }}
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </button>
      )}

      {compactNav && drawerOpen && (
        <>
          <div
            className="ltm-mobile-drawer-overlay ltm-shell-motion-overlay fixed inset-0 z-40 bg-background/65 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            className="ltm-mobile-drawer ltm-shell-mobile-drawer ltm-shell-drawer-surface ltm-shell-motion-drawer fixed inset-y-0 left-0 z-50 flex flex-col"
            onTouchStart={handleDrawerTouchStart}
            onTouchMove={handleDrawerTouchMove}
            onTouchEnd={handleDrawerTouchEnd}
            onTouchCancel={handleDrawerTouchEnd}
          >
            <div className="ltm-mobile-drawer-header ltm-shell-segment-header flex h-14 items-center justify-between px-3">
              <Link
                to="/"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full">
                  <AppBrandGlyph />
                </span>
                Home
              </Link>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="ltm-shell-action ltm-touch-target inline-flex h-8 w-8 items-center justify-center rounded-md"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              className="ltm-mobile-drawer-content flex min-h-0 flex-1 flex-col p-3"
              style={drawerBottomInset ? { paddingBottom: `${drawerBottomInset + 12}px` } : undefined}
            >
              <div className="ltm-nav-scroll min-h-0 flex-1 overflow-y-auto">
                <div className="space-y-1">
                  <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Core
                  </div>
                  {coreNavItems.map((item) => {
                    const Icon = item.icon
                    const active = isNavItemActive(location.pathname, item)
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setDrawerOpen(false)}
                        className={`ltm-motion-fast ltm-touch-row flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                          active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    )
                  })}
                </div>

                <div className="mt-5 space-y-1">
                  <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Workspace
                  </div>
                  {utilityNavItems.map((item) => {
                    const Icon = item.icon
                    const active = isNavItemActive(location.pathname, item)
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setDrawerOpen(false)}
                        className={`ltm-motion-fast ltm-touch-row flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                          active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    )
                  })}
                </div>

                <div className="mt-5 space-y-1">
                  <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Excalidraw++
                  </div>
                  <Link
                    to={EXCALIDRAW_NAV_ITEM.to}
                    onClick={() => setDrawerOpen(false)}
                    className={`ltm-motion-fast ltm-touch-row flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                      excalidrawGroupActive ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    <ExcalidrawPlusIcon className="h-4 w-4" />
                    <span className="truncate">Excalidraw++</span>
                  </Link>
                  {(() => {
                    const Icon = passwordNavItem.icon
                    const active = isNavItemActive(location.pathname, passwordNavItem)
                    return (
                      <Link
                        to={passwordNavItem.to}
                        onClick={() => setDrawerOpen(false)}
                        className={`ltm-motion-fast ltm-touch-row flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                          active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="truncate">{passwordNavItem.label}</span>
                      </Link>
                    )
                  })()}
                </div>
              </div>

              <div className="ltm-shell-segment-footer mt-3 space-y-2 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false)
                    openCommandPalette()
                  }}
                  className="ltm-shell-action ltm-motion-fast ltm-touch-row inline-flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Open quick search"
                >
                  <Search className="h-4 w-4" />
                  <span className="truncate">Search</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="ltm-shell-action ltm-motion-fast ltm-touch-row inline-flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Collapse drawer"
                >
                  <X className="h-4 w-4" />
                  <span className="truncate">Collapse drawer</span>
                </button>
              </div>
            </div>
          </aside>
        </>
      )}

      {syncPanelOpen && createPortal(
        <div
          ref={syncPanelRef}
          className="fixed z-[80] w-[380px] rounded-xl bg-white p-3 text-sm text-slate-900 shadow-lg [-webkit-app-region:no-drag]"
          style={{
            top: `${syncPanelAnchor.top}px`,
            right: `${syncPanelAnchor.right}px`,
            backgroundColor: '#ffffff',
            opacity: 1,
            filter: 'none',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            mixBlendMode: 'normal',
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">Sync Tools</p>
          <div className="mt-3 space-y-3">
            <div className="space-y-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!!syncActionRunning || !!gitActionRunning || needsVaultSetup}
                className="w-full justify-start border-transparent bg-white text-slate-900 hover:bg-slate-50 disabled:border-transparent disabled:bg-white disabled:text-slate-500"
                onClick={() => { void runSyncAction('sync') }}
              >
                {syncActionRunning === 'sync' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Sync Folder
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!!syncActionRunning || !!gitActionRunning || needsVaultSetup}
                className="w-full justify-start border-transparent bg-white text-slate-900 hover:bg-slate-50 disabled:border-transparent disabled:bg-white disabled:text-slate-500"
                onClick={() => { void runSyncAction('rebuild') }}
              >
                {syncActionRunning === 'rebuild' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Rebuild Index + Cache
              </Button>

              <div className="rounded-lg bg-white p-2 text-[11px]">
                <p className="text-slate-600">Sync Folder Root</p>
                <p className="truncate font-mono text-slate-900">
                  {(() => {
                    const root = getStoredVaultRoot() || ''
                    if (!root) return 'Not configured'
                    if (root === 'web-backend') return 'web-backend (browser backend)'
                    return root
                  })()}
                </p>
                <p className="mt-1 text-slate-600">
                  Last Successful Sync:{' '}
                  <span className="text-slate-900">
                    {lastSyncedAt
                      ? new Date(lastSyncedAt * 1000).toLocaleString()
                      : (lastSyncSummary?.result?.errors.length ?? 0) > 0
                        ? 'No successful sync yet (latest sync had errors)'
                        : 'No successful sync yet'}
                  </span>
                </p>
                <p className="text-slate-600">
                  Last Sync Attempt: <span className="text-slate-900">{formatSyncTimestamp(lastSyncAttemptAt)}</span>
                </p>
                {lastSyncSummary && (
                  <>
                    <p className="mt-1 text-slate-600">
                      Last Action: <span className="text-slate-900">{lastSyncSummary.mode === 'sync' ? 'Sync Folder' : 'Rebuild Index + Cache'}</span>
                    </p>
                    {lastSyncSummary.result ? (
                      <>
                        <p className="text-slate-600">
                          Files: <span className="text-slate-900">{lastSyncSummary.result.totalFiles}</span> · Parsed:{' '}
                          <span className="text-slate-900">{lastSyncSummary.result.parsedNodes}</span> · Errors:{' '}
                          <span className="text-slate-900">{lastSyncSummary.result.errors.length}</span>
                        </p>
                      </>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            <div className="my-1 h-px bg-slate-200" />

            <div className="space-y-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!!syncActionRunning || !!gitActionRunning || needsVaultSetup || !gitSyncToolsSupported}
                className="w-full justify-start border-transparent bg-white text-slate-900 hover:bg-slate-50 disabled:border-transparent disabled:bg-white disabled:text-slate-500"
                onClick={openGitCommitDialog}
              >
                {gitActionRunning === 'commit' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Git Commit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!!syncActionRunning || !!gitActionRunning || needsVaultSetup || !gitSyncToolsSupported}
                className="w-full justify-start border-transparent bg-white text-slate-900 hover:bg-slate-50 disabled:border-transparent disabled:bg-white disabled:text-slate-500"
                onClick={() => { void runGitAction('push') }}
              >
                {gitActionRunning === 'push' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Git Push
              </Button>
              {!gitSyncToolsSupported && (
                <p className="px-1 text-[11px] text-slate-600">Git only supported in Electron desktop app.</p>
              )}

              <div className="rounded-lg bg-white p-2 text-[11px]">
                <p className="text-slate-600">
                  Last Git Commit: <span className="text-slate-900">{formatSyncTimestamp(lastGitCommitAt)}</span>
                </p>
                <p className="text-slate-600">
                  Last Git Push: <span className="text-slate-900">{formatSyncTimestamp(lastGitPushAt)}</span>
                </p>
                {lastGitActionSummary && (
                  <p className="mt-1 text-slate-600">
                    Last Git Action:{' '}
                    <span className="text-slate-900">
                      {lastGitActionSummary.mode === 'commit' ? 'Commit' : 'Push'}
                    </span>
                    {' · '}
                    <span className="text-slate-900">
                      {formatSyncTimestamp(lastGitActionSummary.finishedAt)}
                    </span>
                    {lastGitActionSummary.message ? (
                      <>
                        {' · '}
                        <span>{lastGitActionSummary.message}</span>
                      </>
                    ) : null}
                  </p>
                )}
              </div>
            </div>

            {(() => {
              const syncActionError = lastSyncSummary?.error?.trim()
              const syncEntryErrors = lastSyncSummary?.result?.errors ?? []
              const gitError = lastGitActionSummary?.error?.trim()
              const hasAnyError = Boolean(syncActionError || gitError || syncEntryErrors.length > 0)
              if (!hasAnyError) return null

              return (
                <div className="rounded-md bg-red-50 p-2 text-[10px] text-red-700">
                  {(syncActionError || syncEntryErrors.length > 0) && (
                    <div>
                      <p className="font-semibold uppercase tracking-[0.12em]">Sync Errors</p>
                      <div className="mt-1 space-y-1">
                        {syncActionError ? <p>{syncActionError}</p> : null}
                        {syncEntryErrors.slice(0, 5).map((entry, idx) => (
                          <p key={`${entry.path}-${idx}`} className="leading-tight">
                            <span className="font-mono">{entry.path}</span>: {entry.error}
                          </p>
                        ))}
                        {syncEntryErrors.length > 5 ? (
                          <p>+{syncEntryErrors.length - 5} more sync errors</p>
                        ) : null}
                      </div>
                    </div>
                  )}
                  {gitError && (
                    <div className="mt-2">
                      <p className="font-semibold uppercase tracking-[0.12em]">Git Errors</p>
                      <div className="mt-1 space-y-1">
                        <p>{gitError}</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </div>,
        document.body,
      )}

      {commandPaletteOpen && (
        <>
          <div
            className="ltm-cmd-overlay ltm-shell-motion-overlay fixed inset-0 z-50 bg-background/70"
            onClick={closeCommandPalette}
          />
          <div
            className="fixed inset-0 z-[60] flex items-start justify-center p-3 sm:p-4"
            data-ltm-shell-region="command-stage"
            style={{ paddingTop: `${commandPaletteTopPadding}px`, paddingBottom: `${commandPaletteBottomPadding}px` }}
          >
            <div className="ltm-cmd-card ltm-shell-command-card ltm-shell-command-surface ltm-shell-motion-modal max-h-full w-full max-w-3xl overflow-hidden rounded-2xl">
              <div className="p-3">
                <UniversalSearchBlock
                  {...UNIVERSAL_SEARCH_COMMAND_MODAL_PRESET_BLOCK}
                  items={allCommandItems}
                  query={commandQuery}
                  onQueryChange={setCommandQuery}
                  onSelect={runCommandItem}
                  getItemKey={item => `${item.group}:${item.to}`}
                  getItemLabel={item => item.label}
                  getItemDescription={item => item.description}
                  getItemSearchCandidates={(item) => [
                    item.label,
                    item.description ?? '',
                    item.to,
                    item.group,
                    item.keywords ?? '',
                  ]}
                  placeholder="Jump to a page or file..."
                  open
                  onEscapeKeyDown={closeCommandPalette}
                  inputRef={commandInputRef}
                  itemClassName={(item) => {
                    const active = isNavItemActive(location.pathname, {
                      to: item.to,
                      label: item.label,
                      icon: Sparkles,
                      activePaths: item.activePaths,
                    })
                    return active
                      ? 'rounded-lg !bg-foreground !text-background'
                      : 'rounded-lg hover:bg-muted'
                  }}
                  renderItem={(item) => {
                    const active = isNavItemActive(location.pathname, {
                      to: item.to,
                      label: item.label,
                      icon: Sparkles,
                      activePaths: item.activePaths,
                    })
                    return (
                      <div className="ltm-motion-fast ltm-touch-row flex w-full items-center justify-between rounded-lg px-0 py-0 text-left text-sm transition-colors">
                        <div className="min-w-0">
                          <div className="truncate">{item.label}</div>
                          {item.description && (
                            <div className={`mt-0.5 truncate text-[11px] ${active ? 'text-background/80' : 'text-muted-foreground'}`}>
                              {item.description}
                            </div>
                          )}
                        </div>
                        <div className={`ml-3 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] ${active ? 'text-background/80' : 'text-muted-foreground'}`}>
                          {item.group === 'Files' ? <FileText className="h-3 w-3" /> : null}
                          <span>{item.group}</span>
                        </div>
                      </div>
                    )
                  }}
                />
              </div>
              <div className="ltm-shell-segment-footer px-3 py-2 text-[11px] text-muted-foreground">
                Enter to open first result · Esc to close · Cmd/Ctrl+K to reopen
              </div>
            </div>
          </div>
        </>
      )}

      {gitCommitDialogOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-background/60"
            onClick={() => {
              if (gitActionRunning) return
              setGitCommitDialogOpen(false)
            }}
          />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <form
              className="w-full max-w-lg rounded-2xl border border-border/70 bg-background p-4 shadow-xl"
              onSubmit={(event) => {
                event.preventDefault()
                void runGitAction('commit', gitCommitMessageDraft)
              }}
            >
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Git Commit</h3>
                <p className="text-xs text-muted-foreground">
                  Enter a commit message for all pending changes in the current vault.
                </p>
              </div>
              <div className="mt-3">
                <input
                  ref={gitCommitMessageInputRef}
                  type="text"
                  value={gitCommitMessageDraft}
                  onChange={(event) => setGitCommitMessageDraft(event.target.value)}
                  disabled={gitActionRunning === 'commit'}
                  placeholder="Commit message"
                  className="h-10 w-full rounded-lg border border-border/70 bg-background px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-300/60 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={gitActionRunning === 'commit'}
                  onClick={() => setGitCommitDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={gitActionRunning === 'commit'}
                >
                  {gitActionRunning === 'commit' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  Commit
                </Button>
              </div>
            </form>
          </div>
        </>
      )}

    </div>
  )

  return (
    <RuntimeErrorBoundaryBlock
      location={currentRoute}
      onError={handleFatalRuntimeError}
      renderFallback={(report) => {
        const fallbackReports = runtimeErrorReports.some(existing => sameRuntimeErrorReport(existing, report))
          ? runtimeErrorReports
          : [report, ...runtimeErrorReports]
        return (
          <RuntimeErrorSurfaceBlock
            reports={fallbackReports}
            fatalReport={report}
            copiedToken={runtimeErrorCopiedToken}
            onCopyReport={(reportId) => {
              const matched = reportId === report.id
                ? report
                : fallbackReports.find((candidate) => candidate.id === reportId)
              if (!matched) return
              void copyRuntimeErrorText(formatRuntimeErrorReportForClipboardBlock(matched), matched.id)
            }}
            onCopyAll={() => {
              void copyRuntimeErrorText(formatRuntimeErrorReportsForClipboardBlock(fallbackReports), 'all')
            }}
            onDismissReport={handleDismissRuntimeErrorReport}
            onClearReports={handleClearRuntimeErrors}
            onReloadApp={() => window.location.reload()}
          />
        )
      }}
    >
      <>
        {appContent}
        <RuntimeErrorSurfaceBlock
          reports={runtimeErrorReports}
          copiedToken={runtimeErrorCopiedToken}
          onCopyReport={handleCopyRuntimeErrorReport}
          onCopyAll={handleCopyAllRuntimeErrors}
          onDismissReport={handleDismissRuntimeErrorReport}
          onClearReports={handleClearRuntimeErrors}
        />
        <DebugPanelBlock
          entries={debugLogEntries}
          isOpen={debugPanelOpen}
          onClose={() => setDebugPanelOpen(false)}
          onClear={() => { setDebugLogEntries([]); setDebugUnreadCount(0) }}
        />
        {debugToast && (
          <div className="pointer-events-none fixed bottom-4 right-4 z-[100]">
            <DebugToastBlock
              entry={debugToast}
              onDismiss={() => {
                setDebugToast(null)
                if (debugToastTimerRef.current !== null) {
                  window.clearTimeout(debugToastTimerRef.current)
                  debugToastTimerRef.current = null
                }
              }}
              onOpenPanel={openDebugPanel}
            />
          </div>
        )}
      </>
    </RuntimeErrorBoundaryBlock>
  )
}

export default App
