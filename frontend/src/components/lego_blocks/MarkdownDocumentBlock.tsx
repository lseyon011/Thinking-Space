import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { X, FileText, ExternalLink, Info, Pencil, Save, Eye, Sparkles } from 'lucide-react'
import {
  MarkdownDocumentConflictError,
  readMarkdownDocument,
  saveMarkdownDocument,
} from '@/services/orchestrators/markdownDocumentsOrch'
import { type AiProvider, type AiProviderStatus, listProvidersBlock } from '@/services/lego_blocks/aiProviderBlock'
import { type AiAssistAction, type RunAiAssistResult, runAiAssistOrch } from '@/services/orchestrators/aiAssistOrch'
import { buildObsidianOpenUrl } from '@/services/lego_blocks/obsidianLinkBlock'
import ExcalidrawDocumentBlock from '@/components/lego_blocks/ExcalidrawDocumentBlock'
import MarkdownMiniNavBlock from '@/components/lego_blocks/MarkdownMiniNavBlock'
import { cn } from '@/lib/utils'

export type MarkdownViewerMode = 'view' | 'edit'

interface MarkdownDocumentBlockProps {
  path: string
  initialMode?: MarkdownViewerMode
  onSaved?: (result: { output_path: string; revision_path: string | null }) => void
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

const AI_ASSIST_ACTIONS: Array<{ action: AiAssistAction; label: string }> = [
  { action: 'grammar', label: 'Grammar' },
  { action: 'clarity', label: 'Clarity' },
  { action: 'structure', label: 'Structure' },
  { action: 'tone', label: 'Tone' },
]

function selectDefaultProvider(providers: AiProviderStatus[]): AiProvider | null {
  const preferred: AiProvider[] = ['codex-cli', 'claude', 'openai-codex', 'azure-gpt']
  for (const provider of preferred) {
    if (providers.some((item) => item.provider === provider && item.available)) {
      return provider
    }
  }
  return providers.find((item) => item.available)?.provider ?? null
}

export default function MarkdownDocumentBlock({
  path,
  initialMode = 'view',
  onSaved,
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

  const [showMeta, setShowMeta] = useState(true)
  const [showPreview, setShowPreview] = useState(false)
  const [providers, setProviders] = useState<AiProviderStatus[]>([])
  const [providersLoading, setProvidersLoading] = useState(true)
  const [selectedProvider, setSelectedProvider] = useState<AiProvider | null>(null)
  const [assistRunningAction, setAssistRunningAction] = useState<AiAssistAction | null>(null)
  const [assistError, setAssistError] = useState<string | null>(null)
  const [assistSuggestion, setAssistSuggestion] = useState<RunAiAssistResult | null>(null)
  const isExcalidrawDoc = /\.(excalidraw|excalidraw\.md)$/i.test(path)
  const contentScrollRef = useRef<HTMLDivElement | null>(null)

  const loadDocument = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSaveError(null)
    setConflict(null)
    setAssistError(null)
    setAssistSuggestion(null)
    setAssistRunningAction(null)
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
  }, [path])

  useEffect(() => {
    let cancelled = false
    setProvidersLoading(true)
    listProvidersBlock()
      .then((items) => {
        if (cancelled) return
        setProviders(items)
        setSelectedProvider((current) => {
          if (current && items.some((item) => item.provider === current && item.available)) {
            return current
          }
          return selectDefaultProvider(items)
        })
      })
      .catch(() => {
        if (cancelled) return
        setProviders([])
        setSelectedProvider(null)
      })
      .finally(() => {
        if (!cancelled) setProvidersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setMode(isExcalidrawDoc ? 'view' : initialMode)
    void loadDocument()
  }, [initialMode, isExcalidrawDoc, loadDocument, path])

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
  const obsidianUrl = buildObsidianOpenUrl(path)

  const isEditing = mode === 'edit'
  const hasChanges = isEditing && content !== null && draft !== content
  const availableProviders = providers.filter((item) => item.available)

  const startEditing = () => {
    if (loading || error || isExcalidrawDoc) return
    setMode('edit')
    setSaveError(null)
    setConflict(null)
    setAssistError(null)
    setAssistSuggestion(null)
  }

  const cancelEditing = () => {
    setMode('view')
    setDraft(content ?? '')
    setSaveError(null)
    setConflict(null)
    setShowPreview(false)
    setAssistError(null)
    setAssistSuggestion(null)
    setAssistRunningAction(null)
  }

  const useLatestConflictVersion = () => {
    if (!conflict) return
    setContent(conflict.currentContent)
    setDraft(conflict.currentContent)
    setBaseMtime(conflict.currentMtime)
    setBaseHash(conflict.currentHash)
    setSaveError(null)
    setConflict(null)
  }

  const runAssistAction = async (action: AiAssistAction) => {
    if (!selectedProvider || loading || isExcalidrawDoc || assistRunningAction) return
    if (!draft.trim()) {
      setAssistError('Add some text before running AI assist.')
      return
    }

    setAssistRunningAction(action)
    setAssistError(null)
    setAssistSuggestion(null)
    try {
      const result = await runAiAssistOrch({
        provider: selectedProvider,
        action,
        content: draft,
      })
      if (!result.changed) {
        setAssistError(`No ${action} changes suggested.`)
        return
      }
      setAssistSuggestion(result)
    } catch (err) {
      setAssistError(err instanceof Error ? err.message : 'AI assist failed')
    } finally {
      setAssistRunningAction(null)
    }
  }

  const applyAssistSuggestion = () => {
    if (!assistSuggestion) return
    setDraft(assistSuggestion.suggestedContent)
    setAssistSuggestion(null)
    setAssistError(null)
    setShowPreview(true)
  }

  const handleSave = async () => {
    if (!hasChanges || baseMtime === null || !baseHash) return
    setSaving(true)
    setSaveError(null)
    setConflict(null)
    try {
      const result = await saveMarkdownDocument({
        path,
        content: draft,
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
      setAssistError(null)
      setAssistSuggestion(null)
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
    <div className={cn('flex h-full min-h-0 flex-col bg-card', className)}>
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

          {!isEditing && !isExcalidrawDoc && (
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

        {!loading && !error && content !== null && isEditing && !isExcalidrawDoc && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI assist
                </span>

                <select
                  value={selectedProvider ?? ''}
                  disabled={providersLoading || availableProviders.length === 0 || !!assistRunningAction}
                  onChange={(event) => setSelectedProvider(event.target.value as AiProvider)}
                  className="rounded-lg border border-input bg-background px-2 py-1 text-xs text-foreground disabled:opacity-60"
                >
                  {!selectedProvider && <option value="">Select provider</option>}
                  {availableProviders.map((provider) => (
                    <option key={provider.provider} value={provider.provider}>
                      {provider.label}
                    </option>
                  ))}
                </select>

                {AI_ASSIST_ACTIONS.map((item) => (
                  <button
                    key={item.action}
                    onClick={() => void runAssistAction(item.action)}
                    disabled={
                      providersLoading
                      || availableProviders.length === 0
                      || !selectedProvider
                      || !!assistRunningAction
                    }
                    className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {assistRunningAction === item.action ? `${item.label}...` : item.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Preview-first only. Suggestions never auto-save until you click Save.
              </div>
            </div>

            {assistSuggestion && (
              <div className="rounded-lg border border-border/50 bg-background p-3">
                <div className="text-xs text-muted-foreground">
                  {[assistSuggestion.provider, assistSuggestion.model].filter(Boolean).join(' • ')}
                  {assistSuggestion.latency_ms != null && ` • ${assistSuggestion.latency_ms} ms`}
                  {assistSuggestion.total_tokens != null && ` • tokens ${assistSuggestion.total_tokens}`}
                </div>
                <textarea
                  value={assistSuggestion.suggestedContent}
                  readOnly
                  className="mt-2 min-h-[20vh] w-full resize-y rounded-lg border border-input bg-muted/10 p-3 text-sm"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={applyAssistSuggestion}
                    className="rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground"
                  >
                    Apply suggestion
                  </button>
                  <button
                    onClick={() => setAssistSuggestion(null)}
                    className="rounded-lg border border-border px-3 py-2 text-xs text-foreground hover:bg-muted"
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}

            {assistError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {assistError}
              </div>
            )}

            <textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                if (assistSuggestion) setAssistSuggestion(null)
                if (assistError) setAssistError(null)
              }}
              className="min-h-[52vh] w-full resize-y rounded-lg border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />

            {showPreview && !isExcalidrawDoc && (
              <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
                <div className="mb-3 text-xs font-medium text-muted-foreground">Preview</div>
                <div className="prose">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {stripFrontmatter(draft)}
                  </ReactMarkdown>
                </div>
              </div>
            )}

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

        {!loading && !error && content !== null && !isExcalidrawDoc && (
          <MarkdownMiniNavBlock content={isEditing ? draft : content} container={contentScrollRef.current} />
        )}
      </div>

      {isEditing && !isExcalidrawDoc && (
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
