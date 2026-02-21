import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { X, FileText, ExternalLink, Info, Pencil, Save } from 'lucide-react'
import {
  MarkdownDocumentConflictError,
  readMarkdownDocument,
  saveMarkdownDocument,
} from '@/services/orchestrators/markdownDocumentsOrch'
import {
  serializeExcalidrawSceneOrch,
  type ParsedExcalidrawScene,
} from '@/services/orchestrators/excalidrawSceneOrch'
import { useUILayoutBlock } from '@/components/lego_blocks/UILayoutBlock'
import {
  buildObsidianOpenUrlOrch,
  isThinkingSpaceWikilinkHrefOrch,
  parseThinkingSpaceWikilinkHrefOrch,
  remarkObsidianWikilinksOrch,
  resolveWikilinkTargetOrch,
} from '@/services/orchestrators/obsidianLinkOrch'
import { openFileInNewTabOrch } from '@/services/orchestrators/fileSystemOrch'
import ExcalidrawDocumentBlock from '@/components/lego_blocks/ExcalidrawDocumentBlock'
import MarkdownMiniNavBlock from '@/components/lego_blocks/MarkdownMiniNavBlock'
import MarkdownRichEditorBlock from '@/components/lego_blocks/MarkdownRichEditorBlock'
import { cn } from '@/lib/utils'
import { useAiAssistRuntimeBlock } from '@/components/lego_blocks/AiAssistRuntimeBlock'
import AiAssistControlsBlock from '@/components/lego_blocks/AiAssistControlsBlock'
import AiAssistReviewBlock from '@/components/lego_blocks/AiAssistReviewBlock'
import { findRelated, type SimilarityMatch } from '@/services/lego_blocks/aiBlock'
import { thinkingSpaceMarkdownUrlTransformBlock } from '@/services/lego_blocks/markdownUrlTransformBlock'

export type MarkdownViewerMode = 'view' | 'edit'

interface MarkdownDocumentBlockProps {
  path: string
  initialMode?: MarkdownViewerMode
  onSaved?: (result: { output_path: string; revision_path: string | null }) => void
  onOpenPath?: (path: string) => void
  onOpenPathForEdit?: (path: string) => void
  onClose?: () => void
  showCloseButton?: boolean
  className?: string
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n?/, '')
}

function splitFrontmatter(content: string): { frontmatter: string; body: string } {
  const match = content.match(/^(---\n[\s\S]*?\n---\n?)([\s\S]*)$/)
  if (!match) return { frontmatter: '', body: content }
  return {
    frontmatter: match[1],
    body: match[2],
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const DEFERRED_RENDER_CHARS = 180_000

interface MarkdownMeta {
  lines: number | null
  words: number | null
  headings: number | null
  size: string
}

function scheduleDeferredWork(callback: () => void): () => void {
  if (typeof window !== 'undefined' && typeof (window as any).requestIdleCallback === 'function') {
    const idleId = (window as any).requestIdleCallback(() => callback(), { timeout: 240 })
    return () => (window as any).cancelIdleCallback?.(idleId)
  }

  const timeoutId = window.setTimeout(callback, 32)
  return () => window.clearTimeout(timeoutId)
}

function yieldToNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      resolve()
      return
    }
    window.requestAnimationFrame(() => resolve())
  })
}

function MarkdownDocumentBlock({
  path,
  initialMode = 'view',
  onSaved,
  onOpenPath,
  onOpenPathForEdit,
  onClose,
  showCloseButton = false,
  className,
}: MarkdownDocumentBlockProps) {
  const { layout } = useUILayoutBlock()
  const [mode, setMode] = useState<MarkdownViewerMode>(initialMode)
  const [content, setContent] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [baseMtime, setBaseMtime] = useState<number | null>(null)
  const [baseHash, setBaseHash] = useState<string | null>(null)

  const [sizeBytes, setSizeBytes] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [navigationError, setNavigationError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<MarkdownDocumentConflictError | null>(null)
  const [relatedThoughts, setRelatedThoughts] = useState<SimilarityMatch[]>([])
  const [relatedLoading, setRelatedLoading] = useState(false)
  const [relatedError, setRelatedError] = useState<string | null>(null)

  const [showMeta, setShowMeta] = useState(true)
  const [showAssistPanel, setShowAssistPanel] = useState(false)
  const [showRelatedPanel, setShowRelatedPanel] = useState(false)
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  const [meta, setMeta] = useState<MarkdownMeta | null>(null)
  const [viewMarkdown, setViewMarkdown] = useState('')
  const [pendingFullRender, setPendingFullRender] = useState(false)
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
  const chromeContainerRef = useRef<HTMLDivElement | null>(null)
  const contentScrollRef = useRef<HTMLDivElement | null>(null)
  const lastScrollTopRef = useRef(0)
  const chromeCollapsedRef = useRef(false)
  const excalidrawSceneRef = useRef<ParsedExcalidrawScene | null>(null)
  const ignoreInitialExcalidrawChangeRef = useRef(true)
  const [hasExcalidrawChanges, setHasExcalidrawChanges] = useState(false)
  const [excalidrawImmersive, setExcalidrawImmersive] = useState(false)
  const markdownSaveInFlightRef = useRef(false)

  const loadDocument = useCallback(async (seedDraft = false) => {
    setLoading(true)
    setError(null)
    setSaveError(null)
    setNavigationError(null)
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
      const data = await readMarkdownDocument(path, { includeHash: false })
      setContent(data.content)
      setDraft(seedDraft && !isExcalidrawDoc ? data.content : '')
      setBaseMtime(data.mtime)
      setBaseHash(data.hash)
      setSizeBytes(data.size)
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
  }, [clearAssistState, isExcalidrawDoc, path])

  useEffect(() => {
    setMode(initialMode)
    void loadDocument(initialMode === 'edit')
  }, [initialMode, loadDocument, path])

  useEffect(() => {
    if (!excalidrawImmersive) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExcalidrawImmersive(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [excalidrawImmersive])

  useEffect(() => {
    const chromeContainer = chromeContainerRef.current
    const scroller = contentScrollRef.current
    if (!chromeContainer || !scroller) return

    const TOP_RESET_THRESHOLD = 12
    let touchY: number | null = null

    const setChromeHidden = (hidden: boolean) => {
      if (chromeCollapsedRef.current === hidden) return
      chromeCollapsedRef.current = hidden
      if (hidden) chromeContainer.classList.add('hidden')
      else chromeContainer.classList.remove('hidden')
    }

    lastScrollTopRef.current = scroller.scrollTop
    chromeCollapsedRef.current = false
    chromeContainer.classList.remove('hidden')

    const onScroll = () => {
      const nextTop = scroller.scrollTop
      const delta = nextTop - lastScrollTopRef.current
      lastScrollTopRef.current = nextTop

      if (nextTop <= TOP_RESET_THRESHOLD) {
        setChromeHidden(false)
        return
      }
      if (delta > 0) {
        setChromeHidden(true)
      } else if (delta < 0) {
        setChromeHidden(false)
      }
    }

    const onWheel = (event: WheelEvent) => {
      if (event.deltaY > 0 && scroller.scrollTop > TOP_RESET_THRESHOLD) {
        setChromeHidden(true)
      } else if (event.deltaY < 0) {
        setChromeHidden(false)
      }
    }

    const onTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? null
    }

    const onTouchMove = (event: TouchEvent) => {
      const nextY = event.touches[0]?.clientY
      if (nextY === undefined || touchY === null) return
      const deltaY = touchY - nextY
      touchY = nextY
      if (deltaY > 0 && scroller.scrollTop > TOP_RESET_THRESHOLD) {
        setChromeHidden(true)
      } else if (deltaY < 0) {
        setChromeHidden(false)
      }
    }

    scroller.addEventListener('scroll', onScroll, { passive: true })
    scroller.addEventListener('wheel', onWheel, { passive: true })
    scroller.addEventListener('touchstart', onTouchStart, { passive: true })
    scroller.addEventListener('touchmove', onTouchMove, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      scroller.removeEventListener('wheel', onWheel)
      scroller.removeEventListener('touchstart', onTouchStart)
      scroller.removeEventListener('touchmove', onTouchMove)
    }
  }, [content, mode, path])

  const filename = path.split('/').pop() || path
  const breadcrumb = path.split('/').slice(0, -1).join(' / ')
  const obsidianUrl = buildObsidianOpenUrlOrch(path)
  const openLinkedPath = onOpenPath ?? onOpenPathForEdit

  const isEditing = mode === 'edit'
  const hasTextChanges = isEditing && content !== null && draft !== content
  const hasChanges = isExcalidrawDoc ? (isEditing && hasExcalidrawChanges) : hasTextChanges
  const shouldPadViewerContent = !isEditing && !isExcalidrawDoc
  const showMiniNavRail = layout.mode === 'desktop' && !layout.isCapacitorNative
  const displayContent = useMemo(
    () => (content !== null ? stripFrontmatter(content) : ''),
    [content],
  )
  const displayDraft = useMemo(
    () => stripFrontmatter(draft),
    [draft],
  )
  const draftFrontmatter = useMemo(
    () => splitFrontmatter(draft).frontmatter,
    [draft],
  )
  const excalidrawEditorContent = useMemo(
    () => (draft || content || ''),
    [content, draft],
  )
  const setDraftBody = useCallback((nextBody: string) => {
    setDraft((current) => `${splitFrontmatter(current).frontmatter}${nextBody}`)
  }, [])
  const markdownRemarkPlugins = useMemo(() => [remarkGfm, remarkObsidianWikilinksOrch], [])

  type MarkdownAnchorProps = ComponentPropsWithoutRef<'a'> & { node?: unknown }
  const markdownComponents = useMemo(() => ({
    a: ({ href, children, ...props }: MarkdownAnchorProps) => {
      const isWikilink = isThinkingSpaceWikilinkHrefOrch(href)

      const onClick = (event: ReactMouseEvent<HTMLAnchorElement>) => {
        if (!isWikilink || !href) {
          props.onClick?.(event)
          return
        }
        event.preventDefault()
        setNavigationError(null)
        const openInNewTab = event.metaKey || event.ctrlKey

        const parsed = parseThinkingSpaceWikilinkHrefOrch(href)
        if (!parsed) {
          setNavigationError('Invalid wikilink target.')
          return
        }

        void (async () => {
          try {
            const resolved = await resolveWikilinkTargetOrch({
              currentPath: path,
              target: parsed.target,
            })

            if (!resolved.path) {
              setNavigationError(`Linked file not found: [[${parsed.target}]]`)
              return
            }

            if (resolved.path === path) return
            if (openInNewTab) {
              openFileInNewTabOrch(resolved.path)
              setNavigationError(null)
              return
            }

            if (!openLinkedPath) {
              setNavigationError('Linked file navigation is unavailable in this view.')
              return
            }

            openLinkedPath(resolved.path)
            setNavigationError(null)
          } catch (err) {
            setNavigationError(err instanceof Error ? err.message : 'Failed to open linked file')
          }
        })()
      }

      return (
        <a
          {...props}
          href={href}
          onClick={onClick}
          className={cn(props.className, isWikilink && 'cursor-pointer')}
        >
          {children}
        </a>
      )
    },
  }), [openLinkedPath, path])

  useEffect(() => {
    if (content === null) {
      setMeta(null)
      return
    }

    setMeta({
      lines: null,
      words: null,
      headings: null,
      size: formatBytes(sizeBytes),
    })

    if (!showMeta) return

    let cancelled = false
    const cancelDeferred = scheduleDeferredWork(() => {
      if (cancelled) return
      setMeta({
        lines: content.split('\n').length,
        words: content.split(/\s+/).filter(Boolean).length,
        headings: (content.match(/^#{1,6}\s/gm) || []).length,
        size: formatBytes(sizeBytes),
      })
    })

    return () => {
      cancelled = true
      cancelDeferred()
    }
  }, [content, showMeta, sizeBytes])

  useEffect(() => {
    if (content === null || isEditing || isExcalidrawDoc) {
      setPendingFullRender(false)
      setViewMarkdown(displayContent)
      return
    }

    if (displayContent.length <= DEFERRED_RENDER_CHARS) {
      setPendingFullRender(false)
      setViewMarkdown(displayContent)
      return
    }

    let cancelled = false
    setViewMarkdown(displayContent.slice(0, DEFERRED_RENDER_CHARS))
    setPendingFullRender(true)
    const cancelDeferred = scheduleDeferredWork(() => {
      if (cancelled) return
      setViewMarkdown(displayContent)
      setPendingFullRender(false)
    })

    return () => {
      cancelled = true
      cancelDeferred()
    }
  }, [content, displayContent, isEditing, isExcalidrawDoc, path])

  useEffect(() => {
    if (!isEditing || isExcalidrawDoc || loading || error || content === null || !showRelatedPanel) {
      setRelatedThoughts([])
      setRelatedError(null)
      setRelatedLoading(false)
      return
    }

    const source = displayDraft.trim()
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
  }, [content, displayDraft, error, isEditing, isExcalidrawDoc, loading, path, showRelatedPanel])

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
    setDraft(isExcalidrawDoc ? '' : (content ?? ''))
    setShowAssistPanel(false)
    setShowRelatedPanel(false)
    setSaveError(null)
    setNavigationError(null)
    setConflict(null)
    setHasExcalidrawChanges(false)
    setExcalidrawImmersive(isExcalidrawDoc)
    excalidrawSceneRef.current = null
    ignoreInitialExcalidrawChangeRef.current = true
    clearAssistState()
  }

  const cancelEditing = () => {
    setMode('view')
    setSaveError(null)
    setConflict(null)
    setShowAssistPanel(false)
    setShowRelatedPanel(false)
    setAutoSaving(false)
    setNavigationError(null)
    setHasExcalidrawChanges(false)
    setExcalidrawImmersive(false)
    excalidrawSceneRef.current = null
    ignoreInitialExcalidrawChangeRef.current = true
    // Keep cancel interaction instant on very large drafts; clear assist state off the click path.
    window.requestAnimationFrame(() => {
      clearAssistState()
    })
  }

  const useLatestConflictVersion = () => {
    if (!conflict) return
    setContent(conflict.currentContent)
    setDraft(isExcalidrawDoc ? '' : conflict.currentContent)
    setBaseMtime(conflict.currentMtime)
    setBaseHash(conflict.currentHash)
    setSaveError(null)
    setConflict(null)
    setHasExcalidrawChanges(false)
    setExcalidrawImmersive(false)
    excalidrawSceneRef.current = null
    ignoreInitialExcalidrawChangeRef.current = true
  }

  const saveMarkdownDraft = useCallback(async (): Promise<boolean> => {
    if (markdownSaveInFlightRef.current) return false
    if (isExcalidrawDoc || content === null || baseMtime === null) return false
    if (draft === content) return true

    markdownSaveInFlightRef.current = true
    setSaveError(null)
    setConflict(null)
    try {
      const result = await saveMarkdownDocument({
        path,
        content: draft,
        baseMtime,
        baseHash,
        baseContent: content,
      })
      setContent(draft)
      setBaseMtime(result.mtime)
      setBaseHash(result.hash)
      setSizeBytes(result.size)
      onSaved?.(result)
      return true
    } catch (err) {
      if (err instanceof MarkdownDocumentConflictError) {
        setConflict(err)
        setSaveError(err.message)
      } else {
        setSaveError(err instanceof Error ? err.message : 'Failed to save file')
      }
      return false
    } finally {
      markdownSaveInFlightRef.current = false
    }
  }, [baseHash, baseMtime, content, draft, isExcalidrawDoc, onSaved, path])

  const handleSave = async () => {
    if (!hasChanges || baseMtime === null) return
    if (!isExcalidrawDoc) {
      setSaving(true)
      await saveMarkdownDraft()
      setSaving(false)
      return
    }

    setSaving(true)
    setSaveError(null)
    setConflict(null)

    try {
      if (content === null || !excalidrawSceneRef.current) return
      await yieldToNextFrame()
      const contentToSave = serializeExcalidrawSceneOrch(content, excalidrawSceneRef.current)
      if (contentToSave === content) {
        setHasExcalidrawChanges(false)
        return
      }

      const result = await saveMarkdownDocument({
        path,
        content: contentToSave,
        baseMtime,
        baseHash,
        baseContent: content,
      })
      const reloaded = await readMarkdownDocument(path, { includeHash: false })
      setContent(reloaded.content)
      setDraft('')
      setBaseMtime(reloaded.mtime)
      setBaseHash(reloaded.hash)
      setSizeBytes(reloaded.size)
      setMode('view')
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

  useEffect(() => {
    if (!autoSaveEnabled) return
    if (!isEditing || isExcalidrawDoc || loading || error || baseMtime === null) return
    if (!hasTextChanges || saving || autoSaving || conflict) return

    const timeoutId = window.setTimeout(() => {
      setAutoSaving(true)
      void saveMarkdownDraft().finally(() => {
        setAutoSaving(false)
      })
    }, 900)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    autoSaveEnabled,
    baseMtime,
    conflict,
    error,
    hasTextChanges,
    isEditing,
    isExcalidrawDoc,
    loading,
    saveMarkdownDraft,
    saving,
    autoSaving,
  ])

  return (
    <div
      className={cn('flex h-full min-h-0 flex-col bg-card', className)}
      data-prevent-sheet-escape={isEditing ? 'true' : undefined}
    >
      <div ref={chromeContainerRef} className="min-h-0 overflow-hidden">
        <div className="min-h-0 overflow-hidden">
          <div className="ts-md-header flex items-start justify-between gap-3 border-b border-border/50 px-5 py-4">
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
                <>
                  <button
                    type="button"
                    onClick={() => setAutoSaveEnabled(v => !v)}
                    className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${autoSaveEnabled ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                    title="Toggle auto save"
                  >
                    {autoSaveEnabled ? 'Auto-save On' : 'Auto-save Off'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAssistPanel(v => !v)}
                    className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${showAssistPanel ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                    title="Toggle AI assist"
                  >
                    AI Assist
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRelatedPanel(v => !v)}
                    className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${showRelatedPanel ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                    title="Toggle related thoughts"
                  >
                    Related Thoughts
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => { void handleSave() }}
                    disabled={!hasChanges || saving || baseMtime === null}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </>
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
              <span><strong className="text-foreground/70">{meta.lines ?? '…'}</strong> lines</span>
              <span><strong className="text-foreground/70">{meta.words ?? '…'}</strong> words</span>
              <span><strong className="text-foreground/70">{meta.headings ?? '…'}</strong> headings</span>
              <span>{meta.size}</span>
            </div>
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={contentScrollRef}
          className="relative h-full min-h-0 overflow-y-auto p-0"
        >
          {loading && (
            <div className={cn('space-y-3', shouldPadViewerContent && 'px-6 py-5')}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-4 animate-pulse rounded bg-muted/40" style={{ width: `${60 + Math.random() * 40}%` }} />
              ))}
            </div>
          )}

          {error && (
            <div className={cn('text-sm text-destructive', shouldPadViewerContent && 'px-6 py-5')}>{error}</div>
          )}

          {!loading && !error && navigationError && (
            <div className="px-6 pt-4">
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {navigationError}
              </div>
            </div>
          )}

          {!loading && !error && content !== null && !isEditing && isExcalidrawDoc && (
            <ExcalidrawDocumentBlock content={content} />
          )}

          {!loading && !error && content !== null && !isEditing && !isExcalidrawDoc && (
            <div className="space-y-2 px-6 py-5">
              {pendingFullRender && (
                <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  Rendering full document...
                </div>
              )}
              <div className="prose" data-markdown-nav-root>
                <ReactMarkdown
                  remarkPlugins={markdownRemarkPlugins}
                  components={markdownComponents}
                  urlTransform={thinkingSpaceMarkdownUrlTransformBlock}
                >
                  {viewMarkdown}
                </ReactMarkdown>
              </div>
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
              content={excalidrawEditorContent}
              editable
              onSceneChange={handleExcalidrawSceneChange}
              className="h-[52vh] sm:h-[60vh] lg:h-[72vh]"
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
                  disabled={!hasChanges || saving || baseMtime === null}
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
                content={excalidrawEditorContent}
                editable
                onSceneChange={handleExcalidrawSceneChange}
                className="h-full"
              />
            </div>
          </div>
        )}

        {!loading && !error && content !== null && isEditing && !isExcalidrawDoc && (
          <div className="space-y-4">
            {showAssistPanel && (
              <div className="space-y-3">
                <AiAssistControlsBlock
                  selectedProvider={selectedProvider}
                  selectedModel={selectedModel}
                  runningAction={assistRunningAction}
                  loading={aiSelectionLoading}
                  disabled={loading || isExcalidrawDoc}
                  onRun={(action) => { void runAssistAction(action, displayDraft) }}
                  helperText="Suggestions apply inline. Auto-save is enabled by default; use Save for immediate commit. Configure provider/model in AI Settings."
                />

                {assistSuggestion && (
                  <AiAssistReviewBlock
                    suggestion={assistSuggestion}
                    onApply={() => {
                      applyAssistSuggestion((next) => {
                        setDraftBody(next)
                      })
                    }}
                    onDiscard={dismissAssistSuggestion}
                  />
                )}

                {assistError && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {assistError}
                  </div>
                )}
              </div>
            )}

            {showRelatedPanel && (
              <div className="space-y-2">
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
              </div>
            )}

            <MarkdownRichEditorBlock
              value={displayDraft}
              currentPath={path}
              onChange={(next) => {
                setDraft(`${draftFrontmatter}${next}`)
                if (assistSuggestion || assistError) clearAssistState()
              }}
              className="min-h-[44vh] sm:min-h-[52vh] lg:min-h-[62vh]"
            />

            {autoSaving && !saving && (
              <div className="text-xs text-muted-foreground">Auto-saving…</div>
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

        </div>

        {!loading && !error && content !== null && !isExcalidrawDoc && !pendingFullRender && showMiniNavRail && (
          <MarkdownMiniNavBlock
            content={isEditing ? displayDraft : viewMarkdown}
            container={contentScrollRef.current}
            useRenderedHeadings={!isEditing}
            renderRootSelector="[data-markdown-nav-root]"
            className="fixed right-3 top-32 z-30 select-none rounded-lg border border-border/70 bg-background/90 p-1 shadow-sm backdrop-blur"
          />
        )}
      </div>

      {isEditing && !excalidrawImmersive && isExcalidrawDoc && (
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
              disabled={!hasChanges || saving || baseMtime === null}
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

export default memo(MarkdownDocumentBlock)
