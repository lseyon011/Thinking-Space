import { Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import {
  Bot,
  CheckSquare2,
  Compass,
  FolderKanban,
  GitBranch,
  Menu,
  MessageSquare,
  PanelLeft,
  PanelLeftClose,
  PlusSquare,
  Search,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react'
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
import AiSettings from './pages/AiSettings'
import ExtensionBuilder from './pages/ExtensionBuilder'
import VaultSetup from './components/orchestrators/VaultSetupOrch'
import { useUILayoutBlock } from './components/lego_blocks/UILayoutBlock'
import { deriveAdaptiveShellStateOrch } from './services/orchestrators/uiNavigationOrch'
import { isElectron, setVaultRoot } from './services/orchestrators/runtimeOrch'
import { smartSync } from './services/orchestrators/vaultSyncOrch'
import {
  STORAGE_KEYS,
  getStoredVaultRoot,
  getStorageItem,
  setStorageItem,
} from './services/orchestrators/storageOrch'
import { getCapabilityFeatureFlags } from './services/orchestrators/capabilityFeatureFlagsOrch'
import { isCapacitorNative, initBrowserVaultFS, setVaultFSInstance } from './services/lego_blocks/fsBlock'

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
  group: 'Core' | 'Workspace' | 'Excalidraw++'
  activePaths?: string[]
  keywords?: string
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

const BOTTOM_NAV_PATHS = new Set([
  '/thinking-space',
  '/new-thought',
  '/todos',
  '/chat',
  '/thinking-organizer',
])

function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (pathname === item.to) return true
  return (item.activePaths ?? []).includes(pathname)
}

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const { layout } = useUILayoutBlock()

  const featureFlags = getCapabilityFeatureFlags()
  const extensionBuilderEnabled = featureFlags.extension_host_enabled && featureFlags.extension_builder_enabled

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => getStorageItem(STORAGE_KEYS.appShellSidebarCollapsed) === '1',
  )
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const commandInputRef = useRef<HTMLInputElement | null>(null)
  const drawerEdgeSwipeStartRef = useRef<{ x: number; y: number } | null>(null)
  const drawerPanelSwipeStartRef = useRef<{ x: number; y: number } | null>(null)
  const [needsVaultSetup, setNeedsVaultSetup] = useState(() => {
    const stored = getStoredVaultRoot()
    if (!stored) return true
    // On Capacitor, reject stale absolute paths from older versions
    if (isCapacitorNative() && stored.startsWith('/')) return true
    return false
  })

  const utilityNavItems = useMemo(() => {
    const items: NavItem[] = [
      { to: '/ai-settings', label: 'AI Settings', icon: Bot },
      { to: '/capabilities', label: 'Capabilities', icon: Wrench },
    ]
    if (extensionBuilderEnabled) {
      items.splice(1, 0, { to: '/extension-builder', label: 'Extension Builder', icon: Sparkles })
    }
    return items
  }, [extensionBuilderEnabled])

  const allNavItems = useMemo(
    () => [...PRIMARY_NAV_ITEMS, ...utilityNavItems, ...TOOL_NAV_ITEMS],
    [utilityNavItems],
  )

  const commandItems = useMemo<CommandItem[]>(() => ([
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

  const bottomNavItems = useMemo(
    () => PRIMARY_NAV_ITEMS.filter(item => BOTTOM_NAV_PATHS.has(item.to)),
    [],
  )

  const currentRouteLabel = useMemo(
    () => allNavItems.find(item => isNavItemActive(location.pathname, item))?.label ?? 'Thinking Space',
    [allNavItems, location.pathname],
  )

  const filteredCommandItems = useMemo(() => {
    const query = commandQuery.trim().toLowerCase()
    if (!query) return commandItems
    return commandItems.filter(item => (
      `${item.label} ${item.to} ${item.group} ${item.keywords ?? ''}`.toLowerCase().includes(query)
    ))
  }, [commandItems, commandQuery])

  const shell = useMemo(() => deriveAdaptiveShellStateOrch(layout), [layout])
  const compactNav = shell.compactNav
  const keyboardVisible = shell.keyboardVisibleCompact
  const showBottomNav = shell.showBottomNav
  const topInset = shell.topInset
  const bottomInset = shell.bottomInset
  const drawerBottomInset = shell.drawerBottomInset
  const mainBottomPadding = shell.mainBottomPadding
  const iosSurface = layout.surface === 'capacitor-ios'
  const commandPaletteTopPadding = Math.max(80, topInset + 56)
  const commandPaletteBottomPadding = Math.max(16, bottomInset + 12)

  const openCommandPalette = useCallback(() => {
    setCommandQuery('')
    setCommandPaletteOpen(true)
  }, [])

  const closeCommandPalette = useCallback(() => {
    setCommandPaletteOpen(false)
  }, [])

  const runCommandItem = useCallback((item: CommandItem) => {
    setCommandPaletteOpen(false)
    setCommandQuery('')
    navigate(item.to)
  }, [navigate])

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
    const deltaY = Math.abs(touch.clientY - start.y)
    if (deltaX < -56 && deltaY < 44) {
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
  }, [location.pathname])

  useEffect(() => {
    if (!compactNav) {
      setDrawerOpen(false)
    }
  }, [compactNav])

  useEffect(() => {
    if (!compactNav || drawerOpen) {
      drawerEdgeSwipeStartRef.current = null
      return
    }

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch) return
      if (touch.clientX > 24) return
      drawerEdgeSwipeStartRef.current = { x: touch.clientX, y: touch.clientY }
    }

    const handleTouchMove = (event: TouchEvent) => {
      const start = drawerEdgeSwipeStartRef.current
      if (!start) return
      const touch = event.touches[0]
      if (!touch) return
      const deltaX = touch.clientX - start.x
      const deltaY = Math.abs(touch.clientY - start.y)
      if (deltaX > 72 && deltaY < 44) {
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
  }, [compactNav, drawerOpen])

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
    const onKeyDown = (event: KeyboardEvent) => {
      const withMeta = event.metaKey || event.ctrlKey
      if (withMeta && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandQuery('')
        setCommandPaletteOpen(true)
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
  }, [compactNav])

  useEffect(() => {
    if (needsVaultSetup) return
    smartSync().catch((err) => {
      console.error('Failed to sync vault to IndexedDB cache', err)
    })
  }, [needsVaultSetup])

  if (needsVaultSetup) {
    return (
      <VaultSetup
        onComplete={(vaultRoot) => {
          setVaultRoot(vaultRoot)
          setNeedsVaultSetup(false)
        }}
      />
    )
  }

  return (
    <div className="ltm-app-shell">
      <header
        className={`sticky top-0 z-50 border-b border-border/70 ${
          iosSurface
            ? 'bg-background/70 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60'
            : 'bg-background/85 backdrop-blur-xl'
        }`}
        style={topInset ? { paddingTop: `${topInset}px` } : undefined}
      >
        <div className="mx-auto w-full px-2 sm:px-3 md:px-4">
          <div className="flex h-14 items-center justify-between gap-2">
            {compactNav ? (
              <>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="ltm-motion-fast ltm-touch-target inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background text-foreground"
                  aria-label="Open navigation"
                >
                  <Menu className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1 truncate px-1 text-sm font-semibold tracking-tight">
                  {currentRouteLabel}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={openCommandPalette}
                    className="ltm-motion-fast ltm-touch-target inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background text-foreground"
                    aria-label="Open quick search"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                  <Link
                    to="/"
                    className="ltm-motion-fast ltm-touch-target inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background"
                    aria-label="Home"
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path d="M9.167 4.5a1.167 1.167 0 1 1-2.334 0 1.167 1.167 0 0 1 2.334 0" />
                        <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0M1 8a7 7 0 0 1 7-7 3.5 3.5 0 1 1 0 7 3.5 3.5 0 1 0 0 7 7 7 0 0 1-7-7m7 4.667a1.167 1.167 0 1 1 0-2.334 1.167 1.167 0 0 1 0 2.334" />
                      </svg>
                    </span>
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed(prev => !prev)}
                    className="ltm-motion-fast ltm-touch-target inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background text-foreground"
                    title={sidebarCollapsed ? 'Expand sidebar (Cmd/Ctrl+\\)' : 'Collapse sidebar (Cmd/Ctrl+\\)'}
                    aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  >
                    {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                  </button>
                  <Link to="/" className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path d="M9.167 4.5a1.167 1.167 0 1 1-2.334 0 1.167 1.167 0 0 1 2.334 0" />
                        <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0M1 8a7 7 0 0 1 7-7 3.5 3.5 0 1 1 0 7 3.5 3.5 0 1 0 0 7 7 7 0 0 1-7-7m7 4.667a1.167 1.167 0 1 1 0-2.334 1.167 1.167 0 0 1 0 2.334" />
                      </svg>
                    </span>
                    LTM Pilot
                  </Link>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openCommandPalette}
                    className="ltm-motion-fast ltm-touch-target inline-flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-background px-3 text-sm text-muted-foreground hover:text-foreground"
                    aria-label="Open quick search"
                  >
                    <Search className="h-4 w-4" />
                    <span className="hidden lg:inline">Search</span>
                    <span className="rounded border border-border/60 px-1.5 py-0.5 text-[10px] leading-none">⌘K</span>
                  </button>
                  <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    {layout.mode} · {layout.orientation}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {!compactNav && (
          <aside className={`hidden shrink-0 border-r border-border/70 transition-[width] duration-200 lg:block ${
            iosSurface ? 'bg-card/40 backdrop-blur-md' : 'bg-card/30'
          } ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
            <div className={`h-[calc(100dvh-3.5rem)] overflow-y-auto py-3 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
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
          </aside>
        )}

        <main
          className="ltm-app-main min-w-0"
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
            <Route path="/ai-settings" element={<AiSettings />} />
            <Route
              path="/extension-builder"
              element={extensionBuilderEnabled ? <ExtensionBuilder /> : <Navigate to="/capabilities" replace />}
            />
            <Route path="/capabilities" element={<CapabilityDiscovery />} />
          </Routes>
        </main>
      </div>

      {compactNav && drawerOpen && (
        <>
          <div
            className={`fixed inset-0 z-40 ltm-animate-fade-in ${
              iosSurface ? 'bg-background/55 backdrop-blur-md' : 'bg-background/65 backdrop-blur-sm'
            }`}
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            className={`fixed inset-y-0 left-0 z-50 w-[84vw] max-w-[420px] border-r border-border/70 ltm-animate-slide-in-left ${
              iosSurface ? 'bg-background/88 backdrop-blur-xl' : 'bg-background'
            } shadow-2xl`}
            onTouchStart={handleDrawerTouchStart}
            onTouchMove={handleDrawerTouchMove}
            onTouchEnd={handleDrawerTouchEnd}
            onTouchCancel={handleDrawerTouchEnd}
          >
            <div className="flex h-12 items-center justify-between border-b border-border/60 px-3">
              <span className="text-sm font-semibold tracking-tight">Navigation</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="ltm-touch-target inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              className="h-[calc(100%-3rem)] overflow-y-auto p-3"
              style={drawerBottomInset ? { paddingBottom: `${drawerBottomInset + 12}px` } : undefined}
            >
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
          </aside>
        </>
      )}

      {commandPaletteOpen && (
        <>
          <div
            className={`fixed inset-0 z-50 ltm-animate-fade-in ${
              iosSurface ? 'bg-background/55 backdrop-blur-md' : 'bg-background/70 backdrop-blur-sm'
            }`}
            onClick={closeCommandPalette}
          />
          <div
            className="fixed inset-0 z-[60] flex items-start justify-center p-3 sm:p-4"
            style={{ paddingTop: `${commandPaletteTopPadding}px`, paddingBottom: `${commandPaletteBottomPadding}px` }}
          >
            <div className={`max-h-full w-full max-w-2xl overflow-hidden rounded-2xl border border-border/70 ltm-animate-slide-up shadow-2xl ${
              iosSurface ? 'bg-background/88 backdrop-blur-xl' : 'bg-background'
            }`}>
              <div className="border-b border-border/60 p-3">
                <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-2.5">
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
                    placeholder="Jump to a page..."
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
                        <span className="truncate">{item.label}</span>
                        <span className={`ml-2 text-[10px] uppercase tracking-[0.14em] ${active ? 'text-background/80' : 'text-muted-foreground'}`}>
                          {item.group}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
              <div className="border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
                Enter to open first result · Esc to close · Cmd/Ctrl+K to reopen
              </div>
            </div>
          </div>
        </>
      )}

      {showBottomNav && (
        <nav
          className={`fixed bottom-0 left-0 right-0 z-40 border-t border-border/70 ${
            iosSurface
              ? 'bg-background/78 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/68'
              : 'bg-background/95 backdrop-blur-xl'
          }`}
          style={bottomInset ? { paddingBottom: `${bottomInset}px` } : undefined}
        >
          <div className="grid h-14 grid-cols-5 items-center px-1">
            {bottomNavItems.map((item) => {
              const Icon = item.icon
              const active = isNavItemActive(location.pathname, item)
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`ltm-touch-row flex h-full min-w-0 flex-col items-center justify-center gap-1 text-[11px] ${
                    active ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate px-1">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}

export default App
