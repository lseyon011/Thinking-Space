import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState, type ComponentType } from 'react'
import {
  Bot,
  CheckSquare2,
  Compass,
  FolderKanban,
  GitBranch,
  Menu,
  MessageSquare,
  PlusSquare,
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
import { isElectron, setVaultRoot } from './services/orchestrators/runtimeOrch'
import { smartSync } from './services/orchestrators/vaultSyncOrch'
import { getStoredVaultRoot } from './services/orchestrators/storageOrch'
import { getCapabilityFeatureFlags } from './services/orchestrators/capabilityFeatureFlagsOrch'
import { isCapacitorNative, initBrowserVaultFS, setVaultFSInstance } from './services/lego_blocks/fsBlock'

type NavIcon = ComponentType<{ className?: string }>

interface NavItem {
  to: string
  label: string
  icon: NavIcon
  activePaths?: string[]
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
  const { layout } = useUILayoutBlock()

  const featureFlags = getCapabilityFeatureFlags()
  const extensionBuilderEnabled = featureFlags.extension_host_enabled && featureFlags.extension_builder_enabled

  const [drawerOpen, setDrawerOpen] = useState(false)
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

  const bottomNavItems = useMemo(
    () => PRIMARY_NAV_ITEMS.filter(item => BOTTOM_NAV_PATHS.has(item.to)),
    [],
  )

  const currentRouteLabel = useMemo(
    () => allNavItems.find(item => isNavItemActive(location.pathname, item))?.label ?? 'Thinking Space',
    [allNavItems, location.pathname],
  )

  const compactNav = !layout.hasSidebar
  const showBottomNav = compactNav && layout.hasBottomBar
  const bottomInset = Math.max(0, Math.round(layout.safeAreaInsets.bottom))
  const bottomOffset = showBottomNav ? 60 + bottomInset : 0

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
  }, [location.pathname])

  useEffect(() => {
    if (!compactNav) {
      setDrawerOpen(false)
    }
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
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto w-full px-2 sm:px-3 md:px-4">
          <div className="flex h-14 items-center justify-between gap-2">
            {compactNav ? (
              <>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background text-foreground"
                  aria-label="Open navigation"
                >
                  <Menu className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1 truncate px-1 text-sm font-semibold tracking-tight">
                  {currentRouteLabel}
                </div>
                <Link
                  to="/"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background"
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
              </>
            ) : (
              <>
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
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {layout.mode} · {layout.orientation}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {!compactNav && (
          <aside className="hidden w-64 shrink-0 border-r border-border/70 bg-card/30 lg:block">
            <div className="h-[calc(100dvh-3.5rem)] overflow-y-auto px-3 py-3">
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
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
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
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
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
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
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
        )}

        <main
          className="ltm-app-main min-w-0"
          style={bottomOffset ? { paddingBottom: `${bottomOffset}px` } : undefined}
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
            className="fixed inset-0 z-40 bg-background/65 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-[84vw] max-w-[360px] border-r border-border/70 bg-background shadow-2xl">
            <div className="flex h-12 items-center justify-between border-b border-border/60 px-3">
              <span className="text-sm font-semibold tracking-tight">Navigation</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="h-[calc(100%-3rem)] overflow-y-auto p-3">
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
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
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
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
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
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
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

      {showBottomNav && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur-xl"
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
                  className={`flex h-full min-w-0 flex-col items-center justify-center gap-1 text-[11px] ${
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
