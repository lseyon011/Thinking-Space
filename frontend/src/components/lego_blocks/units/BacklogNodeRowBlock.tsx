import { Check, ChevronRight, Copy, Info, Layers, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import type { NodeRecord } from '@/services/lego_blocks/integrations/dbBlock'
import type { NodeStatus } from '@/services/lego_blocks/units/yamlNoteBlock'
import {
  formatRowOrdinal,
  getTaskStatusBadge,
  iconForNodeType,
  isTaskNode,
  nodeDisplayTitle,
  nodeTitleWithoutTicket,
  PriorityDot,
  TaskStatusBadge,
  taskStatusLabel,
  TASK_STATUS_COLORS,
  TASK_STATUS_OPTIONS,
  type DropEdge,
  type TaskStatusOption,
} from '@/components/lego_blocks/units/BacklogListDomainBlock'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/lego_blocks/units/ui/select'
import {
  NodeStatusBadgeBlock,
  NodeStatusSelectBlock,
} from '@/components/lego_blocks/units/NodeStatusBlock'
import type { BacklogRowColumnBlock } from '@/components/lego_blocks/units/BacklogRowColumnsBlock'
import { cn } from '@/lib/utils'
import { tagColorClassBlock, tagColorStyleBlock } from '@/services/lego_blocks/units/tagBlock'

interface BacklogNodeRowBlockProps {
  node: NodeRecord
  depth: number
  siblingIndex: number
  isExpanded: boolean
  childCount: number | null
  borderColorClass: string
  iconColorClass: string
  selected: boolean
  dragOver: boolean
  dragOverEdge: DropEdge | null
  newlyCreated: boolean
  allowProgramLayoutEditing: boolean
  readOnly: boolean
  rowPresetTags: { visible: string[]; hiddenCount: number }
  copied: boolean
  canShowGroupingInfo: boolean
  groupingInfoOpen: boolean
  detailsOpen: boolean
  inlineNotesSaving: boolean
  statusBusy: boolean
  canEditTaskStatus: boolean
  canEditNodeStatus: boolean
  canToggleDetails: boolean
  rowColumns: BacklogRowColumnBlock[]
  ticketBadge: ReactNode
  lookupTagColor: (node: NodeRecord, tag: string) => string | undefined
  onToggleNode: () => void
  onSelectNode: () => void
  onDragStart: (event: React.DragEvent) => void
  onDragEnd: () => void
  onDragOver: (event: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (event: React.DragEvent) => void
  onToggleInlineNotes: () => void
  onCopyRowLabel: (event: React.MouseEvent<HTMLButtonElement>) => void
  onToggleGroupingInfo: () => void
  onTaskStatusChange: (nextStatus: TaskStatusOption) => void
  onNodeStatusChange: (nextStatus: NodeStatus) => void
}

export function BacklogNodeRowBlock({
  node,
  depth,
  siblingIndex,
  isExpanded,
  childCount,
  borderColorClass,
  iconColorClass,
  selected,
  dragOver,
  dragOverEdge,
  newlyCreated,
  allowProgramLayoutEditing,
  readOnly,
  rowPresetTags,
  copied,
  canShowGroupingInfo,
  groupingInfoOpen,
  detailsOpen,
  inlineNotesSaving,
  statusBusy,
  canEditTaskStatus,
  canEditNodeStatus,
  canToggleDetails,
  rowColumns,
  ticketBadge,
  lookupTagColor,
  onToggleNode,
  onSelectNode,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onToggleInlineNotes,
  onCopyRowLabel,
  onToggleGroupingInfo,
  onTaskStatusChange,
  onNodeStatusChange,
}: BacklogNodeRowBlockProps) {
  const Icon = iconForNodeType(node.type)
  const taskNode = isTaskNode(node)
  const taskStatus = getTaskStatusBadge(node)
  const applicableColumns = rowColumns.filter(column => !column.showForTypes || column.showForTypes.includes(node.type))

  return (
    <div
      draggable={allowProgramLayoutEditing}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'flex cursor-pointer items-center gap-2 border-l-[3px] px-3 py-2 transition-colors',
        'bg-card hover:bg-zinc-50',
        borderColorClass,
        selected && 'bg-accent/40',
        dragOver && 'ring-2 ring-primary/40 bg-primary/5',
        dragOver && dragOverEdge === 'before' && 'shadow-[inset_0_2px_0_rgba(59,130,246,0.7)]',
        dragOver && dragOverEdge === 'after' && 'shadow-[inset_0_-2px_0_rgba(59,130,246,0.7)]',
        newlyCreated && 'bg-emerald-100/80 ring-2 ring-emerald-400/70',
      )}
      style={{ paddingLeft: `${12 + (depth * 16)}px` }}
    >
      <sup
        aria-hidden="true"
        className="-ml-1.5 mr-0.5 mt-0.5 self-start font-mono text-[8px] leading-none tabular-nums text-muted-foreground/45"
      >
        {formatRowOrdinal(siblingIndex)}
      </sup>
      <button
        type="button"
        onClick={onToggleNode}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-transparent p-0 text-muted-foreground outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 hover:bg-transparent active:bg-transparent hover:text-foreground"
      >
        <ChevronRight className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-90')} />
      </button>
      <Icon className={cn('h-4 w-4 shrink-0', iconColorClass)} />
      <button
        type="button"
        onClick={onSelectNode}
        className="group min-w-0 flex flex-1 items-center gap-2 text-left text-sm font-medium"
      >
        {ticketBadge}
        <span className="min-w-0 flex-1 truncate">
          {nodeTitleWithoutTicket(node) || nodeDisplayTitle(node) || 'Untitled'}
        </span>
      </button>
      {applicableColumns.length > 0 && (
        <div className="hidden items-center gap-2 xl:flex">
          {applicableColumns.map(column => {
            const content = column.render(node)
            return (
              <div
                key={`${node.uuid}-column-${column.id}`}
                className={cn(
                  'truncate text-xs text-muted-foreground',
                  column.widthClassName ?? 'w-24',
                  column.align === 'center' && 'text-center',
                  column.align === 'right' && 'text-right',
                )}
                title={typeof content === 'string' ? content : undefined}
              >
                {content}
              </div>
            )
          })}
        </div>
      )}
      {rowPresetTags.visible.length > 0 && (
        <div className="hidden max-w-[35%] items-center gap-1 overflow-hidden lg:flex">
          {rowPresetTags.visible.map(tag => (
            <span
              key={`${node.uuid}-preset-row-tag-${tag}`}
              className={cn(
                'truncate rounded-full border px-1.5 py-0.5 text-[10px] leading-none',
                tagColorClassBlock(tag, 'solid'),
              )}
              style={tagColorStyleBlock(tag, 'solid', lookupTagColor(node, tag))}
            >
              {tag}
            </span>
          ))}
          {rowPresetTags.hiddenCount > 0 && (
            <span className="rounded-full border border-border/70 bg-muted/20 px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
              +{rowPresetTags.hiddenCount}
            </span>
          )}
        </div>
      )}
      {taskNode ? (
        readOnly || !canEditTaskStatus ? (
          <TaskStatusBadge taskStatus={taskStatus} />
        ) : (
          <div
            className="flex items-center gap-1"
            onClick={(event) => { event.preventDefault(); event.stopPropagation() }}
          >
            {statusBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : (
              <Select
                value={taskStatus}
                onValueChange={value => onTaskStatusChange(value as TaskStatusOption)}
              >
                <SelectTrigger
                  className={cn(
                    'h-6 w-auto gap-1 rounded-full border border-transparent px-2 py-0 text-[10px] font-medium shadow-none focus:ring-0 focus:ring-offset-0',
                    TASK_STATUS_COLORS[taskStatus],
                  )}
                  title="Change task status"
                >
                  <span>{taskStatusLabel(taskStatus)}</span>
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUS_OPTIONS.map(option => (
                    <SelectItem key={`${node.uuid}-task-${option}`} value={option}>
                      {taskStatusLabel(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )
      ) : (
        readOnly || !canEditNodeStatus ? (
          <NodeStatusBadgeBlock status={node.status} />
        ) : (
          <div
            className="flex items-center gap-1"
            onClick={(event) => { event.preventDefault(); event.stopPropagation() }}
          >
            {statusBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : (
              <NodeStatusSelectBlock
                status={node.status}
                onChange={onNodeStatusChange}
                variant="pill"
                title="Change status"
              />
            )}
          </div>
        )
      )}
      {canToggleDetails && (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onToggleInlineNotes()
          }}
          className={cn(
            'rounded p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            detailsOpen
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
          title="Details"
          disabled={inlineNotesSaving}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        draggable={false}
        onClick={onCopyRowLabel}
        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title={copied ? 'Copied' : 'Copy row label'}
        aria-label={copied ? `Copied row label ${nodeDisplayTitle(node)}` : `Copy row label ${nodeDisplayTitle(node)}`}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      {canShowGroupingInfo && (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onToggleGroupingInfo()
          }}
          className={cn(
            'rounded-md p-1 transition-colors',
            groupingInfoOpen
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
          title="Why this task is grouped here"
        >
          <Layers className="h-3.5 w-3.5" />
        </button>
      )}
      {childCount !== null && (
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {childCount}
        </span>
      )}
      <PriorityDot priority={node.priority} />
    </div>
  )
}
