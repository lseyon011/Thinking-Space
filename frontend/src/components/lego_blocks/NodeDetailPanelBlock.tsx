import { useCallback, useEffect, useState } from 'react'
import {
  BookOpen,
  Folder,
  FolderTree,
  Layers,
  Lightbulb,
  MessageSquare,
  Loader2,
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
import type { NodeType, NodePriority, NodeStatus } from '@/services/lego_blocks/yamlNoteBlock'

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

const STATUS_OPTIONS: NodeStatus[] = ['active', 'paused', 'completed', 'archived']
const PRIORITY_OPTIONS: NodePriority[] = ['low', 'medium', 'high', 'critical']

export interface NodeDetailPanelBlockProps {
  node: NodeRecord
  frontmatter?: Record<string, unknown> | null
  frontmatterLoading?: boolean
  onClose: () => void
  onRename: (newTitle: string) => Promise<void>
  onUpdateStatus: (status: string) => Promise<void>
  onUpdatePriority: (priority: string) => Promise<void>
  onOpenFile: () => void
  onDelete: () => Promise<void>
}

export default function NodeDetailPanelBlock({
  node,
  frontmatter = null,
  frontmatterLoading = false,
  onClose,
  onRename,
  onUpdateStatus,
  onUpdatePriority,
  onOpenFile,
  onDelete,
}: NodeDetailPanelBlockProps) {
  const [titleDraft, setTitleDraft] = useState(node.title)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setTitleDraft(node.title)
  }, [node.title])

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
  const metadataEntries = frontmatter ? Object.entries(frontmatter).sort((a, b) => a[0].localeCompare(b[0])) : []

  const formatMetadataValue = (value: unknown): string => {
    if (value == null) return ''
    if (Array.isArray(value)) return value.map(item => String(item)).join(', ')
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-border bg-background shadow-2xl animate-slide-in overflow-auto">
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

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">YAML Metadata</label>
            {frontmatterLoading ? (
              <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading metadata...
              </div>
            ) : metadataEntries.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
                No frontmatter metadata found.
              </div>
            ) : (
              <div className="max-h-52 space-y-1 overflow-auto rounded-md border border-border/60 bg-muted/10 p-2">
                {metadataEntries.map(([key, raw]) => (
                  <div key={key} className="grid grid-cols-[110px_minmax(0,1fr)] items-start gap-2 text-xs">
                    <span className="font-mono text-muted-foreground">{key}</span>
                    <span className="break-all text-foreground/90">{formatMetadataValue(raw)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

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
