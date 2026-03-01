import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { BacklogNodeRowBlock } from '@/components/lego_blocks/units/BacklogNodeRowBlock'
import { BacklogProgramRowBlock } from '@/components/lego_blocks/units/BacklogProgramRowBlock'
import type { BacklogRowColumnBlock } from '@/components/lego_blocks/units/BacklogRowColumnsBlock'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { BacklogInlineCreateBlock } from '@/components/lego_blocks/integrations/BacklogInlineCreateBlock'
import { BacklogInlineNotesEditorBlock } from '@/components/lego_blocks/integrations/BacklogInlineNotesEditorBlock'
import { ProgramGroupHeaderBlock } from '@/components/lego_blocks/integrations/ProgramGroupHeaderBlock'
import LinkedItemChipsBlock from '@/components/lego_blocks/units/LinkedItemChipsBlock'
import type { NodeRecord } from '@/services/lego_blocks/integrations/dbBlock'
import { tagLookupKeyBlock } from '@/services/lego_blocks/units/tagBlock'
import { cn } from '@/lib/utils'
import type { NodeStatus, NodeType, YAMLCommentEntry } from '@/services/lego_blocks/units/yamlNoteBlock'
import {
  allowedCreateTypes,
  type ChildStateBlock,
  compactTagList,
  copyTextToClipboard,
  EPIC_BORDER_PALETTE,
  EPIC_ICON_COLOR_BY_BORDER,
  getTaskStatusBadge,
  iconColorForNodeType,
  isTaskNode,
  NEW_ROW_HIGHLIGHT_MS,
  normalizePath,
  nodeDisplayTitle,
  ROOT_INPUT_KEY,
  selectedPresetTagsForNode,
  sortNodesForDisplay,
  type TaskStatusOption,
} from '@/components/lego_blocks/units/BacklogListDomainBlock'
import { useBacklogDragAndReorderBlock } from '@/components/lego_blocks/hooks/integrations/useBacklogDragAndReorderBlock'
import { useBacklogInlineNotesBlock } from '@/components/lego_blocks/hooks/integrations/useBacklogInlineNotesBlock'

interface ProgramGroupEntryBlock {
  id: string
  name: string
  collapsed?: boolean
}

interface BacklogRelatedNodeOptionBlock {
  path: string
  label: string
  summary?: string
}

function normalizeRelatedNodePathsBlock(paths: string[] | undefined): string[] {
  if (!paths || paths.length === 0) return []
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const path of paths) {
    const next = normalizePath(path)
    if (!next || seen.has(next)) continue
    seen.add(next)
    normalized.push(next)
  }
  return normalized
}

function fileNameFromPathBlock(path: string): string {
  const normalized = normalizePath(path)
  const base = normalized.split('/').pop() || normalized
  return base.toLowerCase().endsWith('.md') ? base.slice(0, -3) : base
}

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
  relatedNodeOptions?: BacklogRelatedNodeOptionBlock[]
  onOpenRelatedNode?: (path: string) => void
  onOpenNodeDetails?: (node: NodeRecord) => void
  canOpenNodeDetails?: (node: NodeRecord) => boolean
  rowColumns?: BacklogRowColumnBlock[]
  showRowColumnsOnCompact?: boolean
  rowPresetTagLimit?: number
  rowPresetTagsClassName?: string
  reserveTagsSlotWhenEmpty?: boolean
  linksColumnLabel?: string
  linksColumnWidthClassName?: string
  linksColumnAlign?: 'left' | 'center' | 'right'
  linksColumnPaddingClassName?: string
  linksBeforeTags?: boolean
  statusRightAligned?: boolean
  rowDetailsRenderer?: ((node: NodeRecord) => ReactNode) | null
  titleColumnClassName?: string
  wrapTitleText?: boolean
  actionsRightEdge?: boolean
  showProgramStatus?: boolean
  showProgramCopyButton?: boolean
  preferInlineDetailsButton?: boolean
  allowInlineNotesInReadOnly?: boolean
  showExpandToggles?: boolean
  showNodeTypeIcons?: boolean
  showPriorityDots?: boolean
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
  relatedNodeOptions = [],
  onOpenRelatedNode,
  onOpenNodeDetails,
  canOpenNodeDetails,
  rowColumns = [],
  showRowColumnsOnCompact = false,
  rowPresetTagLimit = 3,
  rowPresetTagsClassName,
  reserveTagsSlotWhenEmpty = false,
  linksColumnLabel,
  linksColumnWidthClassName,
  linksColumnAlign = 'right',
  linksColumnPaddingClassName = 'px-2',
  linksBeforeTags = false,
  statusRightAligned = true,
  rowDetailsRenderer = null,
  titleColumnClassName,
  wrapTitleText = false,
  actionsRightEdge = false,
  showProgramStatus = true,
  showProgramCopyButton = true,
  preferInlineDetailsButton = false,
  allowInlineNotesInReadOnly = false,
  showExpandToggles = true,
  showNodeTypeIcons = true,
  showPriorityDots = true,
}: BacklogListBlockProps) {
  const [childrenByNode, setChildrenByNode] = useState<Record<string, ChildStateBlock>>({})
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [descriptionDrafts, setDescriptionDrafts] = useState<Record<string, string>>({})
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [draftTypeByKey, setDraftTypeByKey] = useState<Record<string, NodeType>>({ [ROOT_INPUT_KEY]: 'program' })
  const [busyCreate, setBusyCreate] = useState<Record<string, boolean>>({})
  const [groupingInfoOpenByNode, setGroupingInfoOpenByNode] = useState<Record<string, boolean>>({})
  const [copiedRowNodeId, setCopiedRowNodeId] = useState<string | null>(null)
  const [statusBusyByNode, setStatusBusyByNode] = useState<Record<string, boolean>>({})
  const [newlyCreatedNodeIds, setNewlyCreatedNodeIds] = useState<Record<string, boolean>>({})
  const [rowDetailsNodeId, setRowDetailsNodeId] = useState<string | null>(null)
  const [programLayoutEditMode, setProgramLayoutEditMode] = useState(false)
  const [programGroupDraft, setProgramGroupDraft] = useState('')
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
    if (rowDetailsRenderer) return
    setRowDetailsNodeId(null)
  }, [rowDetailsRenderer])

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

  const {
    dragOverNodeId,
    dragOverEdge,
    makeDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    moveProgramByOffset,
  } = useBacklogDragAndReorderBlock({
    allowProgramLayoutEditing,
    programs,
    childrenByNode,
    setChildrenByNode,
    setExpandedNodes,
    onDropNodeToNode,
    onReorderSiblings,
    setLocalError,
  })

  const createProgramGroupFromDraft = useCallback(() => {
    if (!onCreateProgramGroup) return
    const nextName = programGroupDraft.trim()
    if (!nextName) return
    onCreateProgramGroup(nextName)
    setProgramGroupDraft('')
  }, [onCreateProgramGroup, programGroupDraft])

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
      const next: Record<string, ChildStateBlock> = {}
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
  }, [])

  const relatedNodeOptionsByPath = useMemo(() => {
    const map = new Map<string, BacklogRelatedNodeOptionBlock>()
    for (const option of relatedNodeOptions) {
      const normalizedPath = normalizePath(option.path)
      if (!normalizedPath) continue
      if (map.has(normalizedPath)) continue
      map.set(normalizedPath, {
        path: normalizedPath,
        label: option.label?.trim() || fileNameFromPathBlock(normalizedPath),
        summary: option.summary?.trim() || undefined,
      })
    }
    return map
  }, [relatedNodeOptions])

  const renderRelatedNodeLinksSlot = useCallback((node: NodeRecord) => {
    const normalizedLinks = normalizeRelatedNodePathsBlock(node.relatedNodes)
    const hasLinks = normalizedLinks.length > 0
    if (!hasLinks) return null

    const linkedItems = normalizedLinks.map((path) => {
      const option = relatedNodeOptionsByPath.get(path)
      return {
        path,
        label: option?.label || fileNameFromPathBlock(path),
        summary: option?.summary,
      }
    })

    return (
      <div className={cn(
        'hidden min-w-0 shrink-0 self-center items-center lg:flex',
        actionsRightEdge && !statusRightAligned && 'ml-auto',
        linksColumnPaddingClassName,
        linksColumnWidthClassName ?? (actionsRightEdge ? 'max-w-[24rem] min-w-[10rem]' : 'max-w-[24rem]'),
      )}>
        <LinkedItemChipsBlock
          items={linkedItems}
          className={cn(
            'min-w-0 w-full gap-1',
            linksColumnAlign === 'center'
              ? 'justify-center'
              : linksColumnAlign === 'left'
                ? 'justify-start'
                : 'justify-end',
          )}
          chipClassName="max-w-[12rem] px-1.5 py-0.5 text-[10px] leading-none"
          labelClassName="max-w-[12rem]"
          onOpenItem={(path, event) => {
            event.preventDefault()
            event.stopPropagation()
            onOpenRelatedNode?.(path)
          }}
        />
      </div>
    )
  }, [
    actionsRightEdge,
    linksColumnAlign,
    linksColumnPaddingClassName,
    linksColumnWidthClassName,
    statusRightAligned,
    onOpenRelatedNode,
    relatedNodeOptionsByPath,
  ])

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

  const {
    inlineNotesNode,
    inlineNotesDescriptionDraft,
    inlineNotesCommentsDraft,
    inlineNotesCommentDraft,
    inlineNotesSaving,
    inlineNotesDirty,
    setInlineNotesDescriptionDraft,
    setInlineNotesCommentDraft,
    toggleInlineNotes,
    addInlineCommentDraft,
    removeInlineCommentDraft,
  } = useBacklogInlineNotesBlock({
    readOnly,
    allowInReadOnly: allowInlineNotesInReadOnly,
    onUpdateNodeNotes,
    patchCachedNode,
    setLocalError,
  })

  const renderTicketBadge = useCallback((node: NodeRecord) => {
    const ticket = node.ticket?.trim() ?? ''
    if (!ticket) return null

    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
        {ticket}
      </span>
    )
  }, [])

  const renderInlineNotesEditor = useCallback((node: NodeRecord, depthPadding: number) => (
    <BacklogInlineNotesEditorBlock
      node={node}
      depthPadding={depthPadding}
      isOpen={inlineNotesNode?.uuid === node.uuid}
      readOnly={readOnly}
      allowInReadOnly={allowInlineNotesInReadOnly}
      canEditNotes={!!onUpdateNodeNotes}
      descriptionDraft={inlineNotesDescriptionDraft}
      commentsDraft={inlineNotesCommentsDraft}
      commentDraft={inlineNotesCommentDraft}
      saving={inlineNotesSaving}
      dirty={inlineNotesDirty}
      lookupTagColor={lookupTagColor}
      onDescriptionDraftChange={setInlineNotesDescriptionDraft}
      onCommentDraftChange={setInlineNotesCommentDraft}
      onAddComment={addInlineCommentDraft}
      onRemoveComment={removeInlineCommentDraft}
    />
  ), [
    addInlineCommentDraft,
    allowInlineNotesInReadOnly,
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

  const toggleRowDetails = useCallback((node: NodeRecord) => {
    const inlineRowDetailsAllowed = !!rowDetailsRenderer && (!canOpenNodeDetails || canOpenNodeDetails(node))
    const inlineNotesAllowed = (
      !!onUpdateNodeNotes
      && (!readOnly || allowInlineNotesInReadOnly)
      && (!canOpenNodeDetails || canOpenNodeDetails(node))
    )
    if (preferInlineDetailsButton) {
      if (inlineRowDetailsAllowed) {
        setRowDetailsNodeId(current => (current === node.uuid ? null : node.uuid))
      }
      if (inlineNotesAllowed) {
        void toggleInlineNotes(node)
      }
      return
    }
    if (onOpenNodeDetails && (!canOpenNodeDetails || canOpenNodeDetails(node))) {
      onOpenNodeDetails(node)
      return
    }
    if (inlineRowDetailsAllowed) {
      setRowDetailsNodeId(current => (current === node.uuid ? null : node.uuid))
      return
    }
    if (inlineNotesAllowed) {
      void toggleInlineNotes(node)
    }
  }, [allowInlineNotesInReadOnly, canOpenNodeDetails, onOpenNodeDetails, onUpdateNodeNotes, preferInlineDetailsButton, readOnly, rowDetailsRenderer, toggleInlineNotes])

  const renderInlineDetailsPanel = useCallback((node: NodeRecord, depthPadding: number) => {
    if (!rowDetailsRenderer) return null
    if (rowDetailsNodeId !== node.uuid) return null
    return (
      <div className="border-t border-border/60 bg-muted/10 px-3 py-2 text-xs" style={{ paddingLeft: `${depthPadding}px` }}>
        {rowDetailsRenderer(node)}
      </div>
    )
  }, [rowDetailsNodeId, rowDetailsRenderer])

  const renderInlineCreate = useCallback((parent: NodeRecord | null, draftKey: string, placeholder: string) => {
    if (readOnly) return null

    const allowedTypes = allowedCreateTypes(parent)
    const selectedType = draftTypeByKey[draftKey] && allowedTypes.includes(draftTypeByKey[draftKey])
      ? draftTypeByKey[draftKey]
      : allowedTypes[0]

    return (
      <BacklogInlineCreateBlock
        allowedTypes={allowedTypes}
        selectedType={selectedType}
        titleDraft={drafts[draftKey] ?? ''}
        descriptionDraft={descriptionDrafts[draftKey] ?? ''}
        commentDraft={commentDrafts[draftKey] ?? ''}
        busy={!!busyCreate[draftKey]}
        placeholder={placeholder}
        onTypeChange={(nextType) => {
          setDraftTypeByKey(prev => ({ ...prev, [draftKey]: nextType }))
        }}
        onTitleChange={(nextTitle) => setDraft(draftKey, nextTitle)}
        onDescriptionChange={(nextDescription) => {
          setDescriptionDrafts(prev => ({ ...prev, [draftKey]: nextDescription }))
        }}
        onCommentChange={(nextComment) => {
          setCommentDrafts(prev => ({ ...prev, [draftKey]: nextComment }))
        }}
        onSubmit={() => { void createUnder(parent, draftKey) }}
      />
    )
  }, [busyCreate, commentDrafts, createUnder, descriptionDrafts, draftTypeByKey, drafts, readOnly, setDraft])

  const renderNodeBranch = useCallback((
    node: NodeRecord,
    depth: number,
    siblingIndex: number,
    parentNode: NodeRecord | null,
    epicContext: NodeRecord | null,
  ) => {
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
      rowPresetTagLimit,
    )
    const detailsOpen = rowDetailsRenderer
      ? rowDetailsNodeId === node.uuid
      : inlineNotesNode?.uuid === node.uuid
    const externalDetailsAllowed = !!onOpenNodeDetails && (!canOpenNodeDetails || canOpenNodeDetails(node))
    const inlineRowDetailsAllowed = !!rowDetailsRenderer && (!canOpenNodeDetails || canOpenNodeDetails(node))
    const inlineNotesAllowed = (
      !!onUpdateNodeNotes
      && (!readOnly || allowInlineNotesInReadOnly)
      && (!canOpenNodeDetails || canOpenNodeDetails(node))
    )
    const canToggleDetails = externalDetailsAllowed || inlineRowDetailsAllowed || inlineNotesAllowed
    const detailsBusy = rowDetailsRenderer ? false : inlineNotesSaving

    return (
      <div key={node.uuid} className="border-b border-border/70 last:border-b-0">
        <BacklogNodeRowBlock
          node={node}
          depth={depth}
          siblingIndex={siblingIndex}
          isExpanded={isExpanded}
          childCount={childCount}
          borderColorClass={borderColorClass}
          iconColorClass={iconColorClass}
          selected={selectedNodeId === node.uuid}
          dragOver={dragOverNodeId === node.uuid}
          dragOverEdge={dragOverNodeId === node.uuid ? dragOverEdge : null}
          newlyCreated={newlyCreated}
          allowProgramLayoutEditing={allowProgramLayoutEditing}
          readOnly={readOnly}
          rowPresetTags={rowPresetTags}
          copied={copiedRowNodeId === node.uuid}
          canShowGroupingInfo={canShowGroupingInfo}
          groupingInfoOpen={groupingInfoOpen}
          detailsOpen={detailsOpen}
          inlineNotesSaving={detailsBusy}
          statusBusy={!!statusBusyByNode[node.uuid]}
          canEditTaskStatus={!!onUpdateTaskStatus}
          canEditNodeStatus={!!onUpdateNodeStatus}
          canToggleDetails={canToggleDetails}
          linksSlot={renderRelatedNodeLinksSlot(node)}
          rowColumns={rowColumns}
          showRowColumnsOnCompact={showRowColumnsOnCompact}
          rowPresetTagsClassName={rowPresetTagsClassName}
          reserveTagsSlotWhenEmpty={reserveTagsSlotWhenEmpty}
          linksBeforeTags={linksBeforeTags}
          statusRightAligned={statusRightAligned}
          titleColumnClassName={titleColumnClassName}
          wrapTitleText={wrapTitleText}
          actionsRightEdge={actionsRightEdge}
          showExpandToggle={showExpandToggles}
          showNodeTypeIcon={showNodeTypeIcons}
          showPriorityDot={showPriorityDots}
          ticketBadge={renderTicketBadge(node)}
          lookupTagColor={lookupTagColor}
          onToggleNode={() => toggleNode(node)}
          onSelectNode={() => onSelectNode(node)}
          onDragStart={makeDragStart(node)}
          onDragEnd={handleDragEnd}
          onDragOver={event => handleDragOver(node, event)}
          onDragLeave={() => handleDragLeave(node.uuid)}
          onDrop={event => { void handleDrop(node, event) }}
          onToggleInlineNotes={() => { void toggleRowDetails(node) }}
          onCopyRowLabel={event => { void copyRowLabelForNode(node, event) }}
          onToggleGroupingInfo={() => setGroupingInfoOpenByNode(prev => ({ ...prev, [node.uuid]: !prev[node.uuid] }))}
          onTaskStatusChange={(nextStatus) => { void handleInlineTaskStatusChange(node, nextStatus) }}
          onNodeStatusChange={(nextStatus) => { void handleInlineNodeStatusChange(node, nextStatus) }}
        />
        {canShowGroupingInfo && groupingInfoOpen && (
          <div className="border-t border-border/60 bg-muted/25 px-3 py-1.5 text-[11px] text-muted-foreground" style={{ paddingLeft: `${36 + (depth * 16)}px` }}>
            Grouped under epic: <span className="text-foreground">{nodeDisplayTitle(effectiveEpicContext!)}</span>
            {' · '}
            Parent: <span className="text-foreground">{nodeDisplayTitle(parentNode!)}</span>
          </div>
        )}
        {renderInlineDetailsPanel(node, 36 + (depth * 16))}
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
  }, [actionsRightEdge, allowInlineNotesInReadOnly, allowProgramLayoutEditing, canOpenNodeDetails, childrenByNode, copiedRowNodeId, copyRowLabelForNode, dragOverEdge, dragOverNodeId, ensureChildrenLoaded, expandedNodes, groupingInfoOpenByNode, handleDragEnd, handleDragLeave, handleDragOver, handleDrop, handleInlineNodeStatusChange, handleInlineTaskStatusChange, inlineNotesNode?.uuid, inlineNotesSaving, linksBeforeTags, lookupTagColor, makeDragStart, newlyCreatedNodeIds, onOpenNodeDetails, onSelectNode, onUpdateNodeNotes, onUpdateNodeStatus, onUpdateTaskStatus, projectPresetTagsByRoot, readOnly, renderInlineCreate, renderInlineDetailsPanel, renderInlineNotesEditor, renderRelatedNodeLinksSlot, renderTicketBadge, reserveTagsSlotWhenEmpty, rowColumns, rowDetailsNodeId, rowDetailsRenderer, rowPresetTagLimit, rowPresetTagsClassName, selectedNodeId, showRowColumnsOnCompact, statusBusyByNode, statusRightAligned, titleColumnClassName, toggleNode, toggleRowDetails, wrapTitleText])

  const renderProgramSection = useCallback((program: NodeRecord, programIndex: number) => {
    void ensureProgramLoaded(program)
    const childState = childrenByNode[program.uuid]
    const newlyCreated = !!newlyCreatedNodeIds[program.uuid]
    const assignedGroupId = resolvedProgramGroupIdByProgram[program.uuid] ?? '__ungrouped__'
    const rowPresetTags = compactTagList(
      selectedPresetTagsForNode(program, projectPresetTagsByRoot),
      rowPresetTagLimit,
    )
    const detailsOpen = rowDetailsRenderer
      ? rowDetailsNodeId === program.uuid
      : inlineNotesNode?.uuid === program.uuid
    const externalDetailsAllowed = !!onOpenNodeDetails && (!canOpenNodeDetails || canOpenNodeDetails(program))
    const inlineRowDetailsAllowed = !!rowDetailsRenderer && (!canOpenNodeDetails || canOpenNodeDetails(program))
    const inlineNotesAllowed = (
      !!onUpdateNodeNotes
      && (!readOnly || allowInlineNotesInReadOnly)
      && (!canOpenNodeDetails || canOpenNodeDetails(program))
    )
    const canToggleDetails = externalDetailsAllowed || inlineRowDetailsAllowed || inlineNotesAllowed
    const detailsBusy = rowDetailsRenderer ? false : inlineNotesSaving

    return (
      <div key={program.uuid} className="overflow-hidden rounded-xl border border-border/70 bg-muted/25">
        <BacklogProgramRowBlock
          program={program}
          programIndex={programIndex}
          programCount={programs.length}
          selected={selectedNodeId === program.uuid}
          dragOver={dragOverNodeId === program.uuid}
          dragOverEdge={dragOverNodeId === program.uuid ? dragOverEdge : null}
          newlyCreated={newlyCreated}
          allowProgramLayoutEditing={allowProgramLayoutEditing && !!onReorderSiblings}
          readOnly={readOnly}
          rowPresetTags={rowPresetTags}
          copied={copiedRowNodeId === program.uuid}
          detailsOpen={detailsOpen}
          inlineNotesSaving={detailsBusy}
          statusBusy={!!statusBusyByNode[program.uuid]}
          canEditNodeStatus={!!onUpdateNodeStatus}
          canToggleDetails={canToggleDetails}
          linksSlot={renderRelatedNodeLinksSlot(program)}
          rowColumns={rowColumns}
          showRowColumnsOnCompact={showRowColumnsOnCompact}
          rowPresetTagsClassName={rowPresetTagsClassName}
          reserveTagsSlotWhenEmpty={reserveTagsSlotWhenEmpty}
          linksBeforeTags={linksBeforeTags}
          statusRightAligned={statusRightAligned}
          titleColumnClassName={titleColumnClassName}
          wrapTitleText={wrapTitleText}
          actionsRightEdge={actionsRightEdge}
          showProgramStatus={showProgramStatus}
          showProgramCopyButton={showProgramCopyButton}
          showNodeTypeIcon={showNodeTypeIcons}
          showPriorityDot={showPriorityDots}
          canAssignToGroup={allowProgramLayoutEditing && !!onAssignProgramToGroup && programGroups.length > 0}
          assignedGroupId={assignedGroupId}
          programGroups={programGroups}
          ticketBadge={renderTicketBadge(program)}
          lookupTagColor={lookupTagColor}
          onSelectProgram={() => onSelectNode(program)}
          onDragStart={makeDragStart(program)}
          onDragEnd={handleDragEnd}
          onDragOver={event => handleDragOver(program, event)}
          onDragLeave={() => handleDragLeave(program.uuid)}
          onDrop={event => { void handleDrop(program, event) }}
          onMoveProgramUp={() => { void moveProgramByOffset(program, -1) }}
          onMoveProgramDown={() => { void moveProgramByOffset(program, 1) }}
          onAssignProgramToGroup={(groupId) => onAssignProgramToGroup?.(program, groupId)}
          onToggleInlineNotes={() => { void toggleRowDetails(program) }}
          onCopyRowLabel={event => { void copyRowLabelForNode(program, event) }}
          onNodeStatusChange={(nextStatus) => { void handleInlineNodeStatusChange(program, nextStatus) }}
        />
        {renderInlineDetailsPanel(program, 36)}
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
  }, [actionsRightEdge, allowInlineNotesInReadOnly, allowProgramLayoutEditing, canOpenNodeDetails, childrenByNode, copiedRowNodeId, copyRowLabelForNode, dragOverEdge, dragOverNodeId, ensureProgramLoaded, handleDragEnd, handleDragLeave, handleDragOver, handleDrop, handleInlineNodeStatusChange, inlineNotesNode?.uuid, inlineNotesSaving, linksBeforeTags, lookupTagColor, makeDragStart, moveProgramByOffset, newlyCreatedNodeIds, onAssignProgramToGroup, onOpenNodeDetails, onReorderSiblings, onSelectNode, onUpdateNodeNotes, onUpdateNodeStatus, programGroups, programs.length, projectPresetTagsByRoot, readOnly, renderInlineCreate, renderInlineDetailsPanel, renderInlineNotesEditor, renderNodeBranch, renderRelatedNodeLinksSlot, renderTicketBadge, reserveTagsSlotWhenEmpty, resolvedProgramGroupIdByProgram, rowColumns, rowDetailsNodeId, rowDetailsRenderer, rowPresetTagLimit, rowPresetTagsClassName, selectedNodeId, showProgramCopyButton, showProgramStatus, showRowColumnsOnCompact, statusBusyByNode, statusRightAligned, titleColumnClassName, toggleRowDetails, wrapTitleText])

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

      {rowColumns.length > 0 && (
        <div className={cn(
          'items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-1',
          showRowColumnsOnCompact ? 'flex' : 'hidden xl:flex',
        )}>
          <span className={cn(
            'text-[10px] font-semibold uppercase tracking-wide text-muted-foreground',
            titleColumnClassName ? ['shrink-0', titleColumnClassName] : 'min-w-0 flex-1',
          )}>
            Title
          </span>
          {rowColumns.map(column => (
            <span
              key={`column-header-${column.id}`}
              className={`shrink-0 truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ${column.widthClassName ?? 'w-24'} ${
                column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : ''
              }`}
            >
              {column.label}
            </span>
          ))}
          {linksColumnLabel && (
            <span className={cn(
              'hidden shrink-0 truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground lg:block',
              linksColumnWidthClassName ?? 'w-72',
              linksColumnAlign === 'center'
                ? 'text-center'
                : linksColumnAlign === 'left'
                  ? 'text-left'
                  : 'text-right',
            )}>
              {linksColumnLabel}
            </span>
          )}
        </div>
      )}

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
                <ProgramGroupHeaderBlock
                  name={group.name}
                  collapsed={group.collapsed}
                  count={groupedPrograms.length}
                  allowEdit={allowProgramLayoutEditing}
                  onToggle={() => onToggleProgramGroupCollapsed?.(group.id)}
                  onDelete={allowProgramLayoutEditing && onDeleteProgramGroup ? () => onDeleteProgramGroup(group.id) : undefined}
                />
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
