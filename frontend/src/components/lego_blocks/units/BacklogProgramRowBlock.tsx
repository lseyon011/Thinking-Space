import { ArrowDown, ArrowUp, Check, Copy, FolderTree, Info, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import type { NodeRecord } from '@/services/lego_blocks/dbBlock'
import type { NodeStatus } from '@/services/lego_blocks/yamlNoteBlock'
import { formatRowOrdinal, nodeDisplayTitle, nodeTitleWithoutTicket, PriorityDot, type DropEdge } from '@/components/lego_blocks/units/BacklogListHelpersBlock'
import {
  NodeStatusBadgeBlock,
  NodeStatusSelectBlock,
} from '@/components/lego_blocks/units/NodeStatusBlock'
import { cn } from '@/lib/utils'
import { tagColorClassBlock, tagColorStyleBlock } from '@/services/lego_blocks/tagBlock'

interface ProgramGroupEntryBlock {
  id: string
  name: string
  collapsed?: boolean
}

interface BacklogProgramRowBlockProps {
  program: NodeRecord
  programIndex: number
  programCount: number
  selected: boolean
  dragOver: boolean
  dragOverEdge: DropEdge | null
  newlyCreated: boolean
  allowProgramLayoutEditing: boolean
  readOnly: boolean
  rowPresetTags: { visible: string[]; hiddenCount: number }
  copied: boolean
  detailsOpen: boolean
  inlineNotesSaving: boolean
  statusBusy: boolean
  canEditNodeStatus: boolean
  canToggleDetails: boolean
  canAssignToGroup: boolean
  assignedGroupId: string
  programGroups: ProgramGroupEntryBlock[]
  ticketBadge: ReactNode
  lookupTagColor: (node: NodeRecord, tag: string) => string | undefined
  onSelectProgram: () => void
  onDragStart: (event: React.DragEvent) => void
  onDragEnd: () => void
  onDragOver: (event: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (event: React.DragEvent) => void
  onMoveProgramUp: () => void
  onMoveProgramDown: () => void
  onAssignProgramToGroup: (groupId: string | null) => void
  onToggleInlineNotes: () => void
  onCopyRowLabel: (event: React.MouseEvent<HTMLButtonElement>) => void
  onNodeStatusChange: (nextStatus: NodeStatus) => void
}

export function BacklogProgramRowBlock({
  program,
  programIndex,
  programCount,
  selected,
  dragOver,
  dragOverEdge,
  newlyCreated,
  allowProgramLayoutEditing,
  readOnly,
  rowPresetTags,
  copied,
  detailsOpen,
  inlineNotesSaving,
  statusBusy,
  canEditNodeStatus,
  canToggleDetails,
  canAssignToGroup,
  assignedGroupId,
  programGroups,
  ticketBadge,
  lookupTagColor,
  onSelectProgram,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onMoveProgramUp,
  onMoveProgramDown,
  onAssignProgramToGroup,
  onToggleInlineNotes,
  onCopyRowLabel,
  onNodeStatusChange,
}: BacklogProgramRowBlockProps) {
  return (
    <div
      draggable={allowProgramLayoutEditing}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'flex cursor-pointer items-center gap-2 border-b border-border/70 bg-card px-3 py-2 transition-colors hover:bg-zinc-50',
        selected && 'bg-accent/40',
        dragOver && 'ring-2 ring-primary/40 bg-primary/5',
        dragOver && dragOverEdge === 'before' && 'shadow-[inset_0_2px_0_rgba(59,130,246,0.7)]',
        dragOver && dragOverEdge === 'after' && 'shadow-[inset_0_-2px_0_rgba(59,130,246,0.7)]',
        newlyCreated && 'bg-emerald-100/80 ring-2 ring-emerald-400/70',
      )}
      onClick={onSelectProgram}
    >
      <sup
        aria-hidden="true"
        className="-ml-1.5 mr-0.5 mt-0.5 self-start font-mono text-[8px] leading-none tabular-nums text-muted-foreground/45"
      >
        {formatRowOrdinal(programIndex)}
      </sup>
      {allowProgramLayoutEditing && (
        <div
          className="mr-0.5 flex items-center gap-0.5"
          onClick={(event) => { event.preventDefault(); event.stopPropagation() }}
        >
          <button
            type="button"
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            title="Move up"
            onClick={onMoveProgramUp}
            disabled={programIndex <= 0}
          >
            <ArrowUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            title="Move down"
            onClick={onMoveProgramDown}
            disabled={programIndex >= (programCount - 1)}
          >
            <ArrowDown className="h-3 w-3" />
          </button>
        </div>
      )}
      <FolderTree className="h-4 w-4 shrink-0 text-sky-600" />
      <div className="min-w-0 flex flex-1 items-center gap-2">
        {ticketBadge}
        <span className="min-w-0 flex-1 truncate text-sm font-bold">
          {nodeTitleWithoutTicket(program) || nodeDisplayTitle(program) || 'Untitled'}
        </span>
      </div>
      {rowPresetTags.visible.length > 0 && (
        <div className="hidden max-w-[35%] items-center gap-1 overflow-hidden lg:flex">
          {rowPresetTags.visible.map(tag => (
            <span
              key={`${program.uuid}-preset-row-tag-${tag}`}
              className={cn(
                'truncate rounded-full border px-1.5 py-0.5 text-[10px] leading-none',
                tagColorClassBlock(tag, 'solid'),
              )}
              style={tagColorStyleBlock(tag, 'solid', lookupTagColor(program, tag))}
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
      {readOnly || !canEditNodeStatus ? (
        <NodeStatusBadgeBlock status={program.status} />
      ) : (
        <div
          className="flex items-center gap-1"
          onClick={(event) => { event.preventDefault(); event.stopPropagation() }}
        >
          {statusBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <NodeStatusSelectBlock
              status={program.status}
              onChange={onNodeStatusChange}
              variant="pill"
              title="Change status"
            />
          )}
        </div>
      )}
      {canAssignToGroup && (
        <div
          className="hidden items-center md:flex"
          onClick={(event) => { event.preventDefault(); event.stopPropagation() }}
        >
          <select
            value={assignedGroupId}
            onChange={(event) => {
              const nextValue = event.target.value
              onAssignProgramToGroup(nextValue === '__ungrouped__' ? null : nextValue)
            }}
            className="h-6 max-w-[140px] rounded-md border border-input bg-background px-1.5 text-[10px] text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            title="Assign group"
          >
            <option value="__ungrouped__">Ungrouped</option>
            {programGroups.map(group => (
              <option key={`${program.uuid}-group-opt-${group.id}`} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {!readOnly && canToggleDetails && (
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
        aria-label={copied ? `Copied row label ${nodeDisplayTitle(program)}` : `Copy row label ${nodeDisplayTitle(program)}`}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <PriorityDot priority={program.priority} />
    </div>
  )
}
