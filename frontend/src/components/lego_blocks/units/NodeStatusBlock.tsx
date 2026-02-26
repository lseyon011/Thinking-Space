import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/lego_blocks/units/ui/select'
import { cn } from '@/lib/utils'
import { NODE_STATUSES, type NodeStatus } from '@/services/lego_blocks/units/yamlNoteBlock'

export const NODE_STATUS_OPTIONS_BLOCK: NodeStatus[] = [...NODE_STATUSES]

export const NODE_STATUS_COLOR_CLASSES_BLOCK: Record<NodeStatus, string> = {
  active: 'bg-emerald-500/15 text-emerald-700',
  paused: 'bg-amber-500/15 text-amber-700',
  incomplete: 'bg-orange-500/15 text-orange-700',
  completed: 'bg-blue-500/15 text-blue-700',
  cancelled: 'bg-rose-500/15 text-rose-700',
  archived: 'bg-zinc-500/15 text-zinc-500',
}

export function nodeStatusLabelBlock(status: NodeStatus): string {
  return status.replace(/_/g, ' ')
}

export interface NodeStatusBadgeBlockProps {
  status: NodeStatus
  className?: string
}

export function NodeStatusBadgeBlock({ status, className }: NodeStatusBadgeBlockProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize',
        NODE_STATUS_COLOR_CLASSES_BLOCK[status],
        className,
      )}
    >
      {nodeStatusLabelBlock(status)}
    </span>
  )
}

export interface NodeStatusSelectBlockProps {
  status: NodeStatus
  onChange: (status: NodeStatus) => void
  disabled?: boolean
  variant?: 'default' | 'pill'
  title?: string
  className?: string
}

export function NodeStatusSelectBlock({
  status,
  onChange,
  disabled = false,
  variant = 'default',
  title,
  className,
}: NodeStatusSelectBlockProps) {
  const triggerClass = variant === 'pill'
    ? cn(
      'h-6 w-auto gap-1 rounded-full border border-transparent px-2 py-0 text-[10px] font-medium capitalize shadow-none focus:ring-0 focus:ring-offset-0',
      NODE_STATUS_COLOR_CLASSES_BLOCK[status],
    )
    : 'h-8 text-xs capitalize'

  return (
    <Select value={status} onValueChange={(value) => onChange(value as NodeStatus)} disabled={disabled}>
      <SelectTrigger className={cn(triggerClass, className)} title={title}>
        <span>{nodeStatusLabelBlock(status)}</span>
      </SelectTrigger>
      <SelectContent>
        {NODE_STATUS_OPTIONS_BLOCK.map(option => (
          <SelectItem key={option} value={option}>
            {nodeStatusLabelBlock(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
