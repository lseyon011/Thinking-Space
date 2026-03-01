import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { BacklogNodeRowBlock } from '@/components/lego_blocks/units/BacklogNodeRowBlock'
import { BacklogProgramRowBlock } from '@/components/lego_blocks/units/BacklogProgramRowBlock'
import type { BacklogRowColumnBlock } from '@/components/lego_blocks/units/BacklogRowColumnsBlock'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { BacklogInlineCreateBlock } from '@/components/lego_blocks/integrations/BacklogInlineCreateBlock'
import { BacklogInlineNotesEditorBlock } from '@/components/lego_blocks/integrations/BacklogInlineNotesEditorBlock'
import { ProgramGroupHeaderBlock } from '@/components/lego_blocks/integrations/ProgramGroupHeaderBlock'
import type { NodeRecord } from '@/services/lego_blocks/integrations/dbBlock'
import { tagLookupKeyBlock } from '@/services/lego_blocks/units/tagBlock'
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
  onOpenNodeDetails?: (node: NodeRecord) => void
  canOpenNodeDetails?: (node: NodeRecord) => boolean
  rowColumns?: BacklogRowColumnBlock[]
  rowDetailsRenderer?: ((node: NodeRecord) => ReactNode) | null
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
  onOpenNodeDetails,
  canOpenNodeDetails,
  rowColumns = [],
  rowDetailsRenderer = null,
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
    if (onOpenNodeDetails && (!canOpenNodeDetails || canOpenNodeDetails(node))) {
      onOpenNodeDetails(node)
      return
    }
    if (rowDetailsRenderer) {
      setRowDetailsNodeId(current => (current === node.uuid ? null : node.uuid))
      return
    }
    void toggleInlineNotes(node)
  }, [canOpenNodeDetails, onOpenNodeDetails, rowDetailsRenderer, toggleInlineNotes])

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
    )
    const detailsOpen = rowDetailsRenderer
      ? rowDetailsNodeId === node.uuid
      : inlineNotesNode?.uuid === node.uuid
    const externalDetailsAllowed = !!onOpenNodeDetails && (!canOpenNodeDetails || canOpenNodeDetails(node))
    const canToggleDetails = externalDetailsAllowed || !!rowDetailsRenderer || (!!onUpdateNodeNotes && !readOnly)
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
          rowColumns={rowColumns}
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
  }, [allowProgramLayoutEditing, canOpenNodeDetails, childrenByNode, copiedRowNodeId, copyRowLabelForNode, dragOverEdge, dragOverNodeId, ensureChildrenLoaded, expandedNodes, groupingInfoOpenByNode, handleDragEnd, handleDragLeave, handleDragOver, handleDrop, handleInlineNodeStatusChange, handleInlineTaskStatusChange, inlineNotesNode?.uuid, inlineNotesSaving, lookupTagColor, makeDragStart, newlyCreatedNodeIds, onOpenNodeDetails, onSelectNode, onUpdateNodeNotes, onUpdateNodeStatus, onUpdateTaskStatus, projectPresetTagsByRoot, readOnly, renderInlineCreate, renderInlineDetailsPanel, renderInlineNotesEditor, renderTicketBadge, rowColumns, rowDetailsNodeId, rowDetailsRenderer, selectedNodeId, statusBusyByNode, toggleNode, toggleRowDetails])

  const renderProgramSection = useCallback((program: NodeRecord, programIndex: number) => {
    void ensureProgramLoaded(program)
    const childState = childrenByNode[program.uuid]
    const newlyCreated = !!newlyCreatedNodeIds[program.uuid]
    const assignedGroupId = resolvedProgramGroupIdByProgram[program.uuid] ?? '__ungrouped__'
    const rowPresetTags = compactTagList(
      selectedPresetTagsForNode(program, projectPresetTagsByRoot),
    )
    const detailsOpen = rowDetailsRenderer
      ? rowDetailsNodeId === program.uuid
      : inlineNotesNode?.uuid === program.uuid
    const externalDetailsAllowed = !!onOpenNodeDetails && (!canOpenNodeDetails || canOpenNodeDetails(program))
    const canToggleDetails = externalDetailsAllowed || !!rowDetailsRenderer || (!!onUpdateNodeNotes && !readOnly)
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
          rowColumns={rowColumns}
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
  }, [allowProgramLayoutEditing, canOpenNodeDetails, childrenByNode, copiedRowNodeId, copyRowLabelForNode, dragOverEdge, dragOverNodeId, ensureProgramLoaded, handleDragEnd, handleDragLeave, handleDragOver, handleDrop, handleInlineNodeStatusChange, inlineNotesNode?.uuid, inlineNotesSaving, lookupTagColor, makeDragStart, moveProgramByOffset, newlyCreatedNodeIds, onAssignProgramToGroup, onOpenNodeDetails, onReorderSiblings, onSelectNode, onUpdateNodeNotes, onUpdateNodeStatus, programGroups, programs.length, projectPresetTagsByRoot, readOnly, renderInlineCreate, renderInlineDetailsPanel, renderInlineNotesEditor, renderNodeBranch, renderTicketBadge, resolvedProgramGroupIdByProgram, rowColumns, rowDetailsNodeId, rowDetailsRenderer, selectedNodeId, statusBusyByNode, toggleRowDetails])

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
        <div className="hidden items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-1 xl:flex">
          <span className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
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
