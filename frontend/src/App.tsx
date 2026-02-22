import { Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import {
  Bot,
  CheckSquare2,
  Compass,
  FolderKanban,
  FileText,
  GitBranch,
  Menu,
  MessageSquare,
  PanelLeft,
  PanelLeftClose,
  PlusSquare,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  X,
} from 'lucide-react'
import treeOfLifeLogo from './assets/tree-of-life-logo.jpg'
import Home from './pages/Home'
import FormatExcalidraw from './pages/FormatExcalidraw'
import ExcalidrawPlugin from './pages/ExcalidrawPlugin'
import MindmapBuilder from './pages/MindmapBuilder'
import PdfToMarkdown from './pages/PdfToMarkdown'
import GitInsights from './pages/GitInsights'
import TranscriptCleaner from './pages/TranscriptCleaner'
import NewThought from './pages/NewThought'
import Todos from './pages/Todos'
import ThinkingSpace from './pages/ThinkingSpace'
import ThinkingOrganizer from './pages/ThinkingOrganizer'
import Chat from './pages/Chat'
import CapabilityDiscovery from './pages/CapabilityDiscovery'
import ExtensionBuilder from './pages/ExtensionBuilder'
import Settings from './pages/Settings'
import VaultSetup from './components/orchestrators/VaultSetupOrch'
import AppTabsBlock, { type AppWorkspaceTabBlockModel } from './components/lego_blocks/AppTabsBlock'
import { useUILayoutBlock } from './components/lego_blocks/UILayoutBlock'
import { useUIThemeBlock } from './components/lego_blocks/UIThemeBlock'
import { deriveAdaptiveShellStateOrch } from './services/orchestrators/uiNavigationOrch'
import { isElectron, setVaultRoot } from './services/orchestrators/runtimeOrch'
import { smartSync } from './services/orchestrators/vaultSyncOrch'
import { listMarkdownEntries } from './services/orchestrators/fileSystemOrch'
import {
  STORAGE_KEYS,
  getJsonStorageItem,
  getStoredVaultRoot,
  getStorageItem,
  setJsonStorageItem,
  setStorageItem,
} from './services/orchestrators/storageOrch'
import { getCapabilityFeatureFlags } from './services/orchestrators/capabilityFeatureFlagsOrch'
import { isCapacitorNative, initBrowserVaultFS, setVaultFSInstance } from './services/lego_blocks/fsBlock'
import { getUIShellThemeProfileOrch } from './services/orchestrators/uiThemeOrch'
import {
  readVaultUiPreferencesOrch,
  setExplorerIconStylePreferenceOrch,
  type ExplorerIconStyleBlock,
} from './services/orchestrators/vaultUiPreferencesOrch'
import {
  shouldCloseDrawerFromSwipeBlock,
  shouldIgnoreEdgeSwipeFromTargetBlock,
  shouldOpenDrawerFromSwipeBlock,
  shouldStartEdgeSwipeOpenBlock,
} from './services/lego_blocks/uiGestureBlock'
import { rankFuzzyItemsBlock } from './services/lego_blocks/fuzzySearchBlock'

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
}

const PRIMARY_NAV_ITEMS: NavItem[] = [
  { to: '/thinking-space', label: 'Thinking Space', icon: Compass },
  { to: '/new-thought', label: 'New Thought', icon: PlusSquare },
  { to: '/todos', label: 'Todos', icon: CheckSquare2 },
  { to: '/git-insights', label: 'Insights', icon: GitBranch },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  {
    to: '/thinking-organizer',
    label: 'Thinking Organizer',
    icon: FolderKanban,
    activePaths: ['/file-organizer'],
  },
]

const TOOL_NAV_ITEMS: NavItem[] = [
  { to: '/excalidraw-plugin', label: 'Excalidraw Plugin', icon: Sparkles },
  { to: '/format-excalidraw', label: 'Format for Excalidraw', icon: Sparkles },
  { to: '/mindmap-builder', label: 'Mindmap Builder', icon: Sparkles },
  { to: '/pdf-to-markdown', label: 'PDF to Markdown', icon: Sparkles },
  { to: '/transcript-cleaner', label: 'Transcript Cleaner', icon: Sparkles },
]

function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (pathname === item.to) return true
  return (item.activePaths ?? []).includes(pathname)
}

function createWorkspaceTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeTabRoute(route: string): string {
  const trimmed = route.trim()
  if (!trimmed) return '/thinking-space'
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function parseTabRoute(route: string): { pathname: string; search: URLSearchParams } {
  try {
    const parsed = new URL(normalizeTabRoute(route), 'https://ltm.local')
    return { pathname: parsed.pathname, search: parsed.searchParams }
  } catch {
    return { pathname: '/thinking-space', search: new URLSearchParams() }
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

function getTabLabel(route: string, labelByPath: Map<string, string>): string {
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

  return labelByPath.get(pathname) ?? 'Workspace'
}

function buildThinkingSpaceFileRoute(path: string): string {
  return `/thinking-space?file=${encodeURIComponent(path)}`
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
  const { themeId } = useUIThemeBlock()
  const shellThemeProfile = useMemo(() => getUIShellThemeProfileOrch(themeId), [themeId])
  const currentRoute = `${location.pathname}${location.search}${location.hash}`

  const featureFlags = getCapabilityFeatureFlags()
  const extensionBuilderEnabled = featureFlags.extension_host_enabled && featureFlags.extension_builder_enabled

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
  const commandInputRef = useRef<HTMLInputElement | null>(null)
  const pendingWorkspaceTabNavigationRef = useRef<{ tabId: string; route: string } | null>(null)
  const drawerEdgeSwipeStartRef = useRef<{ x: number; y: number } | null>(null)
  const drawerPanelSwipeStartRef = useRef<{ x: number; y: number } | null>(null)
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
      }))

    if (savedTabs.length > 0) return savedTabs

    return [{ id: createWorkspaceTabId(), route: normalizeTabRoute(currentRoute) }]
  })
  const [activeWorkspaceTabId, setActiveWorkspaceTabId] = useState(
    () => getStorageItem(STORAGE_KEYS.appShellActiveTabId) ?? '',
  )

  const utilityNavItems = useMemo(() => {
    const items: NavItem[] = [
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
    ...PRIMARY_NAV_ITEMS.map(item => ({
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
    ...TOOL_NAV_ITEMS.map(item => ({
      to: item.to,
      label: item.label,
      group: 'Excalidraw++' as const,
      activePaths: item.activePaths,
    })),
  ]), [utilityNavItems])

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

  const workspaceTabItems = useMemo<AppWorkspaceTabBlockModel[]>(
    () => workspaceTabs.map(tab => ({
      id: tab.id,
      label: getTabLabel(tab.route, routeLabelByPath),
    })),
    [routeLabelByPath, workspaceTabs],
  )

  const filteredCommandItems = useMemo(() => {
    const query = commandQuery.trim()
    if (!query) {
      return [...baseCommandItems, ...commandFileItems.slice(0, 24)]
    }
    const ranked = rankFuzzyItemsBlock({
      items: allCommandItems,
      query,
      limit: 80,
      getCandidates: (item) => [
        item.label,
        item.description ?? '',
        item.to,
        item.group,
        item.keywords ?? '',
      ],
    })
    return ranked.map(entry => entry.item)
  }, [allCommandItems, baseCommandItems, commandFileItems, commandQuery])

  const shell = useMemo(() => deriveAdaptiveShellStateOrch(layout), [layout])
  const keyboardVisible = layout.keyboardVisible
  const forceCompactNavForIosKeyboard = layout.surface === 'capacitor-ios' && keyboardVisible
  const compactNav = shell.compactNav || forceCompactNavForIosKeyboard
  const showBottomNav = false
  const isCapacitorSurface = layout.surface === 'capacitor-ios' || layout.surface === 'capacitor-android'
  const showCapacitorTopChromeMenu = compactNav && !drawerOpen && isCapacitorSurface
  const topInset = shell.topInset
  const rightInset = shell.rightInset
  const bottomInset = shell.bottomInset
  const leftInset = shell.leftInset
  const drawerBottomInset = shell.drawerBottomInset
  const shouldUsePhoneSafeBottomPadding = layout.surface === 'capacitor-ios' && layout.mode === 'phone' && !keyboardVisible
  const mainBottomPadding = keyboardVisible
    ? Math.max(0, Math.round(layout.keyboardInset))
    : (shouldUsePhoneSafeBottomPadding ? Math.max(bottomInset, 14) : 0)
  const commandPaletteTopPadding = Math.max(80, topInset + 56)
  const commandPaletteBottomPadding = Math.max(16, bottomInset + 12)
  const compactDrawerBaseOffset = layout.surface === 'capacitor-ios' ? 24 : 16
  const compactDrawerTriggerBottom = Math.max(
    bottomInset + (showBottomNav ? 72 : compactDrawerBaseOffset),
    compactDrawerBaseOffset,
  )
  const compactDrawerTriggerLeft = Math.max(16, leftInset + 16)
  const shellSafeAreaVars = useMemo<CSSProperties>(() => ({
    '--ltm-safe-top': `${topInset}px`,
    '--ltm-safe-right': `${rightInset}px`,
    '--ltm-safe-bottom': `${bottomInset}px`,
    '--ltm-safe-left': `${leftInset}px`,
  }) as CSSProperties, [bottomInset, leftInset, rightInset, topInset])

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

  const handleRequestVaultSwitch = useCallback(() => {
    setDrawerOpen(false)
    setCommandPaletteOpen(false)
    setVaultSwitchHardRefreshPending(true)
    setNeedsVaultSetup(true)
  }, [])

  const runCommandItem = useCallback((item: CommandItem) => {
    setCommandPaletteOpen(false)
    setCommandQuery('')
    navigate(item.to)
  }, [navigate])

  const handleCreateWorkspaceTab = useCallback(() => {
    const tab: AppWorkspaceTab = {
      id: createWorkspaceTabId(),
      route: '/thinking-space',
    }
    pendingWorkspaceTabNavigationRef.current = {
      tabId: tab.id,
      route: normalizeTabRoute(tab.route),
    }
    setWorkspaceTabs(prev => [...prev, tab])
    setActiveWorkspaceTabId(tab.id)
    navigate(tab.route)
  }, [navigate])

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

    import('@capacitor/core').then(({ registerPlugin }) => {
      const FolderPicker = registerPlugin<{
        restoreBookmark(): Promise<{ url: string; accessing: boolean }>
      }>('FolderPicker')
      FolderPicker.restoreBookmark().catch((err: unknown) => {
        console.warn('[App] Failed to restore bookmark, re-prompting vault setup:', err)
        setNeedsVaultSetup(true)
      })
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
    if (!compactNav) {
      setDrawerOpen(false)
    }
  }, [compactNav])

  useEffect(() => {
    if (!compactNav || drawerOpen || keyboardVisible) {
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
  }, [compactNav, drawerOpen, keyboardVisible])

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

  useEffect(() => {
    if (needsVaultSetup) return
    smartSync().catch((err) => {
      console.error('Failed to sync vault to IndexedDB cache', err)
    })
  }, [needsVaultSetup])

  useEffect(() => {
    if (needsVaultSetup) return
    let cancelled = false
    void readVaultUiPreferencesOrch()
      .then((preferences) => {
        if (cancelled) return
        setExplorerIconStyle(preferences.explorerIconStyle)
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
      if (prev[index].route === normalizedCurrentRoute) return prev
      const next = prev.slice()
      next[index] = { ...next[index], route: normalizedCurrentRoute }
      return next
    })
  }, [activeWorkspaceTabId, currentRoute])

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
      const route = normalizeTabRoute(customEvent.detail ?? '/thinking-space')
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

  if (needsVaultSetup) {
    return (
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
    )
  }

  return (
    <div
      className="ltm-app-shell"
      style={shellSafeAreaVars}
      data-ltm-mode={layout.mode}
      data-ltm-surface={layout.surface}
      data-ltm-route={location.pathname}
      data-ltm-shell-material={shellThemeProfile.material}
      data-ltm-shell-motion={shellThemeProfile.motion}
      data-ltm-theme={themeId}
      data-ltm-explorer-icon-style={explorerIconStyle}
    >
      <div className="ltm-shell-layer-base">
        <div
          className="ltm-shell-stage"
          style={topInset ? { paddingTop: `calc(${topInset}px + var(--ltm-shell-inset))` } : undefined}
        >
        <section className="ltm-shell-main-stage">
          <header className={`ltm-shell-top-chrome ltm-shell-motion-chrome ${showCapacitorTopChromeMenu ? 'justify-start gap-2' : ''}`}>
            {showCapacitorTopChromeMenu && (
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="ltm-mobile-drawer-trigger ltm-motion-fast ltm-shell-field-surface inline-flex h-8 min-w-[5.5rem] shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-foreground shadow-sm"
                aria-label="Open navigation"
              >
                <Menu className="h-3 w-3" />
                <span>Menu</span>
              </button>
            )}
            <AppTabsBlock
              tabs={workspaceTabItems}
              activeTabId={activeWorkspaceTabId}
              onSelectTab={handleSelectWorkspaceTab}
              onCreateTab={handleCreateWorkspaceTab}
              onCloseTab={handleCloseWorkspaceTab}
              className={showCapacitorTopChromeMenu ? 'min-w-0 flex-1' : 'ltm-shell-top-tab-capsule'}
            />
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
                  <div className="space-y-1">
                    {!sidebarCollapsed && (
                      <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Core
                      </div>
                    )}
                    {PRIMARY_NAV_ITEMS.map((item) => {
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

                  <div className="mt-5 space-y-1">
                    {!sidebarCollapsed && (
                      <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Workspace
                      </div>
                    )}
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

                  <div className="mt-5 space-y-1">
                    {!sidebarCollapsed && (
                      <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Excalidraw++
                      </div>
                    )}
                    {TOOL_NAV_ITEMS.map((item) => {
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
                </div>

                <div className="ltm-sidebar-actions space-y-2">
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
                    className={`ltm-shell-logo ltm-shell-field-surface ltm-motion-fast mt-2 inline-flex items-center rounded-lg ${
                      sidebarCollapsed
                        ? 'h-10 w-full justify-center'
                        : 'gap-2 px-2.5 py-2 text-sm font-semibold tracking-tight'
                    }`}
                  >
                    <span className="inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full">
                      <AppBrandGlyph className="h-full w-full" />
                    </span>
                    {!sidebarCollapsed && <span>Think Space</span>}
                  </Link>
                </div>
                </div>
              </aside>
            )}
          <main
            className="ltm-app-main ltm-shell-main ltm-shell-content-stage"
            style={mainBottomPadding ? { paddingBottom: `${mainBottomPadding}px` } : undefined}
          >
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/thinking-space" element={<ThinkingSpace />} />
              <Route path="/thinking-organizer" element={<ThinkingOrganizer />} />
              <Route path="/file-organizer" element={<ThinkingOrganizer />} />
              <Route path="/excalidraw-plugin" element={<ExcalidrawPlugin />} />
              <Route path="/format-excalidraw" element={<FormatExcalidraw />} />
              <Route path="/mindmap-builder" element={<MindmapBuilder />} />
              <Route path="/git-insights" element={<GitInsights />} />
              <Route path="/pdf-to-markdown" element={<PdfToMarkdown />} />
              <Route path="/transcript-cleaner" element={<TranscriptCleaner />} />
              <Route path="/new-thought" element={<NewThought />} />
              <Route path="/todos" element={<Todos />} />
              <Route path="/chat" element={<Chat />} />
              <Route
                path="/settings"
                element={
                  <Settings
                    explorerIconStyle={explorerIconStyle}
                    onExplorerIconStyleChange={handleExplorerIconStyleChange}
                    onRequestVaultSwitch={handleRequestVaultSwitch}
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
                Think Space
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
                  {PRIMARY_NAV_ITEMS.map((item) => {
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
                  {TOOL_NAV_ITEMS.map((item) => {
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
                        <Sparkles className="h-4 w-4" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    )
                  })}
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
            <div className="ltm-cmd-card ltm-shell-command-card ltm-shell-command-surface ltm-shell-motion-modal max-h-full w-full max-w-2xl overflow-hidden rounded-2xl">
              <div className="ltm-shell-segment-header p-3">
                <div className="ltm-shell-field-surface flex items-center gap-2 rounded-lg px-2.5">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input
                    ref={commandInputRef}
                    value={commandQuery}
                    onChange={(event) => setCommandQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && filteredCommandItems.length > 0) {
                        event.preventDefault()
                        runCommandItem(filteredCommandItems[0])
                      }
                    }}
                    placeholder="Jump to a page or file..."
                    className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </div>
              <div className="max-h-[min(58vh,520px)] overflow-y-auto p-2">
                {filteredCommandItems.length === 0 ? (
                  <div className="rounded-lg px-3 py-4 text-sm text-muted-foreground">
                    No matches. Try another keyword.
                  </div>
                ) : (
                  filteredCommandItems.map(item => {
                    const active = isNavItemActive(location.pathname, {
                      to: item.to,
                      label: item.label,
                      icon: Sparkles,
                      activePaths: item.activePaths,
                    })
                    return (
                      <button
                        key={`${item.group}:${item.to}`}
                        type="button"
                        onClick={() => runCommandItem(item)}
                        className={`ltm-motion-fast ltm-touch-row flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          active ? 'bg-foreground text-background' : 'hover:bg-muted'
                        }`}
                      >
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
                      </button>
                    )
                  })
                )}
              </div>
              <div className="ltm-shell-segment-footer px-3 py-2 text-[11px] text-muted-foreground">
                Enter to open first result · Esc to close · Cmd/Ctrl+K to reopen
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  )
}

export default App
