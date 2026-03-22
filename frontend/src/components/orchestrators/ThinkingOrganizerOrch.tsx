import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, Loader2, FolderTree, Handshake, Layers, Lightbulb, ListChecks, Pencil, Play, Plus, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
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
import OrganizerIntegrityOrch from '@/components/orchestrators/OrganizerIntegrityOrch'
import StewardQueueOrch from '@/components/orchestrators/StewardQueueOrch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/lego_blocks/units/ui/card'
import { cn } from '@/lib/utils'
import { useUILayoutBlock } from '@/components/lego_blocks/hooks/shared/useUILayoutBlock'
import { useIosSidebarSwipeBlock } from '@/components/lego_blocks/hooks/shared/useIosSidebarSwipeBlock'
import { hasNativeDrawerShellBlock } from '@/services/orchestrators/runtimeOrch'

type TabMode = 'backlog' | 'view' | 'link' | 'steward' | 'integrity'
const TAB_QUERY_PARAM = 'tab'
const THINKING_ORGANIZER_TABS: Array<{ id: TabMode; label: string }> = [
  { id: 'backlog', label: 'Create' },
  { id: 'view', label: 'View' },
  { id: 'link', label: 'Link' },
  { id: 'steward', label: 'Steward' },
  { id: 'integrity', label: 'Integrity' },
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

const VIEW_ACTOR: CapabilityActor = {
  kind: 'human',
  id: 'ui.organizer-view',
}

function parseTabMode(raw: string | null): TabMode | null {
  if (raw === 'backlog' || raw === 'view' || raw === 'link' || raw === 'steward' || raw === 'integrity') return raw
  return null
}

function usePersistentTab(): [TabMode, (value: TabMode) => void] {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<TabMode>(() => {
    const saved = parseTabMode(getStorageItem(STORAGE_KEYS.thinkingOrganizerTab))
    if (saved) return saved
    return 'backlog'
  })
  const [urlHydrated, setUrlHydrated] = useState(false)

  useEffect(() => {
    if (urlHydrated) return
    const tabFromUrl = parseTabMode(searchParams.get(TAB_QUERY_PARAM))
    if (tabFromUrl && tabFromUrl !== tab) {
      setTab(tabFromUrl)
    }
    setUrlHydrated(true)
  }, [searchParams, tab, urlHydrated])

  useEffect(() => {
    if (!urlHydrated) return
    const current = parseTabMode(searchParams.get(TAB_QUERY_PARAM))
    if (current === tab) return
    const next = new URLSearchParams(searchParams)
    next.set(TAB_QUERY_PARAM, tab)
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, tab, urlHydrated])

  useEffect(() => {
    setStorageItem(STORAGE_KEYS.thinkingOrganizerTab, tab)
  }, [tab])

  const setAndPersist = useCallback((value: TabMode) => {
    setTab(value)
  }, [])

  return [tab, setAndPersist]
}

function ViewTab() {
  const { openFile } = useMarkdownViewer()
  const [programs, setPrograms] = useState<NodeRecord[]>([])
  const [selectedPath, setSelectedPath] = useState<NodeRecord[]>([])
  const [currentNodes, setCurrentNodes] = useState<NodeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [nodesLoading, setNodesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPrograms = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { nodes: roots } = await invokeCapabilityOrThrow({
        capability: 'organizer.nodes.list_roots',
        input: { typeFilter: 'program' },
        actor: VIEW_ACTOR,
      })
      const sorted = roots.sort((a, b) => a.title.localeCompare(b.title))
      setPrograms(sorted)
      setCurrentNodes(sorted)
    } catch (err) {
      setError(errorMessage(err, 'Failed to load programs'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPrograms()
  }, [loadPrograms])

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
      setCurrentNodes(children.sort((a, b) => a.title.localeCompare(b.title)))
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
      setCurrentNodes(children.sort((a, b) => a.title.localeCompare(b.title)))
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
const PROJECT_ROOT_QUERY_PARAM = 'projectRoot'

interface ProjectEntry {
  name: string
  root: string
}

export default function ThinkingOrganizerOrch() {
  const { layout } = useUILayoutBlock()
  const isIos = layout.surface === 'capacitor-ios'
  const isIosPhone = isIos && layout.mode === 'phone'
  const useNativePhoneDrawer = isIosPhone && hasNativeDrawerShellBlock()
  const [tab, setTab] = usePersistentTab()
  const [searchParams, setSearchParams] = useSearchParams()
  const [mountedTabs, setMountedTabs] = useState<Record<TabMode, boolean>>(() => ({
    backlog: tab === 'backlog',
    view: tab === 'view',
    link: tab === 'link',
    steward: tab === 'steward',
    integrity: tab === 'integrity',
  }))
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (useNativePhoneDrawer) return true
    if (typeof window === 'undefined') return false
    const stored = window.localStorage.getItem(ORGANIZER_SIDEBAR_COLLAPSED_KEY)
    return stored === '1'
  })
  const [pinBoardHeaderVisible, setPinBoardHeaderVisible] = useState(true)
  const [pinBoardActive, setPinBoardActive] = useState(false)

  // Project context
  const projectRoot = useMemo(
    () => searchParams.get(PROJECT_ROOT_QUERY_PARAM)?.trim() ?? '',
    [searchParams],
  )
  const [projectUiState, setProjectUiState] = useState<OrganizerUiStateOrch | null>(null)
  const [projectEntries, setProjectEntries] = useState<ProjectEntry[]>(
    () => getJsonStorageItem<ProjectEntry[]>(STORAGE_KEYS.thinkingOrganizerProjects, []),
  )

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
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (root) next.set(PROJECT_ROOT_QUERY_PARAM, root)
      else next.delete(PROJECT_ROOT_QUERY_PARAM)
      return next
    }, { replace: true })
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
    if (useNativePhoneDrawer && !sidebarCollapsed) {
      setSidebarCollapsed(true)
    }
  }, [sidebarCollapsed, useNativePhoneDrawer])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(ORGANIZER_SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0')
  }, [sidebarCollapsed])

  useEffect(() => {
    dispatchOrganizerSidebarChromeStateBlock({
      enabled: true,
      collapsed: useNativePhoneDrawer ? true : sidebarCollapsed,
      label: 'Organizer',
      headerVisible: pinBoardHeaderVisible,
      showHeaderToggle: tab === 'backlog' && pinBoardActive,
    })
  }, [pinBoardActive, pinBoardHeaderVisible, sidebarCollapsed, tab, useNativePhoneDrawer])

  useEffect(() => {
    if (useNativePhoneDrawer) return
    const handler = () => setSidebarCollapsed(prev => !prev)
    window.addEventListener(ORGANIZER_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK, handler)
    return () => window.removeEventListener(ORGANIZER_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK, handler)
  }, [useNativePhoneDrawer])

  useEffect(() => {
    const handler = () => setPinBoardHeaderVisible(prev => !prev)
    window.addEventListener(ORGANIZER_SIDEBAR_CHROME_TOGGLE_HEADER_EVENT_BLOCK, handler)
    return () => window.removeEventListener(ORGANIZER_SIDEBAR_CHROME_TOGGLE_HEADER_EVENT_BLOCK, handler)
  }, [])

  const handleToggleSidebar = useCallback(() => setSidebarCollapsed(prev => !prev), [])
  useIosSidebarSwipeBlock({
    isIos: isIos && !useNativePhoneDrawer,
    isOpen: !useNativePhoneDrawer && !sidebarCollapsed,
    keyboardVisible: layout.keyboardVisible,
    onToggle: handleToggleSidebar,
  })

  return (
    <div className="ltm-page-shell ltm-shell-ultra relative min-h-full">
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
          {projectName ? `${activeTabLabel} · ${projectName}` : activeTabLabel}
        </h1>

        {/* Mission statement — only when a project is selected */}
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

      <div className={cn(!isIosPhone && 'grid gap-4', !isIosPhone && (sidebarCollapsed ? 'grid-cols-1' : 'grid-cols-[200px_minmax(0,1fr)]'))}>
        {isIosPhone && !useNativePhoneDrawer && !sidebarCollapsed && (
          <div
            className="ltm-phone-sidebar-backdrop"
            onClick={() => setSidebarCollapsed(true)}
            aria-hidden="true"
          />
        )}

        {((!useNativePhoneDrawer && !sidebarCollapsed) || !isIosPhone) && (
          <aside className={cn(isIosPhone ? 'ltm-phone-sidebar-sheet p-3' : 'space-y-3')}>
            <div className="rounded-xl border bg-background p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Thinking Organizer</p>
              <div className="space-y-1">
                {THINKING_ORGANIZER_TABS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={cn(
                      'w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
                      tab === item.id
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-border/40">
                <p className="mb-1.5 px-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Projects</p>
                <div className="space-y-1">
                  {projectEntries.map((entry) => (
                    <button
                      key={entry.root}
                      type="button"
                      onClick={() => selectProject(entry.root)}
                      className={cn(
                        'w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
                        projectRoot === entry.root
                          ? 'bg-foreground text-background'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      {entry.name}
                    </button>
                  ))}
                  {projectEntries.length === 0 && (
                    <p className="px-2 py-1 text-xs text-muted-foreground/60">No projects yet.</p>
                  )}
                </div>
                <Button
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => window.dispatchEvent(new CustomEvent(ORGANIZER_OPEN_CREATE_PROJECT_EVENT))}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Create Project
                </Button>
              </div>
            </div>
          </aside>
        )}

        <div className="min-w-0">
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
          <section hidden={tab !== 'link'} aria-hidden={tab !== 'link'}>
            {mountedTabs.link ? <LinkingOrch /> : null}
          </section>
          <section hidden={tab !== 'steward'} aria-hidden={tab !== 'steward'}>
            {mountedTabs.steward ? <StewardQueueOrch /> : null}
          </section>
          <section hidden={tab !== 'integrity'} aria-hidden={tab !== 'integrity'}>
            {mountedTabs.integrity ? <OrganizerIntegrityOrch /> : null}
          </section>
        </div>
      </div>
    </div>
  )
}
