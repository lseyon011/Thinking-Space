import type { ReactNode } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { Button } from '@/components/lego_blocks/ui/button'
import { hasTagBlock } from '@/services/lego_blocks/tagBlock'
import { cn } from '@/lib/utils'

const PRESET_TAG_COLOR_CLASSES = [
  {
    selected: 'border-emerald-300 bg-emerald-100/80 text-emerald-800',
    unselected: 'border-emerald-200/80 text-emerald-700/70 hover:bg-emerald-50/60',
  },
  {
    selected: 'border-sky-300 bg-sky-100/80 text-sky-800',
    unselected: 'border-sky-200/80 text-sky-700/70 hover:bg-sky-50/60',
  },
  {
    selected: 'border-amber-300 bg-amber-100/80 text-amber-800',
    unselected: 'border-amber-200/80 text-amber-700/70 hover:bg-amber-50/60',
  },
  {
    selected: 'border-fuchsia-300 bg-fuchsia-100/80 text-fuchsia-800',
    unselected: 'border-fuchsia-200/80 text-fuchsia-700/70 hover:bg-fuchsia-50/60',
  },
  {
    selected: 'border-violet-300 bg-violet-100/80 text-violet-800',
    unselected: 'border-violet-200/80 text-violet-700/70 hover:bg-violet-50/60',
  },
] as const

function presetTagPaletteBlock(tag: string): (typeof PRESET_TAG_COLOR_CLASSES)[number] {
  let hash = 0
  for (let index = 0; index < tag.length; index += 1) {
    hash = ((hash << 5) - hash) + tag.charCodeAt(index)
    hash |= 0
  }
  const paletteIndex = Math.abs(hash) % PRESET_TAG_COLOR_CLASSES.length
  return PRESET_TAG_COLOR_CLASSES[paletteIndex]
}

export interface TagDisclosureButtonBlockProps {
  label: string
  expanded: boolean
  onToggle: () => void
  count?: number
  className?: string
}

export function TagDisclosureButtonBlock({
  label,
  expanded,
  onToggle,
  count,
  className,
}: TagDisclosureButtonBlockProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={cn('h-8 gap-1.5 px-2 text-xs', className)}
      onClick={onToggle}
      aria-expanded={expanded}
    >
      {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      <span>{label}</span>
      {typeof count === 'number' && (
        <span className="rounded-full border border-border/70 bg-muted/40 px-1.5 py-0 text-[10px] text-muted-foreground">
          {count}
        </span>
      )}
    </Button>
  )
}

export interface TagListEditorBlockProps {
  heading?: string
  tags: string[]
  emptyMessage: string
  draftValue: string
  onDraftValueChange: (nextValue: string) => void
  onAddTag: () => void
  addButtonLabel?: string
  addButtonBusyLabel?: string
  addPlaceholder?: string
  addDisabled?: boolean
  disabled?: boolean
  busy?: boolean
  onRemoveTag?: (tag: string) => void
  chipTone?: 'muted' | 'sky'
  className?: string
}

export function TagListEditorBlock({
  heading,
  tags,
  emptyMessage,
  draftValue,
  onDraftValueChange,
  onAddTag,
  addButtonLabel = 'Add',
  addButtonBusyLabel = 'Saving...',
  addPlaceholder = 'Add tags (comma separated)',
  addDisabled = false,
  disabled = false,
  busy = false,
  onRemoveTag,
  chipTone = 'muted',
  className,
}: TagListEditorBlockProps) {
  const chipClassName = chipTone === 'sky'
    ? 'border-sky-200/80 bg-sky-100/70 text-sky-800'
    : 'border-border/70 bg-muted/25 text-foreground/90'

  return (
    <div className={cn('space-y-2', className)}>
      {heading && <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{heading}</p>}

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(tag => (
            <span
              key={`tag-chip-${tag}`}
              className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]', chipClassName)}
            >
              <span>{tag}</span>
              {onRemoveTag && (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => onRemoveTag(tag)}
                  disabled={disabled || busy}
                  aria-label={`Remove tag ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      )}

      <div className="flex items-center gap-2">
        <input
          value={draftValue}
          onChange={event => onDraftValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            onAddTag()
          }}
          placeholder={addPlaceholder}
          className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={disabled || busy}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-2 text-xs"
          onClick={onAddTag}
          disabled={disabled || busy || addDisabled}
        >
          {busy ? addButtonBusyLabel : addButtonLabel}
        </Button>
      </div>
    </div>
  )
}

export interface TagPresetSelectorBlockProps {
  heading?: string
  description?: ReactNode
  tags: string[]
  selectedTags: string[]
  emptyMessage: string
  onToggleTag: (tag: string) => void
  disabled?: boolean
  busy?: boolean
  className?: string
}

export function TagPresetSelectorBlock({
  heading,
  description,
  tags,
  selectedTags,
  emptyMessage,
  onToggleTag,
  disabled = false,
  busy = false,
  className,
}: TagPresetSelectorBlockProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {(heading || description) && (
        <div className="flex items-center justify-between gap-2">
          {heading ? <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{heading}</p> : <span />}
          {description ? <p className="text-[10px] text-muted-foreground">{description}</p> : null}
        </div>
      )}

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(tag => {
            const selected = hasTagBlock(selectedTags, tag)
            const palette = presetTagPaletteBlock(tag)
            const toneClass = selected ? palette.selected : palette.unselected
            return (
              <button
                key={`preset-tag-chip-${tag}`}
                type="button"
                className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] transition-colors', toneClass)}
                onClick={() => onToggleTag(tag)}
                disabled={disabled || busy}
                title={selected ? `Remove ${tag}` : `Add ${tag}`}
              >
                {tag}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      )}
    </div>
  )
}
