import { useCallback, useState } from 'react'
import { Bookmark, Star, Tag, X } from 'lucide-react'
import { updateRssItemMetaOrch } from '@/services/orchestrators/rssFeedOrch'
import { splitTagInputBlock } from '@/services/lego_blocks/units/tagBlock'
import type { RssFeedItemBlock } from '@/services/lego_blocks/units/rssFeedBlock'
import UrlDocumentBlock from './UrlDocumentBlock'
import { cn } from '@/lib/utils'

interface RssArticleViewBlockProps {
  item: RssFeedItemBlock
  onClose: () => void
  onItemUpdate: (updated: RssFeedItemBlock) => void
  className?: string
}

export default function RssArticleViewBlock({
  item,
  onClose,
  onItemUpdate,
  className,
}: RssArticleViewBlockProps) {
  const [tags, setTags] = useState<string[]>(item.tags ?? [])
  const [keep, setKeep] = useState(item.keep ?? false)
  const [important, setImportant] = useState(item.important ?? false)
  const [addingTag, setAddingTag] = useState(false)
  const [tagDraft, setTagDraft] = useState('')

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

  const hasAnything = keep || important || tags.length > 0

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      {/* Meta bar */}
      <div className={cn(
        'flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border/40 px-3 py-1.5',
        !hasAnything && 'bg-muted/10',
        hasAnything && 'bg-muted/20',
      )}>
        {/* Keep toggle */}
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

        {/* Important toggle */}
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
            onBlur={() => { if (!tagDraft.trim()) { setTagDraft(''); setAddingTag(false) } else commitTagDraft() }}
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
      </div>

      {/* URL content */}
      <UrlDocumentBlock
        url={item.link}
        onClose={onClose}
        showCloseButton
        className="min-h-0 flex-1"
      />
    </div>
  )
}
