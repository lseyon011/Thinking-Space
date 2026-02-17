import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Folder,
  FolderTree,
  Layers,
  Lightbulb,
  MessageSquare,
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
import type { NodeRecord } from '@/services/lego_blocks/dbBlock'
import type { NodeType, NodePriority, NodeStatus, YAMLCommentEntry, YAMLFrontmatter } from '@/services/lego_blocks/yamlNoteBlock'

function iconForNodeType(type: NodeType) {
  if (type === 'program') return FolderTree
  if (type === 'epic') return Layers
  if (type === 'idea_bucket') return BookOpen
  if (type === 'idea') return Lightbulb
  if (type === 'thought_bucket') return Folder
  if (type === 'thought') return MessageSquare
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

export interface NodeDetailPanelBlockProps {
  node: NodeRecord
  frontmatter?: YAMLFrontmatter | null
  onClose: () => void
  onRename: (newTitle: string) => Promise<void>
  onUpdateStatus: (status: string) => Promise<void>
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
  const yamlFields = useMemo(() => {
    if (!frontmatter) return []
    return Object.entries(frontmatter)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .sort(([a], [b]) => a.localeCompare(b))
  }, [frontmatter])

  function renderYamlValue(value: unknown): string {
    if (Array.isArray(value)) return value.join(', ')
    if (typeof value === 'object' && value !== null) return JSON.stringify(value)
    return String(value)
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
    try {
      await onUpdateNotes(descriptionDraft.trim(), commentsDraft)
    } finally {
      setBusy(false)
    }
  }, [commentsDraft, descriptionDraft, notesDirty, onUpdateNotes])

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
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select
              value={node.status}
              onValueChange={val => { void onUpdateStatus(val) }}
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
          </div>

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
            <textarea
              value={descriptionDraft}
              onChange={e => setDescriptionDraft(e.target.value)}
              rows={4}
              className="w-full resize-y rounded-md border border-input bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Add description..."
              disabled={busy}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Comments</label>
              {notesDirty && (
                <Button size="sm" variant="outline" onClick={() => { void commitNotes() }} disabled={busy}>
                  Save Notes
                </Button>
              )}
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
              <div className="grid gap-2 rounded-lg border border-border/70 bg-muted/20 p-3 md:grid-cols-2">
                {yamlFields.map(([key, value]) => (
                  <div key={key} className="space-y-0.5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{key}</p>
                    <p className="break-all font-mono text-xs text-foreground/90">{renderYamlValue(value)}</p>
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
