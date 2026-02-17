import { useCallback, useState } from 'react'
import {
  BookOpen,
  ChevronRight,
  Folder,
  FolderTree,
  Layers,
  Lightbulb,
  Loader2,
  MessageSquare,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/lego_blocks/ui/button'
import type { NodeRecord } from '@/services/lego_blocks/dbBlock'
import type { NodeType, NodePriority, NodeStatus } from '@/services/lego_blocks/yamlNoteBlock'
import { cn } from '@/lib/utils'

// ── Inline helpers ──

function iconForNodeType(type: NodeType) {
  if (type === 'program') return FolderTree
  if (type === 'epic') return Layers
  if (type === 'idea_bucket') return BookOpen
  if (type === 'idea') return Lightbulb
  if (type === 'thought_bucket') return Folder
  if (type === 'thought') return MessageSquare
  return Lightbulb
}

const STATUS_COLORS: Record<NodeStatus, string> = {
  active: 'bg-emerald-500/15 text-emerald-700',
  paused: 'bg-amber-500/15 text-amber-700',
  completed: 'bg-blue-500/15 text-blue-700',
  archived: 'bg-zinc-500/15 text-zinc-500',
}

const PRIORITY_COLORS: Record<NonNullable<NodePriority>, string> = {
  low: 'bg-zinc-400',
  medium: 'bg-blue-400',
  high: 'bg-amber-400',
  critical: 'bg-red-500',
}

const EPIC_BORDER_PALETTE = [
  'border-l-blue-500',
  'border-l-violet-500',
  'border-l-emerald-500',
  'border-l-amber-500',
  'border-l-rose-500',
  'border-l-cyan-500',
  'border-l-fuchsia-500',
  'border-l-lime-500',
]

function StatusBadge({ status }: { status: NodeStatus }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_COLORS[status])}>
      {status}
    </span>
  )
}

function PriorityDot({ priority }: { priority?: NodePriority }) {
  if (!priority) return null
  return (
    <span className={cn('inline-block h-2 w-2 rounded-full shrink-0', PRIORITY_COLORS[priority])} title={priority} />
  )
}

// ── Types ──

interface ChildState {
  loading: boolean
  loaded: boolean
  nodes: NodeRecord[]
  error: string | null
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
  // epic children keyed by program uuid
  const [epicsByProgram, setEpicsByProgram] = useState<Record<string, ChildState>>({})
  // children keyed by epic uuid
  const [childrenByEpic, setChildrenByEpic] = useState<Record<string, ChildState>>({})
  // expanded epic sections
  const [expandedEpics, setExpandedEpics] = useState<Record<string, boolean>>({})
  // inline create drafts
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [draftTypeByKey, setDraftTypeByKey] = useState<Record<string, NodeType>>({ [ROOT_INPUT_KEY]: 'program' })
  const [busyCreate, setBusyCreate] = useState<Record<string, boolean>>({})
  // drag state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  // ── Load epics for a program ──
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
        [program.uuid]: { loading: false, loaded: true, nodes: epics.sort((a, b) => a.title.localeCompare(b.title)), error: null },
      }))
    } catch (err) {
      setEpicsByProgram(prev => ({
        ...prev,
        [program.uuid]: { loading: false, loaded: false, nodes: [], error: err instanceof Error ? err.message : 'Failed to load epics' },
      }))
    }
  }, [epicsByProgram, loadEpics])

  // ── Load children for an epic ──
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
        [epic.uuid]: { loading: false, loaded: true, nodes: children.sort((a, b) => a.title.localeCompare(b.title)), error: null },
      }))
    } catch (err) {
      setChildrenByEpic(prev => ({
        ...prev,
        [epic.uuid]: { loading: false, loaded: false, nodes: [], error: err instanceof Error ? err.message : 'Failed to load children' },
      }))
    }
  }, [childrenByEpic, loadChildren])

  // ── Toggle epic expand ──
  const toggleEpic = useCallback((epic: NodeRecord) => {
    setExpandedEpics(prev => {
      const willExpand = !prev[epic.uuid]
      if (willExpand) void ensureChildrenLoaded(epic)
      return { ...prev, [epic.uuid]: willExpand }
    })
  }, [ensureChildrenLoaded])

  // ── Auto-load epics when program section mounts ──
  const ensureProgramLoaded = useCallback((program: NodeRecord) => {
    const existing = epicsByProgram[program.uuid]
    if (!existing?.loading && !existing?.loaded) {
      void ensureEpicsLoaded(program)
    }
  }, [epicsByProgram, ensureEpicsLoaded])

  // ── Inline create ──
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

      // Add to local state
      if (parent && parent.type === 'program') {
        setEpicsByProgram(prev => {
          const existing = prev[parent.uuid]
          if (!existing?.loaded) return prev
          return {
            ...prev,
            [parent.uuid]: { ...existing, nodes: [...existing.nodes, created].sort((a, b) => a.title.localeCompare(b.title)) },
          }
        })
      } else if (parent) {
        setChildrenByEpic(prev => {
          const existing = prev[parent.uuid]
          if (!existing?.loaded) return prev
          return {
            ...prev,
            [parent.uuid]: { ...existing, nodes: [...existing.nodes, created].sort((a, b) => a.title.localeCompare(b.title)) },
          }
        })
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to create node')
    } finally {
      setBusyCreate(prev => ({ ...prev, [draftKey]: false }))
    }
  }, [draftTypeByKey, drafts, onCreateChild])

  // ── Drag handlers ──
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

  // ── Render a child row ──
  const renderChildRow = useCallback((node: NodeRecord) => {
    const Icon = iconForNodeType(node.type)
    return (
      <button
        key={node.uuid}
        type="button"
        draggable
        onDragStart={makeDragStart(node)}
        onDragEnd={handleDragEnd}
        onDragOver={e => handleDragOver(node, e)}
        onDragLeave={() => handleDragLeave(node.uuid)}
        onDrop={e => { void handleDrop(node, e) }}
        onClick={() => onSelectNode(node)}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted/60',
          selectedNodeId === node.uuid && 'bg-accent text-accent-foreground',
          dragOverNodeId === node.uuid && 'ring-2 ring-primary/40 bg-primary/5',
        )}
        style={{ minHeight: '36px' }}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{node.title}</span>
        <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {nodeTypeLabel(node.type)}
        </span>
        <StatusBadge status={node.status} />
        <PriorityDot priority={node.priority} />
      </button>
    )
  }, [dragOverNodeId, handleDragEnd, handleDragLeave, handleDragOver, handleDrop, makeDragStart, onSelectNode, selectedNodeId])

  // ── Render inline create input ──
  const renderInlineCreate = useCallback((parent: NodeRecord | null, draftKey: string, placeholder: string) => {
    if (readOnly) return null
    const allowedTypes = allowedCreateTypes(parent)
    const selectedType = draftTypeByKey[draftKey] && allowedTypes.includes(draftTypeByKey[draftKey])
      ? draftTypeByKey[draftKey]
      : allowedTypes[0]
    const selectedTypeLabel = nodeTypeLabel(selectedType)

    return (
      <div className="flex items-center gap-2 px-3 py-1.5">
        <select
          value={selectedType}
          onChange={e => {
            const nextType = e.target.value as NodeType
            setDraftTypeByKey(prev => ({ ...prev, [draftKey]: nextType }))
          }}
          className="h-7 shrink-0 rounded-md border border-input bg-background px-2 text-[11px] text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
          placeholder={`${placeholder} (${selectedTypeLabel})`}
          className="h-7 flex-1 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          disabled={busyCreate[draftKey]}
          onClick={() => { void createUnder(parent, draftKey) }}
        >
          {busyCreate[draftKey] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        </Button>
      </div>
    )
  }, [busyCreate, createUnder, draftTypeByKey, drafts, readOnly, setDraft])

  // ── Render epic section ──
  const renderEpicSection = useCallback((epic: NodeRecord, colorIndex: number) => {
    const isExpanded = !!expandedEpics[epic.uuid]
    const childState = childrenByEpic[epic.uuid]
    const childCount = childState?.loaded ? childState.nodes.length : null
    const borderColor = EPIC_BORDER_PALETTE[colorIndex % EPIC_BORDER_PALETTE.length]

    return (
      <div key={epic.uuid} className={cn('border-l-[3px] rounded-md', borderColor)}>
        {/* Epic header row */}
        <div
          draggable
          onDragStart={makeDragStart(epic)}
          onDragEnd={handleDragEnd}
          onDragOver={e => handleDragOver(epic, e)}
          onDragLeave={() => handleDragLeave(epic.uuid)}
          onDrop={e => { void handleDrop(epic, e) }}
          className={cn(
            'flex items-center gap-2 rounded-r-md px-3 py-2 transition-colors hover:bg-muted/40 cursor-pointer',
            selectedNodeId === epic.uuid && 'bg-accent/50',
            dragOverNodeId === epic.uuid && 'ring-2 ring-primary/40 bg-primary/5',
          )}
        >
          <button
            type="button"
            onClick={() => toggleEpic(epic)}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted"
          >
            <ChevronRight className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-90')} />
          </button>
          <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
          <button
            type="button"
            onClick={() => onSelectNode(epic)}
            className="min-w-0 flex-1 truncate text-left text-sm font-medium"
          >
            {epic.title}
          </button>
          {childCount !== null && (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {childCount}
            </span>
          )}
          <StatusBadge status={epic.status} />
        </div>

        {/* Expanded children */}
        {isExpanded && (
          <div className="pb-1">
            {childState?.loading && (
              <div className="flex items-center gap-2 px-6 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading...
              </div>
            )}
            {childState?.error && (
              <div className="px-6 py-1 text-xs text-destructive">{childState.error}</div>
            )}
            {childState?.loaded && (
              <div className="space-y-0.5 pl-3">
                {childState.nodes.map(renderChildRow)}
                {childState.nodes.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No items yet.</div>
                )}
              </div>
            )}
            {renderInlineCreate(epic, `epic-${epic.uuid}`, 'Add item...')}
          </div>
        )}
      </div>
    )
  }, [childrenByEpic, dragOverNodeId, expandedEpics, handleDragEnd, handleDragLeave, handleDragOver, handleDrop, makeDragStart, onSelectNode, renderChildRow, renderInlineCreate, selectedNodeId, toggleEpic])

  // ── Render program section ──
  const renderProgramSection = useCallback((program: NodeRecord) => {
    ensureProgramLoaded(program)
    const epicState = epicsByProgram[program.uuid]

    return (
      <div key={program.uuid} className="space-y-1">
        {/* Program header */}
        <div
          draggable
          onDragStart={makeDragStart(program)}
          onDragEnd={handleDragEnd}
          onDragOver={e => handleDragOver(program, e)}
          onDragLeave={() => handleDragLeave(program.uuid)}
          onDrop={e => { void handleDrop(program, e) }}
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-2 cursor-pointer transition-colors hover:bg-muted/40',
            selectedNodeId === program.uuid && 'bg-accent/50',
            dragOverNodeId === program.uuid && 'ring-2 ring-primary/40 bg-primary/5',
          )}
          onClick={() => onSelectNode(program)}
        >
          <FolderTree className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm font-bold">{program.title}</span>
        </div>

        {/* Epics under this program */}
        <div className="space-y-1 pl-2">
          {epicState?.loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading epics...
            </div>
          )}
          {epicState?.error && (
            <div className="px-3 py-1 text-xs text-destructive">{epicState.error}</div>
          )}
          {epicState?.loaded && (
            <>
              {epicState.nodes.map((epic, idx) => renderEpicSection(epic, idx))}
              {epicState.nodes.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">No epics yet.</div>
              )}
            </>
          )}
          {renderInlineCreate(program, `program-${program.uuid}`, 'Add epic...')}
        </div>
      </div>
    )
  }, [dragOverNodeId, ensureProgramLoaded, epicsByProgram, handleDragEnd, handleDragLeave, handleDragOver, handleDrop, makeDragStart, onSelectNode, renderEpicSection, renderInlineCreate, selectedNodeId])

  return (
    <div className="flex flex-col space-y-3">
      {/* Top-level program create */}
      {!readOnly && renderInlineCreate(null, '__root__', 'Add program...')}

      {programs.length === 0 && (
        <div className="px-3 py-4 text-sm text-muted-foreground">
          No programs yet. Create one above to get started.
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
