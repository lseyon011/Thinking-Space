import { ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProgramGroupHeaderBlockProps {
  name: string
  collapsed?: boolean
  count: number
  allowEdit: boolean
  onToggle: () => void
  onDelete?: () => void
}

export function ProgramGroupHeaderBlock({
  name,
  collapsed = false,
  count,
  allowEdit,
  onToggle,
  onDelete,
}: ProgramGroupHeaderBlockProps) {
  return (
    <div className="flex items-center gap-2 px-1">
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors',
          allowEdit
            ? 'border border-border/60 bg-muted/25 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground'
            : 'bg-zinc-800/90 text-sm font-semibold text-white hover:bg-zinc-700',
        )}
        onClick={onToggle}
        title={collapsed ? 'Expand group' : 'Collapse group'}
      >
        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', collapsed ? '' : 'rotate-90')} />
        <span>{name}</span>
        <span
          className={cn(
            'rounded-full px-1.5 py-0 text-[10px] leading-none',
            allowEdit
              ? 'border border-border/70 text-muted-foreground'
              : 'bg-white/20 text-white',
          )}
        >
          {count}
        </span>
      </button>
      {allowEdit && onDelete && (
        <button
          type="button"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={onDelete}
          title={`Delete group ${name}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
