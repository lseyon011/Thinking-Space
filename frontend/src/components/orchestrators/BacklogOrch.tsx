import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, Download, Loader2, Plus, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import BacklogListBlock from '@/components/lego_blocks/BacklogListBlock'
import ExecutionProgressBlock from '@/components/lego_blocks/ExecutionProgressBlock'
import NodeDetailPanelBlock from '@/components/lego_blocks/NodeDetailPanelBlock'
import {
  TagDisclosureButtonBlock,
  TagListEditorBlock,
} from '@/components/lego_blocks/TagManagerBlock'
import CascadingFolderPicker, {
  addRecent,
  type CascadingFolderPickerChange,
} from '@/components/lego_blocks/CascadingFolderPickerBlock'
import { Button } from '@/components/lego_blocks/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/lego_blocks/ui/card'
import type { NodeRecord } from '@/services/lego_blocks/dbBlock'
import type { NodeStatus, NodeType, YAMLCommentEntry, YAMLFrontmatter } from '@/services/lego_blocks/yamlNoteBlock'
import {
  THINKING_ORGANIZER_DIR,
  getVaultFsOrch,
  hierarchyToExcalidrawMdOrch,
} from '@/services/orchestrators/backlogProjectOrch'
import { useMarkdownViewer } from '@/components/orchestrators/MarkdownViewerOrch'
import { defaultNodeKindLabel } from '@/components/lego_blocks/HierarchyTreeBlock'
import {
  invokeCapabilityOrThrow,
} from '@/services/orchestrators/capabilityRouterOrch'
import { listInProgressExecutionTasksOrch } from '@/services/orchestrators/executionProgressOrch'
import { getLastSyncTimestamp, smartSync } from '@/services/orchestrators/vaultSyncOrch'
import type { CapabilityActor } from '@/services/lego_blocks/capabilityRegistryBlock'
import {
  STORAGE_KEYS,
  getJsonStorageItem,
  setJsonStorageItem,
} from '@/services/orchestrators/storageOrch'
import {
  normalizeHexColorBlock,
  normalizeTagBlock,
  normalizeTagListBlock,
  splitTagInputBlock,
  tagLookupKeyBlock,
} from '@/services/lego_blocks/tagBlock'

interface ProjectEntry {
  name: string
  root: string
}
type ProjectPresetTagsByRoot = Record<string, string[]>
type ProjectTagColorsByRoot = Record<string, Record<string, string>>

const BACKLOG_ACTOR: CapabilityActor = {
  kind: 'human',
  id: 'ui.backlog',
}
const PROJECT_DESTINATION_RECENTS_KEY = 'ltm-thinking-organizer-project-destination-recents'
const PROJECT_ROOT_QUERY_PARAM = 'projectRoot'
const SELECTED_NODE_QUERY_PARAM = 'selectedNode'

function errorMessage(value: unknown, fallback: string): string {
  if (value instanceof Error && value.message) return value.message
  if (typeof value === 'string' && value.trim()) return value
  return fallback
}

function formatSyncTime(timestampSeconds: number): string {
  if (!timestampSeconds) return 'never'
  const date = new Date(timestampSeconds * 1000)
  if (Number.isNaN(date.getTime())) return 'unknown'
  return date.toLocaleString()
}

function toDateInputValue(value: string | undefined): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
}

function timelineSortTimestamp(node: Pick<NodeRecord, 'epicCompletedAt' | 'updatedAt' | 'createdAt'>): number {
  const epicCompletedDate = toDateInputValue(node.epicCompletedAt)
  if (epicCompletedDate) {
    const completionTime = new Date(`${epicCompletedDate}T00:00:00Z`).getTime()
    if (!Number.isNaN(completionTime)) return completionTime
  }
  const updatedTime = new Date(node.updatedAt).getTime()
  if (!Number.isNaN(updatedTime)) return updatedTime
  const createdTime = new Date(node.createdAt).getTime()
  if (!Number.isNaN(createdTime)) return createdTime
  return 0
}

function sortTimelineEpics(nodes: NodeRecord[]): NodeRecord[] {
  return [...nodes].sort((a, b) => {
    const byCompletion = timelineSortTimestamp(b) - timelineSortTimestamp(a)
    if (byCompletion !== 0) return byCompletion
    return a.title.localeCompare(b.title)
  })
}

function displaySortOrder(node: Pick<NodeRecord, 'sortOrder'>): number {
  return typeof node.sortOrder === 'number' && Number.isFinite(node.sortOrder)
    ? node.sortOrder
    : Number.POSITIVE_INFINITY
}

function sortBacklogNodes(nodes: NodeRecord[]): NodeRecord[] {
  return [...nodes].sort((a, b) => {
    const byOrder = displaySortOrder(a) - displaySortOrder(b)
    if (byOrder !== 0) return byOrder
    const byTitle = a.title.localeCompare(b.title)
    if (byTitle !== 0) return byTitle
    return a.key.localeCompare(b.key)
  })
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

function normalizeStoredSegments(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap(segment => (typeof segment === 'string' ? segment.split('/') : []))
      .map(segment => segment.trim())
      .filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split('/')
      .map(segment => segment.trim())
      .filter(Boolean)
  }
  return []
}

function readStoredProjectRoot(): string {
  const saved = normalizeStoredSegments(
    getJsonStorageItem<unknown>(STORAGE_KEYS.thinkingOrganizerSelectedProjectRoot, []),
  )
  return normalizePath(saved.join('/'))
}

function humanizeKey(value: string): string {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') || 'Project'
}

function allowedChildTypes(parentType: NodeType | null): NodeType[] {
  if (!parentType) return ['program']
  const all: NodeType[] = ['epic', 'idea_bucket', 'idea', 'thought_bucket', 'thought', 'task', 'run', 'handoff']
  const preferred: NodeType =
    parentType === 'program' ? 'epic'
      : parentType === 'epic' ? 'epic'
        : parentType === 'idea_bucket' ? 'idea'
          : parentType === 'idea' ? 'thought_bucket'
            : parentType === 'thought_bucket' ? 'thought'
              : 'thought'
  return [preferred, ...all.filter(type => type !== preferred)]
}

function isTaskLikeNode(node: Pick<NodeRecord, 'type' | 'recordKind' | 'taskStatus'>): boolean {
  return node.type === 'task' || node.recordKind === 'task' || !!node.taskStatus
}

type BacklogNodeStatus = NodeStatus
type BacklogTaskStatus = 'ready' | 'in_progress' | 'blocked' | 'done' | 'cancelled'
type BacklogSubTab = 'hierarchy' | 'timeline'

export default function BacklogOrch() {
  const { openFile } = useMarkdownViewer()
  const [searchParams, setSearchParams] = useSearchParams()
  const [programs, setPrograms] = useState<NodeRecord[]>([])
  const [selectedNode, setSelectedNode] = useState<NodeRecord | null>(null)
  const [urlHydrated, setUrlHydrated] = useState(false)
  const [selectedFrontmatter, setSelectedFrontmatter] = useState<YAMLFrontmatter | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [treeRevision, setTreeRevision] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<number>(() => getLastSyncTimestamp())
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentOperation, setCurrentOperation] = useState<string | null>(null)
  const [activeExecutionTasks, setActiveExecutionTasks] = useState<NodeRecord[]>([])
  const [activeExecutionTasksLoading, setActiveExecutionTasksLoading] = useState(false)
  const [activeExecutionTasksError, setActiveExecutionTasksError] = useState<string | null>(null)
  const [activeBacklogSubTab, setActiveBacklogSubTab] = useState<BacklogSubTab>('hierarchy')
  const [completedEpicTimeline, setCompletedEpicTimeline] = useState<NodeRecord[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineError, setTimelineError] = useState<string | null>(null)
  const [timelineSavingByEpic, setTimelineSavingByEpic] = useState<Record<string, boolean>>({})

  const [projectEntries, setProjectEntries] = useState<ProjectEntry[]>(
    () => getJsonStorageItem<ProjectEntry[]>(STORAGE_KEYS.thinkingOrganizerProjects, []),
  )
  const [projectPresetTagsByRoot, setProjectPresetTagsByRoot] = useState<ProjectPresetTagsByRoot>(
    () => getJsonStorageItem<ProjectPresetTagsByRoot>(STORAGE_KEYS.thinkingOrganizerProjectPresetTags, {}),
  )
  const [projectTagColorsByRoot, setProjectTagColorsByRoot] = useState<ProjectTagColorsByRoot>(
    () => getJsonStorageItem<ProjectTagColorsByRoot>(STORAGE_KEYS.thinkingOrganizerProjectTagColors, {}),
  )
  const [initialProjectLoadResolved, setInitialProjectLoadResolved] = useState(false)
  const [initialStoredProjectRoot] = useState(() => readStoredProjectRoot())
  const activeProjectRoot = useMemo(
    () => normalizePath(searchParams.get(PROJECT_ROOT_QUERY_PARAM) ?? ''),
    [searchParams],
  )

  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [projectPresetTagDraft, setProjectPresetTagDraft] = useState('')
  const [projectTagsExpanded, setProjectTagsExpanded] = useState(false)
  const [destinationSegments, setDestinationSegments] = useState<string[]>(
    () => normalizeStoredSegments(
      getJsonStorageItem<unknown>(STORAGE_KEYS.thinkingOrganizerProjectCreateDestination, []),
    ),
  )
  const [destinationBasePath, setDestinationBasePath] = useState(() => destinationSegments.join('/'))
  const [destinationPath, setDestinationPath] = useState(() => {
    const root = destinationSegments.join('/')
    return normalizePath(root) ? normalizePath(`${root}/${THINKING_ORGANIZER_DIR}`) : ''
  })
  const [creatingProject, setCreatingProject] = useState(false)

  const loadPrograms = useCallback(async (syncVault = false): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      if (syncVault) {
        setSyncing(true)
        await smartSync()
        setLastSyncedAt(getLastSyncTimestamp())
      }
      const { nodes: roots } = await invokeCapabilityOrThrow({
        capability: 'organizer.nodes.list_roots',
        input: { typeFilter: 'program' },
        actor: BACKLOG_ACTOR,
      })
      setPrograms(sortBacklogNodes(roots))
      return true
    } catch (err) {
      setError(errorMessage(err, 'Failed to load programs'))
      return false
    } finally {
      setSyncing(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await loadPrograms(true)
      if (!cancelled) setInitialProjectLoadResolved(true)
    })()
    return () => { cancelled = true }
  }, [loadPrograms])

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

  const updateProjectTagColor = useCallback((projectRoot: string, tag: string, color: string | null) => {
    const normalizedRoot = normalizePath(projectRoot)
    if (!normalizedRoot) return
    const tagKey = tagLookupKeyBlock(tag)
    if (!tagKey) return
    const normalizedColor = normalizeHexColorBlock(color)
    setProjectTagColorsByRoot((prev) => {
      const next: ProjectTagColorsByRoot = { ...prev }
      const existing = { ...(next[normalizedRoot] ?? {}) }
      if (normalizedColor) existing[tagKey] = normalizedColor
      else delete existing[tagKey]
      if (Object.keys(existing).length > 0) next[normalizedRoot] = existing
      else delete next[normalizedRoot]
      setJsonStorageItem(STORAGE_KEYS.thinkingOrganizerProjectTagColors, next)
      return next
    })
  }, [])

  const updateProjectPresetTags = useCallback((projectRoot: string, tags: string[]) => {
    const normalizedRoot = normalizePath(projectRoot)
    if (!normalizedRoot) return
    const normalizedTags = normalizeTagListBlock(tags)
    setProjectPresetTagsByRoot((prev) => {
      const next: ProjectPresetTagsByRoot = { ...prev }
      if (normalizedTags.length > 0) next[normalizedRoot] = normalizedTags
      else delete next[normalizedRoot]
      setJsonStorageItem(STORAGE_KEYS.thinkingOrganizerProjectPresetTags, next)
      return next
    })
    setProjectTagColorsByRoot((prev) => {
      const existing = prev[normalizedRoot]
      if (!existing) return prev
      const allowedTagKeys = new Set(normalizedTags.map(tagLookupKeyBlock))
      const pruned = Object.fromEntries(
        Object.entries(existing).filter(([tagKey]) => allowedTagKeys.has(tagKey)),
      )
      const next: ProjectTagColorsByRoot = { ...prev }
      if (Object.keys(pruned).length > 0) next[normalizedRoot] = pruned
      else delete next[normalizedRoot]
      setJsonStorageItem(STORAGE_KEYS.thinkingOrganizerProjectTagColors, next)
      return next
    })
  }, [])

  const selectedProjectPresetTags = useMemo(() => {
    const projectRoot = normalizePath(selectedNode?.projectRoot ?? activeProjectRoot)
    if (!projectRoot) return []
    return normalizeTagListBlock(projectPresetTagsByRoot[projectRoot] ?? [])
  }, [activeProjectRoot, projectPresetTagsByRoot, selectedNode?.projectRoot])
  const activeProjectPresetTags = useMemo(() => {
    if (!activeProjectRoot) return []
    return normalizeTagListBlock(projectPresetTagsByRoot[activeProjectRoot] ?? [])
  }, [activeProjectRoot, projectPresetTagsByRoot])
  const selectedProjectTagColors = useMemo(() => {
    const projectRoot = normalizePath(selectedNode?.projectRoot ?? activeProjectRoot)
    if (!projectRoot) return {}
    return projectTagColorsByRoot[projectRoot] ?? {}
  }, [activeProjectRoot, projectTagColorsByRoot, selectedNode?.projectRoot])
  const activeProjectTagColors = useMemo(() => {
    if (!activeProjectRoot) return {}
    return projectTagColorsByRoot[activeProjectRoot] ?? {}
  }, [activeProjectRoot, projectTagColorsByRoot])

  const addActiveProjectPresetTags = useCallback(() => {
    if (!activeProjectRoot) return
    const additions = splitTagInputBlock(projectPresetTagDraft)
    if (additions.length === 0) return
    updateProjectPresetTags(activeProjectRoot, [...activeProjectPresetTags, ...additions])
    setProjectPresetTagDraft('')
  }, [activeProjectPresetTags, activeProjectRoot, projectPresetTagDraft, updateProjectPresetTags])

  const removeActiveProjectPresetTag = useCallback((tag: string) => {
    if (!activeProjectRoot) return
    const normalizedTarget = normalizeTagBlock(tag).toLowerCase()
    if (!normalizedTarget) return
    const next = activeProjectPresetTags.filter(
      existing => normalizeTagBlock(existing).toLowerCase() !== normalizedTarget,
    )
    updateProjectPresetTags(activeProjectRoot, next)
  }, [activeProjectPresetTags, activeProjectRoot, updateProjectPresetTags])

  const setActiveProjectTagColor = useCallback((tag: string, color: string | null) => {
    if (!activeProjectRoot) return
    updateProjectTagColor(activeProjectRoot, tag, color)
  }, [activeProjectRoot, updateProjectTagColor])

  useEffect(() => {
    if (urlHydrated) return
    const selectedNodeUuid = searchParams.get(SELECTED_NODE_QUERY_PARAM)?.trim() ?? ''
    let cancelled = false
    void (async () => {
      if (selectedNodeUuid) {
        try {
          const { node } = await invokeCapabilityOrThrow({
            capability: 'organizer.node.get',
            input: { uuid: selectedNodeUuid },
            actor: BACKLOG_ACTOR,
          })
          if (!cancelled) setSelectedNode(node ?? null)
        } catch {
          if (!cancelled) setSelectedNode(null)
        } finally {
          if (!cancelled) setUrlHydrated(true)
        }
        return
      }
      if (!cancelled) setUrlHydrated(true)
    })()
    return () => { cancelled = true }
  }, [searchParams, urlHydrated])

  useEffect(() => {
    if (!urlHydrated) return
    const currentSelectedNode = searchParams.get(SELECTED_NODE_QUERY_PARAM)?.trim() ?? ''
    const nextSelectedNode = selectedNode?.uuid ?? ''
    if (currentSelectedNode === nextSelectedNode) return
    const next = new URLSearchParams(searchParams)
    if (nextSelectedNode) next.set(SELECTED_NODE_QUERY_PARAM, nextSelectedNode)
    else next.delete(SELECTED_NODE_QUERY_PARAM)
    setSearchParams(next, { replace: true })
  }, [searchParams, selectedNode?.uuid, setSearchParams, urlHydrated])

  useEffect(() => {
    if (!urlHydrated) return
    if (activeProjectRoot) return
    if (!initialStoredProjectRoot) return
    selectProject(initialStoredProjectRoot)
  }, [activeProjectRoot, initialStoredProjectRoot, selectProject, urlHydrated])

  const refreshExecutionProgress = useCallback(async () => {
    setActiveExecutionTasksLoading(true)
    setActiveExecutionTasksError(null)
    try {
      const tasks = await listInProgressExecutionTasksOrch({
        actor: BACKLOG_ACTOR,
        projectRoot: activeProjectRoot || undefined,
        limit: 8,
      })
      setActiveExecutionTasks(tasks)
    } catch (err) {
      setActiveExecutionTasksError(errorMessage(err, 'Failed to load execution progress'))
    } finally {
      setActiveExecutionTasksLoading(false)
    }
  }, [activeProjectRoot])

  const refreshEpicTimeline = useCallback(async () => {
    setTimelineLoading(true)
    setTimelineError(null)
    try {
      const { nodes } = await invokeCapabilityOrThrow({
        capability: 'organizer.nodes.list_all',
        input: {},
        actor: BACKLOG_ACTOR,
      })
      const epics = nodes
        .filter(node => node.type === 'epic' && node.status === 'completed')
        .filter(node => {
          if (!activeProjectRoot) return true
          return normalizePath(node.projectRoot ?? '') === activeProjectRoot
        })
      setCompletedEpicTimeline(sortTimelineEpics(epics))
    } catch (err) {
      setTimelineError(errorMessage(err, 'Failed to load epic timeline'))
    } finally {
      setTimelineLoading(false)
    }
  }, [activeProjectRoot])

  useEffect(() => {
    void refreshExecutionProgress()
  }, [refreshExecutionProgress])

  useEffect(() => {
    void refreshEpicTimeline()
  }, [refreshEpicTimeline])

  useEffect(() => {
    const onFocus = () => {
      void loadPrograms(false)
      void refreshEpicTimeline()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [loadPrograms, refreshEpicTimeline])

  const syncVaultNow = useCallback(async () => {
    setMessage(null)
    setError(null)
    setCurrentOperation('Syncing vault and refreshing organizer cache')
    try {
      const ok = await loadPrograms(true)
      if (ok) setMessage('Vault synced and organizer cache refreshed.')
    } finally {
      setCurrentOperation(null)
      void refreshExecutionProgress()
      void refreshEpicTimeline()
    }
  }, [loadPrograms, refreshEpicTimeline, refreshExecutionProgress])

  useEffect(() => {
    if (!selectedNode) {
      setSelectedFrontmatter(null)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const { frontmatter } = await invokeCapabilityOrThrow({
          capability: 'organizer.node.read_frontmatter',
          input: { filePath: selectedNode.filePath },
          actor: BACKLOG_ACTOR,
        })
        if (!cancelled) setSelectedFrontmatter(frontmatter)
      } catch {
        if (!cancelled) setSelectedFrontmatter(null)
      }
    })()

    return () => { cancelled = true }
  }, [selectedNode])

  const availableProjects = useMemo(() => {
    const byRoot = new Map<string, ProjectEntry>()

    for (const project of projectEntries) {
      const root = normalizePath(project.root)
      if (!root) continue
      byRoot.set(root, {
        name: project.name?.trim() || humanizeKey(root.split('/')[root.split('/').length - 1] || ''),
        root,
      })
    }

    for (const program of programs) {
      const root = normalizePath(program.projectRoot ?? '')
      if (!root) continue
      if (!byRoot.has(root)) {
        byRoot.set(root, {
          name: humanizeKey(root.split('/')[root.split('/').length - 1] || ''),
          root,
        })
      }
    }

    return [...byRoot.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [projectEntries, programs])

  useEffect(() => {
    if (!initialProjectLoadResolved) return
    if (availableProjects.length === 0) return

    const exists = availableProjects.some(project => project.root === activeProjectRoot)
    if (exists) return

    const fallbackFromStored = availableProjects.find(
      project => project.root === initialStoredProjectRoot,
    )?.root
    const fallback = fallbackFromStored ?? availableProjects[0].root
    selectProject(fallback)
  }, [activeProjectRoot, availableProjects, initialProjectLoadResolved, initialStoredProjectRoot, selectProject])

  const visiblePrograms = useMemo(() => {
    if (!activeProjectRoot) return programs
    return programs.filter(program => normalizePath(program.projectRoot ?? '') === activeProjectRoot)
  }, [activeProjectRoot, programs])

  const handleDestinationChange = useCallback((change: CascadingFolderPickerChange) => {
    setDestinationSegments(change.baseSegments)
    setDestinationBasePath(change.basePath)
    setDestinationPath(change.destinationPath)
    setJsonStorageItem(STORAGE_KEYS.thinkingOrganizerProjectCreateDestination, change.baseSegments)
    setError(null)
  }, [])

  const createProject = useCallback(async () => {
    const trimmedName = newProjectName.trim()
    const normalizedProjectRoot = normalizePath(destinationBasePath)

    if (!trimmedName) {
      setError('Project name is required.')
      return
    }
    if (!normalizedProjectRoot) {
      setError('Project destination is required.')
      return
    }

    const projectRoot = normalizedProjectRoot

    setCreatingProject(true)
    setCurrentOperation(`Creating project ${trimmedName}`)
    setError(null)
    setMessage(null)

    try {
      const fs = getVaultFsOrch()
      await fs.mkdir(projectRoot)
      await fs.mkdir(`${projectRoot}/${THINKING_ORGANIZER_DIR}`)

      const nextEntries = [...projectEntries]
      const existingIdx = nextEntries.findIndex(project => normalizePath(project.root) === projectRoot)
      if (existingIdx >= 0) {
        nextEntries[existingIdx] = { name: trimmedName, root: projectRoot }
      } else {
        nextEntries.push({ name: trimmedName, root: projectRoot })
      }
      nextEntries.sort((a, b) => a.name.localeCompare(b.name))

      setProjectEntries(nextEntries)
      setJsonStorageItem(STORAGE_KEYS.thinkingOrganizerProjects, nextEntries)
      selectProject(projectRoot)
      addRecent(PROJECT_DESTINATION_RECENTS_KEY, destinationSegments)

      setProjectModalOpen(false)
      setNewProjectName('')
      setMessage(`Created project: ${trimmedName}`)
    } catch (err) {
      setError(errorMessage(err, 'Failed to create project'))
    } finally {
      setCreatingProject(false)
      setCurrentOperation(null)
      void refreshExecutionProgress()
    }
  }, [destinationBasePath, destinationSegments, newProjectName, projectEntries, refreshExecutionProgress, selectProject])

  const createChildNode = useCallback(async (
    parent: NodeRecord | null,
    title: string,
    requestedType?: NodeType,
    details?: {
      description?: string
      comment?: string
    },
  ) => {
    const allowedTypes = allowedChildTypes(parent?.type ?? null)
    const nextType = requestedType && allowedTypes.includes(requestedType)
      ? requestedType
      : allowedTypes[0]

    if (!parent && !activeProjectRoot) {
      throw new Error('Create or select a project first.')
    }

    setCurrentOperation(`Creating ${defaultNodeKindLabel(nextType)}`)
    try {
      const { node: created } = await invokeCapabilityOrThrow({
        capability: 'organizer.node.create',
        input: {
          type: nextType,
          title,
          parentKey: parent?.key,
          parentUuid: parent?.uuid,
          parentType: parent?.type,
          projectRoot: parent ? undefined : activeProjectRoot,
          description: details?.description,
          comments: details?.comment ? [details.comment] : undefined,
        },
        actor: BACKLOG_ACTOR,
      })
      if (!parent) {
        setPrograms(prev => sortBacklogNodes([...prev, created]))
      }
      setMessage(`Created ${defaultNodeKindLabel(created.type)}: ${created.title}`)
      return created
    } finally {
      setCurrentOperation(null)
      void refreshExecutionProgress()
      void refreshEpicTimeline()
    }
  }, [activeProjectRoot, refreshEpicTimeline, refreshExecutionProgress])

  const deleteNodeRecursive = useCallback(async (node: NodeRecord, removedIds: Set<string>): Promise<void> => {
    const { nodes: children } = await invokeCapabilityOrThrow({
      capability: 'organizer.nodes.list_children',
      input: { parentKey: node.key },
      actor: BACKLOG_ACTOR,
    })
    for (const child of children) {
      await deleteNodeRecursive(child, removedIds)
    }
    await invokeCapabilityOrThrow({
      capability: 'organizer.node.delete',
      input: { uuid: node.uuid },
      actor: BACKLOG_ACTOR,
    })
    removedIds.add(node.uuid)
  }, [])

  const deleteAnyNode = useCallback(async (node: NodeRecord) => {
    setWorking(true)
    setCurrentOperation(`Deleting ${node.title}`)
    setError(null)
    setMessage(null)
    try {
      const removed = new Set<string>()
      await deleteNodeRecursive(node, removed)
      await loadPrograms()
      if (selectedNode && removed.has(selectedNode.uuid)) setSelectedNode(null)
      setMessage(`Deleted: ${node.title}`)
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete node'))
    } finally {
      setWorking(false)
      setCurrentOperation(null)
      void refreshExecutionProgress()
      void refreshEpicTimeline()
    }
  }, [deleteNodeRecursive, loadPrograms, refreshEpicTimeline, refreshExecutionProgress, selectedNode])

  const renameNode = useCallback(async (newTitle: string) => {
    if (!selectedNode) return
    setWorking(true)
    setCurrentOperation(`Renaming ${selectedNode.title}`)
    setError(null)
    try {
      const { node: updated } = await invokeCapabilityOrThrow({
        capability: 'organizer.node.rename',
        input: {
          uuid: selectedNode.uuid,
          newTitle,
        },
        actor: BACKLOG_ACTOR,
      })
      if (updated.type === 'program') {
        setPrograms(prev => sortBacklogNodes(prev.map(p => p.uuid === updated.uuid ? updated : p)))
      }
      setSelectedNode(updated)
      setMessage(`Renamed to: ${updated.title}`)
    } catch (err) {
      setError(errorMessage(err, 'Failed to rename'))
    } finally {
      setWorking(false)
      setCurrentOperation(null)
      void refreshExecutionProgress()
      void refreshEpicTimeline()
    }
  }, [refreshEpicTimeline, refreshExecutionProgress, selectedNode])

  const applyUpdatedNode = useCallback((updated: NodeRecord) => {
    if (updated.type === 'program') {
      setPrograms(prev => sortBacklogNodes(prev.map(p => p.uuid === updated.uuid ? updated : p)))
    }
    setSelectedNode(prev => (prev?.uuid === updated.uuid ? updated : prev))
  }, [])

  const updateNodeStatusFor = useCallback(async (node: NodeRecord, status: BacklogNodeStatus): Promise<NodeRecord> => {
    setWorking(true)
    setCurrentOperation(`Updating status for ${node.title}`)
    setError(null)
    try {
      const { node: updated } = await invokeCapabilityOrThrow({
        capability: 'organizer.node.update',
        input: {
          uuid: node.uuid,
          updates: { status },
        },
        actor: BACKLOG_ACTOR,
      })
      applyUpdatedNode(updated)
      return updated
    } catch (err) {
      setError(errorMessage(err, 'Failed to update status'))
      throw err
    } finally {
      setWorking(false)
      setCurrentOperation(null)
      void refreshExecutionProgress()
      void refreshEpicTimeline()
    }
  }, [applyUpdatedNode, refreshEpicTimeline, refreshExecutionProgress])

  const updateEpicCompletionDateFor = useCallback(async (
    node: NodeRecord,
    completionDate: string | null,
  ): Promise<NodeRecord> => {
    if (node.type !== 'epic') throw new Error('Completion date is only available for epics.')

    const normalizedDate = completionDate?.trim() ?? ''
    setTimelineSavingByEpic(prev => ({ ...prev, [node.uuid]: true }))
    setError(null)
    try {
      const { node: updated } = await invokeCapabilityOrThrow({
        capability: 'organizer.node.update',
        input: {
          uuid: node.uuid,
          updates: {
            extraFields: {
              epic_completed_at: normalizedDate || null,
            },
          },
        },
        actor: BACKLOG_ACTOR,
      })
      applyUpdatedNode(updated)
      setCompletedEpicTimeline(prev => {
        const withoutCurrent = prev.filter(item => item.uuid !== updated.uuid)
        const inScope = !activeProjectRoot || normalizePath(updated.projectRoot ?? '') === activeProjectRoot
        if (updated.type === 'epic' && updated.status === 'completed' && inScope) {
          return sortTimelineEpics([...withoutCurrent, updated])
        }
        return withoutCurrent
      })
      return updated
    } catch (err) {
      setError(errorMessage(err, 'Failed to update epic completion date'))
      throw err
    } finally {
      setTimelineSavingByEpic(prev => ({ ...prev, [node.uuid]: false }))
      void refreshEpicTimeline()
    }
  }, [activeProjectRoot, applyUpdatedNode, refreshEpicTimeline])

  const updateStatus = useCallback(async (status: string) => {
    if (!selectedNode) return
    await updateNodeStatusFor(selectedNode, status as BacklogNodeStatus)
  }, [selectedNode, updateNodeStatusFor])

  const updateTaskStatusFor = useCallback(async (node: NodeRecord, taskStatus: BacklogTaskStatus): Promise<NodeRecord> => {
    if (!isTaskLikeNode(node)) throw new Error('Task status can only be updated for task-like nodes.')
    setWorking(true)
    setCurrentOperation(`Updating task state for ${node.title}`)
    setError(null)
    try {
      const { node: updated } = await invokeCapabilityOrThrow({
        capability: 'task.update_status',
        input: {
          uuid: node.uuid,
          taskStatus,
        },
        actor: BACKLOG_ACTOR,
      })
      applyUpdatedNode(updated)
      setTreeRevision(prev => prev + 1)
      return updated
    } catch (err) {
      setError(errorMessage(err, 'Failed to update task state'))
      throw err
    } finally {
      setWorking(false)
      setCurrentOperation(null)
      void refreshExecutionProgress()
      void refreshEpicTimeline()
    }
  }, [applyUpdatedNode, refreshEpicTimeline, refreshExecutionProgress])

  const updateTaskStatus = useCallback(async (taskStatus: string) => {
    if (!selectedNode) return
    if (!isTaskLikeNode(selectedNode)) return
    await updateTaskStatusFor(selectedNode, taskStatus as BacklogTaskStatus)
  }, [selectedNode, updateTaskStatusFor])

  const updatePriority = useCallback(async (priority: string) => {
    if (!selectedNode) return
    setWorking(true)
    setCurrentOperation(`Updating priority for ${selectedNode.title}`)
    try {
      const { node: updated } = await invokeCapabilityOrThrow({
        capability: 'organizer.node.update',
        input: {
          uuid: selectedNode.uuid,
          updates: { priority: priority as 'low' | 'medium' | 'high' | 'critical' },
        },
        actor: BACKLOG_ACTOR,
      })
      setSelectedNode(updated)
    } catch (err) {
      setError(errorMessage(err, 'Failed to update priority'))
    } finally {
      setWorking(false)
      setCurrentOperation(null)
      void refreshExecutionProgress()
    }
  }, [refreshExecutionProgress, selectedNode])

  const updateNodeTagsFor = useCallback(async (node: NodeRecord, tags: string[]): Promise<NodeRecord> => {
    setWorking(true)
    setCurrentOperation(`Updating tags for ${node.title}`)
    setError(null)
    try {
      const { node: updated } = await invokeCapabilityOrThrow({
        capability: 'organizer.node.update',
        input: {
          uuid: node.uuid,
          updates: {
            tags: normalizeTagListBlock(tags),
          },
        },
        actor: BACKLOG_ACTOR,
      })
      applyUpdatedNode(updated)
      return updated
    } catch (err) {
      setError(errorMessage(err, 'Failed to update tags'))
      throw err
    } finally {
      setWorking(false)
      setCurrentOperation(null)
    }
  }, [applyUpdatedNode])

  const updateNodeTags = useCallback(async (tags: string[]) => {
    if (!selectedNode) return
    await updateNodeTagsFor(selectedNode, tags)
  }, [selectedNode, updateNodeTagsFor])

  const updateNodeNotesFor = useCallback(async (
    node: NodeRecord,
    description: string,
    comments: YAMLCommentEntry[],
  ): Promise<NodeRecord> => {
    setWorking(true)
    setCurrentOperation(`Updating notes for ${node.title}`)
    setError(null)
    try {
      const { node: updated } = await invokeCapabilityOrThrow({
        capability: 'organizer.node.update',
        input: {
          uuid: node.uuid,
          updates: {
            description,
            comments,
          },
        },
        actor: BACKLOG_ACTOR,
      })
      applyUpdatedNode(updated)
      return updated
    } catch (err) {
      setError(errorMessage(err, 'Failed to update description/comments'))
      throw err
    } finally {
      setWorking(false)
      setCurrentOperation(null)
      void refreshExecutionProgress()
    }
  }, [applyUpdatedNode, refreshExecutionProgress])

  const updateNodeNotes = useCallback(async (description: string, comments: YAMLCommentEntry[]) => {
    if (!selectedNode) return
    await updateNodeNotesFor(selectedNode, description, comments)
  }, [selectedNode, updateNodeNotesFor])

  const dropNodeToNode = useCallback(async (sourceUuid: string, targetNode: NodeRecord) => {
    setWorking(true)
    setCurrentOperation(`Moving node under ${targetNode.title}`)
    setError(null)
    setMessage(null)
    try {
      const { node: sourceNode } = await invokeCapabilityOrThrow({
        capability: 'organizer.node.get',
        input: { uuid: sourceUuid },
        actor: BACKLOG_ACTOR,
      })
      if (!sourceNode) throw new Error('Source node not found')
      if (sourceNode.uuid === targetNode.uuid) throw new Error('Cannot move a node onto itself.')
      if (!allowedChildTypes(targetNode.type).includes(sourceNode.type)) {
        throw new Error(`${defaultNodeKindLabel(sourceNode.type)} cannot be grouped under ${defaultNodeKindLabel(targetNode.type)}.`)
      }

      let cursor: NodeRecord | null = targetNode
      const seenKeys = new Set<string>()
      while (cursor && !seenKeys.has(cursor.key)) {
        seenKeys.add(cursor.key)
        if (cursor.key === sourceNode.key) {
          throw new Error('Cannot move a node under its own descendant.')
        }
        if (!cursor.parent) break
        cursor = (await invokeCapabilityOrThrow<'organizer.node.get_by_key'>({
          capability: 'organizer.node.get_by_key',
          input: { key: cursor.parent },
          actor: BACKLOG_ACTOR,
        })).node
      }

      await invokeCapabilityOrThrow({
        capability: 'organizer.node.move',
        input: {
          uuid: sourceNode.uuid,
          newParentKey: targetNode.key,
        },
        actor: BACKLOG_ACTOR,
      })
      await loadPrograms()
      setTreeRevision(prev => prev + 1)
      setMessage(`Moved ${sourceNode.title} under ${targetNode.title}`)
    } catch (err) {
      setError(errorMessage(err, 'Failed to move node'))
    } finally {
      setWorking(false)
      setCurrentOperation(null)
      void refreshExecutionProgress()
      void refreshEpicTimeline()
    }
  }, [loadPrograms, refreshEpicTimeline, refreshExecutionProgress])

  const reorderSiblingRows = useCallback(async (params: {
    parentKey: string | null
    orderedNodes: NodeRecord[]
  }): Promise<NodeRecord[]> => {
    setWorking(true)
    setCurrentOperation('Reordering rows')
    setError(null)

    const updatedById = new Map<string, NodeRecord>()

    try {
      for (let index = 0; index < params.orderedNodes.length; index += 1) {
        const node = params.orderedNodes[index]
        const nextSortOrder = index + 1
        if (node.sortOrder === nextSortOrder) continue

        const { node: updated } = await invokeCapabilityOrThrow({
          capability: 'organizer.node.update',
          input: {
            uuid: node.uuid,
            updates: {
              extraFields: {
                sort_order: nextSortOrder,
              },
            },
          },
          actor: BACKLOG_ACTOR,
        })
        updatedById.set(updated.uuid, updated)
      }

      if (updatedById.size > 0) {
        setPrograms(prev => sortBacklogNodes(
          prev.map(node => updatedById.get(node.uuid) ?? node),
        ))
        setSelectedNode(prev => (prev ? (updatedById.get(prev.uuid) ?? prev) : prev))
      }

      return params.orderedNodes.map(node => updatedById.get(node.uuid) ?? node)
    } catch (err) {
      setError(errorMessage(err, 'Failed to reorder rows'))
      throw err
    } finally {
      setWorking(false)
      setCurrentOperation(null)
    }
  }, [])

  const exportToExcalidraw = useCallback(async () => {
    setWorking(true)
    setCurrentOperation('Exporting hierarchy to Excalidraw')
    setError(null)
    setMessage(null)
    try {
      const { nodes: allNodes } = await invokeCapabilityOrThrow({
        capability: 'organizer.nodes.list_all',
        input: {},
        actor: BACKLOG_ACTOR,
      })
      if (allNodes.length === 0) { setError('No nodes to export.'); return }
      const mdContent = hierarchyToExcalidrawMdOrch(allNodes)
      const fs = getVaultFsOrch()
      const filePath = 'hierarchy-mindmap.excalidraw.md'
      await fs.write(filePath, mdContent)
      setMessage(`Exported hierarchy to ${filePath}`)
      openFile(filePath)
    } catch (err) {
      setError(errorMessage(err, 'Failed to export'))
    } finally {
      setWorking(false)
      setCurrentOperation(null)
      void refreshExecutionProgress()
    }
  }, [openFile, refreshExecutionProgress])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setProjectModalOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Create Project
        </Button>

        {availableProjects.map(project => {
          const isActive = project.root === activeProjectRoot
          return (
            <Button
              key={project.root}
              size="sm"
              variant={isActive ? 'default' : 'secondary'}
              onClick={() => selectProject(project.root)}
            >
              {project.name}
            </Button>
          )
        })}

        {activeProjectRoot && (
          <div className="basis-full text-xs text-muted-foreground">
            Active project root:{' '}
            <span className="font-mono text-foreground">{activeProjectRoot}</span>
          </div>
        )}
      </div>

      {activeProjectRoot && (
        <div className="space-y-2 rounded-md border border-border/70 bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <TagDisclosureButtonBlock
              label="Project Tags"
              expanded={projectTagsExpanded}
              onToggle={() => setProjectTagsExpanded(prev => !prev)}
              count={activeProjectPresetTags.length}
            />
            <p className="text-[11px] text-muted-foreground">Project-scoped preset tags</p>
          </div>
          {projectTagsExpanded && (
            <TagListEditorBlock
              heading="Project Tags"
              tags={activeProjectPresetTags}
              tagColors={activeProjectTagColors}
              emptyMessage="No project tags yet."
              draftValue={projectPresetTagDraft}
              onDraftValueChange={setProjectPresetTagDraft}
              onAddTag={addActiveProjectPresetTags}
              addPlaceholder="Add project tags (comma separated)"
              addDisabled={splitTagInputBlock(projectPresetTagDraft).length === 0}
              onRemoveTag={removeActiveProjectPresetTag}
              onChangeTagColor={setActiveProjectTagColor}
              chipTone="sky"
            />
          )}
        </div>
      )}

      {(message || error) && (
        <div className="space-y-2">
          {message && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
              {message}
            </div>
          )}
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
      )}

      <ExecutionProgressBlock
        busy={working || syncing || creatingProject}
        currentOperation={currentOperation}
        tasks={activeExecutionTasks}
        tasksLoading={activeExecutionTasksLoading}
        tasksError={activeExecutionTasksError}
        onRefresh={() => { void refreshExecutionProgress() }}
        onSelectTask={(task) => {
          setSelectedNode(task)
          setMessage(`Focused task: ${task.ticket || task.title}`)
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => { void syncVaultNow() }} disabled={working || syncing}>
          {syncing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
          Sync Vault Now
        </Button>
        <Button size="sm" variant="outline" onClick={() => { void exportToExcalidraw() }} disabled={working}>
          <Download className="mr-1 h-3.5 w-3.5" />
          Export Excalidraw
        </Button>
        <div className="text-xs text-muted-foreground">
          Last synced: <span className="font-medium text-foreground">{formatSyncTime(lastSyncedAt)}</span>
        </div>
        {(working || syncing) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="inline-flex rounded-md border border-border/70 bg-muted/30 p-0.5 text-xs" role="tablist" aria-label="Backlog views">
        <button
          type="button"
          role="tab"
          aria-selected={activeBacklogSubTab === 'hierarchy'}
          className={`rounded px-2.5 py-1.5 ${activeBacklogSubTab === 'hierarchy' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveBacklogSubTab('hierarchy')}
        >
          Hierarchy
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeBacklogSubTab === 'timeline'}
          className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 ${activeBacklogSubTab === 'timeline' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveBacklogSubTab('timeline')}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Epic Timeline
        </button>
      </div>

      {activeBacklogSubTab === 'timeline' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              Epic Timeline
            </CardTitle>
            <CardDescription>
              Completed epics sorted by completion date. Date is auto-set when an epic completes, and can be backfilled.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {timelineLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading timeline...
              </div>
            ) : timelineError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {timelineError}
              </div>
            ) : completedEpicTimeline.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No completed epics yet.
              </div>
            ) : (
              <div className="space-y-2">
                {completedEpicTimeline.map(epic => {
                  const completionDate = toDateInputValue(epic.epicCompletedAt)
                  const saving = !!timelineSavingByEpic[epic.uuid]
                  return (
                    <div key={epic.uuid} className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/15 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setSelectedNode(epic)}
                        className="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground hover:underline"
                      >
                        {epic.ticket ? `${epic.ticket} - ` : ''}{epic.title}
                      </button>
                      <input
                        key={`${epic.uuid}-${completionDate}`}
                        type="date"
                        defaultValue={completionDate}
                        disabled={saving}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        onBlur={(event) => {
                          const nextValue = event.currentTarget.value.trim()
                          if (nextValue === completionDate) return
                          void updateEpicCompletionDateFor(epic, nextValue || null)
                        }}
                      />
                      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeBacklogSubTab === 'hierarchy' && (
        loading ? (
          <div className="flex items-center gap-2 px-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading hierarchy...
          </div>
        ) : (
          <BacklogListBlock
            programs={visiblePrograms}
            loadEpics={async program => {
              const { nodes } = await invokeCapabilityOrThrow({
                capability: 'organizer.nodes.list_children',
                input: { parentKey: program.key },
                actor: BACKLOG_ACTOR,
              })
              return nodes
            }}
            loadChildren={async node => {
              const { nodes } = await invokeCapabilityOrThrow({
                capability: 'organizer.nodes.list_children',
                input: { parentKey: node.key },
                actor: BACKLOG_ACTOR,
              })
              return nodes
            }}
            treeRevision={treeRevision}
            selectedNodeId={selectedNode?.uuid ?? null}
            onSelectNode={(node) => setSelectedNode(node)}
            onCreateChild={createChildNode}
            onDropNodeToNode={dropNodeToNode}
            onReorderSiblings={reorderSiblingRows}
            projectPresetTagsByRoot={projectPresetTagsByRoot}
            projectTagColorsByRoot={projectTagColorsByRoot}
            onUpdateNodeStatus={updateNodeStatusFor}
            onUpdateTaskStatus={updateTaskStatusFor}
            onUpdateNodeNotes={updateNodeNotesFor}
          />
        )
      )}

      {selectedNode && (
        <NodeDetailPanelBlock
          node={selectedNode}
          frontmatter={selectedFrontmatter}
          onClose={() => setSelectedNode(null)}
          onRename={renameNode}
          onUpdateStatus={updateStatus}
          onUpdateTaskStatus={updateTaskStatus}
          onUpdatePriority={updatePriority}
          onUpdateTags={updateNodeTags}
          presetTags={selectedProjectPresetTags}
          projectTagColors={selectedProjectTagColors}
          onUpdateNotes={updateNodeNotes}
          onUpdateEpicCompletedAt={async (completionDate) => {
            await updateEpicCompletionDateFor(selectedNode, completionDate)
          }}
          onOpenFile={() => openFile(selectedNode.filePath)}
          onDelete={() => deleteAnyNode(selectedNode)}
        />
      )}

      {projectModalOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-background/50 backdrop-blur-sm" onClick={() => setProjectModalOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-xl border-border/80 shadow-2xl">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>Create Project</CardTitle>
                    <CardDescription>
                      Choose project name and destination. We will create a <code>{THINKING_ORGANIZER_DIR}</code> folder inside it.
                    </CardDescription>
                  </div>
                  <button
                    type="button"
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                    onClick={() => setProjectModalOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Project name</label>
                  <input
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    placeholder="Data Ingestion"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Project root folder</label>
                  <CascadingFolderPicker
                    defaultPath={destinationSegments}
                    onChange={handleDestinationChange}
                    requiredSuffixSegments={[THINKING_ORGANIZER_DIR]}
                    previewLabel="Organizer folder preview"
                    storageKey={PROJECT_DESTINATION_RECENTS_KEY}
                    maxRecents={12}
                  />
                </div>

                <div className="rounded-md border border-border/60 bg-muted/15 px-3 py-2 text-xs text-muted-foreground">
                  Project root:{' '}
                  <span className="font-mono text-foreground">
                    {destinationBasePath.trim()
                      ? normalizePath(destinationBasePath)
                      : '(choose destination folder)'}
                  </span>
                </div>

                <div className="rounded-md border border-border/60 bg-muted/15 px-3 py-2 text-xs text-muted-foreground">
                  Organizer storage folder:{' '}
                  <span className="font-mono text-foreground">
                    {destinationPath.trim()
                      ? normalizePath(destinationPath)
                      : '(choose destination folder)'}
                  </span>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setProjectModalOpen(false)} disabled={creatingProject}>
                    Cancel
                  </Button>
                  <Button onClick={() => { void createProject() }} disabled={creatingProject}>
                    {creatingProject ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Project'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
