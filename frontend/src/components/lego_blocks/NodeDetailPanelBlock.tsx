import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  Folder,
  FolderTree,
  Layers,
  Lightbulb,
  Loader2,
  ListChecks,
  MessageSquare,
  Reply,
  SlidersHorizontal,
  ThumbsDown,
  ThumbsUp,
  Handshake,
  Play,
  Trash2,
  X,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/lego_blocks/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/lego_blocks/ui/select'
import ExtensionSlotBlock from '@/components/lego_blocks/ExtensionSlotBlock'
import MarkdownRichEditorBlock from '@/components/lego_blocks/MarkdownRichEditorBlock'
import { NodeStatusSelectBlock } from '@/components/lego_blocks/NodeStatusBlock'
import {
  TagListEditorBlock,
  TagPresetSelectorBlock,
} from '@/components/lego_blocks/TagManagerBlock'
import type { NodeRecord } from '@/services/lego_blocks/dbBlock'
import type { NodeType, NodePriority, NodeStatus, YAMLCommentEntry, YAMLFrontmatter } from '@/services/lego_blocks/yamlNoteBlock'
import {
  hasTagBlock,
  normalizeTagBlock,
  normalizeTagListBlock,
  splitTagInputBlock,
  tagsEqualBlock,
} from '@/services/lego_blocks/tagBlock'

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

function labelForNodeType(type: NodeType): string {
  const map: Record<NodeType, string> = {
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
  return map[type] ?? 'Node'
}

function formatTimestamp(value: string | undefined): string {
  if (!value) return 'time unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'time unknown'
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

function initialsForAuthor(value: string | undefined): string {
  const normalized = (value ?? '').trim()
  if (!normalized) return 'NA'
  const tokens = normalized.split(/[\s._-]+/).filter(Boolean)
  if (tokens.length === 0) return normalized.slice(0, 2).toUpperCase()
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase()
  return `${tokens[0][0] ?? ''}${tokens[1][0] ?? ''}`.toUpperCase()
}

const PRIORITY_OPTIONS: NodePriority[] = ['low', 'medium', 'high', 'critical']
const TASK_STATUS_OPTIONS = ['ready', 'in_progress', 'blocked', 'done', 'cancelled'] as const

function normalizeTaskStatus(value: string | undefined): (typeof TASK_STATUS_OPTIONS)[number] | null {
  if (!value) return null
  const canonical = value.trim().toLowerCase().replace(/\s+/g, '_')
  if (!canonical) return null
  if (canonical === 'inprogress' || canonical === 'doing' || canonical === 'underway') return 'in_progress'
  if (canonical === 'open' || canonical === 'todo' || canonical === 'to_do' || canonical === 'pending' || canonical === 'backlog') return 'ready'
  if (canonical === 'stuck' || canonical === 'waiting' || canonical === 'on_hold' || canonical === 'paused') return 'blocked'
  if (canonical === 'complete' || canonical === 'completed' || canonical === 'closed' || canonical === 'resolved' || canonical === 'shipped') return 'done'
  if (canonical === 'archived' || canonical === 'canceled' || canonical === 'dropped') return 'cancelled'
  if (TASK_STATUS_OPTIONS.includes(canonical as (typeof TASK_STATUS_OPTIONS)[number])) {
    return canonical as (typeof TASK_STATUS_OPTIONS)[number]
  }
  return null
}

function taskStatusFromNodeStatus(status: NodeStatus): (typeof TASK_STATUS_OPTIONS)[number] {
  if (status === 'completed') return 'done'
  if (status === 'archived' || status === 'cancelled') return 'cancelled'
  if (status === 'incomplete') return 'ready'
  if (status === 'paused') return 'blocked'
  return 'in_progress'
}

export interface NodeDetailPanelBlockProps {
  node: NodeRecord
  frontmatter?: YAMLFrontmatter | null
  onClose: () => void
  onRename: (newTitle: string) => Promise<void>
  onUpdateStatus: (status: string) => Promise<void>
  onUpdateTaskStatus: (taskStatus: string) => Promise<void>
  onUpdatePriority: (priority: string) => Promise<void>
  onUpdateTags: (tags: string[]) => Promise<void>
  presetTags?: string[]
  onUpdateNotes: (description: string, comments: YAMLCommentEntry[]) => Promise<void>
  onUpdateEpicCompletedAt?: (completionDate: string | null) => Promise<void>
  onOpenFile: () => void
  onDelete: () => Promise<void>
}

export default function NodeDetailPanelBlock({
  node,
  frontmatter,
  onClose,
  onRename,
  onUpdateStatus,
  onUpdateTaskStatus,
  onUpdatePriority,
  onUpdateTags,
  presetTags = [],
  onUpdateNotes,
  onUpdateEpicCompletedAt,
  onOpenFile,
  onDelete,
}: NodeDetailPanelBlockProps) {
  const [titleDraft, setTitleDraft] = useState(node.title)
  const [busy, setBusy] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [commentsDraft, setCommentsDraft] = useState<YAMLCommentEntry[]>([])
  const [newCommentDraft, setNewCommentDraft] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesAutoSaving, setNotesAutoSaving] = useState(false)
  const [epicCompletionDateDraft, setEpicCompletionDateDraft] = useState('')
  const [epicCompletionSaving, setEpicCompletionSaving] = useState(false)
  const [userTagDraft, setUserTagDraft] = useState('')
  const [tagsSaving, setTagsSaving] = useState(false)
  const [activityTab, setActivityTab] = useState<'all' | 'comments' | 'history' | 'worklog'>('comments')
  const [descriptionEditMode, setDescriptionEditMode] = useState(false)
  const notesAutoSaveSignatureRef = useRef<string | null>(null)
  const lastNodeUuidRef = useRef<string | null>(null)

  useEffect(() => {
    setTitleDraft(node.title)
  }, [node.title])

  const sourceDescription = useMemo(
    () => (node.description ?? frontmatter?.description ?? '').trim(),
    [frontmatter?.description, node.description],
  )
  const sourceComments = useMemo(
    () => (node.comments ?? frontmatter?.comments ?? []),
    [frontmatter?.comments, node.comments],
  )
  const sourceEpicCompletionDate = useMemo(() => {
    const fromFrontmatter = typeof frontmatter?.epic_completed_at === 'string'
      ? frontmatter.epic_completed_at
      : undefined
    return toDateInputValue(fromFrontmatter ?? node.epicCompletedAt)
  }, [frontmatter?.epic_completed_at, node.epicCompletedAt])
  const sourceAllTags = useMemo(
    () => normalizeTagListBlock(frontmatter?.tags ?? node.tags ?? []),
    [frontmatter?.tags, node.tags],
  )
  const sourcePresetTags = useMemo(() => normalizeTagListBlock(presetTags), [presetTags])
  const sourceUserTags = useMemo(() => (
    sourceAllTags.filter(tag => !hasTagBlock(sourcePresetTags, tag))
  ), [sourceAllTags, sourcePresetTags])

  useEffect(() => {
    const nodeChanged = lastNodeUuidRef.current !== node.uuid
    lastNodeUuidRef.current = node.uuid
    setDescriptionDraft(sourceDescription)
    setCommentsDraft(sourceComments)
    setNewCommentDraft('')
    setNotesSaving(false)
    setNotesAutoSaving(false)
    setEpicCompletionDateDraft(sourceEpicCompletionDate)
    setEpicCompletionSaving(false)
    setActivityTab('comments')
    if (nodeChanged) setDescriptionEditMode(false)
    notesAutoSaveSignatureRef.current = null
  }, [node.uuid, sourceComments, sourceDescription, sourceEpicCompletionDate])

  useEffect(() => {
    setUserTagDraft('')
    setTagsSaving(false)
  }, [node.uuid])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const commitRename = useCallback(async () => {
    const next = titleDraft.trim()
    if (!next || next === node.title) return
    setBusy(true)
    try {
      await onRename(next)
    } finally {
      setBusy(false)
    }
  }, [node.title, onRename, titleDraft])

  const handleDelete = useCallback(async () => {
    setBusy(true)
    try {
      await onDelete()
      onClose()
    } finally {
      setBusy(false)
    }
  }, [onClose, onDelete])

  const Icon = iconForNodeType(node.type)
  const taskLikeNode = node.type === 'task' || node.recordKind === 'task' || !!node.taskStatus
  const statusEditable = !taskLikeNode
  const currentTaskStatus = useMemo(() => (
    normalizeTaskStatus(node.taskStatus) ?? taskStatusFromNodeStatus(node.status)
  ), [node.status, node.taskStatus])
  const commentsDirty = useMemo(() => {
    if (commentsDraft.length !== sourceComments.length) return true
    for (let i = 0; i < commentsDraft.length; i += 1) {
      if (commentsDraft[i].text !== sourceComments[i].text) return true
      if ((commentsDraft[i].added_at ?? '') !== (sourceComments[i].added_at ?? '')) return true
      if ((commentsDraft[i].added_by ?? '') !== (sourceComments[i].added_by ?? '')) return true
    }
    return false
  }, [commentsDraft, sourceComments])
  const notesDirty = descriptionDraft.trim() !== sourceDescription || commentsDirty
  const notesPayloadSignature = useMemo(() => JSON.stringify({
    description: descriptionDraft.trim(),
    comments: commentsDraft,
  }), [commentsDraft, descriptionDraft])
  const orderedComments = useMemo(() => (
    commentsDraft.map((comment, index) => ({ comment, index })).reverse()
  ), [commentsDraft])
  const yamlFields = useMemo(() => {
    if (!frontmatter) return []
    return Object.entries(frontmatter)
      .filter(([key, value]) => (
        key !== 'description' &&
        key !== 'comments' &&
        key !== 'tags' &&
        value !== undefined &&
        value !== null &&
        value !== ''
      ))
      .sort(([a], [b]) => a.localeCompare(b))
  }, [frontmatter])

  function renderYamlValue(value: unknown): JSX.Element {
    if (value === null || value === undefined) {
      return <span className="font-mono text-xs text-muted-foreground">null</span>
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="font-mono text-xs text-muted-foreground">[]</span>
      }
      return (
        <ul className="space-y-1">
          {value.map((item, idx) => (
            <li key={idx} className="rounded border border-border/50 bg-background/60 px-2 py-1">
              {renderYamlValue(item)}
            </li>
          ))}
        </ul>
      )
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
      if (entries.length === 0) {
        return <span className="font-mono text-xs text-muted-foreground">{'{}'}</span>
      }

      return (
        <div className="space-y-1.5 rounded border border-border/50 bg-background/60 p-2">
          {entries.map(([key, inner]) => (
            <div key={key} className="space-y-0.5">
              <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{key}</p>
              <div className="pl-2">{renderYamlValue(inner)}</div>
            </div>
          ))}
        </div>
      )
    }

    return <span className="break-all font-mono text-xs text-foreground/90">{String(value)}</span>
  }

  const addComment = useCallback(() => {
    const next = newCommentDraft.trim()
    if (!next) return
    setCommentsDraft(prev => [
      ...prev,
      {
        text: next,
        added_at: new Date().toISOString(),
        added_by: 'unknown',
      },
    ])
    setNewCommentDraft('')
  }, [newCommentDraft])

  const removeComment = useCallback((index: number) => {
    setCommentsDraft(prev => prev.filter((_, idx) => idx !== index))
  }, [])

  const commitNotes = useCallback(async (mode: 'auto' | 'manual' = 'manual') => {
    if (!notesDirty || notesSaving) return
    setNotesSaving(true)
    setNotesAutoSaving(mode === 'auto')
    try {
      await onUpdateNotes(descriptionDraft.trim(), commentsDraft)
    } finally {
      setNotesAutoSaving(false)
      setNotesSaving(false)
    }
  }, [commentsDraft, descriptionDraft, notesDirty, notesSaving, onUpdateNotes])

  const commitEpicCompletionDate = useCallback(async () => {
    if (node.type !== 'epic' || !onUpdateEpicCompletedAt) return
    const normalizedDate = epicCompletionDateDraft.trim()
    if (normalizedDate === sourceEpicCompletionDate) return
    setBusy(true)
    setEpicCompletionSaving(true)
    try {
      await onUpdateEpicCompletedAt(normalizedDate || null)
    } finally {
      setEpicCompletionSaving(false)
      setBusy(false)
    }
  }, [epicCompletionDateDraft, node.type, onUpdateEpicCompletedAt, sourceEpicCompletionDate])

  const commitTags = useCallback(async (nextTags: string[]) => {
    const normalizedNextTags = normalizeTagListBlock(nextTags)
    if (tagsEqualBlock(normalizedNextTags, sourceAllTags)) return
    setBusy(true)
    setTagsSaving(true)
    try {
      await onUpdateTags(normalizedNextTags)
    } finally {
      setTagsSaving(false)
      setBusy(false)
    }
  }, [onUpdateTags, sourceAllTags])

  const addUserTags = useCallback(async () => {
    const additions = splitTagInputBlock(userTagDraft)
    if (additions.length === 0) return
    const next = normalizeTagListBlock([...sourceAllTags, ...additions])
    await commitTags(next)
    setUserTagDraft('')
  }, [commitTags, sourceAllTags, userTagDraft])

  const removeUserTag = useCallback(async (tag: string) => {
    const target = normalizeTagBlock(tag).toLowerCase()
    if (!target) return
    const next = sourceAllTags.filter(item => normalizeTagBlock(item).toLowerCase() !== target)
    await commitTags(next)
  }, [commitTags, sourceAllTags])

  const togglePresetTagOnNode = useCallback(async (tag: string) => {
    const normalizedTag = normalizeTagBlock(tag)
    if (!normalizedTag) return
    const next = hasTagBlock(sourceAllTags, normalizedTag)
      ? sourceAllTags.filter(item => normalizeTagBlock(item).toLowerCase() !== normalizedTag.toLowerCase())
      : normalizeTagListBlock([...sourceAllTags, normalizedTag])
    await commitTags(next)
  }, [commitTags, sourceAllTags])

  useEffect(() => {
    if (!notesDirty || busy || notesSaving) return
    if (notesAutoSaveSignatureRef.current === notesPayloadSignature) return

    const timeoutId = window.setTimeout(() => {
      notesAutoSaveSignatureRef.current = notesPayloadSignature
      void commitNotes('auto')
    }, 900)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [busy, commitNotes, notesDirty, notesPayloadSignature, notesSaving])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-[min(96vw,58rem)] border-l border-border bg-background shadow-2xl animate-slide-in overflow-auto">
        <div className="flex flex-col gap-5 p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon className="h-5 w-5 shrink-0" />
              <span className="text-xs font-medium uppercase tracking-wider">{labelForNodeType(node.type)}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Title input */}
          <input
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={() => { void commitRename() }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); void commitRename() }
            }}
            className="w-full border-b border-border bg-transparent pb-1 text-lg font-semibold outline-none transition-colors focus:border-primary"
            disabled={busy}
          />

          <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                notesAutoSaveSignatureRef.current = notesPayloadSignature
                void commitNotes('manual')
              }}
              disabled={notesSaving}
            >
              {notesSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
            </Button>
            <Button size="sm" variant="outline" onClick={onOpenFile}>
              Open File
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => { void handleDelete() }}
              disabled={busy}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Delete
            </Button>
            <span className="text-[11px] text-muted-foreground">
              {notesAutoSaving ? 'Auto-saving...' : (notesDirty ? 'Unsaved changes' : 'Auto-save on')}
            </span>
          </div>

          <div className="grid gap-3 rounded-md border border-border/60 bg-muted/20 p-3 md:grid-cols-3">
            {taskLikeNode ? (
              <div className="space-y-1">
                <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Task State</label>
                <Select
                  value={currentTaskStatus}
                  onValueChange={val => { void onUpdateTaskStatus(val) }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUS_OPTIONS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</label>
                <NodeStatusSelectBlock
                  status={node.status}
                  onChange={val => { if (statusEditable) void onUpdateStatus(val) }}
                  disabled={!statusEditable}
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Priority</label>
              <Select
                value={node.priority ?? 'medium'}
                onValueChange={val => { void onUpdatePriority(val) }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {node.type === 'epic' && onUpdateEpicCompletedAt ? (
              <div className="space-y-1">
                <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Completion Date</label>
                <input
                  type="date"
                  value={epicCompletionDateDraft}
                  onChange={event => setEpicCompletionDateDraft(event.target.value)}
                  onBlur={() => { void commitEpicCompletionDate() }}
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={busy}
                />
                <p className="text-[10px] text-muted-foreground">
                  {epicCompletionSaving ? 'Saving...' : 'Auto-set on completion. Cleared when marked incomplete.'}
                </p>
              </div>
            ) : (
              <div className="flex items-end">
                <ExtensionSlotBlock
                  slotId="thought-context-actions"
                  context={{
                    nodeUuid: node.uuid,
                    nodeKey: node.key,
                    nodeTitle: node.title,
                    nodeType: node.type,
                    filePath: node.filePath,
                    projectRoot: node.projectRoot ?? null,
                    parentKey: node.parent ?? null,
                  }}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-foreground">Description</label>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setDescriptionEditMode(prev => !prev)}
              >
                {descriptionEditMode ? 'Done' : 'Edit'}
              </Button>
            </div>
            {descriptionEditMode ? (
              <MarkdownRichEditorBlock
                value={descriptionDraft}
                onChange={setDescriptionDraft}
                placeholder="Add description..."
                className="min-h-[120px] rounded-md border border-input overflow-hidden"
              />
            ) : (
              <div className="prose prose-sm max-w-none rounded-md border border-border/60 bg-card p-3 leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {descriptionDraft || '_No description yet._'}
                </ReactMarkdown>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-md border border-border/60 bg-card p-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-foreground">Tags</label>
              <span className="text-[11px] text-muted-foreground">Shown in detail panel only</span>
            </div>

            <TagListEditorBlock
              heading="User Tags"
              tags={sourceUserTags}
              emptyMessage="No user tags yet."
              draftValue={userTagDraft}
              onDraftValueChange={setUserTagDraft}
              onAddTag={() => { void addUserTags() }}
              addPlaceholder="Add user tags (comma separated)"
              addDisabled={splitTagInputBlock(userTagDraft).length === 0}
              disabled={busy || tagsSaving}
              busy={tagsSaving}
              onRemoveTag={(tag) => { void removeUserTag(tag) }}
            />

            <TagPresetSelectorBlock
              heading="Project Tags"
              description="Project-scoped presets"
              tags={sourcePresetTags}
              selectedTags={sourceAllTags}
              emptyMessage="No preset tags yet for this project."
              onToggleTag={(tag) => { void togglePresetTagOnNode(tag) }}
              disabled={busy || tagsSaving}
              busy={tagsSaving}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-foreground">Subtasks</label>
            <p className="text-sm text-muted-foreground">Add subtask</p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-foreground">Linked work items</label>
            <p className="text-sm text-muted-foreground">Add linked work item</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-foreground">Activity</label>
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            </div>

            <div className="inline-flex rounded-md border border-border/70 bg-muted/30 p-0.5 text-xs">
              {[
                { key: 'all', label: 'All' },
                { key: 'comments', label: 'Comments' },
                { key: 'history', label: 'History' },
                { key: 'worklog', label: 'Work log' },
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  className={`rounded px-2 py-1 ${activityTab === tab.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => setActivityTab(tab.key as typeof activityTab)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="rounded-md border border-border/70 bg-card p-2.5">
              <div className="flex items-start gap-2">
                <div className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold text-white">
                  {initialsForAuthor('AP')}
                </div>
                <div className="flex-1 space-y-2">
                  <textarea
                    value={newCommentDraft}
                    onChange={e => setNewCommentDraft(e.target.value)}
                    placeholder="Add a comment..."
                    className="min-h-[72px] w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
                    disabled={busy}
                  />
                  <div className="flex flex-wrap gap-1">
                    {['Looks good!', 'Need help?', 'This is blocked...', 'Can you clarify...?', 'This is on track'].map(template => (
                      <button
                        key={template}
                        type="button"
                        className="rounded-md border border-border/70 bg-background px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                        onClick={() => setNewCommentDraft(prev => (prev.trim() ? `${prev}\n\n${template}` : template))}
                      >
                        {template}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">Pro tip: press M to comment</span>
                    <Button size="sm" variant="outline" onClick={addComment} disabled={busy || !newCommentDraft.trim()}>
                      Add Comment
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {(activityTab === 'comments' || activityTab === 'all') ? (
              orderedComments.length > 0 ? (
                <div className="space-y-4">
                  {orderedComments.map(({ comment, index }) => (
                    <div key={`${comment.text}-${comment.added_at ?? index}`} className="space-y-1.5">
                      <div className="flex items-start gap-2">
                        <div className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[10px] font-semibold text-white">
                          {initialsForAuthor(comment.added_by)}
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-semibold text-foreground">{comment.added_by ?? 'Unknown'}</p>
                          <p className="text-[11px] text-muted-foreground">{formatTimestamp(comment.added_at)}</p>
                          <div className="prose prose-sm max-w-none leading-relaxed">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {comment.text}
                            </ReactMarkdown>
                          </div>
                          <div className="flex items-center gap-1">
                            <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                              <ThumbsUp className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                              <ThumbsDown className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                              <Reply className="h-3 w-3" />
                              Reply
                            </button>
                            <button
                              type="button"
                              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                              onClick={() => removeComment(index)}
                              disabled={busy}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              )
            ) : (
              <p className="text-sm text-muted-foreground">No entries in this tab yet.</p>
            )}
          </div>

          <details className="rounded-md border border-border/60 bg-muted/15 p-2.5">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Advanced metadata</summary>
            <div className="mt-2 space-y-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">File Path</label>
                <p className="break-all font-mono text-xs text-foreground/80">{node.filePath}</p>
              </div>
              {node.aiSummary && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">AI Summary</label>
                  <p className="text-sm text-muted-foreground">{node.aiSummary}</p>
                </div>
              )}
              {yamlFields.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">YAML Metadata</label>
                  <div className="space-y-2 rounded-lg border border-border/70 bg-card p-3">
                    {yamlFields.map(([key, value]) => (
                      <div key={key} className="space-y-1 rounded-md border border-border/50 bg-muted/20 p-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{key}</p>
                        <div>{renderYamlValue(value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>

        </div>
      </div>
    </>
  )
}
