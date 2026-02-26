import { Button } from '@/components/lego_blocks/ui/button'
import { cn } from '@/lib/utils'
import type { NodeRecord } from '@/services/lego_blocks/dbBlock'
import { normalizeTagListBlock, tagColorClassBlock, tagColorStyleBlock } from '@/services/lego_blocks/tagBlock'
import type { YAMLCommentEntry } from '@/services/lego_blocks/yamlNoteBlock'

interface BacklogInlineNotesEditorBlockProps {
  node: NodeRecord
  depthPadding: number
  isOpen: boolean
  readOnly: boolean
  canEditNotes: boolean
  descriptionDraft: string
  commentsDraft: YAMLCommentEntry[]
  commentDraft: string
  saving: boolean
  dirty: boolean
  lookupTagColor: (node: NodeRecord, tag: string) => string | undefined
  onDescriptionDraftChange: (nextDescription: string) => void
  onCommentDraftChange: (nextComment: string) => void
  onAddComment: () => void
  onRemoveComment: (index: number) => void
}

export function BacklogInlineNotesEditorBlock({
  node,
  depthPadding,
  isOpen,
  readOnly,
  canEditNotes,
  descriptionDraft,
  commentsDraft,
  commentDraft,
  saving,
  dirty,
  lookupTagColor,
  onDescriptionDraftChange,
  onCommentDraftChange,
  onAddComment,
  onRemoveComment,
}: BacklogInlineNotesEditorBlockProps) {
  if (readOnly || !canEditNotes || !isOpen) return null
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
            value={descriptionDraft}
            onChange={(event) => onDescriptionDraftChange(event.target.value)}
            placeholder="Add description..."
            className="min-h-[72px] w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-1">
          <div className="text-[11px] font-medium text-muted-foreground">Comments</div>
          {commentsDraft.length > 0 ? (
            <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
              {commentsDraft.map((comment, index) => (
                <div key={`${comment.text}-${comment.added_at ?? index}`} className="flex items-start justify-between gap-2 rounded-md border border-border/60 bg-background/70 px-2 py-1 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-foreground">{comment.text}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {comment.added_by ?? 'unknown'} · {comment.added_at ? new Date(comment.added_at).toLocaleString() : 'time unknown'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveComment(index)}
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
              value={commentDraft}
              onChange={(event) => onCommentDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                onAddComment()
              }}
              placeholder="Add a comment..."
              className="h-7 flex-1 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={onAddComment}>
              Add
            </Button>
          </div>

          <div className="text-[11px] text-muted-foreground">
            {saving ? 'Auto-saving...' : (dirty ? 'Unsaved changes' : 'Auto-save on')}
          </div>
        </div>
      </div>
    </div>
  )
}
