import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
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
  X,
} from 'lucide-react'
import { Button } from '@/components/lego_blocks/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/lego_blocks/ui/select'
import {
  NodeStatusBadgeBlock,
  NodeStatusSelectBlock,
} from '@/components/lego_blocks/NodeStatusBlock'
import type { NodeRecord } from '@/services/lego_blocks/dbBlock'
import {
  normalizeTagBlock,
  normalizeTagListBlock,
  tagColorClassBlock,
  tagColorStyleBlock,
  tagLookupKeyBlock,
} from '@/services/lego_blocks/tagBlock'
import type { NodePriority, NodeStatus, NodeType, YAMLCommentEntry } from '@/services/lego_blocks/yamlNoteBlock'
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

const TASK_STATUS_COLORS = {
  ready: 'bg-indigo-500/15 text-indigo-700',
  in_progress: 'bg-emerald-500/15 text-emerald-700',
  blocked: 'bg-amber-500/15 text-amber-700',
  done: 'bg-blue-500/15 text-blue-700',
  cancelled: 'bg-zinc-500/15 text-zinc-500',
} as const
const TASK_STATUS_OPTIONS = ['ready', 'in_progress', 'blocked', 'done', 'cancelled'] as const
type TaskStatusOption = (typeof TASK_STATUS_OPTIONS)[number]

const PRIORITY_COLORS: Record<NonNullable<NodePriority>, string> = {
  low: 'bg-zinc-400',
  medium: 'bg-blue-400',
  high: 'bg-amber-400',
  critical: 'bg-red-500',
}

function taskStatusLabel(taskStatus: TaskStatusOption): string {
  return taskStatus.replace(/_/g, ' ')
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

const NEW_ROW_HIGHLIGHT_MS = 2200

function formatRowOrdinal(index: number): string {
  if (!Number.isFinite(index) || index < 0) return '0'
  return String(index + 1)
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

function selectedPresetTagsForNode(
  node: NodeRecord,
  projectPresetTagsByRoot: Record<string, string[]>,
): string[] {
  const projectRoot = normalizePath(node.projectRoot ?? '')
  if (!projectRoot) return []
  const presetTags = projectPresetTagsByRoot[projectRoot] ?? []
  if (presetTags.length === 0 || node.tags.length === 0) return []
  const presetLookup = new Set(presetTags.map(tag => normalizeTagBlock(tag).toLowerCase()).filter(Boolean))
  return node.tags.filter(tag => presetLookup.has(normalizeTagBlock(tag).toLowerCase()))
}

function compactTagList(tags: string[], limit = 3): { visible: string[]; hiddenCount: number } {
  if (tags.length <= limit) return { visible: tags, hiddenCount: 0 }
  return {
    visible: tags.slice(0, limit),
    hiddenCount: tags.length - limit,
  }
}

function TaskStatusBadge({ taskStatus }: { taskStatus: TaskStatusOption }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium', TASK_STATUS_COLORS[taskStatus])}>
      {taskStatus}
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

interface ProgramGroupEntryBlock {
  id: string
  name: string
  collapsed?: boolean
}

const ROOT_INPUT_KEY = '__root__'
type DropEdge = 'before' | 'after'

export interface BacklogListBlockProps {
  programs: NodeRecord[]
  loadEpics: (program: NodeRecord) => Promise<NodeRecord[]>
  loadChildren: (node: NodeRecord) => Promise<NodeRecord[]>
  treeRevision?: number
  selectedNodeId: string | null
  readOnly?: boolean
  onSelectNode: (node: NodeRecord) => void
  onCreateChild?: (
    parent: NodeRecord | null,
    title: string,
    requestedType?: NodeType,
    details?: {
      description?: string
      comment?: string
    },
  ) => Promise<NodeRecord>
  onDropNodeToNode?: (sourceUuid: string, target: NodeRecord) => Promise<void>
  onReorderSiblings?: (params: { parentKey: string | null; orderedNodes: NodeRecord[] }) => Promise<NodeRecord[] | void>
  projectPresetTagsByRoot?: Record<string, string[]>
  projectTagColorsByRoot?: Record<string, Record<string, string>>
  programGroups?: ProgramGroupEntryBlock[]
  programGroupIdByProgram?: Record<string, string>
  onCreateProgramGroup?: (name: string) => void
  onDeleteProgramGroup?: (groupId: string) => void
  onToggleProgramGroupCollapsed?: (groupId: string) => void
  onAssignProgramToGroup?: (program: NodeRecord, groupId: string | null) => void
  onUpdateNodeStatus?: (node: NodeRecord, status: NodeStatus) => Promise<NodeRecord | void>
  onUpdateTaskStatus?: (node: NodeRecord, taskStatus: TaskStatusOption) => Promise<NodeRecord | void>
  onUpdateNodeNotes?: (node: NodeRecord, description: string, comments: YAMLCommentEntry[]) => Promise<NodeRecord | void>
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
      : parent.type === 'epic' ? 'epic'
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

function normalizeTaskStatus(value: string | undefined): keyof typeof TASK_STATUS_COLORS | null {
  if (!value) return null
  const canonical = value.trim().toLowerCase().replace(/\s+/g, '_')
  if (!canonical) return null
  if (canonical === 'inprogress' || canonical === 'doing' || canonical === 'underway') return 'in_progress'
  if (canonical === 'open' || canonical === 'todo' || canonical === 'to_do' || canonical === 'pending' || canonical === 'backlog') return 'ready'
  if (canonical === 'stuck' || canonical === 'waiting' || canonical === 'on_hold' || canonical === 'paused') return 'blocked'
  if (canonical === 'complete' || canonical === 'completed' || canonical === 'closed' || canonical === 'resolved' || canonical === 'shipped') return 'done'
  if (canonical === 'archived' || canonical === 'canceled' || canonical === 'dropped') return 'cancelled'
  if (canonical in TASK_STATUS_COLORS) return canonical as keyof typeof TASK_STATUS_COLORS
  return null
}

function taskStatusFromNodeStatus(status: NodeStatus): TaskStatusOption {
  if (status === 'completed') return 'done'
  if (status === 'archived' || status === 'cancelled') return 'cancelled'
  if (status === 'incomplete') return 'ready'
  if (status === 'paused') return 'blocked'
  return 'in_progress'
}

function getTaskStatusBadge(node: NodeRecord): TaskStatusOption {
  return normalizeTaskStatus(node.taskStatus) ?? taskStatusFromNodeStatus(node.status)
}

function notesSignature(description: string, comments: YAMLCommentEntry[]): string {
  return JSON.stringify({
    description: description.trim(),
    comments,
  })
}

function displaySortOrder(node: Pick<NodeRecord, 'sortOrder'>): number {
  return typeof node.sortOrder === 'number' && Number.isFinite(node.sortOrder)
    ? node.sortOrder
    : Number.POSITIVE_INFINITY
}

function compareNodeDisplayOrder(a: NodeRecord, b: NodeRecord): number {
  const byOrder = displaySortOrder(a) - displaySortOrder(b)
  if (byOrder !== 0) return byOrder
  const byTitle = a.title.localeCompare(b.title)
  if (byTitle !== 0) return byTitle
  return a.key.localeCompare(b.key)
}

function sortNodesForDisplay(nodes: NodeRecord[]): NodeRecord[] {
  return [...nodes].sort(compareNodeDisplayOrder)
}

function reorderNodesWithEdge(
  nodes: NodeRecord[],
  sourceId: string,
  targetId: string,
  edge: DropEdge,
): NodeRecord[] | null {
  const sourceNode = nodes.find(node => node.uuid === sourceId)
  if (!sourceNode) return null
  const withoutSource = nodes.filter(node => node.uuid !== sourceId)
  const targetIndex = withoutSource.findIndex(node => node.uuid === targetId)
  if (targetIndex < 0) return null

  const insertAt = edge === 'after' ? targetIndex + 1 : targetIndex
  withoutSource.splice(insertAt, 0, sourceNode)
  return withoutSource
}

export default function BacklogListBlock({
  programs,
  loadEpics,
  loadChildren,
  treeRevision = 0,
  selectedNodeId,
  readOnly = false,
  onSelectNode,
  onCreateChild,
  onDropNodeToNode,
  onReorderSiblings,
  projectPresetTagsByRoot = {},
  projectTagColorsByRoot = {},
  programGroups = [],
  programGroupIdByProgram = {},
  onCreateProgramGroup,
  onDeleteProgramGroup,
  onToggleProgramGroupCollapsed,
  onAssignProgramToGroup,
  onUpdateNodeStatus,
  onUpdateTaskStatus,
  onUpdateNodeNotes,
}: BacklogListBlockProps) {
  const [childrenByNode, setChildrenByNode] = useState<Record<string, ChildState>>({})
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [descriptionDrafts, setDescriptionDrafts] = useState<Record<string, string>>({})
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [draftTypeByKey, setDraftTypeByKey] = useState<Record<string, NodeType>>({ [ROOT_INPUT_KEY]: 'program' })
  const [busyCreate, setBusyCreate] = useState<Record<string, boolean>>({})
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null)
  const [dragOverEdge, setDragOverEdge] = useState<DropEdge | null>(null)
  const [groupingInfoOpenByNode, setGroupingInfoOpenByNode] = useState<Record<string, boolean>>({})
  const [copiedRowNodeId, setCopiedRowNodeId] = useState<string | null>(null)
  const [statusBusyByNode, setStatusBusyByNode] = useState<Record<string, boolean>>({})
  const [newlyCreatedNodeIds, setNewlyCreatedNodeIds] = useState<Record<string, boolean>>({})
  const [inlineNotesNode, setInlineNotesNode] = useState<NodeRecord | null>(null)
  const [inlineNotesDescriptionDraft, setInlineNotesDescriptionDraft] = useState('')
  const [inlineNotesCommentsDraft, setInlineNotesCommentsDraft] = useState<YAMLCommentEntry[]>([])
  const [inlineNotesCommentDraft, setInlineNotesCommentDraft] = useState('')
  const [inlineNotesSaving, setInlineNotesSaving] = useState(false)
  const [inlineNotesBaselineSignature, setInlineNotesBaselineSignature] = useState<string | null>(null)
  const [programLayoutEditMode, setProgramLayoutEditMode] = useState(false)
  const [programGroupDraft, setProgramGroupDraft] = useState('')
  const inlineNotesSessionRef = useRef(0)
  const inlineNotesAutoSaveSignatureRef = useRef<string | null>(null)
  const newRowHighlightTimeoutByNodeRef = useRef<Record<string, number>>({})
  const [localError, setLocalError] = useState<string | null>(null)
  const programFingerprint = programs.map(program => `${program.uuid}:${program.updatedAt}`).join('|')
  const allowProgramLayoutEditing = !readOnly && programLayoutEditMode

  const lookupTagColor = useCallback((node: NodeRecord, tag: string): string | undefined => {
    const projectRoot = normalizePath(node.projectRoot ?? '')
    if (!projectRoot) return undefined
    const colorsByTag = projectTagColorsByRoot[projectRoot]
    if (!colorsByTag) return undefined
    return colorsByTag[tagLookupKeyBlock(tag)]
  }, [projectTagColorsByRoot])

  const validProgramGroupIds = useMemo(
    () => new Set(programGroups.map(group => group.id)),
    [programGroups],
  )
  const resolvedProgramGroupIdByProgram = useMemo(() => {
    const resolved: Record<string, string> = {}
    for (const [programId, groupId] of Object.entries(programGroupIdByProgram)) {
      if (!validProgramGroupIds.has(groupId)) continue
      resolved[programId] = groupId
    }
    return resolved
  }, [programGroupIdByProgram, validProgramGroupIds])
  const programIndexById = useMemo(() => new Map(programs.map((program, index) => [program.uuid, index])), [programs])
  const groupedProgramsByGroupId = useMemo(() => {
    const grouped = new Map<string, NodeRecord[]>(programGroups.map(group => [group.id, []]))
    const ungrouped: NodeRecord[] = []

    for (const program of programs) {
      const groupId = resolvedProgramGroupIdByProgram[program.uuid]
      const target = groupId ? grouped.get(groupId) : null
      if (target) target.push(program)
      else ungrouped.push(program)
    }

    return {
      grouped,
      ungrouped,
    }
  }, [programGroups, programs, resolvedProgramGroupIdByProgram])

  useEffect(() => {
    // Child lists are locally cached; clear them when upstream program data refreshes
    // so externally-created organizer nodes become visible without stale tree state.
    setChildrenByNode({})
    setExpandedNodes({})
  }, [programFingerprint])

  useEffect(() => {
    setChildrenByNode({})
  }, [treeRevision])

  useEffect(() => {
    if (!readOnly) return
    setProgramLayoutEditMode(false)
  }, [readOnly])

  useEffect(() => {
    if (allowProgramLayoutEditing) return
    setDraggingNodeId(null)
    setDragOverNodeId(null)
    setDragOverEdge(null)
  }, [allowProgramLayoutEditing])

  useEffect(() => () => {
    for (const timeoutId of Object.values(newRowHighlightTimeoutByNodeRef.current)) {
      window.clearTimeout(timeoutId)
    }
    newRowHighlightTimeoutByNodeRef.current = {}
  }, [])

  const highlightNewlyCreatedRow = useCallback((nodeUuid: string) => {
    const normalizedNodeUuid = nodeUuid.trim()
    if (!normalizedNodeUuid) return

    const previousTimeoutId = newRowHighlightTimeoutByNodeRef.current[normalizedNodeUuid]
    if (previousTimeoutId) window.clearTimeout(previousTimeoutId)

    setNewlyCreatedNodeIds(prev => ({ ...prev, [normalizedNodeUuid]: true }))
    newRowHighlightTimeoutByNodeRef.current[normalizedNodeUuid] = window.setTimeout(() => {
      setNewlyCreatedNodeIds(prev => {
        if (!prev[normalizedNodeUuid]) return prev
        const next = { ...prev }
        delete next[normalizedNodeUuid]
        return next
      })
      delete newRowHighlightTimeoutByNodeRef.current[normalizedNodeUuid]
    }, NEW_ROW_HIGHLIGHT_MS)
  }, [])

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
          nodes: sortNodesForDisplay(epics),
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
          nodes: sortNodesForDisplay(children),
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
    const description = (descriptionDrafts[draftKey] ?? '').trim()
    const comment = (commentDrafts[draftKey] ?? '').trim()

    const allowedTypes = allowedCreateTypes(parent)
    const selectedType = draftTypeByKey[draftKey]
    const requestedType = selectedType && allowedTypes.includes(selectedType)
      ? selectedType
      : allowedTypes[0]

    setLocalError(null)
    setBusyCreate(prev => ({ ...prev, [draftKey]: true }))
    try {
      const created = await onCreateChild(parent, title, requestedType, {
        description: description || undefined,
        comment: comment || undefined,
      })
      setDrafts(prev => ({ ...prev, [draftKey]: '' }))
      setDescriptionDrafts(prev => ({ ...prev, [draftKey]: '' }))
      setCommentDrafts(prev => ({ ...prev, [draftKey]: '' }))

      if (parent) {
        setChildrenByNode(prev => {
          const existing = prev[parent.uuid]
          if (!existing?.loaded) return prev
          return {
            ...prev,
            [parent.uuid]: {
              ...existing,
              nodes: sortNodesForDisplay([...existing.nodes, created]),
            },
          }
        })
      }
      highlightNewlyCreatedRow(created.uuid)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to create node')
    } finally {
      setBusyCreate(prev => ({ ...prev, [draftKey]: false }))
    }
  }, [commentDrafts, descriptionDrafts, draftTypeByKey, drafts, highlightNewlyCreatedRow, onCreateChild])

  const makeDragStart = useCallback((node: NodeRecord) => (event: React.DragEvent) => {
    if (!allowProgramLayoutEditing) {
      event.preventDefault()
      return
    }
    setDraggingNodeId(node.uuid)
    event.dataTransfer.setData('application/x-ltm-node-id', node.uuid)
    event.dataTransfer.setData('text/ltm-node-id', node.uuid)
    event.dataTransfer.setData('text/plain', `ltm-node:${node.uuid}`)
    event.dataTransfer.effectAllowed = 'move'
  }, [allowProgramLayoutEditing])

  const handleDragEnd = useCallback(() => {
    setDraggingNodeId(null)
    setDragOverNodeId(null)
    setDragOverEdge(null)
  }, [])

  const handleDragOver = useCallback((node: NodeRecord, event: React.DragEvent) => {
    if (!allowProgramLayoutEditing) return
    event.preventDefault()
    event.stopPropagation()
    if (draggingNodeId || hasNodeDragType(event)) {
      event.dataTransfer.dropEffect = 'move'
      const rowRect = (event.currentTarget as HTMLElement).getBoundingClientRect()
      const pointerOffsetY = event.clientY - rowRect.top
      const edge: DropEdge = pointerOffsetY < rowRect.height / 2 ? 'before' : 'after'
      setDragOverNodeId(node.uuid)
      setDragOverEdge(edge)
    }
  }, [allowProgramLayoutEditing, draggingNodeId])

  const handleDragLeave = useCallback((nodeId: string) => {
    if (dragOverNodeId !== nodeId) return
    setDragOverNodeId(null)
    setDragOverEdge(null)
  }, [dragOverNodeId])

  const patchMovedNode = useCallback((sourceUuid: string, targetNode: NodeRecord) => {
    let shouldExpandTarget = false

    setChildrenByNode(prev => {
      let changed = false
      let movedNode: NodeRecord | null = null
      const next: Record<string, ChildState> = {}

      for (const [key, state] of Object.entries(prev)) {
        const filteredNodes = state.nodes.filter(node => {
          if (node.uuid !== sourceUuid) return true
          movedNode = node
          return false
        })

        if (filteredNodes.length !== state.nodes.length) {
          changed = true
          next[key] = { ...state, nodes: filteredNodes }
        } else {
          next[key] = state
        }
      }

      if (movedNode) {
        const targetState = next[targetNode.uuid]
        if (targetState?.loaded) {
          const alreadyPresent = targetState.nodes.some(node => node.uuid === sourceUuid)
          if (!alreadyPresent) {
            const movedSource = movedNode as NodeRecord
            changed = true
            shouldExpandTarget = true
            next[targetNode.uuid] = {
              ...targetState,
              nodes: sortNodesForDisplay([
                ...targetState.nodes,
                {
                  ...movedSource,
                  parent: targetNode.key,
                  parentUuid: targetNode.uuid,
                  parentType: targetNode.type,
                  updatedAt: new Date().toISOString(),
                },
              ]),
            }
          }
        }
      }

      return changed ? next : prev
    })

    if (shouldExpandTarget) {
      setExpandedNodes(prev => ({ ...prev, [targetNode.uuid]: true }))
    }
  }, [])

  const findSiblingContext = useCallback((nodeId: string): {
    parentUuid: string | null
    parentKey: string | null
    nodes: NodeRecord[]
  } | null => {
    if (programs.some(program => program.uuid === nodeId)) {
      return { parentUuid: null, parentKey: null, nodes: programs }
    }

    for (const [parentUuid, state] of Object.entries(childrenByNode)) {
      if (!state.loaded) continue
      if (state.nodes.some(node => node.uuid === nodeId)) {
        const parentNode = programs.find(program => program.uuid === parentUuid)
          ?? Object.values(childrenByNode)
            .flatMap(entry => entry.nodes)
            .find(node => node.uuid === parentUuid)
        return {
          parentUuid,
          parentKey: parentNode?.key ?? null,
          nodes: state.nodes,
        }
      }
    }
    return null
  }, [childrenByNode, programs])

  const patchSiblingOrderForParent = useCallback((parentUuid: string | null, orderedNodes: NodeRecord[]) => {
    if (!parentUuid) return
    setChildrenByNode(prev => {
      const state = prev[parentUuid]
      if (!state?.loaded) return prev
      return {
        ...prev,
        [parentUuid]: {
          ...state,
          nodes: orderedNodes,
        },
      }
    })
  }, [])

  const handleDrop = useCallback(async (target: NodeRecord, event: React.DragEvent) => {
    if (!allowProgramLayoutEditing) return
    event.preventDefault()
    event.stopPropagation()
    setDragOverNodeId(null)
    const edge = dragOverEdge ?? 'after'
    setDragOverEdge(null)

    const sourceId = readDroppedNodeId(event) ?? draggingNodeId
    if (!sourceId) return
    if (sourceId === target.uuid) {
      setLocalError('Cannot drop a node onto itself.')
      return
    }

    const sourceContext = findSiblingContext(sourceId)
    const targetContext = findSiblingContext(target.uuid)

    if (
      sourceContext &&
      targetContext &&
      sourceContext.parentUuid === targetContext.parentUuid &&
      onReorderSiblings
    ) {
      const reordered = reorderNodesWithEdge(targetContext.nodes, sourceId, target.uuid, edge)
      if (!reordered) return

      const beforeOrder = targetContext.nodes.map(node => node.uuid).join('|')
      const nextOrder = reordered.map(node => node.uuid).join('|')
      if (beforeOrder === nextOrder) return

      setLocalError(null)
      try {
        const persisted = await onReorderSiblings({
          parentKey: targetContext.parentKey,
          orderedNodes: reordered,
        })
        const persistedById = new Map((persisted ?? []).map(node => [node.uuid, node]))
        const nextNodes = reordered.map(node => persistedById.get(node.uuid) ?? node)
        patchSiblingOrderForParent(targetContext.parentUuid, nextNodes)
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Failed to reorder nodes')
      }
      return
    }

    if (!onDropNodeToNode) return
    setLocalError(null)
    try {
      await onDropNodeToNode(sourceId, target)
      patchMovedNode(sourceId, target)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to move node')
    }
  }, [
    allowProgramLayoutEditing,
    dragOverEdge,
    draggingNodeId,
    findSiblingContext,
    onDropNodeToNode,
    onReorderSiblings,
    patchMovedNode,
    patchSiblingOrderForParent,
  ])

  const createProgramGroupFromDraft = useCallback(() => {
    if (!onCreateProgramGroup) return
    const nextName = programGroupDraft.trim()
    if (!nextName) return
    onCreateProgramGroup(nextName)
    setProgramGroupDraft('')
  }, [onCreateProgramGroup, programGroupDraft])

  const moveProgramByOffset = useCallback(async (program: NodeRecord, offset: -1 | 1) => {
    if (!allowProgramLayoutEditing) return
    if (!onReorderSiblings) return
    const currentIndex = programs.findIndex(entry => entry.uuid === program.uuid)
    if (currentIndex < 0) return
    const nextIndex = currentIndex + offset
    if (nextIndex < 0 || nextIndex >= programs.length) return

    const reordered = [...programs]
    const [moved] = reordered.splice(currentIndex, 1)
    reordered.splice(nextIndex, 0, moved)

    setLocalError(null)
    try {
      await onReorderSiblings({
        parentKey: null,
        orderedNodes: reordered,
      })
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to reorder programs')
    }
  }, [allowProgramLayoutEditing, onReorderSiblings, programs])

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

  const patchCachedNode = useCallback((updatedNode: NodeRecord) => {
    setChildrenByNode(prev => {
      let changed = false
      const next: Record<string, ChildState> = {}
      for (const [key, state] of Object.entries(prev)) {
        let stateChanged = false
        const nextNodes = state.nodes.map(node => {
          if (node.uuid !== updatedNode.uuid) return node
          stateChanged = true
          return updatedNode
        })
        if (stateChanged) {
          changed = true
          next[key] = { ...state, nodes: nextNodes }
        } else {
          next[key] = state
        }
      }
      return changed ? next : prev
    })
    setInlineNotesNode(prev => (prev?.uuid === updatedNode.uuid ? updatedNode : prev))
  }, [])

  const handleInlineNodeStatusChange = useCallback(async (node: NodeRecord, nextStatus: NodeStatus) => {
    if (readOnly || !onUpdateNodeStatus) return
    if (node.status === nextStatus) return

    setStatusBusyByNode(prev => ({ ...prev, [node.uuid]: true }))
    setLocalError(null)
    try {
      const updated = await onUpdateNodeStatus(node, nextStatus)
      patchCachedNode(updated ?? { ...node, status: nextStatus })
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setStatusBusyByNode(prev => ({ ...prev, [node.uuid]: false }))
    }
  }, [onUpdateNodeStatus, patchCachedNode, readOnly])

  const handleInlineTaskStatusChange = useCallback(async (node: NodeRecord, nextTaskStatus: TaskStatusOption) => {
    if (readOnly || !onUpdateTaskStatus) return
    if (getTaskStatusBadge(node) === nextTaskStatus) return

    setStatusBusyByNode(prev => ({ ...prev, [node.uuid]: true }))
    setLocalError(null)
    try {
      const updated = await onUpdateTaskStatus(node, nextTaskStatus)
      patchCachedNode(updated ?? { ...node, taskStatus: nextTaskStatus })
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to update task status')
    } finally {
      setStatusBusyByNode(prev => ({ ...prev, [node.uuid]: false }))
    }
  }, [onUpdateTaskStatus, patchCachedNode, readOnly])

  const saveInlineNotesSnapshot = useCallback(async (
    node: NodeRecord,
    descriptionDraft: string,
    commentsDraft: YAMLCommentEntry[],
  ): Promise<NodeRecord> => {
    if (!onUpdateNodeNotes) return node
    const description = descriptionDraft.trim()
    const comments = commentsDraft
    const updated = await onUpdateNodeNotes(node, description, comments)
    const nextNode = updated ?? { ...node, description, comments }
    patchCachedNode(nextNode)
    return nextNode
  }, [onUpdateNodeNotes, patchCachedNode])

  const closeInlineNotes = useCallback(() => {
    inlineNotesSessionRef.current += 1
    inlineNotesAutoSaveSignatureRef.current = null
    setInlineNotesNode(null)
    setInlineNotesDescriptionDraft('')
    setInlineNotesCommentsDraft([])
    setInlineNotesCommentDraft('')
    setInlineNotesBaselineSignature(null)
  }, [])

  const openInlineNotes = useCallback((node: NodeRecord) => {
    const initialDescription = (node.description ?? '').trim()
    const initialComments = node.comments ?? []
    inlineNotesSessionRef.current += 1
    inlineNotesAutoSaveSignatureRef.current = null
    setInlineNotesDescriptionDraft(initialDescription)
    setInlineNotesCommentsDraft(initialComments)
    setInlineNotesCommentDraft('')
    setInlineNotesBaselineSignature(notesSignature(initialDescription, initialComments))
    setInlineNotesNode(node)
  }, [])

  const toggleInlineNotes = useCallback(async (node: NodeRecord) => {
    if (readOnly || !onUpdateNodeNotes || inlineNotesSaving) return
    setLocalError(null)

    const activeNode = inlineNotesNode
    if (activeNode) {
      const currentSignature = notesSignature(inlineNotesDescriptionDraft, inlineNotesCommentsDraft)
      const activeDirty = currentSignature !== inlineNotesBaselineSignature
      if (activeDirty) {
        setInlineNotesSaving(true)
        try {
          const persisted = await saveInlineNotesSnapshot(activeNode, inlineNotesDescriptionDraft, inlineNotesCommentsDraft)
          setInlineNotesBaselineSignature(notesSignature(persisted.description ?? '', persisted.comments ?? []))
          setInlineNotesNode(persisted)
        } catch (err) {
          setLocalError(err instanceof Error ? err.message : 'Failed to update notes')
          return
        } finally {
          setInlineNotesSaving(false)
        }
      }
    }

    if (inlineNotesNode?.uuid === node.uuid) {
      closeInlineNotes()
      return
    }

    openInlineNotes(node)
  }, [
    closeInlineNotes,
    inlineNotesBaselineSignature,
    inlineNotesCommentsDraft,
    inlineNotesDescriptionDraft,
    inlineNotesNode,
    inlineNotesSaving,
    onUpdateNodeNotes,
    openInlineNotes,
    readOnly,
    saveInlineNotesSnapshot,
  ])

  const addInlineCommentDraft = useCallback(() => {
    const next = inlineNotesCommentDraft.trim()
    if (!next) return
    setInlineNotesCommentsDraft(prev => [
      ...prev,
      {
        text: next,
        added_at: new Date().toISOString(),
        added_by: 'unknown',
      },
    ])
    setInlineNotesCommentDraft('')
  }, [inlineNotesCommentDraft])

  const removeInlineCommentDraft = useCallback((index: number) => {
    setInlineNotesCommentsDraft(prev => prev.filter((_, idx) => idx !== index))
  }, [])

  const commitInlineNotes = useCallback(async (): Promise<void> => {
    if (!inlineNotesNode || !onUpdateNodeNotes) return
    if (inlineNotesSaving) return

    const description = inlineNotesDescriptionDraft.trim()
    const comments = inlineNotesCommentsDraft
    const signature = notesSignature(description, comments)
    if (signature === inlineNotesBaselineSignature) return

    const activeSession = inlineNotesSessionRef.current
    setInlineNotesSaving(true)
    setLocalError(null)
    try {
      const nextNode = await saveInlineNotesSnapshot(inlineNotesNode, description, comments)
      if (inlineNotesSessionRef.current !== activeSession) return
      setInlineNotesNode(nextNode)
      setInlineNotesBaselineSignature(notesSignature(nextNode.description ?? '', nextNode.comments ?? []))
      inlineNotesAutoSaveSignatureRef.current = signature
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to update notes')
    } finally {
      setInlineNotesSaving(false)
    }
  }, [
    inlineNotesBaselineSignature,
    inlineNotesCommentsDraft,
    inlineNotesDescriptionDraft,
    inlineNotesNode,
    inlineNotesSaving,
    onUpdateNodeNotes,
    saveInlineNotesSnapshot,
  ])

  const inlineNotesPayloadSignature = inlineNotesNode
    ? notesSignature(inlineNotesDescriptionDraft, inlineNotesCommentsDraft)
    : null
  const inlineNotesDirty = inlineNotesNode
    ? inlineNotesPayloadSignature !== inlineNotesBaselineSignature
    : false

  useEffect(() => {
    if (!inlineNotesNode || !onUpdateNodeNotes || readOnly) return
    if (inlineNotesSaving || !inlineNotesDirty) return
    if (!inlineNotesPayloadSignature) return
    if (inlineNotesAutoSaveSignatureRef.current === inlineNotesPayloadSignature) return

    const timeoutId = window.setTimeout(() => {
      inlineNotesAutoSaveSignatureRef.current = inlineNotesPayloadSignature
      void commitInlineNotes()
    }, 900)
    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    commitInlineNotes,
    inlineNotesDirty,
    inlineNotesNode,
    inlineNotesPayloadSignature,
    inlineNotesSaving,
    onUpdateNodeNotes,
    readOnly,
  ])

  const renderTicketBadge = useCallback((node: NodeRecord) => {
    const ticket = node.ticket?.trim() ?? ''
    if (!ticket) return null

    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
        {ticket}
      </span>
    )
  }, [])

  const renderInlineNotesEditor = useCallback((node: NodeRecord, depthPadding: number) => {
    if (readOnly || !onUpdateNodeNotes) return null
    if (inlineNotesNode?.uuid !== node.uuid) return null
    const inlineTags = normalizeTagListBlock(node.tags ?? [])

    return (
      <div
        className="border-t border-border/60 bg-muted/25 px-3 py-2.5"
        style={{ paddingLeft: `${depthPadding}px` }}
        onClick={(event) => { event.preventDefault(); event.stopPropagation() }}
      >
        <div className="space-y-2">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Tags</label>
            {inlineTags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {inlineTags.map(tag => (
                  <span
                    key={`${node.uuid}-inline-tag-${tag}`}
                    className={cn(
                      'rounded-full border px-1.5 py-0.5 text-[10px] leading-none',
                      tagColorClassBlock(tag, 'solid'),
                    )}
                    style={tagColorStyleBlock(tag, 'solid', lookupTagColor(node, tag))}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground">No tags yet.</div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Description</label>
            <textarea
              value={inlineNotesDescriptionDraft}
              onChange={(event) => setInlineNotesDescriptionDraft(event.target.value)}
              placeholder="Add description..."
              className="min-h-[72px] w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <div className="text-[11px] font-medium text-muted-foreground">Comments</div>
            {inlineNotesCommentsDraft.length > 0 ? (
              <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
                {inlineNotesCommentsDraft.map((comment, index) => (
                  <div key={`${comment.text}-${comment.added_at ?? index}`} className="flex items-start justify-between gap-2 rounded-md border border-border/60 bg-background/70 px-2 py-1 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="break-words text-foreground">{comment.text}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {comment.added_by ?? 'unknown'} · {comment.added_at ? new Date(comment.added_at).toLocaleString() : 'time unknown'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeInlineCommentDraft(index)}
                      className="rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground">No comments yet.</div>
            )}

            <div className="flex items-center gap-2">
              <input
                value={inlineNotesCommentDraft}
                onChange={(event) => setInlineNotesCommentDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addInlineCommentDraft()
                  }
                }}
                placeholder="Add a comment..."
                className="h-7 flex-1 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={addInlineCommentDraft}>
                Add
              </Button>
            </div>

            <div className="text-[11px] text-muted-foreground">
              {inlineNotesSaving ? 'Auto-saving...' : (inlineNotesDirty ? 'Unsaved changes' : 'Auto-save on')}
            </div>
          </div>
        </div>
      </div>
    )
  }, [
    addInlineCommentDraft,
    inlineNotesCommentDraft,
    inlineNotesCommentsDraft,
    inlineNotesDescriptionDraft,
    inlineNotesDirty,
    inlineNotesNode?.uuid,
    inlineNotesSaving,
    lookupTagColor,
    onUpdateNodeNotes,
    readOnly,
    removeInlineCommentDraft,
  ])

  const renderInlineCreate = useCallback((parent: NodeRecord | null, draftKey: string, placeholder: string) => {
    if (readOnly) return null

    const allowedTypes = allowedCreateTypes(parent)
    const selectedType = draftTypeByKey[draftKey] && allowedTypes.includes(draftTypeByKey[draftKey])
      ? draftTypeByKey[draftKey]
      : allowedTypes[0]
    const selectedTypeLabel = nodeTypeLabel(selectedType)

    return (
      <div className="space-y-2 border-t border-border/70 bg-background px-3 py-2">
        <div className="flex items-center gap-2">
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
        <div className="grid gap-2 md:grid-cols-2">
          <textarea
            value={descriptionDrafts[draftKey] ?? ''}
            onChange={event => {
              const next = event.target.value
              setDescriptionDrafts(prev => ({ ...prev, [draftKey]: next }))
            }}
            rows={2}
            placeholder="Description (optional)"
            className="min-h-[64px] w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 text-xs leading-snug focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <textarea
            value={commentDrafts[draftKey] ?? ''}
            onChange={event => {
              const next = event.target.value
              setCommentDrafts(prev => ({ ...prev, [draftKey]: next }))
            }}
            rows={2}
            placeholder="Comment (optional)"
            className="min-h-[64px] w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 text-xs leading-snug focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
    )
  }, [busyCreate, commentDrafts, createUnder, descriptionDrafts, draftTypeByKey, drafts, readOnly, setDraft])

  const renderNodeBranch = useCallback((
    node: NodeRecord,
    depth: number,
    siblingIndex: number,
    parentNode: NodeRecord | null,
    epicContext: NodeRecord | null,
  ) => {
    const Icon = iconForNodeType(node.type)
    const isExpanded = !!expandedNodes[node.uuid]
    const childState = childrenByNode[node.uuid]
    if (isExpanded && !childState?.loading && !childState?.loaded) {
      void ensureChildrenLoaded(node)
    }
    const childCount = childState?.loaded ? childState.nodes.length : null
    const borderColorClass = depth === 0
      ? EPIC_BORDER_PALETTE[siblingIndex % EPIC_BORDER_PALETTE.length]
      : 'border-l-zinc-300'
    const iconColorClass = node.type === 'epic' && depth === 0
      ? (EPIC_ICON_COLOR_BY_BORDER[borderColorClass] ?? iconColorForNodeType(node.type))
      : iconColorForNodeType(node.type)

    const effectiveEpicContext = node.type === 'epic' ? node : epicContext
    const canShowGroupingInfo = isTaskNode(node) && !!effectiveEpicContext && !!parentNode
    const groupingInfoOpen = !!groupingInfoOpenByNode[node.uuid]
    const newlyCreated = !!newlyCreatedNodeIds[node.uuid]
    const rowPresetTags = compactTagList(
      selectedPresetTagsForNode(node, projectPresetTagsByRoot),
    )

    return (
      <div key={node.uuid} className="border-b border-border/70 last:border-b-0">
        <div
          draggable={allowProgramLayoutEditing}
          onDragStart={makeDragStart(node)}
          onDragEnd={handleDragEnd}
          onDragOver={e => handleDragOver(node, e)}
          onDragLeave={() => handleDragLeave(node.uuid)}
          onDrop={e => { void handleDrop(node, e) }}
          className={cn(
            'flex cursor-pointer items-center gap-2 border-l-[3px] px-3 py-2 transition-colors',
            'bg-card hover:bg-zinc-50',
            borderColorClass,
            selectedNodeId === node.uuid && 'bg-accent/40',
            dragOverNodeId === node.uuid && 'ring-2 ring-primary/40 bg-primary/5',
            dragOverNodeId === node.uuid && dragOverEdge === 'before' && 'shadow-[inset_0_2px_0_rgba(59,130,246,0.7)]',
            dragOverNodeId === node.uuid && dragOverEdge === 'after' && 'shadow-[inset_0_-2px_0_rgba(59,130,246,0.7)]',
            newlyCreated && 'bg-emerald-100/80 ring-2 ring-emerald-400/70',
          )}
          style={{ paddingLeft: `${12 + (depth * 16)}px` }}
        >
          <sup
            aria-hidden="true"
            className="-ml-1.5 mr-0.5 mt-0.5 self-start font-mono text-[8px] leading-none tabular-nums text-muted-foreground/45"
          >
            {formatRowOrdinal(siblingIndex)}
          </sup>
          <button
            type="button"
            onClick={() => toggleNode(node)}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-transparent p-0 text-muted-foreground outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 hover:bg-transparent active:bg-transparent hover:text-foreground"
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
          {rowPresetTags.visible.length > 0 && (
            <div className="hidden max-w-[35%] items-center gap-1 overflow-hidden lg:flex">
              {rowPresetTags.visible.map(tag => (
                <span
                  key={`${node.uuid}-preset-row-tag-${tag}`}
                  className={cn(
                    'truncate rounded-full border px-1.5 py-0.5 text-[10px] leading-none',
                    tagColorClassBlock(tag, 'solid'),
                  )}
                  style={tagColorStyleBlock(tag, 'solid', lookupTagColor(node, tag))}
                >
                  {tag}
                </span>
              ))}
              {rowPresetTags.hiddenCount > 0 && (
                <span className="rounded-full border border-border/70 bg-muted/20 px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
                  +{rowPresetTags.hiddenCount}
                </span>
              )}
            </div>
          )}
          {isTaskNode(node) ? (
            readOnly || !onUpdateTaskStatus ? (
              <TaskStatusBadge taskStatus={getTaskStatusBadge(node)} />
            ) : (
              <div
                className="flex items-center gap-1"
                onClick={(event) => { event.preventDefault(); event.stopPropagation() }}
              >
                {statusBusyByNode[node.uuid] ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <Select
                    value={getTaskStatusBadge(node)}
                    onValueChange={(value) => { void handleInlineTaskStatusChange(node, value as TaskStatusOption) }}
                  >
                    <SelectTrigger
                      className={cn(
                        'h-6 w-auto gap-1 rounded-full border border-transparent px-2 py-0 text-[10px] font-medium shadow-none focus:ring-0 focus:ring-offset-0',
                        TASK_STATUS_COLORS[getTaskStatusBadge(node)],
                      )}
                      title="Change task status"
                    >
                      <span>{taskStatusLabel(getTaskStatusBadge(node))}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUS_OPTIONS.map(option => (
                        <SelectItem key={`${node.uuid}-task-${option}`} value={option}>
                          {taskStatusLabel(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )
          ) : (
            readOnly || !onUpdateNodeStatus ? (
              <NodeStatusBadgeBlock status={node.status} />
            ) : (
              <div
                className="flex items-center gap-1"
                onClick={(event) => { event.preventDefault(); event.stopPropagation() }}
              >
                {statusBusyByNode[node.uuid] ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <NodeStatusSelectBlock
                    status={node.status}
                    onChange={(value) => { void handleInlineNodeStatusChange(node, value) }}
                    variant="pill"
                    title="Change status"
                  />
                )}
              </div>
            )
          )}
          {!readOnly && onUpdateNodeNotes && (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                void toggleInlineNotes(node)
              }}
              className={cn(
                'rounded p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                inlineNotesNode?.uuid === node.uuid
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              title="Details"
              disabled={inlineNotesSaving}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          )}
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
              <Layers className="h-3.5 w-3.5" />
            </button>
          )}
          {childCount !== null && (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {childCount}
            </span>
          )}
          <PriorityDot priority={node.priority} />
        </div>
        {canShowGroupingInfo && groupingInfoOpen && (
          <div className="border-t border-border/60 bg-muted/25 px-3 py-1.5 text-[11px] text-muted-foreground" style={{ paddingLeft: `${36 + (depth * 16)}px` }}>
            Grouped under epic: <span className="text-foreground">{nodeDisplayTitle(effectiveEpicContext!)}</span>
            {' · '}
            Parent: <span className="text-foreground">{nodeDisplayTitle(parentNode!)}</span>
          </div>
        )}
        {renderInlineNotesEditor(node, 36 + (depth * 16))}

        {isExpanded && (
          <div className="bg-muted/15">
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
  }, [allowProgramLayoutEditing, childrenByNode, copiedRowNodeId, copyRowLabelForNode, dragOverEdge, dragOverNodeId, ensureChildrenLoaded, expandedNodes, groupingInfoOpenByNode, handleDragEnd, handleDragLeave, handleDragOver, handleDrop, handleInlineNodeStatusChange, handleInlineTaskStatusChange, inlineNotesNode?.uuid, inlineNotesSaving, lookupTagColor, makeDragStart, newlyCreatedNodeIds, onSelectNode, onUpdateNodeNotes, onUpdateNodeStatus, onUpdateTaskStatus, projectPresetTagsByRoot, readOnly, renderInlineCreate, renderInlineNotesEditor, renderTicketBadge, selectedNodeId, statusBusyByNode, toggleInlineNotes, toggleNode])

  const renderProgramSection = useCallback((program: NodeRecord, programIndex: number) => {
    void ensureProgramLoaded(program)
    const childState = childrenByNode[program.uuid]
    const programIconColorClass = iconColorForNodeType(program.type)
    const newlyCreated = !!newlyCreatedNodeIds[program.uuid]
    const assignedGroupId = resolvedProgramGroupIdByProgram[program.uuid] ?? '__ungrouped__'
    const rowPresetTags = compactTagList(
      selectedPresetTagsForNode(program, projectPresetTagsByRoot),
    )

    return (
      <div key={program.uuid} className="overflow-hidden rounded-xl border border-border/70 bg-muted/25">
        <div
          draggable={allowProgramLayoutEditing}
          onDragStart={makeDragStart(program)}
          onDragEnd={handleDragEnd}
          onDragOver={e => handleDragOver(program, e)}
          onDragLeave={() => handleDragLeave(program.uuid)}
          onDrop={e => { void handleDrop(program, e) }}
          className={cn(
            'flex cursor-pointer items-center gap-2 border-b border-border/70 bg-card px-3 py-2 transition-colors hover:bg-zinc-50',
            selectedNodeId === program.uuid && 'bg-accent/40',
            dragOverNodeId === program.uuid && 'ring-2 ring-primary/40 bg-primary/5',
            dragOverNodeId === program.uuid && dragOverEdge === 'before' && 'shadow-[inset_0_2px_0_rgba(59,130,246,0.7)]',
            dragOverNodeId === program.uuid && dragOverEdge === 'after' && 'shadow-[inset_0_-2px_0_rgba(59,130,246,0.7)]',
            newlyCreated && 'bg-emerald-100/80 ring-2 ring-emerald-400/70',
          )}
          onClick={() => onSelectNode(program)}
        >
          <sup
            aria-hidden="true"
            className="-ml-1.5 mr-0.5 mt-0.5 self-start font-mono text-[8px] leading-none tabular-nums text-muted-foreground/45"
          >
            {formatRowOrdinal(programIndex)}
          </sup>
          {allowProgramLayoutEditing && onReorderSiblings && (
            <div
              className="mr-0.5 flex items-center gap-0.5"
              onClick={(event) => { event.preventDefault(); event.stopPropagation() }}
            >
              <button
                type="button"
                className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                title="Move up"
                onClick={() => { void moveProgramByOffset(program, -1) }}
                disabled={programIndex <= 0}
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                title="Move down"
                onClick={() => { void moveProgramByOffset(program, 1) }}
                disabled={programIndex >= (programs.length - 1)}
              >
                <ArrowDown className="h-3 w-3" />
              </button>
            </div>
          )}
          <FolderTree className={cn('h-4 w-4 shrink-0', programIconColorClass)} />
          <div className="min-w-0 flex flex-1 items-center gap-2">
            {renderTicketBadge(program)}
            <span className="min-w-0 flex-1 truncate text-sm font-bold">
              {nodeTitleWithoutTicket(program) || nodeDisplayTitle(program) || 'Untitled'}
            </span>
          </div>
          {rowPresetTags.visible.length > 0 && (
            <div className="hidden max-w-[35%] items-center gap-1 overflow-hidden lg:flex">
              {rowPresetTags.visible.map(tag => (
                <span
                  key={`${program.uuid}-preset-row-tag-${tag}`}
                  className={cn(
                    'truncate rounded-full border px-1.5 py-0.5 text-[10px] leading-none',
                    tagColorClassBlock(tag, 'solid'),
                  )}
                  style={tagColorStyleBlock(tag, 'solid', lookupTagColor(program, tag))}
                >
                  {tag}
                </span>
              ))}
              {rowPresetTags.hiddenCount > 0 && (
                <span className="rounded-full border border-border/70 bg-muted/20 px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
                  +{rowPresetTags.hiddenCount}
                </span>
              )}
            </div>
          )}
          {readOnly || !onUpdateNodeStatus ? (
            <NodeStatusBadgeBlock status={program.status} />
          ) : (
            <div
              className="flex items-center gap-1"
              onClick={(event) => { event.preventDefault(); event.stopPropagation() }}
            >
              {statusBusyByNode[program.uuid] ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : (
                <NodeStatusSelectBlock
                  status={program.status}
                  onChange={(value) => { void handleInlineNodeStatusChange(program, value) }}
                  variant="pill"
                  title="Change status"
                />
                )}
              </div>
            )}
          {allowProgramLayoutEditing && onAssignProgramToGroup && programGroups.length > 0 && (
            <div
              className="hidden items-center md:flex"
              onClick={(event) => { event.preventDefault(); event.stopPropagation() }}
            >
              <select
                value={assignedGroupId}
                onChange={(event) => {
                  const nextValue = event.target.value
                  onAssignProgramToGroup(program, nextValue === '__ungrouped__' ? null : nextValue)
                }}
                className="h-6 max-w-[140px] rounded-md border border-input bg-background px-1.5 text-[10px] text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                title="Assign group"
              >
                <option value="__ungrouped__">Ungrouped</option>
                {programGroups.map(group => (
                  <option key={`${program.uuid}-group-opt-${group.id}`} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!readOnly && onUpdateNodeNotes && (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                void toggleInlineNotes(program)
              }}
              className={cn(
                'rounded p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                inlineNotesNode?.uuid === program.uuid
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              title="Details"
              disabled={inlineNotesSaving}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          )}
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
          <PriorityDot priority={program.priority} />
        </div>
        {renderInlineNotesEditor(program, 36)}

        <div className="bg-muted/15">
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
  }, [allowProgramLayoutEditing, childrenByNode, copiedRowNodeId, copyRowLabelForNode, dragOverEdge, dragOverNodeId, ensureProgramLoaded, handleDragEnd, handleDragLeave, handleDragOver, handleDrop, handleInlineNodeStatusChange, inlineNotesNode?.uuid, inlineNotesSaving, lookupTagColor, makeDragStart, moveProgramByOffset, newlyCreatedNodeIds, onAssignProgramToGroup, onReorderSiblings, onSelectNode, onUpdateNodeNotes, onUpdateNodeStatus, programGroups, programs.length, projectPresetTagsByRoot, readOnly, renderInlineCreate, renderInlineNotesEditor, renderNodeBranch, renderTicketBadge, resolvedProgramGroupIdByProgram, selectedNodeId, statusBusyByNode, toggleInlineNotes])

  return (
    <div className="flex flex-col space-y-3">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={allowProgramLayoutEditing ? 'default' : 'outline'}
            onClick={() => setProgramLayoutEditMode(prev => !prev)}
          >
            {allowProgramLayoutEditing ? 'Done Organizing Programs' : 'Edit Program Layout'}
          </Button>
          {allowProgramLayoutEditing && (
            <p className="text-xs text-muted-foreground">
              Layout editing is on. Use drag/drop or arrow controls to reorder, assign groups from the right-side dropdown on each program row, and remove groups with the X button on each group header.
            </p>
          )}
        </div>
      )}

      {!readOnly && renderInlineCreate(null, ROOT_INPUT_KEY, 'Add program...')}

      {allowProgramLayoutEditing && onCreateProgramGroup && (
        <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2 py-1.5">
          <input
            value={programGroupDraft}
            onChange={event => setProgramGroupDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              createProgramGroupFromDraft()
            }}
            placeholder="Add program group (e.g. 2025)"
            className="h-7 flex-1 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={createProgramGroupFromDraft}
            disabled={!programGroupDraft.trim()}
          >
            Add Group
          </Button>
        </div>
      )}

      {programs.length === 0 && (
        <div className="px-3 py-4 text-sm text-muted-foreground">
          No programs yet. Create one above to get started.
        </div>
      )}

      {programGroups.length > 0 && (
        <div className="space-y-3">
          {programGroups.map((group) => {
            const groupedPrograms = groupedProgramsByGroupId.grouped.get(group.id) ?? []
            return (
              <div key={`program-group-${group.id}`} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <button
                    type="button"
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors',
                      allowProgramLayoutEditing
                        ? 'border border-border/60 bg-muted/25 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground'
                        : 'bg-zinc-800/90 text-sm font-semibold text-white hover:bg-zinc-700',
                    )}
                    onClick={() => onToggleProgramGroupCollapsed?.(group.id)}
                    title={group.collapsed ? 'Expand group' : 'Collapse group'}
                  >
                    <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', group.collapsed ? '' : 'rotate-90')} />
                    <span>{group.name}</span>
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0 text-[10px] leading-none',
                        allowProgramLayoutEditing
                          ? 'border border-border/70 text-muted-foreground'
                          : 'bg-white/20 text-white',
                      )}
                    >
                      {groupedPrograms.length}
                    </span>
                  </button>
                  {allowProgramLayoutEditing && onDeleteProgramGroup && (
                    <button
                      type="button"
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      onClick={() => onDeleteProgramGroup(group.id)}
                      title={`Delete group ${group.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {!group.collapsed && (
                  groupedPrograms.length > 0 ? (
                    <div className="space-y-2">
                      {groupedPrograms.map(program => renderProgramSection(program, programIndexById.get(program.uuid) ?? 0))}
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                      No programs assigned to this group.
                    </div>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}

      {groupedProgramsByGroupId.ungrouped.length > 0 && (
        <div className="space-y-2">
          {programGroups.length > 0 && (
            <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Ungrouped Programs</p>
          )}
          {groupedProgramsByGroupId.ungrouped.map(program => renderProgramSection(program, programIndexById.get(program.uuid) ?? 0))}
        </div>
      )}

      {localError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {localError}
        </div>
      )}
    </div>
  )
}
