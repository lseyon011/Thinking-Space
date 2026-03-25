import { Loader2, Plus } from 'lucide-react'
import { memo, type Ref } from 'react'
import { Button } from '@/components/lego_blocks/units/ui/button'
import type { NodeType } from '@/services/lego_blocks/units/yamlNoteBlock'
import { nodeTypeLabel } from '@/components/lego_blocks/units/BacklogListDomainBlock'

interface BacklogInlineCreateBlockProps {
  allowedTypes: NodeType[]
  selectedType: NodeType
  titleDraft: string
  descriptionDraft: string
  commentDraft: string
  busy: boolean
  placeholder: string
  titleInputRef?: Ref<HTMLInputElement>
  onTypeChange: (nextType: NodeType) => void
  onTitleChange: (nextTitle: string) => void
  onDescriptionChange: (nextDescription: string) => void
  onCommentChange: (nextComment: string) => void
  onSubmit: () => void
}

export const BacklogInlineCreateBlock = memo(function BacklogInlineCreateBlock({
  allowedTypes,
  selectedType,
  titleDraft,
  descriptionDraft,
  commentDraft,
  busy,
  placeholder,
  titleInputRef,
  onTypeChange,
  onTitleChange,
  onDescriptionChange,
  onCommentChange,
  onSubmit,
}: BacklogInlineCreateBlockProps) {
  const selectedTypeLabel = nodeTypeLabel(selectedType)

  return (
    <div className="ltm-backlog-inline-create space-y-2 border-t border-border/70 bg-background px-3 py-2">
      <div className="ltm-backlog-inline-create-top-row flex items-center gap-2">
        <select
          value={selectedType}
          onChange={event => onTypeChange(event.target.value as NodeType)}
          className="ltm-backlog-inline-create-field h-7 shrink-0 rounded-md border border-input bg-background px-2 text-[11px] text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {allowedTypes.map(type => (
            <option key={`inline-create-${type}`} value={type}>
              {nodeTypeLabel(type)}
            </option>
          ))}
        </select>
        <input
          ref={titleInputRef}
          value={titleDraft}
          onChange={event => onTitleChange(event.target.value)}
          onKeyDown={event => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            onSubmit()
          }}
          placeholder={`${placeholder} (${selectedTypeLabel})`}
          className="ltm-backlog-inline-create-field ltm-backlog-inline-create-title h-7 flex-1 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="ltm-backlog-inline-create-submit h-7 px-2 text-xs"
          disabled={busy}
          onClick={onSubmit}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <textarea
          value={descriptionDraft}
          onChange={event => onDescriptionChange(event.target.value)}
          rows={2}
          placeholder="Description (optional)"
          className="ltm-backlog-inline-create-field min-h-[64px] w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 text-xs leading-snug focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <textarea
          value={commentDraft}
          onChange={event => onCommentChange(event.target.value)}
          rows={2}
          placeholder="Comment (optional)"
          className="ltm-backlog-inline-create-field min-h-[64px] w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 text-xs leading-snug focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </div>
  )
})
