import { useEffect, useState } from 'react'
import { Languages, Pencil, Trash2, X } from 'lucide-react'
import MarkdownAnnotationCanvasBlock from '@/components/lego_blocks/units/MarkdownAnnotationCanvasBlock'
import type { MarkdownAnchorAnnotationBlock } from '@/services/lego_blocks/units/markdownAnnotationBlock'
import {
  isMarkdownAnnotationOcrSupportedOrch,
  recognizeMarkdownAnnotationInkOrch,
} from '@/services/orchestrators/markdownAnnotationOcrOrch'
import { cn } from '@/lib/utils'

interface MarkdownAnnotationEditorBlockProps {
  open: boolean
  anchorId: string | null
  annotation: MarkdownAnchorAnnotationBlock | null
  saving?: boolean
  error?: string | null
  onClose: () => void
  onSave: (draft: {
    text: string
    transcript: string
    ocrText: string
    ocrStatus: MarkdownAnchorAnnotationBlock['ocrStatus']
    ocrUpdatedAt: string | null
    strokes: MarkdownAnchorAnnotationBlock['strokes']
  }) => void
  onDelete: (() => void) | null
}

export default function MarkdownAnnotationEditorBlock({
  open,
  anchorId,
  annotation,
  saving = false,
  error = null,
  onClose,
  onSave,
  onDelete,
}: MarkdownAnnotationEditorBlockProps) {
  const [text, setText] = useState('')
  const [transcript, setTranscript] = useState('')
  const [ocrText, setOcrText] = useState('')
  const [ocrStatus, setOcrStatus] = useState<MarkdownAnchorAnnotationBlock['ocrStatus']>('idle')
  const [ocrUpdatedAt, setOcrUpdatedAt] = useState<string | null>(null)
  const [strokes, setStrokes] = useState<MarkdownAnchorAnnotationBlock['strokes']>([])
  const [ocrRecognizing, setOcrRecognizing] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const ocrSupported = isMarkdownAnnotationOcrSupportedOrch()

  useEffect(() => {
    if (!open) return
    setText(annotation?.text ?? '')
    setTranscript(annotation?.transcript ?? '')
    setOcrText(annotation?.ocrText ?? '')
    setOcrStatus(annotation?.ocrStatus ?? 'idle')
    setOcrUpdatedAt(annotation?.ocrUpdatedAt ?? null)
    setStrokes(annotation?.strokes ?? [])
    setOcrRecognizing(false)
    setOcrError(null)
  }, [annotation, open])

  if (!open || !anchorId) return null

  const canSave = text.trim().length > 0 || transcript.trim().length > 0 || ocrText.trim().length > 0 || strokes.length > 0

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-[76] flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border/50 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Pencil className="h-4 w-4 text-amber-600" />
              Anchored Note
            </div>
            <div className="truncate text-xs text-muted-foreground">{anchorId}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border/60 p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close annotation editor"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-4">
          <label className="block space-y-2">
            <span className="text-xs font-medium text-foreground">Typed note</span>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={4}
              placeholder="Type a markdown-visible note summary here."
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none ring-0 placeholder:text-muted-foreground focus:border-amber-400"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-medium text-foreground">Handwriting transcript</span>
            <input
              type="text"
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              placeholder="Optional searchable text for your handwritten note."
              className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm outline-none ring-0 placeholder:text-muted-foreground focus:border-amber-400"
            />
          </label>

          {(ocrSupported || ocrText.trim()) && (
            <div className="space-y-2 rounded-xl border border-border/50 bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-foreground">On-device handwriting recognition</div>
                  <div className="text-[11px] text-muted-foreground">
                    {ocrSupported ? 'Runs locally on this iOS device.' : 'Saved OCR result.'}
                  </div>
                </div>
                {ocrSupported && (
                  <button
                    type="button"
                    onClick={() => {
                      setOcrRecognizing(true)
                      setOcrError(null)
                      void recognizeMarkdownAnnotationInkOrch(strokes)
                        .then((result) => {
                          const nextText = result.text.trim()
                          setOcrText(nextText)
                          setOcrStatus(nextText ? 'ready' : 'error')
                          setOcrUpdatedAt(new Date().toISOString())
                          if (!transcript.trim() && nextText) {
                            setTranscript(nextText)
                          }
                          if (!nextText) {
                            setOcrError('No handwriting was recognized from the current ink.')
                          }
                        })
                        .catch((recognizeError) => {
                          setOcrStatus('error')
                          setOcrUpdatedAt(new Date().toISOString())
                          setOcrError(recognizeError instanceof Error ? recognizeError.message : 'Failed to recognize handwriting.')
                        })
                        .finally(() => {
                          setOcrRecognizing(false)
                        })
                    }}
                    disabled={ocrRecognizing || strokes.length === 0}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-border/60 px-2.5 text-[11px] font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Languages className="h-3.5 w-3.5" />
                    {ocrRecognizing ? 'Recognizing…' : 'Recognize ink'}
                  </button>
                )}
              </div>
              <textarea
                value={ocrText}
                onChange={(event) => {
                  setOcrText(event.target.value)
                  setOcrStatus(event.target.value.trim() ? 'ready' : 'idle')
                  setOcrUpdatedAt(new Date().toISOString())
                }}
                rows={3}
                placeholder="OCR text will appear here."
                className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none ring-0 placeholder:text-muted-foreground focus:border-amber-400"
              />
              {ocrText.trim() && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setTranscript(ocrText)}
                    className="rounded-md border border-border/60 px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    Use OCR as transcript
                  </button>
                </div>
              )}
              {ocrError && (
                <div className="text-[11px] text-destructive">{ocrError}</div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-foreground">Apple Pencil / ink note</span>
              <button
                type="button"
                onClick={() => setStrokes([])}
                className="rounded-md border border-border/60 px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Clear ink
              </button>
            </div>
            <MarkdownAnnotationCanvasBlock editable strokes={strokes} onChange={setStrokes} />
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/50 px-5 py-4">
          <div className="text-xs text-muted-foreground">
            Notes stay inside the markdown file. Highlights remain text-native; ink stays attached to the anchor.
          </div>
          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => onSave({ text, transcript, ocrText, ocrStatus, ocrUpdatedAt, strokes })}
              disabled={!canSave || saving}
              className={cn(
                'inline-flex h-9 items-center rounded-md px-3 text-xs font-medium text-white',
                saving || !canSave ? 'bg-amber-400/70' : 'bg-amber-500 hover:bg-amber-600',
              )}
            >
              {saving ? 'Saving…' : 'Save note'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
