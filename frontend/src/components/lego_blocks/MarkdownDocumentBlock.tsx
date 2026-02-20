import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { X, FileText, ExternalLink, Info, Pencil, Save, Eye } from 'lucide-react'
import {
  MarkdownDocumentConflictError,
  readMarkdownDocument,
  saveMarkdownDocument,
} from '@/services/orchestrators/markdownDocumentsOrch'
import {
  serializeExcalidrawSceneOrch,
  type ParsedExcalidrawScene,
} from '@/services/orchestrators/excalidrawSceneOrch'
import { buildObsidianOpenUrlOrch } from '@/services/orchestrators/obsidianLinkOrch'
import ExcalidrawDocumentBlock from '@/components/lego_blocks/ExcalidrawDocumentBlock'
import MarkdownMiniNavBlock from '@/components/lego_blocks/MarkdownMiniNavBlock'
import { cn } from '@/lib/utils'
import { useAiAssistRuntimeBlock } from '@/components/lego_blocks/AiAssistRuntimeBlock'
import AiAssistControlsBlock from '@/components/lego_blocks/AiAssistControlsBlock'
import AiAssistReviewBlock from '@/components/lego_blocks/AiAssistReviewBlock'
import { findRelated, type SimilarityMatch } from '@/services/lego_blocks/aiBlock'

export type MarkdownViewerMode = 'view' | 'edit'

interface MarkdownDocumentBlockProps {
  path: string
  initialMode?: MarkdownViewerMode
  onSaved?: (result: { output_path: string; revision_path: string | null }) => void
  onOpenPathForEdit?: (path: string) => void
  onClose?: () => void
  showCloseButton?: boolean
  className?: string
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n?/, '')
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function MarkdownDocumentBlock({
  path,
  initialMode = 'view',
  onSaved,
  onOpenPathForEdit,
  onClose,
  showCloseButton = false,
  className,
}: MarkdownDocumentBlockProps) {
  const [mode, setMode] = useState<MarkdownViewerMode>(initialMode)
  const [content, setContent] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [baseMtime, setBaseMtime] = useState<number | null>(null)
  const [baseHash, setBaseHash] = useState<string | null>(null)

  const [sizeBytes, setSizeBytes] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<MarkdownDocumentConflictError | null>(null)
  const [relatedThoughts, setRelatedThoughts] = useState<SimilarityMatch[]>([])
  const [relatedLoading, setRelatedLoading] = useState(false)
  const [relatedError, setRelatedError] = useState<string | null>(null)

  const [showMeta, setShowMeta] = useState(true)
  const [showPreview, setShowPreview] = useState(false)
  const {
    aiSelectionLoading,
    selectedProvider,
    selectedModel,
    assistRunningAction,
    assistError,
    assistSuggestion,
    runAssistAction,
    applyAssistSuggestion,
    dismissAssistSuggestion,
    clearAssistState,
  } = useAiAssistRuntimeBlock({
    scope: 'markdown_editor',
    useCase: 'markdown.assist',
  })
  const isExcalidrawDoc = /\.(excalidraw|excalidraw\.md)$/i.test(path)
  const contentScrollRef = useRef<HTMLDivElement | null>(null)
  const excalidrawSceneRef = useRef<ParsedExcalidrawScene | null>(null)
  const ignoreInitialExcalidrawChangeRef = useRef(true)
  const [hasExcalidrawChanges, setHasExcalidrawChanges] = useState(false)
  const [excalidrawImmersive, setExcalidrawImmersive] = useState(false)

  const loadDocument = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSaveError(null)
    setConflict(null)
    setRelatedThoughts([])
    setRelatedError(null)
    setRelatedLoading(false)
    setHasExcalidrawChanges(false)
    setExcalidrawImmersive(false)
    excalidrawSceneRef.current = null
    ignoreInitialExcalidrawChangeRef.current = true
    clearAssistState()
    try {
      const data = await readMarkdownDocument(path)
      setContent(data.content)
      setDraft(data.content)
      setBaseMtime(data.mtime)
      setBaseHash(data.hash)
      setSizeBytes(new Blob([data.content]).size)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file')
      setContent(null)
      setDraft('')
      setBaseMtime(null)
      setBaseHash(null)
      setSizeBytes(0)
    } finally {
      setLoading(false)
    }
  }, [clearAssistState, path])

  useEffect(() => {
    setMode(initialMode)
    void loadDocument()
  }, [initialMode, loadDocument, path])

  useEffect(() => {
    if (!excalidrawImmersive) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExcalidrawImmersive(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [excalidrawImmersive])

  const meta = content !== null
    ? {
      lines: content.split('\n').length,
      words: content.split(/\s+/).filter(Boolean).length,
      headings: (content.match(/^#{1,6}\s/gm) || []).length,
      size: formatBytes(sizeBytes),
    }
    : null

  const filename = path.split('/').pop() || path
  const breadcrumb = path.split('/').slice(0, -1).join(' / ')
  const obsidianUrl = buildObsidianOpenUrlOrch(path)

  const isEditing = mode === 'edit'
  const hasTextChanges = isEditing && content !== null && draft !== content
  const hasChanges = isExcalidrawDoc ? (isEditing && hasExcalidrawChanges) : hasTextChanges
  const splitPreviewOnWide = isEditing && !isExcalidrawDoc && showPreview

  useEffect(() => {
    if (!isEditing || isExcalidrawDoc || loading || error || content === null) {
      setRelatedThoughts([])
      setRelatedError(null)
      setRelatedLoading(false)
      return
    }

    const source = draft.trim()
    if (source.length < 24) {
      setRelatedThoughts([])
      setRelatedError(null)
      setRelatedLoading(false)
      return
    }

    let cancelled = false
    setRelatedLoading(true)
    setRelatedError(null)
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const matches = await findRelated({
            text: source,
            sourceFilePath: path,
            preferredTypes: ['thought'],
            limit: 6,
          })
          if (cancelled) return
          setRelatedThoughts(matches)
        } catch (err) {
          if (cancelled) return
          setRelatedError(err instanceof Error ? err.message : 'Failed to load related thoughts')
          setRelatedThoughts([])
        } finally {
          if (!cancelled) setRelatedLoading(false)
        }
      })()
    }, 320)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [content, draft, error, isEditing, isExcalidrawDoc, loading, path])

  const handleExcalidrawSceneChange = useCallback((scene: ParsedExcalidrawScene) => {
    excalidrawSceneRef.current = scene

    if (ignoreInitialExcalidrawChangeRef.current) {
      ignoreInitialExcalidrawChangeRef.current = false
      return
    }

    setHasExcalidrawChanges(true)
  }, [])

  const startEditing = () => {
    if (loading || error) return
    setMode('edit')
    setSaveError(null)
    setConflict(null)
    setHasExcalidrawChanges(false)
    setExcalidrawImmersive(isExcalidrawDoc)
    excalidrawSceneRef.current = null
    ignoreInitialExcalidrawChangeRef.current = true
    clearAssistState()
  }

  const cancelEditing = () => {
    setMode('view')
    setDraft(content ?? '')
    setSaveError(null)
    setConflict(null)
    setShowPreview(false)
    setHasExcalidrawChanges(false)
    setExcalidrawImmersive(false)
    excalidrawSceneRef.current = null
    ignoreInitialExcalidrawChangeRef.current = true
    clearAssistState()
  }

  const useLatestConflictVersion = () => {
    if (!conflict) return
    setContent(conflict.currentContent)
    setDraft(conflict.currentContent)
    setBaseMtime(conflict.currentMtime)
    setBaseHash(conflict.currentHash)
    setSaveError(null)
    setConflict(null)
    setHasExcalidrawChanges(false)
    setExcalidrawImmersive(false)
    excalidrawSceneRef.current = null
    ignoreInitialExcalidrawChangeRef.current = true
  }

  const handleSave = async () => {
    if (!hasChanges || baseMtime === null || !baseHash) return

    let contentToSave = draft
    if (isExcalidrawDoc) {
      if (content === null || !excalidrawSceneRef.current) return
      contentToSave = serializeExcalidrawSceneOrch(content, excalidrawSceneRef.current)
      if (contentToSave === content) {
        setHasExcalidrawChanges(false)
        return
      }
    }

    setSaving(true)
    setSaveError(null)
    setConflict(null)
    try {
      const result = await saveMarkdownDocument({
        path,
        content: contentToSave,
        baseMtime,
        baseHash,
      })
      const reloaded = await readMarkdownDocument(path)
      setContent(reloaded.content)
      setDraft(reloaded.content)
      setBaseMtime(reloaded.mtime)
      setBaseHash(reloaded.hash)
      setSizeBytes(new Blob([reloaded.content]).size)
      setMode('view')
      setShowPreview(false)
      setHasExcalidrawChanges(false)
      setExcalidrawImmersive(false)
      excalidrawSceneRef.current = null
      ignoreInitialExcalidrawChangeRef.current = true
      clearAssistState()
      onSaved?.(result)
    } catch (err) {
      if (err instanceof MarkdownDocumentConflictError) {
        setConflict(err)
        setSaveError(err.message)
      } else {
        setSaveError(err instanceof Error ? err.message : 'Failed to save file')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={cn('flex h-full min-h-0 flex-col bg-card', className)}
      data-prevent-sheet-escape={isEditing ? 'true' : undefined}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border/50 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{filename}</span>
          </div>
          {breadcrumb && (
            <div className="mt-0.5 truncate text-xs text-muted-foreground">{breadcrumb}</div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setShowMeta(v => !v)}
            className={`rounded-lg p-1.5 transition-colors ${showMeta ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
            title="File metadata"
          >
            <Info className="h-4 w-4" />
          </button>

          {!isEditing && (
            <button
              onClick={startEditing}
              disabled={loading || !!error}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              title="Edit file"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}

          {isEditing && !isExcalidrawDoc && (
            <button
              onClick={() => setShowPreview(v => !v)}
              className={`rounded-lg p-1.5 transition-colors ${showPreview ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              title="Toggle preview"
            >
              <Eye className="h-4 w-4" />
            </button>
          )}

          <a
            href={obsidianUrl}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Open in Obsidian"
          >
            <ExternalLink className="h-4 w-4" />
          </a>

          {showCloseButton && onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 transition-colors hover:bg-muted"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {showMeta && meta && (
        <div className="flex items-center gap-4 border-b border-border/30 bg-muted/30 px-5 py-2 text-xs text-muted-foreground">
          <span><strong className="text-foreground/70">{meta.lines}</strong> lines</span>
          <span><strong className="text-foreground/70">{meta.words}</strong> words</span>
          <span><strong className="text-foreground/70">{meta.headings}</strong> headings</span>
          <span>{meta.size}</span>
        </div>
      )}

      <div ref={contentScrollRef} className="relative min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-muted/40" style={{ width: `${60 + Math.random() * 40}%` }} />
            ))}
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive">{error}</div>
        )}

        {!loading && !error && content !== null && !isEditing && isExcalidrawDoc && (
          <ExcalidrawDocumentBlock content={content} />
        )}

        {!loading && !error && content !== null && !isEditing && !isExcalidrawDoc && (
          <div className="prose">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {stripFrontmatter(content)}
            </ReactMarkdown>
          </div>
        )}

        {!loading && !error && content !== null && isEditing && isExcalidrawDoc && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              <span>Full Excalidraw tool surface is enabled in edit mode.</span>
              <button
                type="button"
                onClick={() => setExcalidrawImmersive(true)}
                className="rounded-md border border-border/70 px-2 py-1 text-xs text-foreground hover:bg-muted"
              >
                Focus Canvas
              </button>
            </div>
            <ExcalidrawDocumentBlock
              content={draft}
              editable
              onSceneChange={handleExcalidrawSceneChange}
              className="h-[72vh]"
            />
            {saveError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {saveError}
              </div>
            )}

            {conflict && (
              <button
                onClick={useLatestConflictVersion}
                className="rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                Load latest file version
              </button>
            )}
          </div>
        )}

        {!loading && !error && content !== null && isEditing && isExcalidrawDoc && excalidrawImmersive && (
          <div className="fixed inset-0 z-[70] flex flex-col bg-background">
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 px-3">
              <span className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Excalidraw Focus Mode
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="rounded-md border border-border/70 px-2.5 py-1 text-xs text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!hasChanges || saving || baseMtime === null || !baseHash}
                  className="rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setExcalidrawImmersive(false)}
                  className="rounded-md border border-border/70 px-2.5 py-1 text-xs text-foreground hover:bg-muted"
                >
                  Exit Focus
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <ExcalidrawDocumentBlock
                content={draft}
                editable
                onSceneChange={handleExcalidrawSceneChange}
                className="h-full"
              />
            </div>
          </div>
        )}

        {!loading && !error && content !== null && isEditing && !isExcalidrawDoc && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="space-y-4">
              <AiAssistControlsBlock
                selectedProvider={selectedProvider}
                selectedModel={selectedModel}
                runningAction={assistRunningAction}
                loading={aiSelectionLoading}
                disabled={loading || isExcalidrawDoc}
                onRun={(action) => { void runAssistAction(action, draft) }}
                helperText="Preview-first only. Suggestions never auto-save until you click Save. Configure provider/model in AI Settings."
              />

              {assistSuggestion && (
                <AiAssistReviewBlock
                  suggestion={assistSuggestion}
                  onApply={() => {
                    const applied = applyAssistSuggestion((next) => {
                      setDraft(next)
                    })
                    if (applied) setShowPreview(true)
                  }}
                  onDiscard={dismissAssistSuggestion}
                />
              )}

              {assistError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {assistError}
                </div>
              )}

              <div className={cn('grid gap-4', splitPreviewOnWide ? 'xl:grid-cols-2' : 'grid-cols-1')}>
                <textarea
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value)
                    if (assistSuggestion || assistError) clearAssistState()
                  }}
                  className={cn(
                    'w-full resize-y rounded-lg border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                    splitPreviewOnWide ? 'min-h-[62vh]' : 'min-h-[52vh]',
                  )}
                />

                {showPreview && !isExcalidrawDoc && (
                  <div className={cn(
                    'rounded-lg border border-border/50 bg-muted/20 p-4',
                    splitPreviewOnWide && 'min-h-[62vh] overflow-y-auto',
                  )}>
                    <div className="mb-3 text-xs font-medium text-muted-foreground">Preview</div>
                    <div className="prose">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {stripFrontmatter(draft)}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>

              {saveError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {saveError}
                </div>
              )}

              {conflict && (
                <button
                  onClick={useLatestConflictVersion}
                  className="rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-muted"
                >
                  Load latest file version
                </button>
              )}
            </div>

            <aside className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-3 lg:sticky lg:top-4 lg:h-fit">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Related Thoughts
              </div>
              {relatedLoading && (
                <div className="text-xs text-muted-foreground">Finding related notes...</div>
              )}
              {relatedError && (
                <div className="text-xs text-destructive">{relatedError}</div>
              )}
              {!relatedLoading && !relatedError && relatedThoughts.length === 0 && (
                <div className="text-xs text-muted-foreground">
                  Keep typing to see lexical matches from your thought cache.
                </div>
              )}
              {relatedThoughts.map(match => (
                <button
                  key={match.node.uuid}
                  type="button"
                  className="w-full rounded-md border border-border/70 bg-background px-2.5 py-2 text-left transition-colors hover:bg-muted/40"
                  onClick={() => {
                    if (!onOpenPathForEdit || match.node.filePath === path) return
                    onOpenPathForEdit(match.node.filePath)
                  }}
                >
                  <div className="truncate text-xs font-medium text-foreground">{match.node.title}</div>
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{match.node.filePath}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    Score {Math.round(match.normalizedScore * 100)}% · {match.reasons.join(', ') || 'lexical'}
                  </div>
                </button>
              ))}
            </aside>
          </div>
        )}

        {!loading && !error && content !== null && !isExcalidrawDoc && (
          <MarkdownMiniNavBlock content={isEditing ? draft : content} container={contentScrollRef.current} />
        )}
      </div>

      {isEditing && !excalidrawImmersive && (
        <div className="flex items-center justify-between gap-2 border-t border-border/50 px-5 py-3">
          <div className="text-xs text-muted-foreground">
            {hasChanges ? 'Unsaved changes' : 'No changes'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={cancelEditing}
              className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving || baseMtime === null || !baseHash}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
