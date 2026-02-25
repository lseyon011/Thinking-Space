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
  Handshake,
  Play,
  Trash2,
  X,
} from 'lucide-react'
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
import type { NodeRecord } from '@/services/lego_blocks/dbBlock'
import type { NodeType, NodePriority, NodeStatus, YAMLCommentEntry, YAMLFrontmatter } from '@/services/lego_blocks/yamlNoteBlock'

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

const STATUS_OPTIONS: NodeStatus[] = ['active', 'paused', 'completed', 'archived']
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
  if (status === 'archived') return 'cancelled'
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
  onUpdateNotes: (description: string, comments: YAMLCommentEntry[]) => Promise<void>
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
  onUpdateNotes,
  onOpenFile,
  onDelete,
}: NodeDetailPanelBlockProps) {
  const [titleDraft, setTitleDraft] = useState(node.title)
  const [busy, setBusy] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [commentsDraft, setCommentsDraft] = useState<YAMLCommentEntry[]>([])
  const [newCommentDraft, setNewCommentDraft] = useState('')
  const [notesAutoSaving, setNotesAutoSaving] = useState(false)
  const notesAutoSaveSignatureRef = useRef<string | null>(null)

  useEffect(() => {
    setTitleDraft(node.title)
  }, [node.title])

  const sourceDescription = useMemo(
    () => (frontmatter?.description ?? node.description ?? '').trim(),
    [frontmatter?.description, node.description],
  )
  const sourceComments = useMemo(
    () => (frontmatter?.comments ?? node.comments ?? []),
    [frontmatter?.comments, node.comments],
  )

  useEffect(() => {
    setDescriptionDraft(sourceDescription)
    setCommentsDraft(sourceComments)
    setNewCommentDraft('')
    setNotesAutoSaving(false)
    notesAutoSaveSignatureRef.current = null
  }, [node.uuid, sourceComments, sourceDescription])

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
  const statusEditable = node.type !== 'epic' && !taskLikeNode
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
  const yamlFields = useMemo(() => {
    if (!frontmatter) return []
    return Object.entries(frontmatter)
      .filter(([key, value]) => (
        key !== 'description' &&
        key !== 'comments' &&
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

  const commitNotes = useCallback(async () => {
    if (!notesDirty) return
    setBusy(true)
    setNotesAutoSaving(true)
    try {
      await onUpdateNotes(descriptionDraft.trim(), commentsDraft)
    } finally {
      setNotesAutoSaving(false)
      setBusy(false)
    }
  }, [commentsDraft, descriptionDraft, notesDirty, onUpdateNotes])

  useEffect(() => {
    if (!notesDirty || busy || notesAutoSaving) return
    if (notesAutoSaveSignatureRef.current === notesPayloadSignature) return

    const timeoutId = window.setTimeout(() => {
      notesAutoSaveSignatureRef.current = notesPayloadSignature
      void commitNotes()
    }, 900)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [busy, commitNotes, notesAutoSaving, notesDirty, notesPayloadSignature])

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

          {/* Status */}
          {taskLikeNode ? (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Task State</label>
              <Select
                value={currentTaskStatus}
                onValueChange={val => { void onUpdateTaskStatus(val) }}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUS_OPTIONS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Derived node status: <span className="font-medium text-foreground">{node.status}</span>
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select
                value={node.status}
                onValueChange={val => { if (statusEditable) void onUpdateStatus(val) }}
                disabled={!statusEditable}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!statusEditable && (
                <p className="text-[11px] text-muted-foreground">
                  Epic status is derived automatically from descendant task states.
                </p>
              )}
            </div>
          )}

          {/* Priority */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Priority</label>
            <Select
              value={node.priority ?? 'medium'}
              onValueChange={val => { void onUpdatePriority(val) }}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

          {/* Tags */}
          {node.tags && node.tags.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tags</label>
              <div className="flex flex-wrap gap-1.5">
                {node.tags.map(tag => (
                  <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs">{tag}</span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <MarkdownRichEditorBlock
              value={descriptionDraft}
              onChange={setDescriptionDraft}
              placeholder="Add description..."
              className="min-h-[120px] rounded-md border border-input overflow-hidden"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Comments</label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {notesAutoSaving ? 'Auto-saving...' : (notesDirty ? 'Unsaved changes' : 'Auto-save on')}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    notesAutoSaveSignatureRef.current = notesPayloadSignature
                    void commitNotes()
                  }}
                  disabled={busy || !notesDirty}
                >
                  {notesAutoSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save Notes'}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {commentsDraft.length > 0 ? (
                <div className="space-y-1">
                  {commentsDraft.map((comment, idx) => (
                    <div key={`${comment.text}-${comment.added_at ?? idx}`} className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/20 px-2 py-1.5 text-sm">
                      <div className="flex-1">
                        <p>{comment.text}</p>
                        <p className="text-xs text-muted-foreground">
                          {comment.added_by ?? 'unknown'} • {formatTimestamp(comment.added_at)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeComment(idx)}
                        className="rounded p-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                        disabled={busy}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              )}
              <div className="flex items-center gap-2">
                <input
                  value={newCommentDraft}
                  onChange={e => setNewCommentDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addComment()
                    }
                  }}
                  placeholder="Add a comment..."
                  className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={busy}
                />
                <Button size="sm" variant="outline" onClick={addComment} disabled={busy}>
                  Add
                </Button>
              </div>
            </div>
          </div>

          {/* AI Summary */}
          {node.aiSummary && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">AI Summary</label>
              <p className="text-sm text-muted-foreground">{node.aiSummary}</p>
            </div>
          )}

          {/* File path */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">File Path</label>
            <p className="break-all font-mono text-xs text-foreground/80">{node.filePath}</p>
          </div>

          {yamlFields.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">YAML Metadata</label>
              <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
                {yamlFields.map(([key, value]) => (
                  <div key={key} className="space-y-1 rounded-md border border-border/50 bg-muted/30 p-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{key}</p>
                    <div>{renderYamlValue(value)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 border-t border-border pt-4">
            <Button size="sm" variant="outline" onClick={onOpenFile}>
              Open File
            </Button>
            <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => { void handleDelete() }} disabled={busy}>
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
