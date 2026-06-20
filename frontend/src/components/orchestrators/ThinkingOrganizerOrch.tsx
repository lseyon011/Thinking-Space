import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Eye, FolderTree, Handshake, LayoutDashboard, Layers, Lightbulb, Link2, ListChecks, Loader2, Pencil, Play, Plus, X, type LucideIcon } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useSessionStateBlock } from '@/components/lego_blocks/hooks/shared/useSessionStateBlock'
import { Button } from '@/components/lego_blocks/units/ui/button'
import type { NodeRecord } from '@/services/lego_blocks/integrations/dbBlock'
import type { NodeType } from '@/services/lego_blocks/units/yamlNoteBlock'
import { useMarkdownViewer } from '@/components/orchestrators/MarkdownViewerOrch'
import { defaultNodeKindLabel } from '@/components/lego_blocks/integrations/HierarchyTreeBlock'
import { invokeCapabilityOrThrow } from '@/services/orchestrators/capabilityRouterOrch'
import type { CapabilityActor } from '@/services/lego_blocks/integrations/capabilityRegistryBlock'
import {
  STORAGE_KEYS,
  getStorageItem,
  getJsonStorageItem,
  setJsonStorageItem,
  setStorageItem,
} from '@/services/orchestrators/storageOrch'
import {
  dispatchOrganizerSidebarChromeStateBlock,
  ORGANIZER_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK,
  ORGANIZER_SIDEBAR_CHROME_TOGGLE_HEADER_EVENT_BLOCK,
} from '@/services/lego_blocks/units/organizerSidebarChromeBlock'
import {
  readOrganizerUiStateOrch,
  writeOrganizerUiStateOrch,
  type OrganizerUiStateOrch,
} from '@/services/orchestrators/organizerUiStateOrch'
import BacklogOrch, {
  ORGANIZER_OPEN_CREATE_PROJECT_EVENT,
  ORGANIZER_PROJECTS_UPDATED_EVENT,
  type OrganizerProjectsUpdatedDetail,
} from '@/components/orchestrators/BacklogOrch'
import LinkingOrch from '@/components/orchestrators/LinkingOrch'
import ThinkingOrgCanvasOrch from '@/components/orchestrators/ThinkingOrgCanvasOrch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/lego_blocks/units/ui/card'
import { cn } from '@/lib/utils'
import { useUILayoutBlock } from '@/components/lego_blocks/hooks/shared/useUILayoutBlock'
import { useIosSidebarSwipeBlock } from '@/components/lego_blocks/hooks/shared/useIosSidebarSwipeBlock'
import { useNativeBackHandlerBlock } from '@/components/lego_blocks/hooks/shared/useNativeBackHandlerBlock'
import { isCapacitorNative } from '@/services/lego_blocks/integrations/fsBlock'
import {
  pushNativeWithForwardBlock,
  setNativeNavigationStackBlock,
} from '@/services/lego_blocks/units/topChromeNativeBridgeBlock'

type TabMode = 'backlog' | 'view' | 'board' | 'link'
const PROJECT_ROOT_QUERY_PARAM = 'projectRoot'
const THINKING_ORGANIZER_TABS: Array<{ id: TabMode; label: string; icon: LucideIcon }> = [
  { id: 'backlog', label: 'Create', icon: Plus },
  { id: 'view', label: 'View', icon: Eye },
  { id: 'board', label: 'Board', icon: LayoutDashboard },
  { id: 'link', label: 'Link', icon: Link2 },
]

function nodeIcon(type: NodeType) {
  if (type === 'program') return FolderTree
  if (type === 'epic') return Layers
  if (type === 'task') return ListChecks
  if (type === 'run') return Play
  if (type === 'handoff') return Handshake
  return Lightbulb
}

function errorMessage(value: unknown, fallback: string): string {
  if (value instanceof Error && value.message) return value.message
  if (typeof value === 'string' && value.trim()) return value
  return fallback
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

const VIEW_ACTOR: CapabilityActor = {
  kind: 'human',
  id: 'ui.organizer-view',
}

function parseTabMode(raw: string | null): TabMode | null {
  if (raw === 'backlog' || raw === 'view' || raw === 'board' || raw === 'link') return raw
  return null
}

function usePersistentTab(): [TabMode, (value: TabMode) => void] {
  const [tab, setTab] = useSessionStateBlock<TabMode>('organizer-tab', () => {
    const saved = parseTabMode(getStorageItem(STORAGE_KEYS.thinkingOrganizerTab))
    return saved ?? 'backlog'
  })

  useEffect(() => {
    setStorageItem(STORAGE_KEYS.thinkingOrganizerTab, tab)
  }, [tab])

  return [tab, setTab]
}

function ViewTab() {
  const { openFile } = useMarkdownViewer()
  const [programs, setPrograms] = useState<NodeRecord[]>([])
  const [selectedPath, setSelectedPath] = useSessionStateBlock<NodeRecord[]>('organizer-view-path', [])
  const [currentNodes, setCurrentNodes] = useState<NodeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [nodesLoading, setNodesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // On mount: load programs, then restore saved path if any.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const { nodes: roots } = await invokeCapabilityOrThrow({
          capability: 'organizer.nodes.list_roots',
          input: { typeFilter: 'program' },
          actor: VIEW_ACTOR,
        })
        if (cancelled) return
        const sorted = roots.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
        setPrograms(sorted)

        // Restore saved drill-down path from session
        const saved = selectedPath
        if (saved.length > 0) {
          const deepest = saved[saved.length - 1]
          try {
            const { nodes: children } = await invokeCapabilityOrThrow({
              capability: 'organizer.nodes.list_children',
              input: { parentKey: deepest.key },
              actor: VIEW_ACTOR,
            })
            if (!cancelled) setCurrentNodes(children.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '')))
          } catch {
            // If restoring fails (node deleted?), fall back to root
            if (!cancelled) {
              setSelectedPath([])
              setCurrentNodes(sorted)
            }
          }
        } else {
          setCurrentNodes(sorted)
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, 'Failed to load programs'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; selectedPath read from session initial value
  }, [])

  const openPathNode = useCallback(async (node: NodeRecord) => {
    setError(null)
    setNodesLoading(true)
    const nextPath = [...selectedPath, node]
    setSelectedPath(nextPath)

    try {
      const { nodes: children } = await invokeCapabilityOrThrow({
        capability: 'organizer.nodes.list_children',
        input: { parentKey: node.key },
        actor: VIEW_ACTOR,
      })
      setCurrentNodes(children.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '')))
    } catch (err) {
      setError(errorMessage(err, 'Failed to load children'))
    } finally {
      setNodesLoading(false)
    }
  }, [selectedPath])

  const rewindPath = useCallback(async (index: number) => {
    const nextPath = selectedPath.slice(0, index + 1)
    setSelectedPath(nextPath)
    const parent = nextPath[nextPath.length - 1]
    setNodesLoading(true)
    setError(null)
    try {
      const { nodes: children } = await invokeCapabilityOrThrow({
        capability: 'organizer.nodes.list_children',
        input: { parentKey: parent.key },
        actor: VIEW_ACTOR,
      })
      setCurrentNodes(children.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '')))
    } catch (err) {
      setError(errorMessage(err, 'Failed to rewind path'))
    } finally {
      setNodesLoading(false)
    }
  }, [selectedPath])

  const resetToPrograms = useCallback(() => {
    setSelectedPath([])
    setCurrentNodes(programs)
  }, [programs])

  const levelLabel = selectedPath.length === 0 ? 'Programs' : 'Children'

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Hierarchy View</CardTitle>
          <CardDescription>
            Start at programs and drill down through your hierarchy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted"
              onClick={resetToPrograms}
            >
              Programs
            </button>
            {selectedPath.map((node, idx) => (
              <span key={node.uuid} className="inline-flex items-center gap-1.5">
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted"
                  onClick={() => {
                    void rewindPath(idx)
                  }}
                >
                  {node.title}
                </button>
              </span>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading programs...
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {levelLabel}
              </div>
              <div className={nodesLoading ? 'pointer-events-none opacity-60 transition-opacity' : 'transition-opacity'}>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {currentNodes.map(node => {
                    const Icon = nodeIcon(node.type)
                    return (
                      <button
                        key={node.uuid}
                        type="button"
                        className="rounded-xl border border-border/60 bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                        onClick={() => {
                          void openPathNode(node)
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <div className="truncate text-sm font-medium">{node.title}</div>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {defaultNodeKindLabel(node.type)}
                          {node.status !== 'active' && ` \u00b7 ${node.status}`}
                        </div>
                        {node.aiSummary && (
                          <div className="mt-1 truncate text-xs text-muted-foreground/70">
                            {node.aiSummary}
                          </div>
                        )}
                      </button>
                    )
                  })}
                  {currentNodes.length === 0 && !nodesLoading && (
                    <div className="rounded-xl border border-dashed border-border/70 px-3 py-6 text-sm text-muted-foreground">
                      No nodes at this level.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedPath.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Node Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            {(() => {
              const node = selectedPath[selectedPath.length - 1]
              return (
                <>
                  <div>Title: <span className="font-medium text-foreground">{node.title}</span></div>
                  <div>Type: {defaultNodeKindLabel(node.type)}</div>
                  <div>Key: <span className="font-mono">{node.key}</span></div>
                  <div>Path: <span className="font-mono">{node.filePath}</span></div>
                  {node.tags && node.tags.length > 0 && <div>Tags: {node.tags.join(', ')}</div>}
                  <Button size="sm" variant="outline" onClick={() => openFile(node.filePath)}>
                    Open File
                  </Button>
                </>
              )
            })()}
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  )
}

const ORGANIZER_SIDEBAR_COLLAPSED_KEY = 'organizer_sidebar_collapsed'

interface ProjectEntry {
  name: string
  root: string
}

interface ThinkingOrganizerOrchProps {
  active?: boolean
}

export default function ThinkingOrganizerOrch({ active = true }: ThinkingOrganizerOrchProps) {
  const { layout } = useUILayoutBlock()
  const isIos = layout.surface === 'capacitor-ios'
  const isIPhoneIosSurface = isIos && layout.mode === 'phone'
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = usePersistentTab()

  // iPhone list/detail mode. On entering Organizer from the rail, the user
  // lands on the sidebar (tabs + projects) full-screen; tapping a tab pushes
  // into the tab's content. Back chevron / edge-swipe / projects-on-sidebar-
  // tap returns to the list. Project taps are context-only (no push).
  const [phonePickedTab, setPhonePickedTab] = useState(false)
  const phoneListMode = isIPhoneIosSurface && !phonePickedTab
  const phoneDetailMode = isIPhoneIosSurface && phonePickedTab

  useNativeBackHandlerBlock({
    active: phoneDetailMode,
    onBack: () => setPhonePickedTab(false),
  })

  const pushPhoneTab = useCallback((nextTab: TabMode) => {
    if (!(isCapacitorNative() && isIPhoneIosSurface)) {
      setTab(nextTab)
      return
    }
    void (async () => {
      try {
        await setNativeNavigationStackBlock(['/thinking-organizer'])
        await pushNativeWithForwardBlock('/thinking-organizer', () => {
          setTab(nextTab)
          setPhonePickedTab(true)
        })
      } catch (err) {
        console.warn('[Organizer] phone tab push failed, falling back', err)
        setTab(nextTab)
        setPhonePickedTab(true)
      }
    })()
  }, [isIPhoneIosSurface, setTab])
  const [mountedTabs, setMountedTabs] = useState<Record<TabMode, boolean>>(() => ({
    backlog: tab === 'backlog',
    view: tab === 'view',
    board: tab === 'board',
    link: tab === 'link',
  }))
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    const stored = window.localStorage.getItem(ORGANIZER_SIDEBAR_COLLAPSED_KEY)
    return stored === '1'
  })
  const [pinBoardHeaderVisible, setPinBoardHeaderVisible] = useState(true)
  const [pinBoardActive, setPinBoardActive] = useState(false)

  // Project context
  const [projectUiState, setProjectUiState] = useState<OrganizerUiStateOrch | null>(null)
  const [projectEntries, setProjectEntries] = useState<ProjectEntry[]>(
    () => getJsonStorageItem<ProjectEntry[]>(STORAGE_KEYS.thinkingOrganizerProjects, []),
  )
  const projectRoot = normalizePath(searchParams.get(PROJECT_ROOT_QUERY_PARAM) ?? '')

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<OrganizerProjectsUpdatedDetail>).detail
      if (detail?.projects) setProjectEntries(detail.projects)
    }
    window.addEventListener(ORGANIZER_PROJECTS_UPDATED_EVENT, handler)
    return () => window.removeEventListener(ORGANIZER_PROJECTS_UPDATED_EVENT, handler)
  }, [])
  const [editingMission, setEditingMission] = useState(false)
  const [missionDraft, setMissionDraft] = useState('')
  const [savingMission, setSavingMission] = useState(false)
  const missionTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  const selectProject = useCallback((root: string) => {
    const normalized = normalizePath(root)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (normalized) next.set(PROJECT_ROOT_QUERY_PARAM, normalized)
      else next.delete(PROJECT_ROOT_QUERY_PARAM)
      return next
    }, { replace: true })
    setJsonStorageItem(
      STORAGE_KEYS.thinkingOrganizerSelectedProjectRoot,
      normalized ? normalized.split('/') : [],
    )
  }, [setSearchParams])


  useEffect(() => {
    if (!projectRoot) { setProjectUiState(null); return }
    let cancelled = false
    void readOrganizerUiStateOrch(projectRoot).then(state => {
      if (!cancelled) setProjectUiState(state)
    })
    return () => { cancelled = true }
  }, [projectRoot])

  const activeTabLabel = THINKING_ORGANIZER_TABS.find(t => t.id === tab)?.label ?? tab
  const projectName = projectUiState?.projectName
    || (projectRoot ? (projectRoot.split('/').pop() ?? projectRoot) : '')
  const missionStatement = projectUiState?.missionStatement ?? ''

  const startEditMission = useCallback(() => {
    setMissionDraft(missionStatement)
    setEditingMission(true)
    setTimeout(() => missionTextareaRef.current?.focus(), 0)
  }, [missionStatement])

  const saveMission = useCallback(async () => {
    if (!projectRoot) return
    setSavingMission(true)
    try {
      const current = await readOrganizerUiStateOrch(projectRoot)
      const base: OrganizerUiStateOrch = current ?? {
        schemaVersion: 2,
        updatedAt: new Date().toISOString(),
        pinBoardGroups: [],
        presetTags: [],
        tagColors: {},
        programGroups: [],
      }
      const updated = await writeOrganizerUiStateOrch(projectRoot, {
        ...base,
        missionStatement: missionDraft.trim() || undefined,
      })
      setProjectUiState(updated)
      setEditingMission(false)
    } finally {
      setSavingMission(false)
    }
  }, [projectRoot, missionDraft])

  useEffect(() => {
    setMountedTabs(prev => (prev[tab] ? prev : { ...prev, [tab]: true }))
  }, [tab])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(ORGANIZER_SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0')
  }, [sidebarCollapsed])

  useEffect(() => {
    if (!active) return
    dispatchOrganizerSidebarChromeStateBlock({
      enabled: true,
      collapsed: sidebarCollapsed,
      label: 'Organizer',
      headerVisible: pinBoardHeaderVisible,
      showHeaderToggle: tab === 'backlog' && pinBoardActive,
    })
  }, [active, pinBoardActive, pinBoardHeaderVisible, sidebarCollapsed, tab])

  useEffect(() => {
    if (!active) return
    const handler = () => setSidebarCollapsed(prev => !prev)
    window.addEventListener(ORGANIZER_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK, handler)
    return () => window.removeEventListener(ORGANIZER_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK, handler)
  }, [active])

  useEffect(() => {
    if (!active) return
    const handler = () => setPinBoardHeaderVisible(prev => !prev)
    window.addEventListener(ORGANIZER_SIDEBAR_CHROME_TOGGLE_HEADER_EVENT_BLOCK, handler)
    return () => window.removeEventListener(ORGANIZER_SIDEBAR_CHROME_TOGGLE_HEADER_EVENT_BLOCK, handler)
  }, [active])

  const handleToggleSidebar = useCallback(() => setSidebarCollapsed(prev => !prev), [])
  useIosSidebarSwipeBlock({
    isIos: isIos && active,
    isOpen: active && !sidebarCollapsed,
    keyboardVisible: layout.keyboardVisible,
    onToggle: handleToggleSidebar,
  })

  const headerBlock = (
    <div className="mb-4">
      <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
        {projectName ? `${activeTabLabel} · ${projectName}` : activeTabLabel}
      </h1>

      {projectRoot && (
          <div className="mt-1.5">
            {editingMission ? (
              <div className="flex flex-col gap-1.5">
                <textarea
                  ref={missionTextareaRef}
                  value={missionDraft}
                  onChange={e => setMissionDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') { setEditingMission(false) }
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { void saveMission() }
                  }}
                  placeholder="Project mission statement..."
                  rows={2}
                  className="w-full resize-none rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
                />
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void saveMission()}
                    disabled={savingMission}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {savingMission ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingMission(false)}
                    className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/70"
                  >
                    <X className="h-3 w-3" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : missionStatement ? (
              <div className="group flex items-start gap-1.5">
                <p className="text-sm text-foreground/80">{missionStatement}</p>
                <button
                  type="button"
                  onClick={startEditMission}
                  className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/60 hover:!text-muted-foreground"
                  title="Edit mission statement"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={startEditMission}
                className="text-xs text-muted-foreground/50 hover:text-muted-foreground"
              >
                + Add mission statement
              </button>
            )}
          </div>
        )}
      </div>
  )

  return (
    <div className="ltm-organizer-shell h-full min-h-0 w-full">
      <div className="flex h-full min-h-0">
        {/* On iPhone, the desktop collapse state is ignored — list/detail mode
            is the sole authority. Sidebar always shows in list mode. */}
        {!phoneDetailMode && (
          <aside
            className={cn(
              'ltm-organizer-shell-nav bg-background/40 overflow-y-auto overflow-x-hidden',
              phoneListMode
                ? 'flex-1 px-3 py-4 opacity-100'
                : cn(
                    'shrink-0 transition-[width,opacity] duration-200 ease-out',
                    sidebarCollapsed
                      ? 'w-0 opacity-0 pointer-events-none border-r-0 px-0 py-4'
                      : 'w-[220px] opacity-100 border-r border-border/60 px-3 py-4',
                  ),
            )}>
            <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Thinking Organizer
            </p>
            <nav className="space-y-1">
              {THINKING_ORGANIZER_TABS.map((item) => {
                const Icon = item.icon
                const active = tab === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => pushPhoneTab(item.id)}
                    className={cn(
                      'ltm-motion-fast flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                      active && !phoneListMode
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="truncate">{item.label}</span>
                  </button>
                )
              })}
            </nav>

            <p className="mb-2 mt-5 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Projects
            </p>
            <nav className="space-y-1">
              {projectEntries.map((entry) => {
                const active = projectRoot === entry.root
                return (
                  <button
                    key={entry.root}
                    type="button"
                    onClick={() => selectProject(entry.root)}
                    className={cn(
                      'ltm-motion-fast flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                      active
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <FolderTree className="h-4 w-4 shrink-0" />
                    <span className="truncate">{entry.name}</span>
                  </button>
                )
              })}
              {projectEntries.length === 0 && (
                <p className="px-2 py-1 text-xs text-muted-foreground/60">No projects yet.</p>
              )}
            </nav>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 w-full"
              onClick={() => window.dispatchEvent(new CustomEvent(ORGANIZER_OPEN_CREATE_PROJECT_EVENT))}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Create Project
            </Button>
          </aside>
        )}

        <div className={cn(
          'min-w-0 overflow-y-auto px-6 py-5',
          phoneListMode ? 'hidden' : 'flex-1',
        )}>
          {headerBlock}
          <section hidden={tab !== 'backlog'} aria-hidden={tab !== 'backlog'}>
            {mountedTabs.backlog ? (
              <BacklogOrch
                pinBoardHeaderVisible={pinBoardHeaderVisible}
                onPinBoardActiveChange={setPinBoardActive}
              />
            ) : null}
          </section>
          <section hidden={tab !== 'view'} aria-hidden={tab !== 'view'}>
            {mountedTabs.view ? <ViewTab /> : null}
          </section>
          <section hidden={tab !== 'board'} aria-hidden={tab !== 'board'}>
            {mountedTabs.board ? (
              <div className="-mx-6 -mb-5 h-[calc(100vh-220px)] min-h-[600px] overflow-hidden">
                <ThinkingOrgCanvasOrch />
              </div>
            ) : null}
          </section>
          <section hidden={tab !== 'link'} aria-hidden={tab !== 'link'}>
            {mountedTabs.link ? <LinkingOrch /> : null}
          </section>
        </div>
      </div>
    </div>
  )
}
