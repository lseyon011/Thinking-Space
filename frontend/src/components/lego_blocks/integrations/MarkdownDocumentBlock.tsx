import {
  isValidElement,
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
import yaml from 'js-yaml'
import { X, FileText, ExternalLink, Pencil, Save, Sparkles, Loader2, RotateCcw, RotateCw } from 'lucide-react'
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
import { useUILayoutBlock } from '@/components/lego_blocks/integrations/UILayoutBlock'
import {
  buildObsidianOpenUrlOrch,
  isThinkingSpaceWikilinkHrefOrch,
  parseThinkingSpaceWikilinkHrefOrch,
  remarkObsidianWikilinksOrch,
  resolveWikilinkTargetOrch,
} from '@/services/orchestrators/obsidianLinkOrch'
import { openFileInNewTabOrch } from '@/services/orchestrators/fileSystemOrch'
import ExcalidrawDocumentBlock from '@/components/lego_blocks/integrations/ExcalidrawDocumentBlock'
import MarkdownMiniNavBlock from '@/components/lego_blocks/integrations/MarkdownMiniNavBlock'
import MarkdownRichEditorBlock, { type MarkdownRichEditorBlockHandle } from '@/components/lego_blocks/integrations/MarkdownRichEditorBlock'
import InfoPanelToggleButtonBlock from '@/components/lego_blocks/units/InfoPanelToggleButtonBlock'
import AiPanelToggleButtonBlock from '@/components/lego_blocks/units/AiPanelToggleButtonBlock'
import { cn } from '@/lib/utils'
import { useAiAssistRuntimeBlock } from '@/components/lego_blocks/integrations/AiAssistRuntimeBlock'
import AiAssistControlsBlock from '@/components/lego_blocks/integrations/AiAssistControlsBlock'
import AiAssistReviewBlock from '@/components/lego_blocks/integrations/AiAssistReviewBlock'
import { findRelated, type SimilarityMatch } from '@/services/lego_blocks/aiBlock'
import { thinkingSpaceMarkdownUrlTransformBlock } from '@/services/lego_blocks/markdownUrlTransformBlock'
import {
  readMarkdownEditorSettingsOrch,
  type MarkdownEditorSettingsBlock,
} from '@/services/orchestrators/markdownEditorSettingsOrch'
import { generateStewardMetadataSuggestionForFileOrch, type StewardMetadataSuggestion } from '@/services/orchestrators/stewardMetadataOrch'

export type MarkdownViewerMode = 'view' | 'edit'

const MARKDOWN_BLANK_LINE_MARKER = 'LTM-BLANK-LINE-MARKER-V2'
const LEGACY_MARKDOWN_BLANK_LINE_MARKERS = new Set([
  'LTM-PRESERVE-BLANK-LINE-MARKER',
  '__LTM_PRESERVE_BLANK_LINE__',
  'LTM_PRESERVE_BLANK_LINE',
  'LTM PRESERVE BLANK LINE',
])

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
  return splitFrontmatter(content).body
}

function splitFrontmatter(content: string): { frontmatter: string; body: string } {
  const normalized = content.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  if (lines[0] !== '---') return { frontmatter: '', body: normalized }

  let closingIndex = -1
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === '---') {
      closingIndex = i
      break
    }
  }
  if (closingIndex < 0) return { frontmatter: '', body: normalized }

  const frontmatter = `${lines.slice(0, closingIndex + 1).join('\n')}\n`
  const body = lines.slice(closingIndex + 1).join('\n')
  return { frontmatter, body }
}

function isBlankLineMarkerText(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (trimmed === MARKDOWN_BLANK_LINE_MARKER) return true
  if (LEGACY_MARKDOWN_BLANK_LINE_MARKERS.has(trimmed)) return true
  const normalized = trimmed
    .replace(/[_*\-`]+/g, '')
    .replace(/\s+/g, '')
    .toUpperCase()
  return normalized === 'LTMPRESERVEBLANKLINE' || normalized === 'LTMBLANKLINEMARKERV2'
}

function extractTextFromNode(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractTextFromNode).join('')
  if (isValidElement(node)) return extractTextFromNode(node.props.children as ReactNode)
  return ''
}

function preserveExtraBlankLinesInMarkdown(content: string): string {
  const normalized = content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => (isBlankLineMarkerText(line) ? '' : line))
    .join('\n')
  const lines = normalized.split('\n')
  const output: string[] = []
  let inFence = false

  const isFenceLine = (line: string): boolean => {
    const trimmed = line.trimStart()
    return trimmed.startsWith('```') || trimmed.startsWith('~~~')
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (isFenceLine(line)) {
      inFence = !inFence
      output.push(line)
      continue
    }

    if (!inFence && line === '') {
      let runEnd = index
      while (runEnd < lines.length && lines[runEnd] === '') runEnd += 1
      const runLength = runEnd - index

      if (runLength <= 2) {
        for (let i = 0; i < runLength; i += 1) output.push('')
      } else {
        output.push('', '')
        for (let i = 0; i < runLength - 2; i += 1) {
          output.push(MARKDOWN_BLANK_LINE_MARKER, '')
        }
      }

      index = runEnd - 1
      continue
    }

    output.push(line)
  }

  return output.join('\n')
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

interface MarkdownFrontmatterMetaEntry {
  key: string
  value: string
}

interface MarkdownFrontmatterMetaState {
  hasFrontmatter: boolean
  yamlText: string
  entries: MarkdownFrontmatterMetaEntry[]
  parseError: string | null
}

interface PurposeProposalState {
  suggestion: StewardMetadataSuggestion
  generatedAt: string
}

interface MarkdownEditBaselineState {
  content: string
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

function frontmatterBlockToYamlText(frontmatterBlock: string): string {
  if (!frontmatterBlock) return ''
  const normalized = frontmatterBlock.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  if (lines[0]?.trim() === '---') lines.shift()
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  if (lines[lines.length - 1]?.trim() === '---') lines.pop()
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines.join('\n')
}

function yamlTextToFrontmatterBlock(yamlText: string): string {
  const normalized = yamlText.replace(/\r\n/g, '\n').replace(/^\n+/, '').trimEnd()
  if (normalized.trim() === '') return ''
  return `---\n${normalized}\n---\n`
}

function parseFrontmatterObject(frontmatterBlock: string): Record<string, unknown> {
  const yamlText = frontmatterBlockToYamlText(frontmatterBlock)
  if (!yamlText.trim()) return {}
  try {
    const parsed = yaml.load(yamlText)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ...(parsed as Record<string, unknown>) }
    }
  } catch {
    return {}
  }
  return {}
}

function frontmatterObjectToBlock(frontmatter: Record<string, unknown>): string {
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === undefined) continue
    sanitized[key] = value
  }
  const dumped = yaml.dump(sanitized, { lineWidth: 120, noRefs: true }).trimEnd()
  return yamlTextToFrontmatterBlock(dumped)
}

function toFrontmatterEntryValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function buildFrontmatterMetaState(content: string): MarkdownFrontmatterMetaState {
  const { frontmatter } = splitFrontmatter(content)
  if (!frontmatter) {
    return {
      hasFrontmatter: false,
      yamlText: '',
      entries: [],
      parseError: null,
    }
  }

  const yamlText = frontmatterBlockToYamlText(frontmatter)
  if (yamlText.trim() === '') {
    return {
      hasFrontmatter: true,
      yamlText,
      entries: [],
      parseError: null,
    }
  }

  try {
    const parsed = yaml.load(yamlText)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const entries = Object.entries(parsed as Record<string, unknown>).map(([key, value]) => ({
        key,
        value: toFrontmatterEntryValue(value),
      }))
      return {
        hasFrontmatter: true,
        yamlText,
        entries,
        parseError: null,
      }
    }

    return {
      hasFrontmatter: true,
      yamlText,
      entries: [
        {
          key: '(value)',
          value: toFrontmatterEntryValue(parsed),
        },
      ],
      parseError: null,
    }
  } catch (error) {
    return {
      hasFrontmatter: true,
      yamlText,
      entries: [],
      parseError: error instanceof Error ? error.message : 'Invalid YAML frontmatter',
    }
  }
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
  const isIosSurface = layout.surface === 'capacitor-ios'
  const isElectronSurface = layout.surface === 'electron'
  const isIosPhone = isIosSurface && layout.mode === 'phone'
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
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [purposeLoading, setPurposeLoading] = useState(false)
  const [purposeError, setPurposeError] = useState<string | null>(null)
  const [purposeMessage, setPurposeMessage] = useState<string | null>(null)
  const [purposeProposal, setPurposeProposal] = useState<PurposeProposalState | null>(null)
  const [editorSettings] = useState<MarkdownEditorSettingsBlock>(
    () => readMarkdownEditorSettingsOrch(),
  )
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
  const markdownEditorRef = useRef<MarkdownRichEditorBlockHandle | null>(null)
  const lastScrollTopRef = useRef(0)
  const chromeCollapsedRef = useRef(false)
  const excalidrawSceneRef = useRef<ParsedExcalidrawScene | null>(null)
  const excalidrawApiRef = useRef<ExcalidrawCanvasApiOrch | null>(null)
  const ignoreInitialExcalidrawChangeRef = useRef(true)
  const [hasExcalidrawChanges, setHasExcalidrawChanges] = useState(false)
  const [excalidrawImmersive, setExcalidrawImmersive] = useState(false)
  const markdownSaveInFlightRef = useRef(false)
  const markdownSavePromiseRef = useRef<Promise<boolean> | null>(null)
  const markdownEditBaselineRef = useRef<MarkdownEditBaselineState | null>(null)
  const markdownCancelRevertInFlightRef = useRef(false)

  const loadDocument = useCallback(async (seedDraft = false) => {
    setLoading(true)
    setError(null)
    setSaveError(null)
    setNavigationError(null)
    setConflict(null)
    setRelatedThoughts([])
    setRelatedError(null)
    setRelatedLoading(false)
    setPurposeError(null)
    setPurposeMessage(null)
    setPurposeLoading(false)
    setPurposeProposal(null)
    setHasExcalidrawChanges(false)
    setExcalidrawImmersive(false)
    markdownEditBaselineRef.current = null
    markdownCancelRevertInFlightRef.current = false
    excalidrawSceneRef.current = null
    excalidrawApiRef.current = null
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
    if (isExcalidrawDoc || mode === 'edit' || isIosSurface || layout.keyboardVisible) return
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
  }, [content, isExcalidrawDoc, isIosSurface, layout.keyboardVisible, mode, path])

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
  const frontmatterMetaSource = isEditing ? draft : (content ?? '')
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
  const setDraftBody = useCallback((nextBody: string) => {
    setDraft((current) => `${splitFrontmatter(current).frontmatter}${nextBody}`)
  }, [])
  const setDraftFrontmatterYaml = useCallback((nextYamlText: string) => {
    setDraft((current) => {
      const { body } = splitFrontmatter(current)
      const nextFrontmatter = yamlTextToFrontmatterBlock(nextYamlText)
      return `${nextFrontmatter}${body}`
    })
    if (assistSuggestion || assistError) clearAssistState()
  }, [assistError, assistSuggestion, clearAssistState])
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
  const generatePurposeForFile = useCallback(async () => {
    if (isExcalidrawDoc || !isEditing) return
    if (frontmatterMeta.parseError) {
      setPurposeError('Fix YAML parse errors before generating purpose metadata proposals.')
      setPurposeMessage(null)
      return
    }

    setPurposeLoading(true)
    setPurposeError(null)
    setPurposeMessage(null)
    try {
      const suggestion = await generateStewardMetadataSuggestionForFileOrch(path)
      setPurposeProposal({
        suggestion,
        generatedAt: new Date().toISOString(),
      })
      const source = suggestion.usedAi
        ? `AI (${suggestion.provider}${suggestion.model ? `/${suggestion.model}` : ''})`
        : 'heuristics'
      setPurposeMessage(`Generated purpose proposal from ${source}. Review and accept or reject.`)
    } catch (err) {
      setPurposeError(err instanceof Error ? err.message : 'Failed to generate purpose metadata')
    } finally {
      setPurposeLoading(false)
    }
  }, [
    frontmatterMeta.parseError,
    isEditing,
    isExcalidrawDoc,
    path,
  ])
  const acceptPurposeProposal = useCallback(() => {
    if (!purposeProposal) return
    if (frontmatterMeta.parseError) {
      setPurposeError('Fix YAML parse errors before accepting this purpose proposal.')
      return
    }
    applyStewardSuggestionToDraft(purposeProposal.suggestion)
    if (assistSuggestion || assistError) clearAssistState()
    setPurposeProposal(null)
    setPurposeError(null)
    setPurposeMessage('Applied purpose proposal to YAML metadata.')
  }, [
    applyStewardSuggestionToDraft,
    assistError,
    assistSuggestion,
    clearAssistState,
    frontmatterMeta.parseError,
    purposeProposal,
  ])
  const rejectPurposeProposal = useCallback(() => {
    if (!purposeProposal) return
    setPurposeProposal(null)
    setPurposeError(null)
    setPurposeMessage('Rejected purpose proposal.')
  }, [purposeProposal])
  const markdownRemarkPlugins = useMemo(() => [remarkGfm, remarkObsidianWikilinksOrch], [])
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
    p: ({ children, ...props }: MarkdownParagraphProps) => {
      const text = extractTextFromNode(children).replace(/\u00a0/g, ' ').trim()
      if (isBlankLineMarkerText(text)) {
        return <div className="ltm-markdown-blank-line" aria-hidden="true" />
      }
      return <p {...props}>{children}</p>
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
    if (!isEditing || isExcalidrawDoc || loading || error || content === null || !showAiPanel) {
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
  }, [content, displayDraft, error, isEditing, isExcalidrawDoc, loading, path, showAiPanel])

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
  }, [])

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
    setMode('edit')
    setDraft(isExcalidrawDoc ? '' : (content ?? ''))
    markdownEditBaselineRef.current = isExcalidrawDoc
      ? null
      : { content: content ?? '' }
    setShowAiPanel(false)
    setSaveError(null)
    setNavigationError(null)
    setConflict(null)
    setPurposeError(null)
    setPurposeMessage(null)
    setPurposeLoading(false)
    setPurposeProposal(null)
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
    setShowAiPanel(false)
    setAutoSaving(false)
    setNavigationError(null)
    setPurposeError(null)
    setPurposeMessage(null)
    setPurposeLoading(false)
    setPurposeProposal(null)
    setHasExcalidrawChanges(false)
    setExcalidrawImmersive(false)
    excalidrawSceneRef.current = null
    ignoreInitialExcalidrawChangeRef.current = true
    if (!isExcalidrawDoc) {
      void revertMarkdownToEditBaseline()
    }
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

  const saveMarkdownDraft = useCallback(async (_reason: 'auto' | 'manual' = 'manual'): Promise<boolean> => {
    if (markdownSaveInFlightRef.current) return markdownSavePromiseRef.current ?? false
    if (isExcalidrawDoc || content === null || baseMtime === null) return false
    if (draft === content) return true

    const draftToSave = draft
    const savePromise = (async () => {
      markdownSaveInFlightRef.current = true
      setSaveError(null)
      setConflict(null)
      try {
        const result = await saveMarkdownDocument({
          path,
          content: draftToSave,
          baseMtime,
          baseHash,
          baseContent: content,
        })
        setContent(draftToSave)
        setBaseMtime(result.mtime)
        setBaseHash(result.hash)
        setSizeBytes(result.size)
        // Keep cancel baseline aligned with the latest persisted draft, including auto-saves.
        markdownEditBaselineRef.current = { content: draftToSave }
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
  }, [baseHash, baseMtime, content, draft, isExcalidrawDoc, onSaved, path])

  const handleSave = async () => {
    if (baseMtime === null) return
    if (!isExcalidrawDoc) {
      setSaving(true)
      await saveMarkdownDraft('manual')
      setSaving(false)
      return
    }
    if (!hasChanges) return

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

  return (
    <div
      className={cn('flex h-full min-h-0 flex-col bg-card', className)}
      data-prevent-sheet-escape={isEditing ? 'true' : undefined}
    >
      <div ref={chromeContainerRef} className="min-h-0 overflow-hidden">
        <div className="min-h-0 overflow-hidden">
          <div className={cn(
            'ts-md-header flex items-start justify-between gap-3 border-b border-border/50',
            isIosPhone ? 'px-3 py-2.5' : 'px-5 py-4',
          )}>
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
              <InfoPanelToggleButtonBlock active={showMeta} onToggle={() => setShowMeta(v => !v)} />

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
                    onClick={() => markdownEditorRef.current?.undo()}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Undo"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => markdownEditorRef.current?.redo()}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Redo"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutoSaveEnabled(v => !v)}
                    className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${autoSaveEnabled ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                    title="Toggle auto save"
                  >
                    {autoSaveEnabled ? 'Auto-save On' : 'Auto-save Off'}
                  </button>
                  <AiPanelToggleButtonBlock active={showAiPanel} onToggle={() => setShowAiPanel(v => !v)} />
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
                    disabled={saving || baseMtime === null}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </>
              )}

              {isEditing && isExcalidrawDoc && (
                <>
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
            <div className={cn(
              'space-y-2 border-b border-border/30 bg-muted/30 py-2.5 text-xs text-muted-foreground',
              isIosPhone ? 'px-3' : 'px-5',
            )}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span><strong className="text-foreground/70">{meta.lines ?? '…'}</strong> lines</span>
                <span><strong className="text-foreground/70">{meta.words ?? '…'}</strong> words</span>
                <span><strong className="text-foreground/70">{meta.headings ?? '…'}</strong> headings</span>
                <span>{meta.size}</span>
              </div>

              {!isExcalidrawDoc && (
                <div className="space-y-1.5 border-t border-border/30 pt-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    YAML Metadata
                  </div>

                  {isEditing ? (
                    <div className="space-y-1.5">
                      <textarea
                        value={frontmatterMeta.yamlText}
                        onChange={(event) => setDraftFrontmatterYaml(event.target.value)}
                        spellCheck={false}
                        className="min-h-[8rem] w-full rounded-md border border-border/60 bg-background px-2.5 py-2 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder="title: My note&#10;type: thought&#10;parent: project-root"
                        aria-label="YAML frontmatter editor"
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
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={contentScrollRef}
          className={cn(
            'relative h-full min-h-0 p-0',
            isExcalidrawDoc ? 'overflow-hidden' : 'overflow-y-auto',
          )}
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
            <div className={cn(isIosPhone ? 'px-3 pt-2.5' : 'px-6 pt-4')}>
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {navigationError}
              </div>
            </div>
          )}

          {!loading && !error && content !== null && !isEditing && isExcalidrawDoc && (
            <ExcalidrawDocumentBlock content={content} filePath={path} onOpenPath={openLinkedPath} />
          )}

          {!loading && !error && content !== null && !isEditing && !isExcalidrawDoc && (
            <div className={cn('space-y-2', isIosPhone ? 'px-3 py-3' : 'px-6 py-5')}>
              {pendingFullRender && (
                <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  Rendering full document...
                </div>
              )}
              <div
                className={cn(
                  'prose',
                  editorSettings.preserveSpacesInViewMode && 'ltm-markdown-preserve-spaces',
                  editorSettings.preserveNewlinesInViewMode && 'ltm-markdown-preserve-newlines',
                )}
                data-markdown-nav-root
              >
                <ReactMarkdown
                  remarkPlugins={markdownRemarkPlugins}
                  components={markdownComponents}
                  urlTransform={thinkingSpaceMarkdownUrlTransformBlock}
                >
                  {renderedViewMarkdown}
                </ReactMarkdown>
              </div>
            </div>
          )}

        {!loading && !error && content !== null && isEditing && isExcalidrawDoc && (
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
              <span className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Excalidraw Focus Mode {hasChanges ? '· Unsaved changes' : '· Saved'}
              </span>
              <div className="flex flex-wrap items-center justify-end gap-1.5" style={isElectronSurface ? { WebkitAppRegion: 'no-drag' } as React.CSSProperties : undefined}>
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
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { void handleSave() }}
                  disabled={!hasChanges || saving || baseMtime === null}
                  className="rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
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
            {showAiPanel && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2">
                  <button
                    type="button"
                    onClick={() => { void generatePurposeForFile() }}
                    disabled={purposeLoading || loading}
                    className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    title="Generate steward purpose metadata for this file"
                  >
                    {purposeLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    Purpose for This File
                  </button>
                  <span className="text-[11px] text-muted-foreground">
                    Uses steward metadata generation to create a proposal for YAML frontmatter.
                  </span>
                </div>

                {purposeMessage && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">
                    {purposeMessage}
                  </div>
                )}

                {purposeError && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {purposeError}
                  </div>
                )}

                {purposeProposal && (
                  <div className="space-y-2 rounded-lg border border-border/70 bg-background px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Purpose Proposal
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(purposeProposal.generatedAt).toLocaleString()}
                      </div>
                    </div>

                    <p className="text-xs text-foreground">{purposeProposal.suggestion.summary}</p>

                    {(purposeProposal.suggestion.tags?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {purposeProposal.suggestion.tags.map((tag) => (
                          <span key={tag} className="rounded-full border border-border/60 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="text-[11px] text-muted-foreground">
                      Suggested epic: {purposeProposal.suggestion.suggestedEpicKey || 'none'} | Suggested idea: {purposeProposal.suggestion.suggestedIdeaKey || 'none'}
                    </div>

                    <div className="text-[11px] text-muted-foreground">
                      {purposeProposal.suggestion.rationale}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={acceptPurposeProposal}
                        className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-95"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={rejectPurposeProposal}
                        className="rounded-md border border-border/70 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}

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
              </div>
            )}

            <div data-ltm-edge-swipe-ignore="true">
              <MarkdownRichEditorBlock
                ref={markdownEditorRef}
                value={displayDraft}
                currentPath={path}
                compactMobile={isIosPhone}
                toolbarAlwaysVisible
                onChange={(next) => {
                  setDraft(`${draftFrontmatter}${next}`)
                  if (assistSuggestion || assistError) clearAssistState()
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

export default memo(MarkdownDocumentBlock)
