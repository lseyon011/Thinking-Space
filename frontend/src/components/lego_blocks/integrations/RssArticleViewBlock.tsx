import { useCallback, useState } from 'react'
import { Bookmark, FolderInput, Loader2, Star, Tag, X } from 'lucide-react'
import { updateRssItemMetaOrch, moveRssArticleToVaultOrch } from '@/services/orchestrators/rssFeedOrch'
import { splitTagInputBlock } from '@/services/lego_blocks/units/tagBlock'
import type { RssFeedItemBlock } from '@/services/lego_blocks/units/rssFeedBlock'
import CascadingFolderPicker, {
  type CascadingFolderPickerChange,
} from './CascadingFolderPickerBlock'
import UrlDocumentBlock from './UrlDocumentBlock'
import { cn } from '@/lib/utils'

const MOVE_RECENTS_KEY = 'ltm-rss-move-to-vault-recents'

interface RssArticleViewBlockProps {
  item: RssFeedItemBlock
  onClose: () => void
  onItemUpdate: (updated: RssFeedItemBlock) => void
  onMoved: (newPath: string) => void
  className?: string
}

export default function RssArticleViewBlock({
  item,
  onClose,
  onItemUpdate,
  onMoved,
  className,
}: RssArticleViewBlockProps) {
  const [tags, setTags] = useState<string[]>(item.tags ?? [])
  const [keep, setKeep] = useState(item.keep ?? false)
  const [important, setImportant] = useState(item.important ?? false)
  const [addingTag, setAddingTag] = useState(false)
  const [tagDraft, setTagDraft] = useState('')

  // Move-to-vault state
  const [showMoveDialog, setShowMoveDialog] = useState(false)
  const [moveDestPath, setMoveDestPath] = useState('')
  const [moving, setMoving] = useState(false)
  const [moveError, setMoveError] = useState<string | null>(null)

  const applyMeta = useCallback((
    nextTags: string[],
    nextKeep: boolean,
    nextImportant: boolean,
  ) => {
    void updateRssItemMetaOrch(item.id, { tags: nextTags, keep: nextKeep, important: nextImportant })
    onItemUpdate({ ...item, tags: nextTags, keep: nextKeep, important: nextImportant })
  }, [item, onItemUpdate])

  const toggleKeep = useCallback(() => {
    const next = !keep
    setKeep(next)
    applyMeta(tags, next, important)
  }, [keep, tags, important, applyMeta])

  const toggleImportant = useCallback(() => {
    const next = !important
    setImportant(next)
    applyMeta(tags, keep, next)
  }, [important, tags, keep, applyMeta])

  const commitTagDraft = useCallback(() => {
    const incoming = splitTagInputBlock(tagDraft).filter(t => t && !tags.includes(t))
    if (incoming.length === 0) {
      setTagDraft('')
      setAddingTag(false)
      return
    }
    const next = [...tags, ...incoming]
    setTags(next)
    setTagDraft('')
    setAddingTag(false)
    applyMeta(next, keep, important)
  }, [tagDraft, tags, keep, important, applyMeta])

  const removeTag = useCallback((tag: string) => {
    const next = tags.filter(t => t !== tag)
    setTags(next)
    applyMeta(next, keep, important)
  }, [tags, keep, important, applyMeta])

  const handleMoveConfirm = useCallback(async () => {
    if (!moveDestPath) return
    setMoving(true)
    setMoveError(null)
    try {
      const newPath = await moveRssArticleToVaultOrch(
        { ...item, tags, keep, important },
        moveDestPath,
      )
      setShowMoveDialog(false)
      onMoved(newPath)
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : 'Move failed')
    } finally {
      setMoving(false)
    }
  }, [item, tags, keep, important, moveDestPath, onMoved])

  const hasAnything = keep || important || tags.length > 0

  return (
    <div className={cn('relative flex h-full min-h-0 flex-col', className)}>
      {/* Meta bar */}
      <div className={cn(
        'flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border/40 px-3 py-1.5',
        hasAnything ? 'bg-muted/20' : 'bg-muted/10',
      )}>
        {/* Keep */}
        <button
          type="button"
          onClick={toggleKeep}
          title={keep ? 'Kept — click to unkeep' : 'Keep forever'}
          className={cn(
            'shrink-0 rounded p-0.5 transition-colors',
            keep ? 'text-amber-500 hover:text-amber-400' : 'text-muted-foreground/50 hover:text-muted-foreground',
          )}
        >
          <Bookmark className={cn('h-3.5 w-3.5', keep && 'fill-amber-500')} />
        </button>

        {/* Important */}
        <button
          type="button"
          onClick={toggleImportant}
          title={important ? 'Important — click to unmark' : 'Mark as important'}
          className={cn(
            'shrink-0 rounded p-0.5 transition-colors',
            important ? 'text-rose-500 hover:text-rose-400' : 'text-muted-foreground/50 hover:text-muted-foreground',
          )}
        >
          <Star className={cn('h-3.5 w-3.5', important && 'fill-rose-500')} />
        </button>

        {(tags.length > 0 || keep || important) && (
          <div className="h-4 w-px shrink-0 bg-border/50" />
        )}

        {/* Tag chips */}
        {tags.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-0.5 rounded-full text-primary/60 hover:text-primary"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}

        {/* Add tag */}
        {addingTag ? (
          <input
            autoFocus
            value={tagDraft}
            onChange={e => setTagDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitTagDraft()
              if (e.key === 'Escape') { setTagDraft(''); setAddingTag(false) }
            }}
            onBlur={() => {
              if (!tagDraft.trim()) { setTagDraft(''); setAddingTag(false) }
              else commitTagDraft()
            }}
            placeholder="tag, tag…"
            className="h-5 w-28 rounded border border-border/70 bg-background px-1.5 text-[11px] outline-none focus:border-ring"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingTag(true)}
            title="Add tag"
            className="shrink-0 rounded p-0.5 text-muted-foreground/50 hover:text-muted-foreground"
          >
            <Tag className="h-3 w-3" />
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Move to vault */}
        <button
          type="button"
          onClick={() => { setShowMoveDialog(true); setMoveError(null) }}
          title="Move to vault folder"
          className="shrink-0 rounded p-0.5 text-muted-foreground/50 hover:text-muted-foreground"
        >
          <FolderInput className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* URL content */}
      <UrlDocumentBlock
        url={item.link}
        onClose={onClose}
        showCloseButton
        className="min-h-0 flex-1"
      />

      {/* Move-to-vault overlay */}
      {showMoveDialog && (
        <div className="absolute inset-0 z-50 flex flex-col bg-background">
          {/* Dialog header */}
          <div className="flex shrink-0 items-center gap-2 border-b border-border/50 px-4 py-3">
            <FolderInput className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              Move to Vault Folder
            </span>
            <button
              type="button"
              onClick={() => setShowMoveDialog(false)}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Article preview */}
          <div className="shrink-0 border-b border-border/30 bg-muted/30 px-4 py-2">
            <div className="truncate text-xs font-medium">{item.title || '(Untitled)'}</div>
            <div className="truncate text-[11px] text-muted-foreground">{item.link}</div>
          </div>

          {/* Picker */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <CascadingFolderPicker
              onChange={(change: CascadingFolderPickerChange) => {
                setMoveDestPath(change.destinationPath)
                setMoveError(null)
              }}
              storageKey={MOVE_RECENTS_KEY}
              previewLabel="Article will be saved to"
              maxRecents={8}
            />
          </div>

          {/* Error */}
          {moveError && (
            <div className="shrink-0 px-4 py-2 text-xs text-destructive">{moveError}</div>
          )}

          {/* Actions */}
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/50 px-4 py-3">
            <button
              type="button"
              onClick={() => setShowMoveDialog(false)}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleMoveConfirm()}
              disabled={!moveDestPath || moving}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              {moving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {moving ? 'Moving…' : 'Move Here'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
