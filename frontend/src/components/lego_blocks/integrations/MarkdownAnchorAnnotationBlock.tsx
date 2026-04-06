import { Pencil, Plus } from 'lucide-react'
import MarkdownAnnotationCanvasBlock from '@/components/lego_blocks/units/MarkdownAnnotationCanvasBlock'
import type { MarkdownAnchorAnnotationBlock as MarkdownAnchorAnnotationModelBlock } from '@/services/lego_blocks/units/markdownAnnotationBlock'

interface MarkdownAnchorAnnotationBlockProps {
  anchorId: string
  annotation: MarkdownAnchorAnnotationModelBlock | null
  disabled?: boolean
  disabledReason?: string | null
  hideWhenEmpty?: boolean
  onOpenEditor: (anchorId: string) => void
}

export default function MarkdownAnchorAnnotationBlock({
  anchorId,
  annotation,
  disabled = false,
  disabledReason = null,
  hideWhenEmpty = false,
  onOpenEditor,
}: MarkdownAnchorAnnotationBlockProps) {
  if (!annotation) {
    if (hideWhenEmpty) return null
    return (
      <div className="my-4 rounded-xl border border-dashed border-amber-400/60 bg-amber-50/60 px-3 py-2 text-sm text-amber-900">
        <button
          type="button"
          onClick={() => onOpenEditor(anchorId)}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-md border border-amber-400/60 bg-white/80 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="h-3.5 w-3.5" />
          Add anchored note
        </button>
        {disabledReason && (
          <div className="mt-2 text-[11px] text-amber-800/80">{disabledReason}</div>
        )}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onOpenEditor(anchorId)}
      disabled={disabled}
      className="my-4 block w-full rounded-2xl border border-amber-300/70 bg-[linear-gradient(180deg,#fff9e8_0%,#ffefb0_100%)] p-4 text-left shadow-sm transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-900/70">
            <Pencil className="h-3.5 w-3.5" />
            Anchored Note
          </div>
          <div className="mt-1 truncate text-[11px] text-amber-900/60">{anchorId}</div>
        </div>
        <div className="text-[11px] text-amber-900/60">Tap to edit</div>
      </div>
      {annotation.text.trim() && (
        <div className="mt-3 whitespace-pre-wrap text-sm text-amber-950">{annotation.text}</div>
      )}
      {annotation.transcript.trim() && (
        <div className="mt-2 text-xs text-amber-900/70">
          Transcript: {annotation.transcript}
        </div>
      )}
      {!annotation.transcript.trim() && annotation.ocrText.trim() && (
        <div className="mt-2 text-xs text-amber-900/70">
          OCR: {annotation.ocrText}
        </div>
      )}
      {annotation.strokes.length > 0 && (
        <div className="mt-3">
          <MarkdownAnnotationCanvasBlock strokes={annotation.strokes} />
        </div>
      )}
    </button>
  )
}
