import { cn } from '@/lib/utils'
import {
  tagColorClassBlock,
  tagColorStyleBlock,
  type TagColorVariantBlock,
} from '@/services/lego_blocks/units/tagBlock'

interface TagChipListBlockProps {
  tags: string[]
  variant?: TagColorVariantBlock
  getTagColor?: (tag: string) => string | undefined
  className?: string
  chipClassName?: string
  emptyMessage?: string
  emptyClassName?: string
  overflowCount?: number
  overflowChipClassName?: string
  keyPrefix?: string
}

export default function TagChipListBlock({
  tags,
  variant = 'solid',
  getTagColor,
  className,
  chipClassName,
  emptyMessage,
  emptyClassName,
  overflowCount = 0,
  overflowChipClassName,
  keyPrefix = 'tag-chip',
}: TagChipListBlockProps) {
  if (tags.length === 0) {
    return emptyMessage ? (
      <span className={cn('text-xs text-muted-foreground', emptyClassName)}>{emptyMessage}</span>
    ) : null
  }

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {tags.map(tag => (
        <span
          key={`${keyPrefix}-${tag}`}
          className={cn(
            'rounded-full border px-1.5 py-0.5 text-[10px] leading-none',
            tagColorClassBlock(tag, variant),
            chipClassName,
          )}
          style={tagColorStyleBlock(tag, variant, getTagColor?.(tag))}
        >
          {tag}
        </span>
      ))}
      {overflowCount > 0 && (
        <span
          className={cn(
            'rounded-full border border-border/70 bg-muted/20 px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground',
            overflowChipClassName,
          )}
        >
          +{overflowCount}
        </span>
      )}
    </div>
  )
}
