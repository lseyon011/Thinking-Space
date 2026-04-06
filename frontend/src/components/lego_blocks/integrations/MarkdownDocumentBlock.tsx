import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { X, FileText, ExternalLink, Pencil, Save, FolderOpen } from 'lucide-react'
import {
  MarkdownDocumentConflictError,
  readMarkdownDocument,
  saveMarkdownDocument,
} from '@/services/orchestrators/markdownDocumentsOrch'
import {
  serializeExcalidrawSceneOrch,
  type ParsedExcalidrawScene,
} from '@/services/orchestrators/excalidrawSceneOrch'
import type { ExcalidrawCanvasApiOrch } from '@/services/orchestrators/excalidrawIntegrationOrch'
import { useUILayoutBlock } from '@/components/lego_blocks/hooks/shared/useUILayoutBlock'
import {
  buildObsidianOpenUrlOrch,
  isThinkingSpaceWikilinkHrefOrch,
  parseThinkingSpaceWikilinkHrefOrch,
  resolveWikilinkAssetTargetOrch,
  remarkObsidianWikilinksOrch,
  resolveWikilinkTargetOrch,
} from '@/services/orchestrators/obsidianLinkOrch'
import {
  getOpenInSystemLabelOrch,
  openFileInNewTabOrch,
  openVaultPathWithDefaultAppOrch,
  openVaultPathInSystemOrch,
  renameVaultPathOrch,
} from '@/services/orchestrators/fileSystemOrch'
import ExcalidrawDocumentBlock from '@/components/lego_blocks/integrations/ExcalidrawDocumentBlock'
import UrlDocumentBlock from '@/components/lego_blocks/integrations/UrlDocumentBlock'
import { isUrlShortcutPathBlock } from '@/services/lego_blocks/units/urlShortcutBlock'
import TableDocumentBlock from '@/components/lego_blocks/integrations/TableDocumentBlock'
import PdfDocumentBlock from '@/components/lego_blocks/integrations/PdfDocumentBlock'
import GoogleDocDocumentBlock from '@/components/lego_blocks/integrations/GoogleDocDocumentBlock'
import ImageDocumentBlock from '@/components/lego_blocks/integrations/ImageDocumentBlock'
import MarkdownMiniNavBlock from '@/components/lego_blocks/integrations/MarkdownMiniNavBlock'
import MarkdownRichEditorBlock from '@/components/lego_blocks/integrations/MarkdownRichEditorBlock'
import MarkdownAnchorAnnotationBlock from '@/components/lego_blocks/integrations/MarkdownAnchorAnnotationBlock'
import MarkdownAnnotationEditorBlock from '@/components/lego_blocks/integrations/MarkdownAnnotationEditorBlock'
import ExcalidrawHighlighterPresetPickerBlock from '@/components/lego_blocks/integrations/ExcalidrawHighlighterPresetPickerBlock'
import MarkupToolIconBlock from '@/components/lego_blocks/units/MarkupToolIconBlock'
import InfoPanelToggleButtonBlock from '@/components/lego_blocks/units/InfoPanelToggleButtonBlock'
import { cn } from '@/lib/utils'
import { thinkingSpaceMarkdownUrlTransformBlock } from '@/services/lego_blocks/integrations/markdownUrlTransformBlock'
import {
  readMarkdownEditorSettingsOrch,
  type MarkdownEditorSettingsBlock,
} from '@/services/orchestrators/markdownEditorSettingsOrch'
import {
  EXCALIDRAW_HIGHLIGHTER_PRESETS_ORCH,
  type ExcalidrawHighlighterPresetBlock,
} from '@/services/orchestrators/excalidrawHighlighterOrch'
import { readExcalidrawActivePresetIdOrch, writeExcalidrawActivePresetIdOrch } from '@/services/orchestrators/excalidrawPenDefaultsOrch'
import { subscribeNativePencilBridgeOrch } from '@/services/orchestrators/pencilBridgeOrch'
import { STORAGE_KEYS, getStorageItem } from '@/services/orchestrators/storageOrch'
import { dispatchGlobalSyncRefreshBlock } from '@/services/lego_blocks/units/globalSyncRefreshBlock'
import { type StewardMetadataSuggestion } from '@/services/orchestrators/stewardMetadataOrch'
import {
  DEFERRED_RENDER_CHARS,
  buildFrontmatterMetaState,
  extractTextFromNode,
  formatUnixTimestampForMeta,
  formatBytes,
  frontmatterObjectToBlock,
  isBlankLineMarkerText,
  parseFrontmatterObject,
  preserveExtraBlankLinesInMarkdown,
  scheduleDeferredWork,
  splitFrontmatter,
  stripFrontmatter,
  type MarkdownMeta,
  yamlTextToFrontmatterBlock,
  yieldToNextFrame,
} from '@/components/lego_blocks/units/MarkdownDocumentContentBlock'
import { isTableDocumentPathBlock } from '@/services/lego_blocks/units/tableDocumentPathBlock'
import { isPdfDocumentPathBlock } from '@/services/lego_blocks/units/pdfDocumentPathBlock'
import { isGoogleDocDocumentPathBlock } from '@/services/lego_blocks/units/googleDocDocumentPathBlock'
import { isImageDocumentPathBlock } from '@/services/lego_blocks/units/imageDocumentPathBlock'
import { isExcalidrawPathBlock } from '@/services/lego_blocks/units/excalidrawPathBlock'
import { readImageDocumentOrch } from '@/services/orchestrators/imageDocumentsOrch'
import {
  clearExcalidrawCrashMarkerBlock,
  markExcalidrawCrashStageBlock,
} from '@/services/lego_blocks/units/excalidrawCrashMarkerBlock'
import {
  buildMarkdownAnchorIdBlock,
  buildMarkdownAnnotationIdBlock,
  composeMarkdownAnnotationDocumentBlock,
  findMarkdownAnchorAfterOffsetBlock,
  findMarkdownHighlightByVisibleOffsetBlock,
  getMarkdownAnchorAnnotationBlock,
  insertMarkdownAnchorAfterBlockOffsetBlock,
  insertMarkdownHighlightAtRangeBlock,
  parseMarkdownHighlightSegmentsBlock,
  parseMarkdownAnchorIdBlock,
  removeMarkdownHighlightByVisibleOffsetBlock,
  removeMarkdownAnchorAnnotationBlock,
  remarkMarkdownSourceSpansBlock,
  splitMarkdownAnnotationDocumentBlock,
  updateMarkdownHighlightPresetByVisibleOffsetBlock,
  upsertMarkdownAnchorAnnotationBlock,
  type MarkdownAnchorAnnotationBlock as MarkdownAnchorAnnotationModelBlock,
  type MarkdownAnnotationStoreBlock,
} from '@/services/lego_blocks/units/markdownAnnotationBlock'

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
  topBarHidden?: boolean
}

interface MarkdownEditBaselineState {
  content: string
}

const SUPPORTED_TEXT_EXTENSIONS_BLOCK = new Set([
  'md', 'markdown', 'txt', 'text', 'json', 'jsonl', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'env',
  'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
  'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'py', 'java', 'kt', 'kts', 'go', 'rs',
  'c', 'cc', 'cpp', 'cxx', 'h', 'hpp', 'cs', 'swift', 'rb', 'php', 'scala', 'lua', 'r',
  'sql', 'graphql', 'gql', 'html', 'htm', 'css', 'scss', 'sass', 'less', 'xml', 'svg', 'tex',
  'log', 'csv', 'tsv',
])

function isUnsupportedFilePathBlock(path: string): boolean {
  const filename = path.split('/').pop()?.toLowerCase() ?? ''
  if (!filename) return false
  if (!filename.includes('.')) return false
  if (filename.startsWith('.')) return false
  const extension = filename.slice(filename.lastIndexOf('.') + 1).trim()
  if (!extension) return false
  return !SUPPORTED_TEXT_EXTENSIONS_BLOCK.has(extension)
}

interface MarkdownWikilinkImageBlockProps {
  src: string | undefined
  alt: string | undefined
  currentPath: string
}

function MarkdownWikilinkImageBlock({
  src,
  alt,
  currentPath,
}: MarkdownWikilinkImageBlockProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!src || !isThinkingSpaceWikilinkHrefOrch(src)) {
      setImageUrl(null)
      setError(null)
      return
    }

    const parsed = parseThinkingSpaceWikilinkHrefOrch(src)
    if (!parsed?.target) {
      setImageUrl(null)
      setError('Invalid embedded image target.')
      return
    }

    let cancelled = false
    let objectUrl: string | null = null

    const load = async () => {
      setImageUrl(null)
      setError(null)
      try {
        const resolvedPath = await resolveWikilinkAssetTargetOrch({
          currentPath,
          target: parsed.target,
        })
        if (!resolvedPath) {
          if (!cancelled) setError(`Embedded file not found: [[${parsed.target}]]`)
          return
        }
        const doc = await readImageDocumentOrch(resolvedPath)
        const blob = new Blob([Uint8Array.from(doc.bytes)], { type: doc.mime })
        objectUrl = URL.createObjectURL(blob)
        if (!cancelled) setImageUrl(objectUrl)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load embedded image.')
        }
      }
    }

    void load()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [currentPath, src])

  if (!src || !isThinkingSpaceWikilinkHrefOrch(src)) {
    return <img src={src} alt={alt ?? ''} />
  }

  if (error) {
    return (
      <span className="inline-flex rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive">
        {error}
      </span>
    )
  }

  if (!imageUrl) {
    return (
      <span className="inline-flex rounded border border-border/50 bg-muted/20 px-2 py-1 text-xs text-muted-foreground">
        Loading image...
      </span>
    )
  }

  return (
    <img
      src={imageUrl}
      alt={alt ?? ''}
      className="max-w-full rounded-md border border-border/40"
      loading="lazy"
    />
  )
}

function resolveMarkdownHighlightColorBlock(
  presetId: string | null,
  presets: readonly ExcalidrawHighlighterPresetBlock[],
): string {
  if (!presetId) return '#fde68a'
  const preset = presets.find((entry) => entry.id === presetId)
  if (!preset) return '#fde68a'
  return preset.backgroundColor !== 'transparent' ? preset.backgroundColor : preset.strokeColor
}

function renderHighlightedSourceSpanBlock(
  text: string,
  sourceStart: number,
  keyPrefix: string,
  presets: readonly ExcalidrawHighlighterPresetBlock[],
): ReactNode[] {
  return parseMarkdownHighlightSegmentsBlock(text).map((segment, index) => {
    const absoluteStart = sourceStart + segment.rawStart
    const absoluteEnd = sourceStart + segment.rawEnd
    if (segment.kind === 'highlight') {
      return (
        <mark
          key={`${keyPrefix}-${index}`}
          data-md-source-start={absoluteStart}
          data-md-source-end={absoluteEnd}
          data-md-highlight-preset={segment.presetId ?? ''}
          className="rounded px-1 py-0.5 text-inherit shadow-[inset_0_-1px_0_rgba(180,83,9,0.18)]"
          style={{ backgroundColor: resolveMarkdownHighlightColorBlock(segment.presetId, presets) }}
        >
          {segment.visibleText}
        </mark>
      )
    }
    return (
      <span
        key={`${keyPrefix}-${index}`}
        data-md-source-start={absoluteStart}
        data-md-source-end={absoluteEnd}
      >
        {segment.visibleText}
      </span>
    )
  })
}

interface ViewerHighlightSelectionBlock {
  start: number
  end: number
  text: string
  top: number
  left: number
}

interface ViewerExistingHighlightTargetBlock {
  offset: number
  start: number
  end: number
  text: string
  presetId: string | null
}

interface ViewerPencilHighlightGestureBlock {
  start: number
  end: number
  blockElement: HTMLElement
}

function findClosestElementBlock(node: Node | null, selector: string): HTMLElement | null {
  let current: Node | null = node
  while (current) {
    if (current instanceof HTMLElement && current.matches(selector)) return current
    current = current.parentNode
  }
  return null
}

function getTextOffsetWithinElementBlock(element: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange()
  range.selectNodeContents(element)
  try {
    range.setEnd(node, offset)
  } catch {
    return 0
  }
  return range.toString().length
}

function getCaretAtClientPointBlock(x: number, y: number): { node: Node; offset: number } | null {
  const candidateDocument = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  if (typeof candidateDocument.caretPositionFromPoint === 'function') {
    const position = candidateDocument.caretPositionFromPoint(x, y)
    if (position?.offsetNode) {
      return {
        node: position.offsetNode,
        offset: position.offset,
      }
    }
  }
  if (typeof candidateDocument.caretRangeFromPoint === 'function') {
    const range = candidateDocument.caretRangeFromPoint(x, y)
    if (range?.startContainer) {
      return {
        node: range.startContainer,
        offset: range.startOffset,
      }
    }
  }
  return null
}

function resolveRawMarkdownOffsetFromSpanBlock(
  spanElement: HTMLElement,
  node: Node,
  offset: number,
): number | null {
  const sourceStart = Number(spanElement.dataset.mdSourceStart ?? '')
  if (!Number.isFinite(sourceStart)) return null
  return sourceStart + getTextOffsetWithinElementBlock(spanElement, node, offset)
}

function readMarkdownNodeEndOffsetBlock(node: unknown): number | null {
  if (!node || typeof node !== 'object') return null
  const candidate = node as {
    position?: {
      end?: {
        offset?: number
      }
    }
  }
  return typeof candidate.position?.end?.offset === 'number' ? candidate.position.end.offset : null
}

function MarkdownTextDocumentRuntimeBlock({
  path,
  initialMode = 'view',
  onSaved,
  onOpenPath,
  onOpenPathForEdit,
  onClose,
  showCloseButton = false,
  className,
  topBarHidden: topBarHiddenProp,
}: MarkdownDocumentBlockProps) {
  const { layout } = useUILayoutBlock()
  const isIosSurface = layout.surface === 'capacitor-ios'
  const isElectronSurface = layout.surface === 'electron'
  const isIosPhone = isIosSurface && layout.mode === 'phone'
  const [mode, setMode] = useState<MarkdownViewerMode>(initialMode)
  const [content, setContent] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [baseMtime, setBaseMtime] = useState<number | null>(null)
  const [baseCtime, setBaseCtime] = useState<number | null>(null)
  const [baseHash, setBaseHash] = useState<string | null>(null)

  const [sizeBytes, setSizeBytes] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const [manualSaveFeedbackVisible, setManualSaveFeedbackVisible] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [navigationError, setNavigationError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<MarkdownDocumentConflictError | null>(null)
  const [showMeta, setShowMeta] = useState(false)
  const [topBarHiddenInViewMode] = useState<boolean>(
    () => getStorageItem(STORAGE_KEYS.markdownDocumentTopBarHidden) === '1',
  )
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [editorSettings] = useState<MarkdownEditorSettingsBlock>(
    () => readMarkdownEditorSettingsOrch(),
  )
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  const [meta, setMeta] = useState<MarkdownMeta | null>(null)
  const [viewMarkdown, setViewMarkdown] = useState('')
  const [pendingFullRender, setPendingFullRender] = useState(false)
  const [filenameDraft, setFilenameDraft] = useState('')
  const [isHeaderRenameActive, setIsHeaderRenameActive] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [activeAnnotationAnchorId, setActiveAnnotationAnchorId] = useState<string | null>(null)
  const [annotationSaveError, setAnnotationSaveError] = useState<string | null>(null)
  const [annotationSaving, setAnnotationSaving] = useState(false)
  const [viewerAnnotateMode, setViewerAnnotateMode] = useState(false)
  const [viewerAnnotateSessionBody, setViewerAnnotateSessionBody] = useState<string | null>(null)
  const [viewerHighlightSelection, setViewerHighlightSelection] = useState<ViewerHighlightSelectionBlock | null>(null)
  const [viewerExistingHighlightTarget, setViewerExistingHighlightTarget] = useState<ViewerExistingHighlightTargetBlock | null>(null)
  const [viewerHighlightSaving, setViewerHighlightSaving] = useState(false)
  const [viewerHighlightError, setViewerHighlightError] = useState<string | null>(null)
  const [viewerHighlightPresets] = useState<readonly ExcalidrawHighlighterPresetBlock[]>(EXCALIDRAW_HIGHLIGHTER_PRESETS_ORCH)
  const [activeViewerHighlightPresetId, setActiveViewerHighlightPresetId] = useState<string | null>(
    () => readExcalidrawActivePresetIdOrch() ?? EXCALIDRAW_HIGHLIGHTER_PRESETS_ORCH[0]?.id ?? null,
  )
  const isExcalidrawDoc = isExcalidrawPathBlock(path)
  const chromeContainerRef = useRef<HTMLDivElement | null>(null)
  const contentScrollRef = useRef<HTMLDivElement | null>(null)
  const markdownViewRootRef = useRef<HTMLDivElement | null>(null)
  const headerRenameInputRef = useRef<HTMLInputElement | null>(null)
  const manualSaveFeedbackTimeoutRef = useRef<number | null>(null)
  const excalidrawSceneRef = useRef<ParsedExcalidrawScene | null>(null)
  const excalidrawApiRef = useRef<ExcalidrawCanvasApiOrch | null>(null)
  const ignoreInitialExcalidrawChangeRef = useRef(true)
  const [hasExcalidrawChanges, setHasExcalidrawChanges] = useState(false)
  const [excalidrawImmersive, setExcalidrawImmersive] = useState(false)
  const markdownSaveInFlightRef = useRef(false)
  const markdownSavePromiseRef = useRef<Promise<boolean> | null>(null)
  const markdownEditBaselineRef = useRef<MarkdownEditBaselineState | null>(null)
  const viewerPencilHighlightGestureRef = useRef<ViewerPencilHighlightGestureBlock | null>(null)
  const viewerPencilBridgeStopRef = useRef<(() => Promise<void>) | null>(null)
  const viewerSuppressSelectionCaptureUntilRef = useRef(0)
  const markdownCancelRevertInFlightRef = useRef(false)
  const excalidrawCrashMarkerClearTimeoutRef = useRef<number | null>(null)
  const preserveExcalidrawCrashMarkerOnUnmountRef = useRef(false)
  const handleSaveRef = useRef<() => Promise<void>>(async () => {})

  const loadDocument = useCallback(async (seedDraft = false) => {
    setLoading(true)
    setError(null)
    setSaveError(null)
    setNavigationError(null)
    setConflict(null)
    setHasExcalidrawChanges(false)
    setExcalidrawImmersive(false)
    setActiveAnnotationAnchorId(null)
    setAnnotationSaveError(null)
    setAnnotationSaving(false)
    setViewerAnnotateMode(false)
    setViewerAnnotateSessionBody(null)
    setViewerHighlightSelection(null)
    setViewerExistingHighlightTarget(null)
    setViewerHighlightSaving(false)
    setViewerHighlightError(null)
    viewerPencilHighlightGestureRef.current = null
    markdownEditBaselineRef.current = null
    markdownCancelRevertInFlightRef.current = false
    excalidrawSceneRef.current = null
    excalidrawApiRef.current = null
    ignoreInitialExcalidrawChangeRef.current = true
    try {
      const data = await readMarkdownDocument(path, { includeHash: false })
      const nextMarkdownContent = isExcalidrawDoc ? data.content : splitMarkdownAnnotationDocumentBlock(data.content).body
      setContent(data.content)
      setDraft(seedDraft && !isExcalidrawDoc ? nextMarkdownContent : '')
      setBaseMtime(data.mtime)
      setBaseCtime(data.ctime)
      setBaseHash(data.hash)
      setSizeBytes(data.size)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file')
      setContent(null)
      setDraft('')
      setBaseMtime(null)
      setBaseCtime(null)
      setBaseHash(null)
      setSizeBytes(0)
    } finally {
      setLoading(false)
    }
  }, [isExcalidrawDoc, path])

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
    if (mode !== 'edit' || !isExcalidrawDoc) return
    markExcalidrawCrashStageBlock(path, 'editor_mounting')
  }, [isExcalidrawDoc, mode, path])

  const triggerManualSaveFeedback = useCallback(() => {
    if (manualSaveFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(manualSaveFeedbackTimeoutRef.current)
    }
    setManualSaveFeedbackVisible(true)
    manualSaveFeedbackTimeoutRef.current = window.setTimeout(() => {
      setManualSaveFeedbackVisible(false)
      manualSaveFeedbackTimeoutRef.current = null
    }, 1600)
  }, [])

  useEffect(() => {
    return () => {
      if (manualSaveFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(manualSaveFeedbackTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      if (excalidrawCrashMarkerClearTimeoutRef.current !== null) {
        window.clearTimeout(excalidrawCrashMarkerClearTimeoutRef.current)
        excalidrawCrashMarkerClearTimeoutRef.current = null
      }
      if (!preserveExcalidrawCrashMarkerOnUnmountRef.current) {
        clearExcalidrawCrashMarkerBlock()
      }
    }
  }, [])

  const filename = path.split('/').pop() || path
  const breadcrumb = path.split('/').slice(0, -1).join(' / ')
  const canRenameInHeader = !!(onOpenPathForEdit || onOpenPath)
  const obsidianUrl = buildObsidianOpenUrlOrch(path)
  const openInSystemLabel = getOpenInSystemLabelOrch()
  const canOpenInSystem = openInSystemLabel !== null
  const openInSystemButtonLabel = openInSystemLabel ?? 'System'
  const openLinkedPath = onOpenPath ?? onOpenPathForEdit
  const openRelatedThoughtPath = onOpenPathForEdit ?? onOpenPath
  const normalizePathForCompare = useCallback((candidate: string): string => (
    candidate
      .trim()
      .replace(/\\/g, '/')
      .replace(/^\.?\//, '')
      .toLowerCase()
  ), [])

  const isEditing = mode === 'edit'
  const effectiveTopBarHidden = topBarHiddenProp !== undefined ? topBarHiddenProp : topBarHiddenInViewMode
  const hideTopBarInView = !isEditing && effectiveTopBarHidden
  const annotationDocument = useMemo(
    () => (isExcalidrawDoc || content === null ? null : splitMarkdownAnnotationDocumentBlock(content)),
    [content, isExcalidrawDoc],
  )
  const persistedMarkdownContent = annotationDocument?.body ?? (content ?? '')
  const annotationStore = annotationDocument?.store ?? { version: 1, annotations: [] }
  const annotationParseError = annotationDocument?.parseError ?? null
  const annotationRawFenceBlock = annotationDocument?.rawFenceBlock ?? null
  const activeAnnotation = useMemo(
    () => (activeAnnotationAnchorId ? getMarkdownAnchorAnnotationBlock(annotationStore, activeAnnotationAnchorId) : null),
    [activeAnnotationAnchorId, annotationStore],
  )
  const hasTextChanges = isEditing && content !== null && draft !== persistedMarkdownContent
  const hasChanges = isExcalidrawDoc ? (isEditing && hasExcalidrawChanges) : hasTextChanges
  const saveButtonLabel = saving ? 'Saving...' : manualSaveFeedbackVisible ? 'Saved' : 'Save'
  const saveButtonClassName = cn(
    'inline-flex items-center gap-1 border border-border/70 font-medium text-foreground transition-colors duration-200 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50',
    isIosPhone ? 'h-7 rounded-md px-2 text-[11px]' : 'rounded-lg px-2.5 py-1 text-xs',
    manualSaveFeedbackVisible && !saving
      ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-600'
      : 'bg-transparent',
  )
  const shouldPadViewerContent = !isEditing && !isExcalidrawDoc
  const showMiniNavRail = layout.mode === 'desktop' && !layout.isCapacitorNative
  const persistedFrontmatterSplit = useMemo(
    () => splitFrontmatter(persistedMarkdownContent),
    [persistedMarkdownContent],
  )
  const displayContent = useMemo(
    () => stripFrontmatter(persistedMarkdownContent),
    [persistedMarkdownContent],
  )
  const activeViewerMarkdownBody = useMemo(
    () => (viewerAnnotateMode && viewerAnnotateSessionBody !== null ? viewerAnnotateSessionBody : displayContent),
    [displayContent, viewerAnnotateMode, viewerAnnotateSessionBody],
  )
  const displayDraft = useMemo(
    () => stripFrontmatter(draft),
    [draft],
  )
  const frontmatterMetaSource = isEditing ? draft : persistedMarkdownContent
  const frontmatterMeta = useMemo(
    () => buildFrontmatterMetaState(frontmatterMetaSource),
    [frontmatterMetaSource],
  )
  const draftFrontmatter = useMemo(
    () => splitFrontmatter(draft).frontmatter,
    [draft],
  )
  const excalidrawEditorContent = useMemo(
    () => (draft || content || ''),
    [content, draft],
  )
  const setDraftFrontmatterYaml = useCallback((nextYamlText: string) => {
    setDraft((current) => {
      const { body } = splitFrontmatter(current)
      const nextFrontmatter = yamlTextToFrontmatterBlock(nextYamlText)
      return `${nextFrontmatter}${body}`
    })
  }, [])

  useEffect(() => {
    setFilenameDraft(filename)
    setRenameError(null)
    setRenaming(false)
    setIsHeaderRenameActive(false)
  }, [filename])

  useEffect(() => {
    if (isEditing) return
    setIsHeaderRenameActive(false)
  }, [isEditing])

  useEffect(() => {
    if (!isHeaderRenameActive) return
    const input = headerRenameInputRef.current
    if (!input) return
    input.focus()
    input.select()
  }, [isHeaderRenameActive])
  const applyStewardSuggestionToDraft = useCallback((suggestion: StewardMetadataSuggestion) => {
    setDraft((current) => {
      const { frontmatter, body } = splitFrontmatter(current)
      const next = parseFrontmatterObject(frontmatter)
      const now = new Date().toISOString()
      const summary = suggestion.summary.trim()
      const suggestionParent = suggestion.suggestedIdeaKey || suggestion.suggestedEpicKey
      const tags = suggestion.tags.map(tag => tag.trim()).filter(Boolean)

      next.tags = tags
      next.ai_summary = summary
      next.ai_generated = true
      next.last_ai_update = now
      next.updated_at = now
      const existingDescription = typeof next.description === 'string' ? next.description.trim() : ''
      if (!existingDescription && summary) next.description = summary

      const rawAiSuggestions = next.ai_suggestions
      const aiSuggestions = (
        rawAiSuggestions && typeof rawAiSuggestions === 'object' && !Array.isArray(rawAiSuggestions)
          ? { ...(rawAiSuggestions as Record<string, unknown>) }
          : {}
      )
      const related = Array.isArray(aiSuggestions.related)
        ? [...aiSuggestions.related]
        : []
      const relatedMap = new Map<string, { key: string; reason: string; score: number }>()
      for (const entry of related) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
        const key = typeof (entry as Record<string, unknown>).key === 'string'
          ? String((entry as Record<string, unknown>).key).trim()
          : ''
        if (!key) continue
        const reason = typeof (entry as Record<string, unknown>).reason === 'string'
          ? String((entry as Record<string, unknown>).reason)
          : 'Suggested related context'
        const scoreRaw = (entry as Record<string, unknown>).score
        const score = typeof scoreRaw === 'number' ? scoreRaw : 0.5
        relatedMap.set(key, { key, reason, score })
      }
      if (suggestion.suggestedEpicKey) {
        relatedMap.set(suggestion.suggestedEpicKey, {
          key: suggestion.suggestedEpicKey,
          reason: 'Suggested epic context',
          score: 0.6,
        })
      }
      if (suggestion.suggestedIdeaKey) {
        relatedMap.set(suggestion.suggestedIdeaKey, {
          key: suggestion.suggestedIdeaKey,
          reason: 'Suggested idea context',
          score: 0.8,
        })
      }

      aiSuggestions.related = [...relatedMap.values()]
      if (suggestionParent) {
        aiSuggestions.suggested_move = { parent: suggestionParent }
      } else {
        delete aiSuggestions.suggested_move
      }
      next.ai_suggestions = aiSuggestions

      return `${frontmatterObjectToBlock(next)}${body}`
    })
  }, [])
  const handleApplyStewardSuggestion = useCallback(async (suggestion: StewardMetadataSuggestion) => {
    if (frontmatterMeta.parseError) {
      throw new Error('Fix YAML parse errors before accepting this purpose proposal.')
    }
    applyStewardSuggestionToDraft(suggestion)
  }, [applyStewardSuggestionToDraft, frontmatterMeta.parseError])
  const markdownRemarkPlugins = useMemo(
    () => [remarkGfm, remarkObsidianWikilinksOrch, remarkMarkdownSourceSpansBlock],
    [],
  )
  const renderedViewMarkdown = useMemo(
    () => (
      editorSettings.preserveNewlinesInViewMode
        ? preserveExtraBlankLinesInMarkdown(viewMarkdown)
        : viewMarkdown
    ),
    [editorSettings.preserveNewlinesInViewMode, viewMarkdown],
  )

  type MarkdownAnchorProps = ComponentPropsWithoutRef<'a'> & { node?: unknown }
  type MarkdownParagraphProps = ComponentPropsWithoutRef<'p'> & { node?: unknown }
  type MarkdownImageProps = ComponentPropsWithoutRef<'img'> & { node?: unknown }
  type MarkdownHeadingProps = ComponentPropsWithoutRef<'h1'> & { node?: unknown }
  type MarkdownListItemProps = ComponentPropsWithoutRef<'li'> & { node?: unknown }
  type MarkdownBlockquoteProps = ComponentPropsWithoutRef<'blockquote'> & { node?: unknown }
  type MarkdownSpanProps = ComponentPropsWithoutRef<'span'> & { node?: unknown }

  async function openViewerAnnotationForBlockBlock(blockEndOffset: number | null) {
    if (blockEndOffset === null || annotationParseError) return
    const { frontmatter } = persistedFrontmatterSplit
    const body = activeViewerMarkdownBody
    const existingAnchorId = findMarkdownAnchorAfterOffsetBlock(body, blockEndOffset)
    if (existingAnchorId) {
      setActiveAnnotationAnchorId(existingAnchorId)
      setAnnotationSaveError(null)
      return
    }

    const anchorId = buildMarkdownAnchorIdBlock()
    const patch = insertMarkdownAnchorAfterBlockOffsetBlock(body, blockEndOffset, anchorId)
    const didSave = await persistViewerMarkdownContent(`${frontmatter}${patch.value}`)
    if (didSave) {
      setViewerAnnotateSessionBody(patch.value)
      setActiveAnnotationAnchorId(anchorId)
      setAnnotationSaveError(null)
    }
  }

  function renderViewerNoteActionBlock(blockEndOffset: number | null): ReactNode {
    if (!viewerAnnotateMode || blockEndOffset === null) return null
    const existingAnchorId = findMarkdownAnchorAfterOffsetBlock(activeViewerMarkdownBody, blockEndOffset)
    return (
      <div className="mt-1 flex justify-end">
        <button
          type="button"
          onClick={() => { void openViewerAnnotationForBlockBlock(blockEndOffset) }}
          disabled={annotationSaving || !!annotationParseError}
          className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-background/70 px-2 py-1 text-[11px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Pencil className="h-3 w-3" />
          {existingAnchorId ? 'Edit note' : 'Add note'}
        </button>
      </div>
    )
  }

  function resolveViewerHighlightRangeFromPointBlock(clientX: number, clientY: number): {
    offset: number
    blockElement: HTMLElement
  } | null {
    const root = markdownViewRootRef.current
    if (!root) return null
    const caret = getCaretAtClientPointBlock(clientX, clientY)
    if (!caret) return null
    if (!root.contains(caret.node)) return null
    const blockElement = findClosestElementBlock(caret.node, '[data-md-selectable-block="true"]')
    const spanElement = findClosestElementBlock(caret.node, '[data-md-source-start]')
    if (!blockElement || !spanElement) return null
    const rawOffset = resolveRawMarkdownOffsetFromSpanBlock(spanElement, caret.node, caret.offset)
    if (rawOffset === null) return null
    return {
      offset: rawOffset,
      blockElement,
    }
  }

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

            const resolvedPath = resolved.path ?? await resolveWikilinkAssetTargetOrch({
              currentPath: path,
              target: parsed.target,
            })

            if (!resolvedPath) {
              setNavigationError(`Linked file not found: [[${parsed.target}]]`)
              return
            }

            if (resolvedPath === path) return
            if (openInNewTab) {
              openFileInNewTabOrch(resolvedPath)
              setNavigationError(null)
              return
            }

            if (!openLinkedPath) {
              setNavigationError('Linked file navigation is unavailable in this view.')
              return
            }

            openLinkedPath(resolvedPath)
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
    p: ({ children, node, ...props }: MarkdownParagraphProps) => {
      const text = extractTextFromNode(children).replace(/\u00a0/g, ' ').trim()
      if (isBlankLineMarkerText(text)) {
        return <div className="ltm-markdown-blank-line" aria-hidden="true" />
      }
      const anchorId = parseMarkdownAnchorIdBlock(text)
      if (anchorId) {
        return (
          <MarkdownAnchorAnnotationBlock
            anchorId={anchorId}
            annotation={getMarkdownAnchorAnnotationBlock(annotationStore, anchorId)}
            disabled={!!annotationParseError}
            disabledReason={annotationParseError ? 'Fix the annotation block JSON before adding or editing notes.' : null}
            hideWhenEmpty={!viewerAnnotateMode}
            onOpenEditor={(nextAnchorId) => {
              setActiveAnnotationAnchorId(nextAnchorId)
              setAnnotationSaveError(null)
            }}
          />
        )
      }
      const blockEndOffset = readMarkdownNodeEndOffsetBlock(node)
      return (
        <div>
          <p {...props} data-md-selectable-block="true">{children}</p>
          {renderViewerNoteActionBlock(blockEndOffset)}
        </div>
      )
    },
    h1: ({ children, node, ...props }: MarkdownHeadingProps) => {
      const blockEndOffset = readMarkdownNodeEndOffsetBlock(node)
      return (
        <div>
          <h1 {...props} data-md-selectable-block="true">{children}</h1>
          {renderViewerNoteActionBlock(blockEndOffset)}
        </div>
      )
    },
    h2: ({ children, node, ...props }: MarkdownHeadingProps) => {
      const blockEndOffset = readMarkdownNodeEndOffsetBlock(node)
      return (
        <div>
          <h2 {...props} data-md-selectable-block="true">{children}</h2>
          {renderViewerNoteActionBlock(blockEndOffset)}
        </div>
      )
    },
    h3: ({ children, node, ...props }: MarkdownHeadingProps) => {
      const blockEndOffset = readMarkdownNodeEndOffsetBlock(node)
      return (
        <div>
          <h3 {...props} data-md-selectable-block="true">{children}</h3>
          {renderViewerNoteActionBlock(blockEndOffset)}
        </div>
      )
    },
    h4: ({ children, node, ...props }: MarkdownHeadingProps) => {
      const blockEndOffset = readMarkdownNodeEndOffsetBlock(node)
      return (
        <div>
          <h4 {...props} data-md-selectable-block="true">{children}</h4>
          {renderViewerNoteActionBlock(blockEndOffset)}
        </div>
      )
    },
    h5: ({ children, node, ...props }: MarkdownHeadingProps) => {
      const blockEndOffset = readMarkdownNodeEndOffsetBlock(node)
      return (
        <div>
          <h5 {...props} data-md-selectable-block="true">{children}</h5>
          {renderViewerNoteActionBlock(blockEndOffset)}
        </div>
      )
    },
    h6: ({ children, node, ...props }: MarkdownHeadingProps) => {
      const blockEndOffset = readMarkdownNodeEndOffsetBlock(node)
      return (
        <div>
          <h6 {...props} data-md-selectable-block="true">{children}</h6>
          {renderViewerNoteActionBlock(blockEndOffset)}
        </div>
      )
    },
    li: ({ children, ...props }: MarkdownListItemProps) => <li {...props} data-md-selectable-block="true">{children}</li>,
    blockquote: ({ children, node, ...props }: MarkdownBlockquoteProps) => {
      const blockEndOffset = readMarkdownNodeEndOffsetBlock(node)
      return (
        <div>
          <blockquote {...props} data-md-selectable-block="true">{children}</blockquote>
          {renderViewerNoteActionBlock(blockEndOffset)}
        </div>
      )
    },
    span: ({ children, ...props }: MarkdownSpanProps) => {
      const dataProps = props as MarkdownSpanProps & {
        'data-md-source-start'?: string | number
        'data-md-source-end'?: string | number
      }
      const sourceStart = Number(dataProps['data-md-source-start'] ?? '')
      const sourceEnd = Number(dataProps['data-md-source-end'] ?? '')
      if (typeof children === 'string' && Number.isFinite(sourceStart) && Number.isFinite(sourceEnd)) {
        return (
          <span {...props}>
            {renderHighlightedSourceSpanBlock(children, sourceStart, `span-${sourceStart}`, viewerHighlightPresets)}
          </span>
        )
      }
      return <span {...props}>{children}</span>
    },
    img: ({ src, alt }: MarkdownImageProps) => (
      <MarkdownWikilinkImageBlock
        src={src}
        alt={alt}
        currentPath={path}
      />
    ),
  }), [activeViewerMarkdownBody, annotationParseError, annotationSaving, annotationStore, content, openLinkedPath, path, viewerAnnotateMode, viewerHighlightPresets])

  const clearViewerHighlightSelection = useCallback(() => {
    setViewerHighlightSelection(null)
    setViewerExistingHighlightTarget(null)
    setViewerHighlightError(null)
  }, [])

  const captureViewerHighlightSelection = useCallback(() => {
    if (isEditing || isExcalidrawDoc || pendingFullRender || viewerHighlightSaving) return
    if (Date.now() < viewerSuppressSelectionCaptureUntilRef.current) return
    const root = markdownViewRootRef.current
    const selection = window.getSelection()
    if (!root || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
      clearViewerHighlightSelection()
      return
    }

    const range = selection.getRangeAt(0)
    const selectedText = selection.toString()
    if (!selectedText.trim()) {
      clearViewerHighlightSelection()
      return
    }

    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
      clearViewerHighlightSelection()
      return
    }

    const startBlock = findClosestElementBlock(range.startContainer, '[data-md-selectable-block="true"]')
    const endBlock = findClosestElementBlock(range.endContainer, '[data-md-selectable-block="true"]')
    if (!startBlock || !endBlock || startBlock !== endBlock) {
      clearViewerHighlightSelection()
      return
    }

    const startSpan = findClosestElementBlock(range.startContainer, '[data-md-source-start]')
    const endSpan = findClosestElementBlock(range.endContainer, '[data-md-source-start]')
    if (!startSpan || !endSpan) {
      clearViewerHighlightSelection()
      return
    }

    const startRawOffset = resolveRawMarkdownOffsetFromSpanBlock(startSpan, range.startContainer, range.startOffset)
    const endRawOffset = resolveRawMarkdownOffsetFromSpanBlock(endSpan, range.endContainer, range.endOffset)
    if (startRawOffset === null || endRawOffset === null) {
      clearViewerHighlightSelection()
      return
    }

    const start = Math.min(startRawOffset, endRawOffset)
    const end = Math.max(startRawOffset, endRawOffset)
    if (end <= start) {
      clearViewerHighlightSelection()
      return
    }

    const rect = range.getBoundingClientRect()
    const nextSelection = {
      start,
      end,
      text: selectedText,
      top: rect.top + window.scrollY - 44,
      left: rect.left + window.scrollX + (rect.width / 2),
    }

    setViewerHighlightSelection(nextSelection)
    setViewerExistingHighlightTarget(null)
  }, [
    clearViewerHighlightSelection,
    isEditing,
    isExcalidrawDoc,
    pendingFullRender,
    viewerHighlightSaving,
  ])

  useEffect(() => {
    if (viewerAnnotateMode) return
    viewerPencilHighlightGestureRef.current = null
    clearViewerHighlightSelection()
  }, [clearViewerHighlightSelection, viewerAnnotateMode])

  useEffect(() => {
    if (!viewerAnnotateMode || isEditing || isExcalidrawDoc || pendingFullRender) return undefined
    let cancelled = false
    void subscribeNativePencilBridgeOrch({
      onMetrics: (event) => {
        const clientX = event.locationX
        const clientY = event.locationY
        if (typeof clientX !== 'number' || typeof clientY !== 'number') return
        if (event.phase === 'began') {
          viewerSuppressSelectionCaptureUntilRef.current = Date.now() + 600
          const start = resolveViewerHighlightRangeFromPointBlock(clientX, clientY)
          viewerPencilHighlightGestureRef.current = start ? {
            start: start.offset,
            end: start.offset,
            blockElement: start.blockElement,
          } : null
          return
        }

        const point = resolveViewerHighlightRangeFromPointBlock(clientX, clientY)
        const gesture = viewerPencilHighlightGestureRef.current
        if (!gesture) {
          if (point && event.phase === 'moved') {
            viewerPencilHighlightGestureRef.current = {
              start: point.offset,
              end: point.offset,
              blockElement: point.blockElement,
            }
          }
          if (event.phase === 'ended' || event.phase === 'cancelled') {
            viewerPencilHighlightGestureRef.current = null
          }
          return
        }
        if (point && point.blockElement === gesture.blockElement) {
          gesture.end = point.offset
        }

        if (event.phase === 'ended' || event.phase === 'cancelled') {
          viewerSuppressSelectionCaptureUntilRef.current = Date.now() + 300
          const completed = viewerPencilHighlightGestureRef.current
          viewerPencilHighlightGestureRef.current = null
          if (!completed) return
          const start = Math.min(completed.start, completed.end)
          const end = Math.max(completed.start, completed.end)
          if (end <= start) return
          void applyViewerHighlightRangeBlock(start, end, activeViewerHighlightPresetId ?? undefined)
        }
      },
    })
      .then((subscription) => {
        if (!subscription) return
        if (cancelled) {
          void subscription.stop()
          return
        }
        viewerPencilBridgeStopRef.current = () => subscription.stop()
      })
      .catch(() => {})

    return () => {
      cancelled = true
      viewerPencilHighlightGestureRef.current = null
      const stop = viewerPencilBridgeStopRef.current
      viewerPencilBridgeStopRef.current = null
      if (stop) void stop()
    }
  }, [
    activeViewerHighlightPresetId,
    isEditing,
    isExcalidrawDoc,
    pendingFullRender,
    viewerAnnotateMode,
  ])

  useEffect(() => {
    if (!hasChanges || !manualSaveFeedbackVisible) return
    setManualSaveFeedbackVisible(false)
  }, [hasChanges, manualSaveFeedbackVisible])

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
      createdAt: formatUnixTimestampForMeta(baseCtime),
      updatedAt: formatUnixTimestampForMeta(baseMtime),
    })

    if (!showMeta) return

    let cancelled = false
    const cancelDeferred = scheduleDeferredWork(() => {
      if (cancelled) return
      setMeta({
        lines: persistedMarkdownContent.split('\n').length,
        words: persistedMarkdownContent.split(/\s+/).filter(Boolean).length,
        headings: (persistedMarkdownContent.match(/^#{1,6}\s/gm) || []).length,
        size: formatBytes(sizeBytes),
        createdAt: formatUnixTimestampForMeta(baseCtime),
        updatedAt: formatUnixTimestampForMeta(baseMtime),
      })
    })

    return () => {
      cancelled = true
      cancelDeferred()
    }
  }, [baseCtime, baseMtime, content, persistedMarkdownContent, showMeta, sizeBytes])

  useEffect(() => {
    if (content === null || isEditing || isExcalidrawDoc) {
      setPendingFullRender(false)
      setViewMarkdown(activeViewerMarkdownBody)
      return
    }

    if (activeViewerMarkdownBody.length <= DEFERRED_RENDER_CHARS) {
      setPendingFullRender(false)
      setViewMarkdown(activeViewerMarkdownBody)
      return
    }

    let cancelled = false
    setViewMarkdown(activeViewerMarkdownBody.slice(0, DEFERRED_RENDER_CHARS))
    setPendingFullRender(true)
    const cancelDeferred = scheduleDeferredWork(() => {
      if (cancelled) return
      setViewMarkdown(activeViewerMarkdownBody)
      setPendingFullRender(false)
    })

    return () => {
      cancelled = true
      cancelDeferred()
    }
  }, [activeViewerMarkdownBody, content, isEditing, isExcalidrawDoc, path])

  const handleExcalidrawSceneChange = useCallback((scene: ParsedExcalidrawScene) => {
    if (!isIosSurface) {
      excalidrawSceneRef.current = scene
    }

    if (ignoreInitialExcalidrawChangeRef.current) {
      ignoreInitialExcalidrawChangeRef.current = false
      return
    }

    setHasExcalidrawChanges(true)
  }, [isIosSurface])

  const handleExcalidrawApiChange = useCallback((api: ExcalidrawCanvasApiOrch | null) => {
    excalidrawApiRef.current = api
    if (!isExcalidrawDoc) return
    preserveExcalidrawCrashMarkerOnUnmountRef.current = true
    if (excalidrawCrashMarkerClearTimeoutRef.current !== null) {
      window.clearTimeout(excalidrawCrashMarkerClearTimeoutRef.current)
      excalidrawCrashMarkerClearTimeoutRef.current = null
    }
    if (!api) {
      markExcalidrawCrashStageBlock(path, 'editor_mounting')
      return
    }
    markExcalidrawCrashStageBlock(path, 'api_attached')
    excalidrawCrashMarkerClearTimeoutRef.current = window.setTimeout(() => {
      preserveExcalidrawCrashMarkerOnUnmountRef.current = false
      clearExcalidrawCrashMarkerBlock()
      excalidrawCrashMarkerClearTimeoutRef.current = null
    }, 2500)
  }, [isExcalidrawDoc, path])

  const revertMarkdownToEditBaseline = useCallback(async () => {
    if (markdownCancelRevertInFlightRef.current) return
    const baseline = markdownEditBaselineRef.current
    if (!baseline || isExcalidrawDoc) return

    markdownCancelRevertInFlightRef.current = true
    try {
      let attempts = 0
      while (markdownSaveInFlightRef.current && attempts < 800) {
        await new Promise<void>((resolve) => {
          window.setTimeout(() => resolve(), 25)
        })
        attempts += 1
      }

      const latestBaseline = markdownEditBaselineRef.current
      if (!latestBaseline) return

      const current = await readMarkdownDocument(path)
      if (current.content === latestBaseline.content) {
        setContent(current.content)
        setBaseMtime(current.mtime)
        setBaseCtime(current.ctime)
        setBaseHash(current.hash)
        setSizeBytes(current.size)
        setDraft('')
        return
      }

      const result = await saveMarkdownDocument({
        path,
        content: latestBaseline.content,
        baseMtime: current.mtime,
        baseHash: current.hash,
        baseContent: current.content,
      })
      setContent(latestBaseline.content)
      setBaseMtime(result.mtime)
      setBaseCtime(result.ctime)
      setBaseHash(result.hash)
      setSizeBytes(result.size)
      setDraft('')
      setNavigationError(null)
      setSaveError(null)
      setConflict(null)
    } catch (err) {
      setNavigationError(err instanceof Error ? `Cancel restore failed: ${err.message}` : 'Cancel restore failed.')
    } finally {
      markdownCancelRevertInFlightRef.current = false
    }
  }, [isExcalidrawDoc, path])

  const startEditing = () => {
    if (loading || error) return
    if (isExcalidrawDoc) {
      preserveExcalidrawCrashMarkerOnUnmountRef.current = true
      markExcalidrawCrashStageBlock(path, 'edit_requested')
    }
    setViewerHighlightSelection(null)
    setViewerExistingHighlightTarget(null)
    setViewerHighlightError(null)
    setViewerAnnotateSessionBody(null)
    setViewerAnnotateMode(false)
    setMode('edit')
    setDraft(isExcalidrawDoc ? '' : persistedMarkdownContent)
    markdownEditBaselineRef.current = isExcalidrawDoc
      ? null
      : { content: content ?? '' }
    setShowAiPanel(false)
    setSaveError(null)
    setNavigationError(null)
    setConflict(null)
    setHasExcalidrawChanges(false)
    setExcalidrawImmersive(isExcalidrawDoc)
    excalidrawSceneRef.current = null
    excalidrawApiRef.current = null
    ignoreInitialExcalidrawChangeRef.current = true
  }

  const cancelEditing = () => {
    if (excalidrawCrashMarkerClearTimeoutRef.current !== null) {
      window.clearTimeout(excalidrawCrashMarkerClearTimeoutRef.current)
      excalidrawCrashMarkerClearTimeoutRef.current = null
    }
    preserveExcalidrawCrashMarkerOnUnmountRef.current = false
    clearExcalidrawCrashMarkerBlock()
    setMode('view')
    setSaveError(null)
    setConflict(null)
    setShowAiPanel(false)
    setAutoSaving(false)
    setNavigationError(null)
    setViewerHighlightSelection(null)
    setViewerExistingHighlightTarget(null)
    setViewerAnnotateSessionBody(null)
    setHasExcalidrawChanges(false)
    setExcalidrawImmersive(false)
    excalidrawSceneRef.current = null
    ignoreInitialExcalidrawChangeRef.current = true
    if (!isExcalidrawDoc) {
      void revertMarkdownToEditBaseline()
    }
  }

  const useLatestConflictVersion = () => {
    if (!conflict) return
    preserveExcalidrawCrashMarkerOnUnmountRef.current = false
    clearExcalidrawCrashMarkerBlock()
    setContent(conflict.currentContent)
    setDraft(isExcalidrawDoc ? '' : splitMarkdownAnnotationDocumentBlock(conflict.currentContent).body)
    setBaseMtime(conflict.currentMtime)
    setBaseHash(conflict.currentHash)
    setSaveError(null)
    setConflict(null)
    setHasExcalidrawChanges(false)
    setExcalidrawImmersive(false)
    excalidrawSceneRef.current = null
    ignoreInitialExcalidrawChangeRef.current = true
  }

  const saveMarkdownDraft = useCallback(async (_reason: 'auto' | 'manual' = 'manual'): Promise<boolean> => {
    if (markdownSaveInFlightRef.current) return markdownSavePromiseRef.current ?? false
    if (isExcalidrawDoc || content === null || baseMtime === null) return false
    const draftToSave = draft
    const rawDraftToSave = composeMarkdownAnnotationDocumentBlock(draftToSave, annotationStore, {
      preserveRawFenceBlock: annotationRawFenceBlock,
      preserveParseError: annotationParseError,
    })
    if (rawDraftToSave === content) return true

    const savePromise = (async () => {
      markdownSaveInFlightRef.current = true
      setSaveError(null)
      setConflict(null)
      try {
        const result = await saveMarkdownDocument({
          path,
          content: rawDraftToSave,
          baseMtime,
          baseHash,
          baseContent: content,
        })
        setContent(rawDraftToSave)
        setBaseMtime(result.mtime)
        setBaseCtime(result.ctime)
        setBaseHash(result.hash)
        setSizeBytes(result.size)
        // Keep cancel baseline aligned with the latest persisted draft, including auto-saves.
        markdownEditBaselineRef.current = { content: rawDraftToSave }
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
        markdownSavePromiseRef.current = null
      }
    })()

    markdownSavePromiseRef.current = savePromise
    return savePromise
  }, [annotationParseError, annotationRawFenceBlock, annotationStore, baseHash, baseMtime, content, draft, isExcalidrawDoc, onSaved, path])

  const persistAnnotationStore = useCallback(async (
    nextStore: MarkdownAnnotationStoreBlock,
  ): Promise<boolean> => {
    if (isExcalidrawDoc || content === null || baseMtime === null) return false
    if (annotationParseError) {
      setAnnotationSaveError(`Annotation block is invalid: ${annotationParseError}`)
      return false
    }

    const nextContent = composeMarkdownAnnotationDocumentBlock(persistedMarkdownContent, nextStore, {
      preserveRawFenceBlock: annotationRawFenceBlock,
      preserveParseError: annotationParseError,
    })

    if (nextContent === content) {
      setAnnotationSaveError(null)
      return true
    }

    setAnnotationSaving(true)
    setAnnotationSaveError(null)
    try {
      const result = await saveMarkdownDocument({
        path,
        content: nextContent,
        baseMtime,
        baseHash,
        baseContent: content,
      })
      setContent(nextContent)
      setBaseMtime(result.mtime)
      setBaseCtime(result.ctime)
      setBaseHash(result.hash)
      setSizeBytes(result.size)
      markdownEditBaselineRef.current = { content: nextContent }
      onSaved?.(result)
      return true
    } catch (err) {
      if (err instanceof MarkdownDocumentConflictError) {
        setConflict(err)
        setAnnotationSaveError(err.message)
      } else {
        setAnnotationSaveError(err instanceof Error ? err.message : 'Failed to save annotation')
      }
      return false
    } finally {
      setAnnotationSaving(false)
    }
  }, [annotationParseError, annotationRawFenceBlock, baseHash, baseMtime, content, isExcalidrawDoc, onSaved, path, persistedMarkdownContent])

  const handleSaveAnnotation = useCallback(async (
    anchorId: string,
    draftAnnotation: {
      text: string
      transcript: string
      ocrText: string
      ocrStatus: MarkdownAnchorAnnotationModelBlock['ocrStatus']
      ocrUpdatedAt: string | null
      strokes: MarkdownAnchorAnnotationModelBlock['strokes']
    },
  ) => {
    const now = new Date().toISOString()
    const existing = getMarkdownAnchorAnnotationBlock(annotationStore, anchorId)
    const nextAnnotation: MarkdownAnchorAnnotationModelBlock = {
      id: existing?.id ?? buildMarkdownAnnotationIdBlock(),
      anchorId,
      text: draftAnnotation.text,
      transcript: draftAnnotation.transcript,
      ocrText: draftAnnotation.ocrText,
      ocrStatus: draftAnnotation.ocrStatus,
      ocrUpdatedAt: draftAnnotation.ocrUpdatedAt,
      strokes: draftAnnotation.strokes,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    const didSave = await persistAnnotationStore(upsertMarkdownAnchorAnnotationBlock(annotationStore, nextAnnotation))
    if (didSave) {
      setActiveAnnotationAnchorId(null)
      setAnnotationSaveError(null)
    }
  }, [annotationStore, persistAnnotationStore])

  const handleDeleteAnnotation = useCallback(async () => {
    if (!activeAnnotationAnchorId) return
    const didSave = await persistAnnotationStore(removeMarkdownAnchorAnnotationBlock(annotationStore, activeAnnotationAnchorId))
    if (didSave) {
      setActiveAnnotationAnchorId(null)
      setAnnotationSaveError(null)
    }
  }, [activeAnnotationAnchorId, annotationStore, persistAnnotationStore])

  const persistViewerMarkdownContent = useCallback(async (nextPersistedMarkdownContent: string): Promise<boolean> => {
    if (isExcalidrawDoc || content === null || baseMtime === null) return false
    const nextContent = composeMarkdownAnnotationDocumentBlock(nextPersistedMarkdownContent, annotationStore, {
      preserveRawFenceBlock: annotationRawFenceBlock,
      preserveParseError: annotationParseError,
    })
    if (nextContent === content) return true

    setViewerHighlightSaving(true)
    setViewerHighlightError(null)
    try {
      const result = await saveMarkdownDocument({
        path,
        content: nextContent,
        baseMtime,
        baseHash,
        baseContent: content,
      })
      setContent(nextContent)
      setBaseMtime(result.mtime)
      setBaseCtime(result.ctime)
      setBaseHash(result.hash)
      setSizeBytes(result.size)
      markdownEditBaselineRef.current = { content: nextContent }
      onSaved?.(result)
      return true
    } catch (err) {
      if (err instanceof MarkdownDocumentConflictError) {
        setConflict(err)
        setViewerHighlightError(err.message)
      } else {
        setViewerHighlightError(err instanceof Error ? err.message : 'Failed to save highlight')
      }
      return false
    } finally {
      setViewerHighlightSaving(false)
    }
  }, [annotationParseError, annotationRawFenceBlock, annotationStore, baseHash, baseMtime, content, isExcalidrawDoc, onSaved, path])

  async function applyViewerHighlightRangeBlock(
    start: number,
    end: number,
    presetIdOverride?: string,
  ) {
    if (end <= start) return false
    const nextBody = insertMarkdownHighlightAtRangeBlock(
      activeViewerMarkdownBody,
      start,
      end,
      presetIdOverride ?? activeViewerHighlightPresetId,
    )
    setViewerAnnotateSessionBody(nextBody)
    setViewerHighlightSelection(null)
    setViewerExistingHighlightTarget(null)
    setViewerHighlightError(null)
    window.getSelection()?.removeAllRanges()
    return true
  }

  const handleApplyViewerHighlight = useCallback(async (presetIdOverride?: string) => {
    if (viewerExistingHighlightTarget) {
      const nextBody = updateMarkdownHighlightPresetByVisibleOffsetBlock(
        activeViewerMarkdownBody,
        viewerExistingHighlightTarget.offset,
        presetIdOverride ?? activeViewerHighlightPresetId ?? null,
      )
      setViewerAnnotateSessionBody(nextBody)
      setViewerExistingHighlightTarget((current) => current ? {
        ...current,
        presetId: presetIdOverride ?? activeViewerHighlightPresetId ?? null,
      } : null)
      setViewerHighlightSelection(null)
      setViewerHighlightError(null)
      return
    }
    if (!viewerHighlightSelection) return
    await applyViewerHighlightRangeBlock(
      viewerHighlightSelection.start,
      viewerHighlightSelection.end,
      presetIdOverride ?? activeViewerHighlightPresetId ?? undefined,
    )
  }, [activeViewerHighlightPresetId, activeViewerMarkdownBody, viewerExistingHighlightTarget, viewerHighlightSelection])

  const handleRemoveExistingViewerHighlight = useCallback(() => {
    if (!viewerExistingHighlightTarget) return
    const nextBody = removeMarkdownHighlightByVisibleOffsetBlock(
      activeViewerMarkdownBody,
      viewerExistingHighlightTarget.offset,
    )
    setViewerAnnotateSessionBody(nextBody)
    setViewerExistingHighlightTarget(null)
    setViewerHighlightSelection(null)
    setViewerHighlightError(null)
  }, [activeViewerMarkdownBody, viewerExistingHighlightTarget])

  const toggleViewerAnnotateMode = useCallback(async () => {
    if (viewerHighlightSaving) return
    if (!viewerAnnotateMode) {
      setViewerAnnotateSessionBody(displayContent)
      setViewerAnnotateMode(true)
      setViewerHighlightSelection(null)
      setViewerExistingHighlightTarget(null)
      setViewerHighlightError(null)
      setShowMeta(false)
      return
    }

    const nextBody = viewerAnnotateSessionBody ?? displayContent
    if (nextBody !== displayContent) {
      const didSave = await persistViewerMarkdownContent(`${persistedFrontmatterSplit.frontmatter}${nextBody}`)
      if (!didSave) return
    }
    setViewerAnnotateMode(false)
    setViewerAnnotateSessionBody(null)
    setViewerHighlightSelection(null)
    setViewerExistingHighlightTarget(null)
    setViewerHighlightError(null)
    window.getSelection()?.removeAllRanges()
  }, [
    displayContent,
    persistedFrontmatterSplit.frontmatter,
    persistViewerMarkdownContent,
    viewerAnnotateMode,
    viewerAnnotateSessionBody,
    viewerHighlightSaving,
  ])

  const handleSave = async () => {
    if (baseMtime === null) return
    if (!isExcalidrawDoc) {
      setSaving(true)
      const didSave = await saveMarkdownDraft('manual')
      setSaving(false)
      if (didSave) triggerManualSaveFeedback()
      return
    }
    if (!hasChanges) return

    let didSave = false
    setSaving(true)
    setSaveError(null)
    setConflict(null)

    try {
      if (content === null) return
      const sceneForSave = excalidrawSceneRef.current ?? (() => {
        const api = excalidrawApiRef.current
        if (!api) return null
        return {
          elements: api.getSceneElementsBlock() as unknown[],
          appState: api.getAppStateBlock(),
          files: api.getFilesBlock(),
        } satisfies ParsedExcalidrawScene
      })()
      if (!sceneForSave) return
      await yieldToNextFrame()
      const contentToSave = serializeExcalidrawSceneOrch(content, sceneForSave)
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
      setBaseCtime(reloaded.ctime)
      setBaseHash(reloaded.hash)
      setSizeBytes(reloaded.size)
      setHasExcalidrawChanges(false)
      excalidrawSceneRef.current = null
      preserveExcalidrawCrashMarkerOnUnmountRef.current = false
      clearExcalidrawCrashMarkerBlock()
      ignoreInitialExcalidrawChangeRef.current = true
      onSaved?.(result)
      didSave = true
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
    if (didSave) triggerManualSaveFeedback()
  }
  handleSaveRef.current = handleSave

  const commitHeaderRename = useCallback(async () => {
    if (!isEditing || !canRenameInHeader || renaming) return
    const nextName = filenameDraft.trim()
    if (!nextName || nextName === filename) {
      setFilenameDraft(filename)
      setIsHeaderRenameActive(false)
      return
    }

    setRenaming(true)
    setRenameError(null)
    try {
      const nextPath = await renameVaultPathOrch(path, nextName)
      setFilenameDraft(nextPath.split('/').pop() || nextPath)
      setIsHeaderRenameActive(false)
      dispatchGlobalSyncRefreshBlock({ source: 'unknown', requestedAt: Date.now(), vaultSyncAttempted: false, vaultSyncSucceeded: false })
      if (onOpenPathForEdit) onOpenPathForEdit(nextPath)
      else if (onOpenPath) onOpenPath(nextPath)
    } catch (err) {
      setFilenameDraft(filename)
      setRenameError(err instanceof Error ? err.message : 'Failed to rename file')
    } finally {
      setRenaming(false)
    }
  }, [canRenameInHeader, filename, filenameDraft, isEditing, onOpenPath, onOpenPathForEdit, path, renaming])

  const startHeaderRename = useCallback(() => {
    if (!isEditing || !canRenameInHeader || renaming) return
    setFilenameDraft(filename)
    setRenameError(null)
    setIsHeaderRenameActive(true)
  }, [canRenameInHeader, filename, isEditing, renaming])

  useEffect(() => {
    if (!autoSaveEnabled) return
    if (!isEditing || isExcalidrawDoc || loading || error || baseMtime === null) return
    if (!hasTextChanges || saving || autoSaving || conflict) return

    const timeoutId = window.setTimeout(() => {
      setAutoSaving(true)
      void saveMarkdownDraft('auto').finally(() => {
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

  useEffect(() => {
    if (!autoSaveEnabled) return
    if (!isEditing || !isExcalidrawDoc || loading || error || baseMtime === null) return
    if (!hasExcalidrawChanges || saving || conflict) return

    const timeoutId = window.setTimeout(() => {
      void handleSaveRef.current()
    }, 2000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    autoSaveEnabled,
    baseMtime,
    conflict,
    error,
    hasExcalidrawChanges,
    isEditing,
    isExcalidrawDoc,
    loading,
    saving,
  ])


  const handleOpenInSystem = useCallback(() => {
    if (!canOpenInSystem) return
    setNavigationError(null)
    void openVaultPathInSystemOrch(path).catch((err) => {
      setNavigationError(err instanceof Error ? err.message : 'Failed to open file in system file manager')
    })
  }, [canOpenInSystem, path])

  return (
    <div
      className={cn('flex h-full min-h-0 flex-col bg-card p-2', className)}
      data-prevent-sheet-escape={isEditing ? 'true' : undefined}
    >
      <div className="relative min-h-0 flex-1">
        <div
          ref={contentScrollRef}
          className={cn(
            'relative h-full min-h-0 p-0',
            isExcalidrawDoc && !isEditing ? 'flex flex-col overflow-hidden' : (isExcalidrawDoc ? 'overflow-hidden' : 'overflow-y-auto'),
          )}
        >
          <div ref={chromeContainerRef} className={cn(hideTopBarInView && 'hidden')}>
            <div className={cn(
              'ts-md-header ts-doc-header flex items-start justify-between gap-3 border-b border-border/50',
              isIosPhone ? 'flex-col items-stretch px-4 py-3.5' : 'px-6 py-5',
            )}>
              <div className={cn('min-w-0 flex-1', isIosPhone && 'w-full')}>
                <div className="flex w-full min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {isEditing && canRenameInHeader && isHeaderRenameActive ? (
                    <input
                      ref={headerRenameInputRef}
                      type="text"
                      value={filenameDraft}
                      onChange={(event) => {
                        setFilenameDraft(event.target.value)
                        if (renameError) setRenameError(null)
                      }}
                      onBlur={() => { void commitHeaderRename() }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          void commitHeaderRename()
                          return
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault()
                          setFilenameDraft(filename)
                          setRenameError(null)
                          setIsHeaderRenameActive(false)
                        }
                      }}
                      disabled={renaming || saving}
                      className="h-8 min-w-0 flex-1 appearance-none border-0 bg-transparent px-0 text-sm font-medium shadow-none outline-none ring-0 focus:border-0 focus:bg-transparent focus:shadow-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 disabled:opacity-60"
                      aria-label="File name"
                    />
                  ) : isEditing && canRenameInHeader ? (
                    <button
                      type="button"
                      onClick={startHeaderRename}
                      className="min-w-0 flex-1 truncate text-left font-medium"
                      title="Rename file"
                    >
                      {filename}
                    </button>
                  ) : (
                    <span className="truncate font-medium">{filename}</span>
                  )}
                </div>
                {breadcrumb && (
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">{breadcrumb}</div>
                )}
                {renameError && (
                  <div className="mt-1 truncate text-xs text-destructive">{renameError}</div>
                )}
              </div>

              <div className={cn(
                'flex shrink-0 items-center gap-1',
                isIosPhone && 'w-full min-w-0 flex-wrap justify-start gap-1.5',
              )}>
                {!viewerAnnotateMode && (
                  <InfoPanelToggleButtonBlock active={showMeta} onToggle={() => setShowMeta(v => !v)} />
                )}

                {!isEditing && !isExcalidrawDoc && (
                  <button
                    type="button"
                    onClick={() => { void toggleViewerAnnotateMode() }}
                    disabled={loading || !!error || viewerHighlightSaving}
                    className={cn(
                      'rounded-lg p-1.5 disabled:cursor-not-allowed disabled:opacity-50',
                      viewerAnnotateMode ? 'bg-amber-100 text-amber-900 hover:bg-amber-200' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                    title={viewerAnnotateMode ? 'Exit annotation mode' : 'Enter annotation mode'}
                  >
                    <MarkupToolIconBlock className="h-4 w-4" />
                  </button>
                )}

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
                      className={cn(
                        'font-medium transition-colors',
                        isIosPhone ? 'h-7 rounded-md px-2 text-[11px]' : 'rounded-lg px-2 py-1 text-xs',
                        autoSaveEnabled ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                      title="Toggle auto save"
                    >
                      {autoSaveEnabled ? 'Auto-save On' : 'Auto-save Off'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className={cn(
                        'border border-border font-medium hover:bg-muted',
                        isIosPhone ? 'h-7 rounded-md px-2 text-[11px]' : 'rounded-lg px-2.5 py-1 text-xs',
                      )}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => { void handleSave() }}
                      disabled={saving || baseMtime === null}
                      className={saveButtonClassName}
                    >
                      <Save className="h-3.5 w-3.5" />
                      {saveButtonLabel}
                    </button>
                  </>
                )}

                {isEditing && isExcalidrawDoc && (
                  <>
                    <button
                      type="button"
                      onClick={() => setAutoSaveEnabled(v => !v)}
                      className={cn(
                        'font-medium transition-colors',
                        isIosPhone ? 'h-7 rounded-md px-2 text-[11px]' : 'rounded-lg px-2 py-1 text-xs',
                        autoSaveEnabled ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                      title="Toggle auto save"
                    >
                      {autoSaveEnabled ? 'Auto-save On' : 'Auto-save Off'}
                    </button>
                    <span className="hidden px-1 text-xs text-muted-foreground md:inline">
                      {hasChanges ? 'Unsaved changes' : 'No changes'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setExcalidrawImmersive(v => !v)}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
                    >
                      {excalidrawImmersive ? 'Exit Focus' : 'Focus Canvas'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => { void handleSave() }}
                      disabled={!hasChanges || saving || baseMtime === null}
                      className={saveButtonClassName}
                    >
                      <Save className="h-3.5 w-3.5" />
                      {saveButtonLabel}
                    </button>
                  </>
                )}

                <a
                  href={obsidianUrl}
                  className={cn(
                    'inline-flex items-center gap-1 border border-border font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                    isIosPhone ? 'h-7 rounded-md px-2 text-[11px]' : 'rounded-lg px-2.5 py-1 text-xs',
                  )}
                  title="Open file in Obsidian"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Obsidian</span>
                </a>
                <button
                  type="button"
                  onClick={handleOpenInSystem}
                  disabled={!canOpenInSystem}
                  className={cn(
                    'inline-flex items-center gap-1 border border-border font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-muted-foreground',
                    isIosPhone ? 'h-7 rounded-md px-2 text-[11px]' : 'rounded-lg px-2.5 py-1 text-xs',
                  )}
                  title={canOpenInSystem ? `Open file in ${openInSystemButtonLabel}` : 'Open in system file manager is unavailable on web'}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{openInSystemButtonLabel}</span>
                </button>

                {showCloseButton && onClose && (
                  <button
                    onClick={onClose}
                    className={cn(
                      'transition-colors hover:bg-muted',
                      isIosPhone ? 'rounded-md p-1.5' : 'rounded-lg p-1.5',
                    )}
                    title="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {showMeta && meta && (
              <div className={cn(
                'space-y-2 border-b border-border/30 bg-muted/30 py-4 text-xs text-muted-foreground',
                isIosPhone ? 'px-5' : 'px-7',
              )}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span><strong className="text-foreground/70">{meta.lines ?? '…'}</strong> lines</span>
                  <span><strong className="text-foreground/70">{meta.words ?? '…'}</strong> words</span>
                  <span><strong className="text-foreground/70">{meta.headings ?? '…'}</strong> headings</span>
                  <span>{meta.size}</span>
                  <span>Created: <strong className="text-foreground/70">{meta.createdAt ?? '—'}</strong></span>
                  <span>Updated: <strong className="text-foreground/70">{meta.updatedAt ?? '—'}</strong></span>
                </div>

                {!isExcalidrawDoc && (
                  <div className="space-y-1.5 border-t border-border/30 pt-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      YAML Metadata
                    </div>

                    {isEditing ? (
                      <div className="space-y-1.5">
                        <MarkdownRichEditorBlock
                          value={frontmatterMeta.yamlText}
                          onChange={setDraftFrontmatterYaml}
                          currentPath={path}
                          enableFormattingToolbar={false}
                          className="h-44 w-full"
                          editorClassName="rounded-md border border-border/60 bg-background"
                          placeholder={'title: My note\ntype: thought\nparent: project-root'}
                          compactMobile={isIosPhone}
                        />
                        {frontmatterMeta.parseError ? (
                          <div className="text-[11px] text-destructive">
                            YAML parse error: {frontmatterMeta.parseError}
                          </div>
                        ) : (
                          <div className="text-[11px] text-muted-foreground">
                            {frontmatterMeta.hasFrontmatter ? 'Frontmatter is valid YAML.' : 'Add YAML above to create frontmatter.'}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {frontmatterMeta.parseError && (
                          <div className="text-[11px] text-destructive">
                            YAML parse error: {frontmatterMeta.parseError}
                          </div>
                        )}
                        {!frontmatterMeta.hasFrontmatter && (
                          <div className="text-[11px] text-muted-foreground">No YAML frontmatter.</div>
                        )}
                        {frontmatterMeta.hasFrontmatter && !frontmatterMeta.parseError && frontmatterMeta.entries.length === 0 && (
                          <div className="text-[11px] text-muted-foreground">YAML frontmatter is empty.</div>
                        )}
                        {frontmatterMeta.entries.length > 0 && (
                          <dl className="grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-3 gap-y-1 text-[11px]">
                            {frontmatterMeta.entries.map((entry) => (
                              <div key={entry.key} className="contents">
                                <dt className="font-medium text-foreground/80">{entry.key}</dt>
                                <dd className="break-all text-muted-foreground">{entry.value}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

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
            <div className={cn(isIosPhone ? 'px-3 pt-2.5' : 'px-6 pt-4')}>
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {navigationError}
              </div>
            </div>
          )}

          {!loading && !error && viewerHighlightError && (
            <div className={cn(isIosPhone ? 'px-3 pt-2.5' : 'px-6 pt-4')}>
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {viewerHighlightError}
              </div>
            </div>
          )}

          {!loading && !error && !isExcalidrawDoc && annotationParseError && (
            <div className={cn(isIosPhone ? 'px-3 pt-2.5' : 'px-6 pt-4')}>
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Annotation metadata is invalid JSON. Highlights still render, but anchored note editing is disabled until the hidden annotation block is fixed.
              </div>
            </div>
          )}

          {!loading && !error && content !== null && !isEditing && isExcalidrawDoc && (
            <ExcalidrawDocumentBlock content={content} filePath={path} onOpenPath={openLinkedPath} className="flex-1 min-h-0" />
          )}

          {!loading && !error && content !== null && !isEditing && !isExcalidrawDoc && (
            <div className={cn('space-y-2', isIosPhone ? 'px-5 py-5' : 'px-8 py-7')}>
              {viewerAnnotateMode && (
                <style>{`
                  [data-markdown-nav-root].ltm-markdown-annotate-mode ::selection {
                    background: var(--ltm-active-highlight-color);
                    color: inherit;
                  }
                  [data-markdown-nav-root].ltm-markdown-annotate-mode mark::selection {
                    background: var(--ltm-active-highlight-color);
                    color: inherit;
                  }
                `}</style>
              )}
              {pendingFullRender && (
                <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  Rendering full document...
                </div>
              )}
              <div
                ref={markdownViewRootRef}
                className={cn(
                  'prose',
                  editorSettings.preserveSpacesInViewMode && 'ltm-markdown-preserve-spaces',
                  editorSettings.preserveNewlinesInViewMode && 'ltm-markdown-preserve-newlines',
                  viewerAnnotateMode && 'ltm-markdown-annotate-mode',
                )}
                style={viewerAnnotateMode ? {
                  ['--ltm-active-highlight-color' as string]: resolveMarkdownHighlightColorBlock(activeViewerHighlightPresetId, viewerHighlightPresets),
                } : undefined}
                data-markdown-nav-root
                onMouseDownCapture={() => {
                  if (!viewerAnnotateMode) return
                  setViewerHighlightSelection(null)
                  setViewerHighlightError(null)
                }}
                onTouchStartCapture={() => {
                  if (!viewerAnnotateMode) return
                  setViewerHighlightSelection(null)
                  setViewerExistingHighlightTarget(null)
                  setViewerHighlightError(null)
                }}
                onClickCapture={(event) => {
                  if (!viewerAnnotateMode) return
                  const target = event.target
                  if (!(target instanceof HTMLElement)) return
                  const highlightElement = target.closest('mark[data-md-source-start]')
                  if (!(highlightElement instanceof HTMLElement)) return
                  event.preventDefault()
                  event.stopPropagation()
                  const start = Number(highlightElement.dataset.mdSourceStart ?? '')
                  if (!Number.isFinite(start)) return
                  const match = findMarkdownHighlightByVisibleOffsetBlock(activeViewerMarkdownBody, start)
                  if (!match) return
                  setViewerHighlightSelection(null)
                  setViewerExistingHighlightTarget({
                    offset: start,
                    start: match.visibleStart,
                    end: match.visibleEnd,
                    text: match.visibleText,
                    presetId: match.presetId,
                  })
                  setViewerHighlightError(null)
                  window.getSelection()?.removeAllRanges()
                }}
                onMouseUp={() => {
                  window.setTimeout(() => {
                    captureViewerHighlightSelection()
                  }, 0)
                }}
                onTouchEnd={() => {
                  window.setTimeout(() => {
                    captureViewerHighlightSelection()
                  }, 0)
                }}
              >
                <ReactMarkdown
                  remarkPlugins={markdownRemarkPlugins}
                  components={markdownComponents}
                  urlTransform={thinkingSpaceMarkdownUrlTransformBlock}
                >
                  {renderedViewMarkdown}
                </ReactMarkdown>
              </div>
              {viewerAnnotateMode && (
                <div
                  className={cn(
                    'fixed z-[72]',
                    isIosPhone ? 'right-3 top-[calc(var(--ltm-safe-top,0px)+7rem)]' : 'right-4 top-1/2 -translate-y-1/2',
                  )}
                >
                  <div
                    onMouseDown={(event) => event.preventDefault()}
                    onTouchStart={(event) => event.preventDefault()}
                    className="space-y-2"
                  >
                    <ExcalidrawHighlighterPresetPickerBlock
                      presets={viewerHighlightPresets}
                      activePresetId={activeViewerHighlightPresetId}
                      onSelectPreset={(presetId) => {
                        setActiveViewerHighlightPresetId(presetId)
                        writeExcalidrawActivePresetIdOrch(presetId)
                        if (viewerHighlightSelection) {
                          void handleApplyViewerHighlight(presetId)
                        }
                      }}
                      orientation="vertical"
                    />
                    {viewerExistingHighlightTarget && (
                      <button
                        type="button"
                        onClick={handleRemoveExistingViewerHighlight}
                        className="w-full rounded-lg border border-destructive/40 bg-background/90 px-2 py-1 text-[11px] font-medium text-destructive shadow-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              )}
              {!viewerAnnotateMode && viewerHighlightSelection && (
                <div
                  className="fixed z-[72] -translate-x-1/2"
                  style={{
                    top: Math.max(12, viewerHighlightSelection.top),
                    left: viewerHighlightSelection.left,
                  }}
                >
                  <div className="rounded-2xl border border-border/70 bg-background/95 p-2 shadow-lg backdrop-blur">
                    <div className="px-1 pb-1 text-[11px] font-medium text-muted-foreground">
                      {viewerHighlightSaving ? 'Highlighting…' : 'Choose highlighter'}
                    </div>
                    <div
                      onMouseDown={(event) => event.preventDefault()}
                      onTouchStart={(event) => event.preventDefault()}
                    >
                      <ExcalidrawHighlighterPresetPickerBlock
                        presets={viewerHighlightPresets}
                        activePresetId={activeViewerHighlightPresetId}
                        onSelectPreset={(presetId) => {
                          setActiveViewerHighlightPresetId(presetId)
                          writeExcalidrawActivePresetIdOrch(presetId)
                          void handleApplyViewerHighlight(presetId)
                        }}
                        orientation="horizontal"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        {!loading && !error && content !== null && isEditing && isExcalidrawDoc && !excalidrawImmersive && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              Full Excalidraw tool surface is enabled in edit mode.
            </div>
            <ExcalidrawDocumentBlock
              content={excalidrawEditorContent}
              editable
              onSceneChange={handleExcalidrawSceneChange}
              onApiChange={handleExcalidrawApiChange}
              filePath={path}
              onOpenPath={openLinkedPath}
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
            <div
              className="relative z-20 flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-background/95 px-3 py-2 backdrop-blur"
              style={{
                paddingTop: isElectronSurface ? '2.25rem' : isIosSurface ? 'calc(var(--ltm-safe-top, 0px) + 0.5rem)' : '0.5rem',
                ...isElectronSurface && { WebkitAppRegion: 'drag' } as React.CSSProperties,
              }}
            >
              <div
                className="min-w-0 flex items-center gap-2"
              >
                <span className="truncate text-sm font-medium text-foreground">
                  {filename}
                </span>
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Excalidraw Focus Mode
                </span>
                <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80">
                  {hasChanges ? 'Unsaved changes' : 'Saved'}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5" style={isElectronSurface ? { WebkitAppRegion: 'no-drag' } as React.CSSProperties : undefined}>
                <button
                  type="button"
                  onClick={() => setAutoSaveEnabled(v => !v)}
                  className={cn(
                    'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                    autoSaveEnabled ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                  title="Toggle auto save"
                >
                  {autoSaveEnabled ? 'Auto-save On' : 'Auto-save Off'}
                </button>
                <button
                  type="button"
                  onClick={() => setExcalidrawImmersive(false)}
                  className="rounded-md border border-border/70 px-2.5 py-1 text-xs text-foreground hover:bg-muted"
                >
                  Exit Focus
                </button>
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="rounded-md border border-border/70 px-2.5 py-1 text-xs text-foreground hover:bg-muted"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => { void handleSave() }}
                  disabled={!hasChanges || saving || baseMtime === null}
                  className="rounded-md border border-border/70 px-2.5 py-1 text-xs text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saveButtonLabel}
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <ExcalidrawDocumentBlock
                content={excalidrawEditorContent}
                editable
                onSceneChange={handleExcalidrawSceneChange}
                onApiChange={handleExcalidrawApiChange}
                filePath={path}
                onOpenPath={openLinkedPath}
                className="h-full"
              />
            </div>
          </div>
        )}

        {!loading && !error && content !== null && isEditing && !isExcalidrawDoc && (
          <div className={cn('space-y-4', isIosPhone && 'px-3 pb-[calc(var(--ltm-safe-bottom,0px)+0.4rem)]')}>
            <div className="rounded-lg border border-amber-300/50 bg-amber-50/70 px-3 py-2 text-xs text-amber-950/80">
              Use <code>==highlight==</code> for text-native highlights. The editor’s <strong>Note anchor</strong> button inserts a <code>^anchor</code> line; save the document, then tap that anchor in view mode to add typed or Apple Pencil notes.
            </div>
            <div data-ltm-edge-swipe-ignore="true">
              <MarkdownRichEditorBlock
                value={displayDraft}
                currentPath={path}
                compactMobile={isIosPhone}
                toolbarAlwaysVisible
                aiPanelOpen={showAiPanel}
                onAiPanelOpenChange={setShowAiPanel}
                aiAssistDisabled={loading || isExcalidrawDoc}
                aiAssistScope="markdown_editor"
                aiAssistUseCase="markdown.assist"
                aiAssistHelperText="Suggestions apply inline. Auto-save is enabled by default; use Save for immediate commit. Configure provider/model in AI Settings."
                onAiStewardApplySuggestion={handleApplyStewardSuggestion}
                onRelatedThoughtOpenPath={(relatedPath) => {
                  if (!openRelatedThoughtPath) return
                  if (normalizePathForCompare(relatedPath) === normalizePathForCompare(path)) return
                  openRelatedThoughtPath(relatedPath)
                }}
                onRelatedThoughtOpenPathInNewTab={(relatedPath) => {
                  if (normalizePathForCompare(relatedPath) === normalizePathForCompare(path)) return
                  openFileInNewTabOrch(relatedPath)
                }}
                onInsertAnnotationAnchor={() => {
                  setAnnotationSaveError(null)
                }}
                onChange={(next) => {
                  setDraft(`${draftFrontmatter}${next}`)
                }}
                className={cn(
                  'min-h-[44vh] sm:min-h-[52vh] lg:min-h-[62vh]',
                  isIosPhone && 'min-h-0 h-full',
                )}
              />
            </div>

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

        {!isExcalidrawDoc && (
          <MarkdownAnnotationEditorBlock
            open={activeAnnotationAnchorId !== null}
            anchorId={activeAnnotationAnchorId}
            annotation={activeAnnotation}
            saving={annotationSaving}
            error={annotationSaveError}
            onClose={() => {
              if (annotationSaving) return
              setActiveAnnotationAnchorId(null)
              setAnnotationSaveError(null)
            }}
            onSave={(draftAnnotation) => {
              if (!activeAnnotationAnchorId) return
              void handleSaveAnnotation(activeAnnotationAnchorId, draftAnnotation)
            }}
            onDelete={activeAnnotation ? (() => { void handleDeleteAnnotation() }) : null}
          />
        )}

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
    </div>
  )
}

function PdfDocumentRuntimeBlock({
  path,
  onOpenPath,
  onClose,
  showCloseButton = false,
  className,
}: MarkdownDocumentBlockProps) {
  const filename = path.split('/').pop() || path
  const breadcrumb = path.split('/').slice(0, -1).join(' / ')
  const openInSystemLabel = getOpenInSystemLabelOrch()
  const canOpenInSystem = openInSystemLabel !== null
  const openInSystemButtonLabel = openInSystemLabel ?? 'System'
  const [openInSystemError, setOpenInSystemError] = useState<string | null>(null)

  const handleOpenInSystem = useCallback(() => {
    if (!canOpenInSystem) return
    setOpenInSystemError(null)
    void openVaultPathInSystemOrch(path).catch((err) => {
      setOpenInSystemError(err instanceof Error ? err.message : 'Failed to open file in system file manager')
    })
  }, [canOpenInSystem, path])

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-card p-2', className)}>
      <div className="ts-doc-header border-b border-border/50 px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{filename}</span>
            </div>
            {breadcrumb && <div className="mt-0.5 truncate text-xs text-muted-foreground">{breadcrumb}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={handleOpenInSystem}
              disabled={!canOpenInSystem}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
              title={canOpenInSystem ? `Open file in ${openInSystemButtonLabel}` : 'Open in system file manager is unavailable on web'}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{openInSystemButtonLabel}</span>
            </button>
            {onOpenPath && (
              <button
                type="button"
                onClick={() => onOpenPath(path)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Open in Thinking Space explorer"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            )}
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
      </div>
      {openInSystemError && (
        <div className="mx-6 mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {openInSystemError}
        </div>
      )}

      <div className="min-h-0 flex-1">
        <PdfDocumentBlock path={path} className="h-full" />
      </div>
    </div>
  )
}

function ImageDocumentRuntimeBlock({
  path,
  onOpenPath,
  onClose,
  showCloseButton = false,
  className,
}: MarkdownDocumentBlockProps) {
  const filename = path.split('/').pop() || path
  const breadcrumb = path.split('/').slice(0, -1).join(' / ')
  const openInSystemLabel = getOpenInSystemLabelOrch()
  const canOpenInSystem = openInSystemLabel !== null
  const openInSystemButtonLabel = openInSystemLabel ?? 'System'
  const [openInSystemError, setOpenInSystemError] = useState<string | null>(null)

  const handleOpenInSystem = useCallback(() => {
    if (!canOpenInSystem) return
    setOpenInSystemError(null)
    void openVaultPathInSystemOrch(path).catch((err) => {
      setOpenInSystemError(err instanceof Error ? err.message : 'Failed to open file in system file manager')
    })
  }, [canOpenInSystem, path])

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-card p-2', className)}>
      <div className="ts-doc-header border-b border-border/50 px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{filename}</span>
            </div>
            {breadcrumb && <div className="mt-0.5 truncate text-xs text-muted-foreground">{breadcrumb}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={handleOpenInSystem}
              disabled={!canOpenInSystem}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
              title={canOpenInSystem ? `Open file in ${openInSystemButtonLabel}` : 'Open in system file manager is unavailable on web'}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{openInSystemButtonLabel}</span>
            </button>
            {onOpenPath && (
              <button
                type="button"
                onClick={() => onOpenPath(path)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Open in Thinking Space explorer"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            )}
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
      </div>
      {openInSystemError && (
        <div className="mx-6 mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {openInSystemError}
        </div>
      )}

      <div className="min-h-0 flex-1 px-6 py-5">
        <ImageDocumentBlock path={path} className="h-full" />
      </div>
    </div>
  )
}

function UnsupportedFileDocumentRuntimeBlock({
  path,
  onOpenPath,
  onClose,
  showCloseButton = false,
  className,
}: MarkdownDocumentBlockProps) {
  const filename = path.split('/').pop() || path
  const breadcrumb = path.split('/').slice(0, -1).join(' / ')
  const openInSystemLabel = getOpenInSystemLabelOrch()
  const canOpenInSystem = openInSystemLabel !== null
  const [openInSystemError, setOpenInSystemError] = useState<string | null>(null)

  const handleOpenInDefaultApp = useCallback(() => {
    if (!canOpenInSystem) return
    setOpenInSystemError(null)
    void openVaultPathWithDefaultAppOrch(path).catch((err) => {
      setOpenInSystemError(err instanceof Error ? err.message : 'Failed to open file in default app')
    })
  }, [canOpenInSystem, path])

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-card p-2', className)}>
      <div className="ts-doc-header border-b border-border/50 px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{filename}</span>
            </div>
            {breadcrumb && <div className="mt-0.5 truncate text-xs text-muted-foreground">{breadcrumb}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onOpenPath && (
              <button
                type="button"
                onClick={() => onOpenPath(path)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Open in Thinking Space explorer"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            )}
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
      </div>

      {openInSystemError && (
        <div className="mx-6 mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {openInSystemError}
        </div>
      )}

      <div className="min-h-0 flex-1 px-6 py-5">
        <div className="flex h-full min-h-[220px] items-center justify-center">
          <div className="w-full max-w-xl rounded-2xl border border-border/60 bg-muted/20 p-8 text-center">
            <button
              type="button"
              onClick={handleOpenInDefaultApp}
              disabled={!canOpenInSystem}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border/70 bg-background/95 px-5 py-2.5 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-background"
              title={canOpenInSystem ? 'Open file in default app' : 'Opening files directly is unavailable on web'}
            >
              <ExternalLink className="h-4 w-4" />
              Open in Default App
            </button>
            <p className="mt-4 text-sm text-muted-foreground">
              This file type is not supported in-app right now. Please open it in your default app.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MarkdownDocumentBlock(props: MarkdownDocumentBlockProps) {
  if (isUrlShortcutPathBlock(props.path)) {
    return (
      <UrlDocumentBlock
        path={props.path}
        onClose={props.onClose}
        showCloseButton={props.showCloseButton}
        className={props.className}
      />
    )
  }
  if (isTableDocumentPathBlock(props.path)) {
    return (
      <TableDocumentBlock
        path={props.path}
        initialMode={props.initialMode}
        onSaved={props.onSaved}
        onOpenPath={props.onOpenPath}
        onOpenPathForEdit={props.onOpenPathForEdit}
        onClose={props.onClose}
        showCloseButton={props.showCloseButton}
        className={props.className}
      />
    )
  }
  if (isGoogleDocDocumentPathBlock(props.path)) {
    return (
      <GoogleDocDocumentBlock
        path={props.path}
        initialMode={props.initialMode}
        onSaved={props.onSaved}
        onClose={props.onClose}
        showCloseButton={props.showCloseButton}
        className={props.className}
      />
    )
  }
  if (isImageDocumentPathBlock(props.path)) {
    return (
      <ImageDocumentRuntimeBlock
        path={props.path}
        initialMode={props.initialMode}
        onSaved={props.onSaved}
        onOpenPath={props.onOpenPath}
        onOpenPathForEdit={props.onOpenPathForEdit}
        onClose={props.onClose}
        showCloseButton={props.showCloseButton}
        className={props.className}
      />
    )
  }
  if (isPdfDocumentPathBlock(props.path)) {
    return (
      <PdfDocumentRuntimeBlock
        path={props.path}
        initialMode={props.initialMode}
        onSaved={props.onSaved}
        onOpenPath={props.onOpenPath}
        onOpenPathForEdit={props.onOpenPathForEdit}
        onClose={props.onClose}
        showCloseButton={props.showCloseButton}
        className={props.className}
      />
    )
  }
  if (isUnsupportedFilePathBlock(props.path)) {
    return (
      <UnsupportedFileDocumentRuntimeBlock
        path={props.path}
        initialMode={props.initialMode}
        onSaved={props.onSaved}
        onOpenPath={props.onOpenPath}
        onOpenPathForEdit={props.onOpenPathForEdit}
        onClose={props.onClose}
        showCloseButton={props.showCloseButton}
        className={props.className}
      />
    )
  }
  return <MarkdownTextDocumentRuntimeBlock {...props} />
}

export default memo(MarkdownDocumentBlock)
