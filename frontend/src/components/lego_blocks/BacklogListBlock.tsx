import { useCallback, useEffect, useState } from 'react'
import {
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  Folder,
  FolderTree,
  Info,
  Layers,
  Lightbulb,
  ListChecks,
  Loader2,
  MessageSquare,
  Handshake,
  Play,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/lego_blocks/ui/button'
import type { NodeRecord } from '@/services/lego_blocks/dbBlock'
import type { NodePriority, NodeStatus, NodeType } from '@/services/lego_blocks/yamlNoteBlock'
import { cn } from '@/lib/utils'

function iconForNodeType(type: NodeType) {
  if (type === 'program') return FolderTree
  if (type === 'epic') return Layers
  if (type === 'idea_bucket') return BookOpen
  if (type === 'idea') return Lightbulb
  if (type === 'thought_bucket') return Folder
  if (type === 'thought') return MessageSquare
  if (type === 'task') return ListChecks
  if (type === 'run') return Play
  if (type === 'handoff') return Handshake
  return Lightbulb
}

function iconColorForNodeType(type: NodeType): string {
  if (type === 'program') return 'text-sky-600'
  if (type === 'epic') return 'text-violet-600'
  if (type === 'idea_bucket') return 'text-indigo-600'
  if (type === 'idea') return 'text-amber-600'
  if (type === 'thought_bucket') return 'text-emerald-600'
  if (type === 'thought') return 'text-cyan-600'
  if (type === 'task') return 'text-rose-600'
  if (type === 'run') return 'text-blue-700'
  if (type === 'handoff') return 'text-fuchsia-700'
  return 'text-muted-foreground'
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

const EPIC_ICON_COLOR_BY_BORDER: Record<string, string> = {
  'border-l-blue-500': 'text-blue-600',
  'border-l-violet-500': 'text-violet-600',
  'border-l-emerald-500': 'text-emerald-600',
  'border-l-amber-500': 'text-amber-600',
  'border-l-rose-500': 'text-rose-600',
  'border-l-cyan-500': 'text-cyan-600',
  'border-l-fuchsia-500': 'text-fuchsia-600',
  'border-l-lime-500': 'text-lime-600',
}

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
    <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', PRIORITY_COLORS[priority])} title={priority} />
  )
}

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
    task: 'Task',
    run: 'Run',
    handoff: 'Handoff',
  }
  return labels[type]
}

function allowedCreateTypes(parent: NodeRecord | null): NodeType[] {
  if (!parent) return ['program']
  const all: NodeType[] = ['epic', 'idea_bucket', 'idea', 'thought_bucket', 'thought', 'task', 'run', 'handoff']
  const preferred: NodeType =
    parent.type === 'program' ? 'epic'
      : parent.type === 'epic' ? 'idea_bucket'
        : parent.type === 'idea_bucket' ? 'idea'
          : parent.type === 'idea' ? 'thought_bucket'
            : parent.type === 'thought_bucket' ? 'thought'
              : 'thought'
  return [preferred, ...all.filter(type => type !== preferred)]
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

function nodeDisplayTitle(node: NodeRecord): string {
  const title = node.title?.trim() ?? ''
  const ticket = node.ticket?.trim() ?? ''
  if (!ticket) return title
  if (!title) return ticket
  if (title.startsWith(ticket)) return title
  return `${ticket} - ${title}`
}

function nodeTitleWithoutTicket(node: NodeRecord): string {
  const title = node.title?.trim() ?? ''
  const ticket = node.ticket?.trim() ?? ''
  if (!ticket) return title
  if (!title) return ''
  if (title === ticket) return ''
  if (title.startsWith(`${ticket} - `)) return title.slice(ticket.length + 3).trim()
  if (title.startsWith(`${ticket} `)) return title.slice(ticket.length + 1).trim()
  return title
}

async function copyTextToClipboard(text: string): Promise<void> {
  const normalized = text.trim()
  if (!normalized) return

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(normalized)
    return
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard API is unavailable in this runtime.')
  }

  const textarea = document.createElement('textarea')
  textarea.value = normalized
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!copied) {
    throw new Error('Failed to copy text to clipboard.')
  }
}

function isTaskNode(node: NodeRecord): boolean {
  return node.type === 'task' || node.recordKind === 'task' || !!node.taskStatus
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
  const [childrenByNode, setChildrenByNode] = useState<Record<string, ChildState>>({})
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [draftTypeByKey, setDraftTypeByKey] = useState<Record<string, NodeType>>({ [ROOT_INPUT_KEY]: 'program' })
  const [busyCreate, setBusyCreate] = useState<Record<string, boolean>>({})
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null)
  const [groupingInfoOpenByNode, setGroupingInfoOpenByNode] = useState<Record<string, boolean>>({})
  const [copiedRowNodeId, setCopiedRowNodeId] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const programFingerprint = programs.map(program => `${program.uuid}:${program.updatedAt}`).join('|')

  useEffect(() => {
    // Child lists are locally cached; clear them when upstream program data refreshes
    // so externally-created organizer nodes become visible without stale tree state.
    setChildrenByNode({})
    setExpandedNodes({})
  }, [programFingerprint])

  const ensureProgramLoaded = useCallback(async (program: NodeRecord) => {
    const existing = childrenByNode[program.uuid]
    if (existing?.loading || existing?.loaded) return

    setChildrenByNode(prev => ({
      ...prev,
      [program.uuid]: { loading: true, loaded: false, nodes: [], error: null },
    }))

    try {
      const epics = await loadEpics(program)
      setChildrenByNode(prev => ({
        ...prev,
        [program.uuid]: {
          loading: false,
          loaded: true,
          nodes: epics.sort((a, b) => a.title.localeCompare(b.title)),
          error: null,
        },
      }))
    } catch (err) {
      setChildrenByNode(prev => ({
        ...prev,
        [program.uuid]: {
          loading: false,
          loaded: false,
          nodes: [],
          error: err instanceof Error ? err.message : 'Failed to load epics',
        },
      }))
    }
  }, [childrenByNode, loadEpics])

  const ensureChildrenLoaded = useCallback(async (node: NodeRecord) => {
    const existing = childrenByNode[node.uuid]
    if (existing?.loading || existing?.loaded) return

    setChildrenByNode(prev => ({
      ...prev,
      [node.uuid]: { loading: true, loaded: false, nodes: [], error: null },
    }))

    try {
      const children = await loadChildren(node)
      setChildrenByNode(prev => ({
        ...prev,
        [node.uuid]: {
          loading: false,
          loaded: true,
          nodes: children.sort((a, b) => a.title.localeCompare(b.title)),
          error: null,
        },
      }))
    } catch (err) {
      setChildrenByNode(prev => ({
        ...prev,
        [node.uuid]: {
          loading: false,
          loaded: false,
          nodes: [],
          error: err instanceof Error ? err.message : 'Failed to load children',
        },
      }))
    }
  }, [childrenByNode, loadChildren])

  const toggleNode = useCallback((node: NodeRecord) => {
    setExpandedNodes(prev => {
      const willExpand = !prev[node.uuid]
      if (willExpand) {
        if (node.type === 'program') void ensureProgramLoaded(node)
        else void ensureChildrenLoaded(node)
      }
      return { ...prev, [node.uuid]: willExpand }
    })
  }, [ensureChildrenLoaded, ensureProgramLoaded])

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

      if (parent) {
        setChildrenByNode(prev => {
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

  useEffect(() => {
    if (!copiedRowNodeId) return
    const timeoutId = window.setTimeout(() => {
      setCopiedRowNodeId(current => (current === copiedRowNodeId ? null : current))
    }, 1400)
    return () => window.clearTimeout(timeoutId)
  }, [copiedRowNodeId])

  const copyRowLabelForNode = useCallback(async (node: NodeRecord, event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const label = nodeDisplayTitle(node).trim() || node.title.trim() || 'Untitled'
    try {
      await copyTextToClipboard(label)
      setCopiedRowNodeId(node.uuid)
      setLocalError(null)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to copy row text')
    }
  }, [])

  const renderTicketBadge = useCallback((node: NodeRecord) => {
    const ticket = node.ticket?.trim() ?? ''
    if (!ticket) return null

    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
        {ticket}
      </span>
    )
  }, [])

  const renderInlineCreate = useCallback((parent: NodeRecord | null, draftKey: string, placeholder: string) => {
    if (readOnly) return null

    const allowedTypes = allowedCreateTypes(parent)
    const selectedType = draftTypeByKey[draftKey] && allowedTypes.includes(draftTypeByKey[draftKey])
      ? draftTypeByKey[draftKey]
      : allowedTypes[0]
    const selectedTypeLabel = nodeTypeLabel(selectedType)

    return (
      <div className="flex items-center gap-2 border-t border-border/70 bg-background px-3 py-2">
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

  const renderNodeBranch = useCallback((
    node: NodeRecord,
    depth: number,
    colorIndex: number,
    parentNode: NodeRecord | null,
    epicContext: NodeRecord | null,
  ) => {
    const Icon = iconForNodeType(node.type)
    const isExpanded = !!expandedNodes[node.uuid]
    const childState = childrenByNode[node.uuid]
    const childCount = childState?.loaded ? childState.nodes.length : null
    const borderColorClass = depth === 0
      ? EPIC_BORDER_PALETTE[colorIndex % EPIC_BORDER_PALETTE.length]
      : 'border-l-zinc-300'
    const iconColorClass = node.type === 'epic' && depth === 0
      ? (EPIC_ICON_COLOR_BY_BORDER[borderColorClass] ?? iconColorForNodeType(node.type))
      : iconColorForNodeType(node.type)

    const effectiveEpicContext = node.type === 'epic' ? node : epicContext
    const canShowGroupingInfo = isTaskNode(node) && !!effectiveEpicContext && !!parentNode
    const groupingInfoOpen = !!groupingInfoOpenByNode[node.uuid]

    return (
      <div key={node.uuid} className="border-b border-border/70 last:border-b-0">
        <div
          draggable
          onDragStart={makeDragStart(node)}
          onDragEnd={handleDragEnd}
          onDragOver={e => handleDragOver(node, e)}
          onDragLeave={() => handleDragLeave(node.uuid)}
          onDrop={e => { void handleDrop(node, e) }}
          className={cn(
            'flex cursor-pointer items-center gap-2 border-l-[3px] bg-background px-3 py-2 transition-colors hover:bg-zinc-50',
            borderColorClass,
            selectedNodeId === node.uuid && 'bg-accent/40',
            dragOverNodeId === node.uuid && 'ring-2 ring-primary/40 bg-primary/5',
          )}
          style={{ paddingLeft: `${12 + (depth * 16)}px` }}
        >
          <button
            type="button"
            onClick={() => toggleNode(node)}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted"
          >
            <ChevronRight className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-90')} />
          </button>
          <Icon className={cn('h-4 w-4 shrink-0', iconColorClass)} />
          <button
            type="button"
            onClick={() => onSelectNode(node)}
            className="group min-w-0 flex flex-1 items-center gap-2 text-left text-sm font-medium"
          >
            {renderTicketBadge(node)}
            <span className="min-w-0 flex-1 truncate">
              {nodeTitleWithoutTicket(node) || nodeDisplayTitle(node) || 'Untitled'}
            </span>
          </button>
          <button
            type="button"
            draggable={false}
            onClick={event => { void copyRowLabelForNode(node, event) }}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={copiedRowNodeId === node.uuid ? 'Copied' : 'Copy row label'}
            aria-label={copiedRowNodeId === node.uuid ? `Copied row label ${nodeDisplayTitle(node)}` : `Copy row label ${nodeDisplayTitle(node)}`}
          >
            {copiedRowNodeId === node.uuid ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          {canShowGroupingInfo && (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                setGroupingInfoOpenByNode(prev => ({ ...prev, [node.uuid]: !prev[node.uuid] }))
              }}
              className={cn(
                'rounded-md p-1 transition-colors',
                groupingInfoOpen
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              title="Why this task is grouped here"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          )}
          {childCount !== null && (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {childCount}
            </span>
          )}
          <StatusBadge status={node.status} />
          <PriorityDot priority={node.priority} />
        </div>
        {canShowGroupingInfo && groupingInfoOpen && (
          <div className="border-t border-border/60 bg-muted/25 px-3 py-1.5 text-[11px] text-muted-foreground" style={{ paddingLeft: `${36 + (depth * 16)}px` }}>
            Grouped under epic: <span className="text-foreground">{nodeDisplayTitle(effectiveEpicContext!)}</span>
            {' · '}
            Parent: <span className="text-foreground">{nodeDisplayTitle(parentNode!)}</span>
          </div>
        )}

        {isExpanded && (
          <div className="bg-background/95">
            {childState?.loading && (
              <div className="flex items-center gap-2 border-t border-border/70 px-6 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading...
              </div>
            )}
            {childState?.error && (
              <div className="border-t border-border/70 px-6 py-1 text-xs text-destructive">{childState.error}</div>
            )}
            {childState?.loaded && (
              <div>
                {childState.nodes.map((child, idx) => renderNodeBranch(
                  child,
                  depth + 1,
                  idx,
                  node,
                  effectiveEpicContext,
                ))}
                {childState.nodes.length === 0 && (
                  <div className="border-t border-border/70 px-3 py-2 text-xs text-muted-foreground">No items yet.</div>
                )}
              </div>
            )}
            {renderInlineCreate(node, `node-${node.uuid}`, 'Add child...')}
          </div>
        )}
      </div>
    )
  }, [childrenByNode, copiedRowNodeId, copyRowLabelForNode, dragOverNodeId, expandedNodes, groupingInfoOpenByNode, handleDragEnd, handleDragLeave, handleDragOver, handleDrop, makeDragStart, onSelectNode, renderInlineCreate, renderTicketBadge, selectedNodeId, toggleNode])

  const renderProgramSection = useCallback((program: NodeRecord) => {
    void ensureProgramLoaded(program)
    const childState = childrenByNode[program.uuid]
    const programIconColorClass = iconColorForNodeType(program.type)

    return (
      <div key={program.uuid} className="rounded-xl border border-border/70 bg-muted/30 p-2">
        <div
          draggable
          onDragStart={makeDragStart(program)}
          onDragEnd={handleDragEnd}
          onDragOver={e => handleDragOver(program, e)}
          onDragLeave={() => handleDragLeave(program.uuid)}
          onDrop={e => { void handleDrop(program, e) }}
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-md bg-muted/40 px-3 py-2 transition-colors hover:bg-muted/60',
            selectedNodeId === program.uuid && 'bg-accent/40',
            dragOverNodeId === program.uuid && 'ring-2 ring-primary/40 bg-primary/5',
          )}
          onClick={() => onSelectNode(program)}
        >
          <FolderTree className={cn('h-4 w-4 shrink-0', programIconColorClass)} />
          <div className="min-w-0 flex flex-1 items-center gap-2">
            {renderTicketBadge(program)}
            <span className="min-w-0 flex-1 truncate text-sm font-bold">
              {nodeTitleWithoutTicket(program) || nodeDisplayTitle(program) || 'Untitled'}
            </span>
          </div>
          <button
            type="button"
            draggable={false}
            onClick={event => { void copyRowLabelForNode(program, event) }}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={copiedRowNodeId === program.uuid ? 'Copied' : 'Copy row label'}
            aria-label={copiedRowNodeId === program.uuid ? `Copied row label ${nodeDisplayTitle(program)}` : `Copy row label ${nodeDisplayTitle(program)}`}
          >
            {copiedRowNodeId === program.uuid ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>

        <div className="mt-2 overflow-hidden rounded-md border border-border/70 bg-background">
          {childState?.loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading children...
            </div>
          )}
          {childState?.error && (
            <div className="px-3 py-1 text-xs text-destructive">{childState.error}</div>
          )}
          {childState?.loaded && (
            <>
              {childState.nodes.map((node, idx) => renderNodeBranch(node, 0, idx, program, node.type === 'epic' ? node : null))}
              {childState.nodes.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">No items yet.</div>
              )}
            </>
          )}
          {renderInlineCreate(program, `program-${program.uuid}`, 'Add child...')}
        </div>
      </div>
    )
  }, [childrenByNode, copiedRowNodeId, copyRowLabelForNode, dragOverNodeId, ensureProgramLoaded, handleDragEnd, handleDragLeave, handleDragOver, handleDrop, makeDragStart, onSelectNode, renderInlineCreate, renderNodeBranch, renderTicketBadge, selectedNodeId])

  return (
    <div className="flex flex-col space-y-3">
      {!readOnly && renderInlineCreate(null, ROOT_INPUT_KEY, 'Add program...')}

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
