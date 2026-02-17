import { useCallback, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  UserCircle2,
} from 'lucide-react'
import { Button } from '@/components/lego_blocks/ui/button'
import type { NodeRecord } from '@/services/lego_blocks/dbBlock'
import type { NodeType, NodePriority, NodeStatus } from '@/services/lego_blocks/yamlNoteBlock'
import { cn } from '@/lib/utils'

interface ChildState {
  loading: boolean
  loaded: boolean
  nodes: NodeRecord[]
  error: string | null
}

interface VisibleIssue {
  node: NodeRecord
  depth: 0 | 1
}

const ROOT_INPUT_KEY = '__root__'

export interface BacklogListBlockProps {
  programs: NodeRecord[]
  loadEpics: (program: NodeRecord) => Promise<NodeRecord[]>
  loadChildren: (node: NodeRecord) => Promise<NodeRecord[]>
  selectedNodeId: string | null
  readOnly?: boolean
  onSelectNode: (node: NodeRecord) => void
  onCreateChild?: (parent: NodeRecord | null, title: string, requestedType?: NodeType) => Promise<NodeRecord>
  onDropNodeToNode?: (sourceUuid: string, target: NodeRecord) => Promise<void>
}

const STATUS_COLORS: Record<NodeStatus, string> = {
  active: 'bg-sky-100 text-sky-900 border-sky-200',
  paused: 'bg-amber-100 text-amber-900 border-amber-200',
  completed: 'bg-lime-200 text-lime-900 border-lime-300',
  archived: 'bg-zinc-200 text-zinc-800 border-zinc-300',
}

const STATUS_LABELS: Record<NodeStatus, string> = {
  active: 'IN PROGRESS',
  paused: 'PAUSED',
  completed: 'DONE',
  archived: 'ARCHIVED',
}

function nodeTypeLabel(type: NodeType): string {
  const labels: Record<NodeType, string> = {
    program: 'Program',
    epic: 'Epic',
    idea_bucket: 'Idea Bucket',
    idea: 'Idea',
    thought_bucket: 'Thought Bucket',
    thought: 'Thought',
  }
  return labels[type]
}

function issueLabel(node: NodeRecord): string {
  const tag = node.tags?.find(Boolean)
  if (!tag) return nodeTypeLabel(node.type).toUpperCase()
  return tag
    .replace(/[\/_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function priorityMarker(priority: NodePriority | null | undefined): string {
  if (!priority) return '-'
  if (priority === 'critical') return '!'
  if (priority === 'high') return '^'
  if (priority === 'medium') return '•'
  return '˅'
}

function allowedCreateTypes(parent: NodeRecord | null): NodeType[] {
  if (!parent) return ['program']
  switch (parent.type) {
    case 'program': return ['epic']
    case 'epic': return ['idea_bucket', 'idea', 'thought_bucket', 'thought']
    case 'idea_bucket': return ['idea']
    case 'idea': return ['thought_bucket', 'thought']
    case 'thought_bucket': return ['thought']
    case 'thought': return ['thought']
    default: return ['idea']
  }
}

function hasNodeDragType(event: React.DragEvent): boolean {
  const types = Array.from(event.dataTransfer.types)
  return types.includes('application/x-ltm-node-id') || types.includes('text/ltm-node-id')
}

function readDroppedNodeId(event: React.DragEvent): string | null {
  const explicit = event.dataTransfer.getData('application/x-ltm-node-id').trim()
  if (explicit) return explicit
  const textFallback = event.dataTransfer.getData('text/ltm-node-id').trim()
  if (textFallback) return textFallback
  const plain = event.dataTransfer.getData('text/plain').trim()
  if (plain.startsWith('ltm-node:')) return plain.slice('ltm-node:'.length).trim() || null
  return null
}

function avatarHue(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash |= 0
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 55% 45%)`
}

function initials(node: NodeRecord): string {
  const tokens = node.title.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return node.key.slice(0, 2).toUpperCase() || 'NA'
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase()
  return `${tokens[0][0] ?? ''}${tokens[1][0] ?? ''}`.toUpperCase()
}

export default function BacklogListBlock({
  programs,
  loadEpics,
  loadChildren,
  selectedNodeId,
  readOnly = false,
  onSelectNode,
  onCreateChild,
  onDropNodeToNode,
}: BacklogListBlockProps) {
  const [epicsByProgram, setEpicsByProgram] = useState<Record<string, ChildState>>({})
  const [childrenByEpic, setChildrenByEpic] = useState<Record<string, ChildState>>({})
  const [expandedEpics, setExpandedEpics] = useState<Record<string, boolean>>({})
  const [collapsedPrograms, setCollapsedPrograms] = useState<Record<string, boolean>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [draftTypeByKey, setDraftTypeByKey] = useState<Record<string, NodeType>>({ [ROOT_INPUT_KEY]: 'program' })
  const [busyCreate, setBusyCreate] = useState<Record<string, boolean>>({})
  const [createComposerOpenByKey, setCreateComposerOpenByKey] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | NodeStatus>('all')
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const normalizedQuery = query.trim().toLowerCase()

  const matchesFilters = useCallback((node: NodeRecord): boolean => {
    if (statusFilter !== 'all' && node.status !== statusFilter) return false
    if (!normalizedQuery) return true
    const searchable = `${node.title} ${node.key} ${node.type} ${node.tags?.join(' ') ?? ''}`.toLowerCase()
    return searchable.includes(normalizedQuery)
  }, [normalizedQuery, statusFilter])

  const ensureEpicsLoaded = useCallback(async (program: NodeRecord) => {
    const existing = epicsByProgram[program.uuid]
    if (existing?.loading || existing?.loaded) return

    setEpicsByProgram(prev => ({
      ...prev,
      [program.uuid]: { loading: true, loaded: false, nodes: [], error: null },
    }))

    try {
      const epics = await loadEpics(program)
      setEpicsByProgram(prev => ({
        ...prev,
        [program.uuid]: {
          loading: false,
          loaded: true,
          nodes: epics.sort((a, b) => a.title.localeCompare(b.title)),
          error: null,
        },
      }))
    } catch (err) {
      setEpicsByProgram(prev => ({
        ...prev,
        [program.uuid]: {
          loading: false,
          loaded: false,
          nodes: [],
          error: err instanceof Error ? err.message : 'Failed to load epics',
        },
      }))
    }
  }, [epicsByProgram, loadEpics])

  const ensureChildrenLoaded = useCallback(async (epic: NodeRecord) => {
    const existing = childrenByEpic[epic.uuid]
    if (existing?.loading || existing?.loaded) return

    setChildrenByEpic(prev => ({
      ...prev,
      [epic.uuid]: { loading: true, loaded: false, nodes: [], error: null },
    }))

    try {
      const children = await loadChildren(epic)
      setChildrenByEpic(prev => ({
        ...prev,
        [epic.uuid]: {
          loading: false,
          loaded: true,
          nodes: children.sort((a, b) => a.title.localeCompare(b.title)),
          error: null,
        },
      }))
    } catch (err) {
      setChildrenByEpic(prev => ({
        ...prev,
        [epic.uuid]: {
          loading: false,
          loaded: false,
          nodes: [],
          error: err instanceof Error ? err.message : 'Failed to load children',
        },
      }))
    }
  }, [childrenByEpic, loadChildren])

  const ensureProgramLoaded = useCallback((program: NodeRecord) => {
    const existing = epicsByProgram[program.uuid]
    if (!existing?.loading && !existing?.loaded) {
      void ensureEpicsLoaded(program)
    }
  }, [epicsByProgram, ensureEpicsLoaded])

  const toggleEpic = useCallback((epic: NodeRecord) => {
    setExpandedEpics(prev => {
      const willExpand = !prev[epic.uuid]
      if (willExpand) void ensureChildrenLoaded(epic)
      return { ...prev, [epic.uuid]: willExpand }
    })
  }, [ensureChildrenLoaded])

  const toggleProgram = useCallback((programUuid: string) => {
    setCollapsedPrograms(prev => ({ ...prev, [programUuid]: !prev[programUuid] }))
  }, [])

  const setDraft = useCallback((key: string, value: string) => {
    setDrafts(prev => ({ ...prev, [key]: value }))
  }, [])

  const createUnder = useCallback(async (parent: NodeRecord | null, draftKey: string) => {
    if (!onCreateChild) return
    const title = (drafts[draftKey] ?? '').trim()
    if (!title) return

    const allowedTypes = allowedCreateTypes(parent)
    const selectedType = draftTypeByKey[draftKey]
    const requestedType = selectedType && allowedTypes.includes(selectedType)
      ? selectedType
      : allowedTypes[0]

    setLocalError(null)
    setBusyCreate(prev => ({ ...prev, [draftKey]: true }))
    try {
      const created = await onCreateChild(parent, title, requestedType)
      setDrafts(prev => ({ ...prev, [draftKey]: '' }))
      setCreateComposerOpenByKey(prev => ({ ...prev, [draftKey]: false }))

      if (parent && parent.type === 'program') {
        setEpicsByProgram(prev => {
          const existing = prev[parent.uuid]
          if (!existing?.loaded) return prev
          return {
            ...prev,
            [parent.uuid]: {
              ...existing,
              nodes: [...existing.nodes, created].sort((a, b) => a.title.localeCompare(b.title)),
            },
          }
        })
      } else if (parent) {
        setChildrenByEpic(prev => {
          const existing = prev[parent.uuid]
          if (!existing?.loaded) return prev
          return {
            ...prev,
            [parent.uuid]: {
              ...existing,
              nodes: [...existing.nodes, created].sort((a, b) => a.title.localeCompare(b.title)),
            },
          }
        })
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to create node')
    } finally {
      setBusyCreate(prev => ({ ...prev, [draftKey]: false }))
    }
  }, [draftTypeByKey, drafts, onCreateChild])

  const makeDragStart = useCallback((node: NodeRecord) => (event: React.DragEvent) => {
    setDraggingNodeId(node.uuid)
    event.dataTransfer.setData('application/x-ltm-node-id', node.uuid)
    event.dataTransfer.setData('text/ltm-node-id', node.uuid)
    event.dataTransfer.setData('text/plain', `ltm-node:${node.uuid}`)
    event.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggingNodeId(null)
    setDragOverNodeId(null)
  }, [])

  const handleDragOver = useCallback((node: NodeRecord, event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (draggingNodeId || hasNodeDragType(event)) {
      event.dataTransfer.dropEffect = 'move'
      setDragOverNodeId(node.uuid)
    }
  }, [draggingNodeId])

  const handleDragLeave = useCallback((nodeId: string) => {
    setDragOverNodeId(prev => prev === nodeId ? null : prev)
  }, [])

  const handleDrop = useCallback(async (target: NodeRecord, event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setDragOverNodeId(null)

    const sourceId = readDroppedNodeId(event) ?? draggingNodeId
    if (!sourceId || !onDropNodeToNode) return
    if (sourceId === target.uuid) {
      setLocalError('Cannot drop a node onto itself.')
      return
    }

    setLocalError(null)
    try {
      await onDropNodeToNode(sourceId, target)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to move node')
    }
  }, [draggingNodeId, onDropNodeToNode])

  const getVisibleIssues = useCallback((program: NodeRecord): VisibleIssue[] => {
    const epicState = epicsByProgram[program.uuid]
    if (!epicState?.loaded) return []

    const output: VisibleIssue[] = []

    for (const epic of epicState.nodes) {
      const childState = childrenByEpic[epic.uuid]
      const children = childState?.loaded ? childState.nodes.filter(matchesFilters) : []
      const includeEpic = matchesFilters(epic) || children.length > 0 || !normalizedQuery

      if (includeEpic) {
        output.push({ node: epic, depth: 0 })
      }

      if (expandedEpics[epic.uuid] && childState?.loaded) {
        for (const child of children) {
          output.push({ node: child, depth: 1 })
        }
      }
    }

    return output
  }, [childrenByEpic, epicsByProgram, expandedEpics, matchesFilters, normalizedQuery])

  const renderInlineCreate = useCallback((parent: NodeRecord, draftKey: string, placeholder: string) => {
    if (readOnly) return null

    const allowedTypes = allowedCreateTypes(parent)
    const selectedType = draftTypeByKey[draftKey] && allowedTypes.includes(draftTypeByKey[draftKey])
      ? draftTypeByKey[draftKey]
      : allowedTypes[0]

    const composerOpen = !!createComposerOpenByKey[draftKey]

    return (
      <div className="border-t border-border/70">
        <button
          type="button"
          onClick={() => setCreateComposerOpenByKey(prev => ({ ...prev, [draftKey]: !prev[draftKey] }))}
          className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-muted-foreground hover:bg-muted/20"
        >
          <Plus className="h-4 w-4" />
          <span className="text-base">Create</span>
        </button>

        {composerOpen && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/70 bg-muted/15 px-4 py-2.5">
            <select
              value={selectedType}
              onChange={e => {
                const nextType = e.target.value as NodeType
                setDraftTypeByKey(prev => ({ ...prev, [draftKey]: nextType }))
              }}
              className="h-8 rounded-md border border-input bg-background px-2 text-[11px] text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {allowedTypes.map(type => (
                <option key={`${draftKey}-${type}`} value={type}>
                  {nodeTypeLabel(type)}
                </option>
              ))}
            </select>
            <input
              value={drafts[draftKey] ?? ''}
              onChange={e => setDraft(draftKey, e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void createUnder(parent, draftKey)
                }
              }}
              placeholder={placeholder}
              className="h-8 min-w-[220px] flex-1 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs"
              disabled={busyCreate[draftKey]}
              onClick={() => { void createUnder(parent, draftKey) }}
            >
              {busyCreate[draftKey] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs"
              onClick={() => setCreateComposerOpenByKey(prev => ({ ...prev, [draftKey]: false }))}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    )
  }, [busyCreate, createComposerOpenByKey, createUnder, draftTypeByKey, drafts, readOnly, setDraft])

  const renderIssueRow = useCallback((issue: VisibleIssue) => {
    const { node, depth } = issue
    const isEpic = node.type === 'epic'
    const isExpanded = !!expandedEpics[node.uuid]
    const rowIsSelected = selectedNodeId === node.uuid

    return (
      <div
        key={node.uuid}
        className={cn(
          'grid grid-cols-[minmax(0,1fr)_220px_126px_84px_74px] items-center border-b border-border/70 bg-background text-sm last:border-b-0',
          rowIsSelected && 'bg-sky-100/60',
          dragOverNodeId === node.uuid && 'ring-2 ring-primary/40 bg-primary/5',
        )}
        draggable
        onDragStart={makeDragStart(node)}
        onDragEnd={handleDragEnd}
        onDragOver={e => handleDragOver(node, e)}
        onDragLeave={() => handleDragLeave(node.uuid)}
        onDrop={e => { void handleDrop(node, e) }}
      >
        <div className="min-w-0 py-2.5 pr-2" style={{ paddingLeft: `${16 + depth * 24}px` }}>
          <div className="flex min-w-0 items-center gap-2">
            {isEpic ? (
              <button
                type="button"
                onClick={() => toggleEpic(node)}
                className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted"
                aria-label={isExpanded ? 'Collapse epic' : 'Expand epic'}
              >
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="w-4" />
            )}
            <button
              type="button"
              onClick={() => onSelectNode(node)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-sm px-1.5 py-1 text-left hover:bg-muted/20"
            >
              <span
                className={cn(
                  'grid h-5 w-5 flex-none place-items-center rounded-[4px] border',
                  node.status === 'completed'
                    ? 'border-blue-500/70 bg-blue-50 text-blue-600'
                    : 'border-muted-foreground/40 bg-background text-muted-foreground/20',
                )}
              >
                {node.status === 'completed' && <Check className="h-3 w-3 stroke-[3]" />}
              </span>
              <span className="min-w-0 truncate text-[14px] text-foreground">
                <span className={cn('mr-2 font-semibold text-muted-foreground', node.status === 'completed' && 'line-through')}>
                  {node.key}
                </span>
                <span className={cn(node.status === 'completed' && 'line-through text-muted-foreground')}>
                  {node.title}
                </span>
              </span>
            </button>
          </div>
        </div>

        <div className="px-2 py-2.5">
          <span className="inline-flex max-w-full truncate rounded-md bg-violet-200/80 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-800">
            {issueLabel(node)}
          </span>
        </div>

        <div className="px-2 py-2.5">
          <span className={cn('inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-bold', STATUS_COLORS[node.status])}>
            {STATUS_LABELS[node.status]}
            <ChevronDown className="ml-1 h-3.5 w-3.5" />
          </span>
        </div>

        <div className="px-2 py-2.5">
          <span className="inline-flex h-7 w-11 items-center justify-center rounded-md bg-muted font-semibold text-muted-foreground">
            {priorityMarker(node.priority)}
          </span>
        </div>

        <div className="px-2 py-2.5">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ backgroundColor: avatarHue(node.key) }}
            title={node.title}
          >
            {initials(node)}
          </span>
        </div>
      </div>
    )
  }, [dragOverNodeId, expandedEpics, handleDragEnd, handleDragLeave, handleDragOver, handleDrop, makeDragStart, onSelectNode, selectedNodeId, toggleEpic])

  const renderProgramSection = useCallback((program: NodeRecord) => {
    ensureProgramLoaded(program)
    const epicState = epicsByProgram[program.uuid]
    const visibleIssues = getVisibleIssues(program)
    const isCollapsed = !!collapsedPrograms[program.uuid]

    const doneCount = visibleIssues.filter(issue => issue.node.status === 'completed').length
    const activeCount = visibleIssues.filter(issue => issue.node.status === 'active').length
    const pausedCount = visibleIssues.filter(issue => issue.node.status === 'paused').length

    if (normalizedQuery && visibleIssues.length === 0 && !matchesFilters(program)) {
      return null
    }

    return (
      <section key={program.uuid} className="overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-sm">
        <header className="border-b border-border/70 bg-muted/20 px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-5 w-5 rounded-[4px] border border-muted-foreground/35 bg-background/90" />
              <button
                type="button"
                onClick={() => toggleProgram(program.uuid)}
                className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted"
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => onSelectNode(program)}
                className="truncate text-left text-xl font-semibold tracking-tight"
              >
                {program.title}
              </button>
              <span className="text-sm text-muted-foreground">({visibleIssues.length} work items)</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded bg-zinc-200/70 px-2 py-0.5 text-xs font-semibold text-zinc-700">{activeCount}</span>
              <span className="rounded bg-blue-300/60 px-2 py-0.5 text-xs font-semibold text-blue-900">{pausedCount}</span>
              <span className="rounded bg-lime-300/70 px-2 py-0.5 text-xs font-semibold text-lime-900">{doneCount}</span>
              <Button size="sm" variant="outline" className="h-8 rounded-md px-3 text-xs">Complete sprint</Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <p className="mt-2 text-sm text-muted-foreground">
            {program.aiSummary || 'Complete work scoped for this project.'}
          </p>
        </header>

        {!isCollapsed && (
          <div>
            <div className="mx-3 mt-3 overflow-hidden rounded-xl border border-border/70 bg-background/95">
              {epicState?.loading && (
                <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading items...
                </div>
              )}

              {epicState?.error && (
                <div className="px-4 py-3 text-sm text-destructive">{epicState.error}</div>
              )}

              {epicState?.loaded && visibleIssues.length === 0 && (
                <div className="px-4 py-4 text-sm text-muted-foreground">No work items yet.</div>
              )}

              {visibleIssues.map(renderIssueRow)}
            </div>
            {renderInlineCreate(program, `program-${program.uuid}`, 'Add work item...')}
          </div>
        )}
      </section>
    )
  }, [collapsedPrograms, ensureProgramLoaded, epicsByProgram, getVisibleIssues, matchesFilters, normalizedQuery, onSelectNode, renderInlineCreate, renderIssueRow, toggleProgram])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card/70 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search backlog"
              className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as 'all' | NodeStatus)}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>

          <Button size="sm" variant="secondary" className="h-9 rounded-md">
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
            Filter
          </Button>

          {readOnly && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
              <UserCircle2 className="h-3.5 w-3.5" />
              Read only
            </span>
          )}
        </div>
      </div>

      {programs.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
          No programs yet.
        </div>
      )}

      {programs.map(renderProgramSection)}

      {localError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {localError}
        </div>
      )}
    </div>
  )
}
