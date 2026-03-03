import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { redo, undo } from '@codemirror/commands'
import { EditorState, type Extension } from '@codemirror/state'
import { Decoration, EditorView, WidgetType, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
import {
  Bold,
  Code,
  Heading1,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Maximize2,
  PenLine,
  Quote,
  RotateCcw,
  RotateCw,
  Save,
  Settings2,
  Sparkles,
  Table,
  Workflow,
  X,
} from 'lucide-react'
import { useUILayoutBlock } from '@/components/lego_blocks/hooks/shared/useUILayoutBlock'
import type { AiSettingsScope } from '@/services/lego_blocks/integrations/aiSettingsBlock'
import AiAssistControlsBlock from '@/components/lego_blocks/integrations/AiAssistControlsBlock'
import AiAssistReviewBlock from '@/components/lego_blocks/integrations/AiAssistReviewBlock'
import AiStewardPanelBlock from '@/components/lego_blocks/integrations/AiStewardPanelBlock'
import RelatedThoughtsPanelBlock from '@/components/lego_blocks/integrations/RelatedThoughtsPanelBlock'
import ExcalidrawDocumentBlock from '@/components/lego_blocks/integrations/ExcalidrawDocumentBlock'
import { useAiAssistRuntimeBlock } from '@/components/lego_blocks/hooks/integrations/useAiAssistRuntimeBlock'
import type { StewardMetadataSuggestion } from '@/services/orchestrators/stewardMetadataOrch'
import {
  getWikilinkSuggestionsOrch,
  toObsidianWikilinkTargetOrch,
} from '@/services/orchestrators/obsidianLinkOrch'
import {
  buildMarkdownTableFromRowsBlock,
  buildMarkdownTableTemplateBlock,
  detectAndParseDelimitedTableBlock,
  formatMarkdownTableAtSelectionBlock,
} from '@/services/orchestrators/markdownTableOrch'
import UniversalSearchBlock from '@/components/lego_blocks/integrations/UniversalSearchBlock'
import { UNIVERSAL_SEARCH_DROPDOWN_PRESET_BLOCK } from '@/components/lego_blocks/integrations/universalSearchPresetBlock'
import {
  deriveWikilinkLabelBlock,
  type WikilinkSuggestionBlock,
} from '@/services/lego_blocks/integrations/obsidianWikilinkBlock'
import {
  buildMindmapPreviewFromContentOrch,
  getDefaultMindmapBuildOptionsOrch,
  saveMindmapSceneFromContentOrch,
  suggestMindmapOutputPathOrch,
  type MindmapBuildOptions,
  type MindmapPreviewData,
} from '@/services/orchestrators/mindmapBuilderOrch'
import {
  buildInlineTextDiffSessionBlock,
  renderInlineTextDiffBlock,
  type InlineTextDiffDecisionBlock,
  type InlineTextDiffRenderedHunkBlock,
  type InlineTextDiffSessionBlock,
} from '@/services/lego_blocks/units/inlineTextDiffBlock'
import { cn } from '@/lib/utils'

interface MarkdownRichEditorBlockProps {
  value: string
  onChange: (next: string) => void
  currentPath?: string
  className?: string
  editorClassName?: string
  placeholder?: string
  compactMobile?: boolean
  /** When true the toolbar is always visible (legacy behavior). When false a toggle button is shown. Default: false. */
  toolbarAlwaysVisible?: boolean
  /** When false, hide formatting toolbar controls entirely (useful for non-markdown text editing). Default: true. */
  enableFormattingToolbar?: boolean
  /** Enables built-in AI assist controls in the editor toolbar and panel. Default: true. */
  enableAiAssist?: boolean
  /** Optional controlled AI panel state. */
  aiPanelOpen?: boolean
  /** Initial AI panel open state for uncontrolled mode. Default: false. */
  defaultAiPanelOpen?: boolean
  /** Called whenever the AI panel open state changes. */
  onAiPanelOpenChange?: (open: boolean) => void
  /** AI settings scope used to resolve provider/model. Default: markdown_editor. */
  aiAssistScope?: AiSettingsScope
  /** AI telemetry/use-case identifier. Default: markdown.assist. */
  aiAssistUseCase?: string
  /** Optional helper text shown under AI assist actions. */
  aiAssistHelperText?: string
  /** Disables AI action buttons when true. */
  aiAssistDisabled?: boolean
  /** Enables AI steward section in AI panel. Default: true. */
  aiStewardEnabled?: boolean
  /** Source file path for steward proposal generation. Defaults to currentPath. */
  aiStewardFilePath?: string
  /** Optional apply handler used by AI steward Accept action. */
  onAiStewardApplySuggestion?: (suggestion: StewardMetadataSuggestion) => void | Promise<void>
  /** Enables related thoughts section in AI panel. Default: true. */
  relatedThoughtsEnabled?: boolean
  /** Optional source file path for related-thought matching. Defaults to aiStewardFilePath/currentPath. */
  relatedThoughtsSourceFilePath?: string
  /** Related-thought result limit. Default: 6. */
  relatedThoughtsLimit?: number
  /** Minimum characters before related-thought lookup runs. Default: 24. */
  relatedThoughtsMinChars?: number
  /** Called when user opens a related-thought result. */
  onRelatedThoughtOpenPath?: (path: string) => void
  /** Called when user opens a related-thought result in a new app tab. */
  onRelatedThoughtOpenPathInNewTab?: (path: string) => void
}

export interface MarkdownRichEditorBlockHandle {
  undo: () => void
  redo: () => void
  focus: () => void
}

function wrapSelection(
  source: string,
  start: number,
  end: number,
  prefix: string,
  suffix: string,
  placeholder: string,
): { value: string; start: number; end: number } {
  const selected = source.slice(start, end)
  const text = selected || placeholder
  const value = `${source.slice(0, start)}${prefix}${text}${suffix}${source.slice(end)}`
  const nextStart = start + prefix.length
  const nextEnd = nextStart + text.length
  return { value, start: nextStart, end: nextEnd }
}

function prefixSelectionLines(
  source: string,
  start: number,
  end: number,
  formatter: (line: string, index: number) => string,
): { value: string; start: number; end: number } {
  const lineStart = source.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  const lineEndRaw = source.indexOf('\n', end)
  const lineEnd = lineEndRaw === -1 ? source.length : lineEndRaw
  const lines = source.slice(lineStart, lineEnd).split('\n')
  const patched = lines.map((line, index) => formatter(line, index)).join('\n')
  const value = `${source.slice(0, lineStart)}${patched}${source.slice(lineEnd)}`
  return { value, start: lineStart, end: lineStart + patched.length }
}

function insertWikilink(
  source: string,
  start: number,
  end: number,
): { value: string; start: number; end: number } {
  const selected = source.slice(start, end).trim()
  const rawTarget = selected || 'linked note'
  const target = toObsidianWikilinkTargetOrch(rawTarget) || rawTarget
  const wrapped = `[[${target}]]`
  const value = `${source.slice(0, start)}${wrapped}${source.slice(end)}`
  return {
    value,
    start: start + 2,
    end: start + 2 + target.length,
  }
}

function insertTextAtSelectionBlock(
  source: string,
  start: number,
  end: number,
  insert: string,
): { value: string; start: number; end: number } {
  const value = `${source.slice(0, start)}${insert}${source.slice(end)}`
  const next = start + insert.length
  return { value, start: next, end: next }
}

function getWikilinkCompletionQueryFromState(
  state: EditorState,
): { from: number; to: number; query: string } | null {
  const selection = state.selection.main
  if (!selection.empty) return null

  const cursor = selection.from
  const line = state.doc.lineAt(cursor)
  const beforeCursor = state.sliceDoc(line.from, cursor)
  const match = beforeCursor.match(/\[\[[^[\]\n]*$/)
  if (!match) return null

  const raw = match[0].slice(2)
  if (raw.includes('|')) return null

  const leadingWhitespace = raw.length - raw.trimStart().length
  return {
    from: cursor - raw.length + leadingWhitespace,
    to: cursor,
    query: raw.trim(),
  }
}

const TOOLBAR_BTN = 'rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground'
type MindmapToggleOptionKey =
  | 'includeFullText'
  | 'centerText'
  | 'multicolorBranches'
  | 'boxNodes'
  | 'roundedCorners'
  | 'fillSweep'

interface InlineDiffWidgetActionsBlock {
  onAccept: (hunkId: string) => void
  onReject: (hunkId: string) => void
  onReset: (hunkId: string) => void
  onUpdateAfterLines: (hunkId: string, nextAfterLines: string[]) => void
}

type InlineDiffWordOpBlock = { kind: 'equal' | 'added' | 'removed'; text: string }

function tokenizeInlineDiffWordOpsBlock(value: string): string[] {
  if (!value) return []
  return value.split(/(\s+)/).filter((token) => token.length > 0)
}

function buildInlineDiffWordOpsBlock(before: string, after: string): InlineDiffWordOpBlock[] {
  const a = tokenizeInlineDiffWordOpsBlock(before)
  const b = tokenizeInlineDiffWordOpsBlock(after)
  const n = a.length
  const m = b.length
  if (n === 0 && m === 0) return []

  const matrixCellLimit = 12_000
  if (n * m > matrixCellLimit) {
    return [
      ...(before ? [{ kind: 'removed' as const, text: before }] : []),
      ...(after ? [{ kind: 'added' as const, text: after }] : []),
    ]
  }

  const width = m + 1
  const lcs = new Uint16Array((n + 1) * (m + 1))
  const idx = (i: number, j: number) => i * width + j

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      if (a[i] === b[j]) {
        lcs[idx(i, j)] = lcs[idx(i + 1, j + 1)] + 1
      } else {
        const down = lcs[idx(i + 1, j)]
        const right = lcs[idx(i, j + 1)]
        lcs[idx(i, j)] = down >= right ? down : right
      }
    }
  }

  const ops: InlineDiffWordOpBlock[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: 'equal', text: a[i] })
      i += 1
      j += 1
      continue
    }
    const down = lcs[idx(i + 1, j)]
    const right = lcs[idx(i, j + 1)]
    if (down >= right) {
      ops.push({ kind: 'removed', text: a[i] })
      i += 1
    } else {
      ops.push({ kind: 'added', text: b[j] })
      j += 1
    }
  }
  while (i < n) {
    ops.push({ kind: 'removed', text: a[i] })
    i += 1
  }
  while (j < m) {
    ops.push({ kind: 'added', text: b[j] })
    j += 1
  }
  return ops
}

function appendInlineDiffWordPreviewBlock(
  container: HTMLElement,
  ops: InlineDiffWordOpBlock[],
  side: 'before' | 'after',
): void {
  const visible = ops.filter((op) => (
    op.kind === 'equal'
    || (side === 'before' && op.kind === 'removed')
    || (side === 'after' && op.kind === 'added')
  ))
  if (visible.length === 0) {
    container.textContent = '\u00a0'
    return
  }
  for (const op of visible) {
    const span = document.createElement('span')
    span.textContent = op.text
    if (side === 'before' && op.kind === 'removed') {
      span.className = 'ts-ai-inline-diff-word-removed'
    } else if (side === 'after' && op.kind === 'added') {
      span.className = 'ts-ai-inline-diff-word-added'
    }
    container.append(span)
  }
}

function buildLineStartOffsetsBlock(content: string): number[] {
  const offsets = [0]
  for (let index = 0; index < content.length; index += 1) {
    if (content[index] === '\n') offsets.push(index + 1)
  }
  return offsets
}

function lineStartFromOffsetsBlock(offsets: number[], line: number, fallback: number): number {
  if (line <= 0) return 0
  if (line >= offsets.length) return fallback
  return offsets[line]
}

function hunkLabelBlock(hunk: InlineTextDiffRenderedHunkBlock): string {
  if (hunk.kind === 'added') return 'Insert suggestion'
  if (hunk.kind === 'removed') return 'Delete suggestion'
  return 'Change suggestion'
}

class InlineDiffWidgetBlock extends WidgetType {
  constructor(
    private readonly hunk: InlineTextDiffRenderedHunkBlock,
    private readonly actions: InlineDiffWidgetActionsBlock,
  ) {
    super()
  }

  eq(other: InlineDiffWidgetBlock): boolean {
    return other.hunk.id === this.hunk.id
      && other.hunk.decision === this.hunk.decision
      && other.hunk.startLine === this.hunk.startLine
      && other.hunk.endLine === this.hunk.endLine
      && other.hunk.afterLines.join('\n') === this.hunk.afterLines.join('\n')
  }

  toDOM(): HTMLElement {
    const root = document.createElement('div')
    root.className = 'ts-ai-inline-diff-widget'

    const heading = document.createElement('div')
    heading.className = 'ts-ai-inline-diff-widget-heading'
    heading.textContent = `${hunkLabelBlock(this.hunk)} • ${this.hunk.decision}`
    root.append(heading)

    if (this.hunk.decision === 'pending') {
      const preview = document.createElement('div')
      preview.className = 'ts-ai-inline-diff-widget-preview'

      if (this.hunk.kind === 'changed' && this.hunk.beforeLines.length === 1 && this.hunk.afterLines.length === 1) {
        const wordDiffPreview = document.createElement('div')
        wordDiffPreview.className = 'ts-ai-inline-diff-widget-word-preview'
        const beforeWordLine = document.createElement('div')
        beforeWordLine.className = 'ts-ai-inline-diff-widget-word-before'
        const afterWordLine = document.createElement('div')
        afterWordLine.className = 'ts-ai-inline-diff-widget-word-after'
        const wordOps = buildInlineDiffWordOpsBlock(this.hunk.beforeLines[0], this.hunk.afterLines[0])
        appendInlineDiffWordPreviewBlock(beforeWordLine, wordOps, 'before')
        appendInlineDiffWordPreviewBlock(afterWordLine, wordOps, 'after')
        wordDiffPreview.append(beforeWordLine, afterWordLine)
        preview.append(wordDiffPreview)
      }

      const afterInput = document.createElement('textarea')
      afterInput.className = 'ts-ai-inline-diff-widget-after-input'
      afterInput.value = this.hunk.afterLines.join('\n')
      afterInput.rows = 1
      afterInput.placeholder = '(empty)'
      const maxHeightPx = 448
      const autoResizeAfterInput = () => {
        afterInput.style.height = '0px'
        const nextHeight = Math.min(afterInput.scrollHeight, maxHeightPx)
        afterInput.style.height = `${nextHeight}px`
        afterInput.style.overflowY = afterInput.scrollHeight > maxHeightPx ? 'auto' : 'hidden'
      }
      const stopBubbling = (event: Event) => {
        event.stopPropagation()
      }
      afterInput.addEventListener('click', stopBubbling)
      afterInput.addEventListener('mousedown', stopBubbling)
      afterInput.addEventListener('keydown', stopBubbling)
      afterInput.addEventListener('input', () => {
        const nextValue = afterInput.value
        const nextAfterLines = nextValue.length === 0 ? [] : nextValue.split('\n')
        this.actions.onUpdateAfterLines(this.hunk.id, nextAfterLines)
        autoResizeAfterInput()
      })
      requestAnimationFrame(autoResizeAfterInput)
      preview.append(afterInput)
      root.append(preview)
    } else {
      const note = document.createElement('div')
      note.className = 'ts-ai-inline-diff-widget-note'
      note.textContent = this.hunk.decision === 'accepted'
        ? 'Accepted. Editor body shows applied text.'
        : 'Rejected. Editor body keeps original text.'
      root.append(note)
    }

    const actions = document.createElement('div')
    actions.className = 'ts-ai-inline-diff-widget-actions'

    if (this.hunk.decision === 'pending') {
      const acceptButton = document.createElement('button')
      acceptButton.type = 'button'
      acceptButton.textContent = 'Accept'
      acceptButton.className = 'ts-ai-inline-diff-widget-btn ts-ai-inline-diff-widget-btn-accept'
      acceptButton.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        this.actions.onAccept(this.hunk.id)
      })

      const rejectButton = document.createElement('button')
      rejectButton.type = 'button'
      rejectButton.textContent = 'Reject'
      rejectButton.className = 'ts-ai-inline-diff-widget-btn ts-ai-inline-diff-widget-btn-reject'
      rejectButton.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        this.actions.onReject(this.hunk.id)
      })
      actions.append(acceptButton, rejectButton)
    } else {
      const resetButton = document.createElement('button')
      resetButton.type = 'button'
      resetButton.textContent = 'Reset'
      resetButton.className = 'ts-ai-inline-diff-widget-btn ts-ai-inline-diff-widget-btn-reset'
      resetButton.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        this.actions.onReset(this.hunk.id)
      })
      actions.append(resetButton)
    }

    root.append(actions)
    return root
  }

  ignoreEvent(): boolean {
    return false
  }
}

const MarkdownRichEditorBlock = forwardRef<MarkdownRichEditorBlockHandle, MarkdownRichEditorBlockProps>(function MarkdownRichEditorBlock({
  value,
  onChange,
  currentPath = '',
  className,
  editorClassName,
  placeholder = 'Write markdown...',
  compactMobile = false,
  toolbarAlwaysVisible = false,
  enableFormattingToolbar = true,
  enableAiAssist = true,
  aiPanelOpen: controlledAiPanelOpen,
  defaultAiPanelOpen = false,
  onAiPanelOpenChange,
  aiAssistScope = 'markdown_editor',
  aiAssistUseCase = 'markdown.assist',
  aiAssistHelperText,
  aiAssistDisabled = false,
  aiStewardEnabled = true,
  aiStewardFilePath,
  onAiStewardApplySuggestion,
  relatedThoughtsEnabled = true,
  relatedThoughtsSourceFilePath,
  relatedThoughtsLimit = 6,
  relatedThoughtsMinChars = 24,
  onRelatedThoughtOpenPath,
  onRelatedThoughtOpenPathInNewTab,
}, ref) {
  const { layout } = useUILayoutBlock()
  const isIphoneRuntime = useMemo(() => {
    const isIosPhoneSurface = layout.surface === 'capacitor-ios' && layout.mode === 'phone'
    if (isIosPhoneSurface) return true
    if (typeof navigator === 'undefined') return false
    return /iPhone/i.test(navigator.userAgent)
  }, [layout.mode, layout.surface])
  const editorViewRef = useRef<EditorView | null>(null)
  const [toolbarOpen, setToolbarOpen] = useState(false)
  const [internalAiPanelOpen, setInternalAiPanelOpen] = useState(defaultAiPanelOpen)
  const [wikilinkPickerOpen, setWikilinkPickerOpen] = useState(false)
  const [wikilinkQuery, setWikilinkQuery] = useState('')
  const [wikilinkSuggestions, setWikilinkSuggestions] = useState<WikilinkSuggestionBlock[]>([])
  const [wikilinkLoading, setWikilinkLoading] = useState(false)
  const [relatedThoughtsOpen, setRelatedThoughtsOpen] = useState(false)
  const [mindmapPanelOpen, setMindmapPanelOpen] = useState(false)
  const [mindmapImmersiveOpen, setMindmapImmersiveOpen] = useState(false)
  const [mindmapSettingsOpen, setMindmapSettingsOpen] = useState(false)
  const [mindmapOptions, setMindmapOptions] = useState<MindmapBuildOptions>(() => getDefaultMindmapBuildOptionsOrch())
  const [debouncedMindmapOptions, setDebouncedMindmapOptions] = useState<MindmapBuildOptions>(() => getDefaultMindmapBuildOptionsOrch())
  const [mindmapOutputPath, setMindmapOutputPath] = useState('')
  const [mindmapPreview, setMindmapPreview] = useState<MindmapPreviewData | null>(null)
  const [mindmapLoading, setMindmapLoading] = useState(false)
  const [mindmapSaving, setMindmapSaving] = useState(false)
  const [mindmapError, setMindmapError] = useState<string | null>(null)
  const [mindmapMessage, setMindmapMessage] = useState<string | null>(null)
  const lastMindmapSourcePathRef = useRef('')
  const pendingInlineWidgetScrollRestoreRef = useRef<{ top: number; left: number } | null>(null)
  const [inlineDiffSession, setInlineDiffSession] = useState<InlineTextDiffSessionBlock | null>(null)
  const [inlineDiffDecisions, setInlineDiffDecisions] = useState<Record<string, InlineTextDiffDecisionBlock>>({})
  const {
    aiSelectionLoading,
    selectedProvider,
    selectedModel,
    assistRunningAction,
    assistError,
    assistResultPill,
    assistSuggestion,
    customPromptHistory,
    runAssistAction,
    applyAssistSuggestion,
    dismissAssistSuggestion,
    clearAssistState,
  } = useAiAssistRuntimeBlock({
    scope: aiAssistScope,
    useCase: aiAssistUseCase,
  })

  const aiPanelOpen = controlledAiPanelOpen ?? internalAiPanelOpen
  const showToolbar = enableFormattingToolbar && (toolbarAlwaysVisible || toolbarOpen)
  const stewardFilePath = (aiStewardFilePath ?? currentPath ?? '').trim()
  const relatedSourceFilePath = (relatedThoughtsSourceFilePath ?? stewardFilePath).trim()
  const normalizedPath = currentPath.trim()
  const supportsMindmap = normalizedPath.length > 0
    && /\.md$/i.test(normalizedPath)
    && !/\.excalidraw\.md$/i.test(normalizedPath)
  const inlineDiffRender = useMemo(() => {
    if (!inlineDiffSession) return null
    return renderInlineTextDiffBlock(inlineDiffSession, inlineDiffDecisions)
  }, [inlineDiffDecisions, inlineDiffSession])
  const inlineDiffHunkIds = useMemo(
    () => inlineDiffSession?.hunks.map(hunk => hunk.id) ?? [],
    [inlineDiffSession],
  )
  const mindmapStatsLine = useMemo(() => {
    if (!mindmapPreview) return null
    return `${mindmapPreview.sourceLines} lines • ${mindmapPreview.headingCount} headings • ${mindmapPreview.nodeCount} nodes • ${mindmapPreview.connectionCount} links • build ${Math.round(mindmapPreview.timingMs.build)} ms`
  }, [mindmapPreview])
  const mindmapPreviewCanvas = (
    <>
      {mindmapPreview && (
        <ExcalidrawDocumentBlock
          content={mindmapPreview.sceneMarkdown}
          className="h-full"
        />
      )}
      {mindmapLoading && (
        <div className={`absolute inset-0 flex items-center justify-center text-xs text-muted-foreground ${mindmapPreview ? 'bg-background/50 backdrop-blur-[1px]' : ''}`}>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Building mindmap preview...
        </div>
      )}
      {!mindmapLoading && !mindmapPreview && (
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
          No preview available.
        </div>
      )}
    </>
  )

  useEffect(() => {
    if (!aiPanelOpen) setRelatedThoughtsOpen(false)
  }, [aiPanelOpen])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedMindmapOptions(mindmapOptions)
    }, 120)
    return () => {
      window.clearTimeout(timer)
    }
  }, [mindmapOptions])

  useEffect(() => {
    if (!supportsMindmap) {
      setMindmapPanelOpen(false)
      setMindmapImmersiveOpen(false)
      setMindmapPreview(null)
      setMindmapOutputPath('')
      setMindmapError(null)
      setMindmapMessage(null)
      lastMindmapSourcePathRef.current = ''
      return
    }
    if (lastMindmapSourcePathRef.current === normalizedPath) return
    lastMindmapSourcePathRef.current = normalizedPath
    setMindmapOutputPath(suggestMindmapOutputPathOrch(normalizedPath))
    setMindmapError(null)
    setMindmapMessage(null)
  }, [normalizedPath, supportsMindmap])

  useEffect(() => {
    if (!mindmapPanelOpen || !supportsMindmap) {
      setMindmapLoading(false)
      if (!mindmapPanelOpen) setMindmapImmersiveOpen(false)
      return
    }
    let cancelled = false
    setMindmapLoading(true)
    setMindmapError(null)
    const timer = window.setTimeout(() => {
      try {
        const nextPreview = buildMindmapPreviewFromContentOrch({
          inputPath: normalizedPath,
          content: value,
          options: debouncedMindmapOptions,
        })
        if (cancelled) return
        setMindmapPreview(nextPreview)
      } catch (err) {
        if (cancelled) return
        setMindmapPreview(null)
        setMindmapError(err instanceof Error ? err.message : 'Failed to build mindmap preview')
      } finally {
        if (!cancelled) setMindmapLoading(false)
      }
    }, 10)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [debouncedMindmapOptions, mindmapPanelOpen, normalizedPath, supportsMindmap, value])

  useEffect(() => {
    if (!mindmapImmersiveOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setMindmapImmersiveOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [mindmapImmersiveOpen])

  useLayoutEffect(() => {
    const pending = pendingInlineWidgetScrollRestoreRef.current
    if (!pending) return
    const view = editorViewRef.current
    if (view) {
      view.scrollDOM.scrollTop = pending.top
      view.scrollDOM.scrollLeft = pending.left
    }
    pendingInlineWidgetScrollRestoreRef.current = null
  }, [inlineDiffSession])

  const setAiPanelOpen = useCallback((open: boolean) => {
    if (controlledAiPanelOpen === undefined) {
      setInternalAiPanelOpen(open)
    }
    onAiPanelOpenChange?.(open)
  }, [controlledAiPanelOpen, onAiPanelOpenChange])

  const toggleAiPanel = useCallback(() => {
    setAiPanelOpen(!aiPanelOpen)
  }, [aiPanelOpen, setAiPanelOpen])

  const toggleMindmapPanel = useCallback(() => {
    setMindmapPanelOpen((prev) => !prev)
  }, [])

  const toggleMindmapOption = useCallback((key: MindmapToggleOptionKey) => {
    setMindmapOptions(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const handleSaveMindmap = useCallback(async () => {
    if (!supportsMindmap) return

    setMindmapSaving(true)
    setMindmapError(null)
    setMindmapMessage(null)
    try {
      const result = await saveMindmapSceneFromContentOrch({
        inputPath: normalizedPath,
        content: value,
        options: mindmapOptions,
        outputPath: mindmapOutputPath,
      })
      setMindmapOutputPath(result.outputPath)
      setMindmapMessage(
        `${result.message} (${Math.round(result.timingMs.total)} ms total; write ${Math.round(result.timingMs.write)} ms)`,
      )
    } catch (err) {
      setMindmapError(err instanceof Error ? err.message : 'Failed to save mindmap')
    } finally {
      setMindmapSaving(false)
    }
  }, [mindmapOptions, mindmapOutputPath, normalizedPath, supportsMindmap, value])

  const acceptInlineDiffHunk = useCallback((hunkId: string) => {
    setInlineDiffDecisions(prev => ({ ...prev, [hunkId]: 'accepted' }))
  }, [])

  const rejectInlineDiffHunk = useCallback((hunkId: string) => {
    setInlineDiffDecisions(prev => ({ ...prev, [hunkId]: 'rejected' }))
  }, [])

  const resetInlineDiffHunk = useCallback((hunkId: string) => {
    setInlineDiffDecisions(prev => ({ ...prev, [hunkId]: 'pending' }))
  }, [])

  const updateInlineDiffHunkAfterLines = useCallback((hunkId: string, nextAfterLines: string[]) => {
    const currentSession = inlineDiffSession
    if (!currentSession) return
    const currentHunk = currentSession.hunks.find(hunk => hunk.id === hunkId)
    if (!currentHunk) return
    if (currentHunk.afterLines.join('\n') === nextAfterLines.join('\n')) return

    const view = editorViewRef.current
    if (view) {
      pendingInlineWidgetScrollRestoreRef.current = {
        top: view.scrollDOM.scrollTop,
        left: view.scrollDOM.scrollLeft,
      }
    }

    setInlineDiffSession((prev) => {
      if (!prev) return prev
      const nextHunks = prev.hunks.map((hunk) => {
        if (hunk.id !== hunkId) return hunk
        return { ...hunk, afterLines: nextAfterLines }
      })
      return { ...prev, hunks: nextHunks }
    })
  }, [inlineDiffSession])

  const startInlineDiffReview = useCallback((suggestedContentOverride?: string) => {
    if (!assistSuggestion) return
    const nextSuggestedContent = suggestedContentOverride ?? assistSuggestion.suggestedContent
    const session = buildInlineTextDiffSessionBlock(
      assistSuggestion.originalContent,
      nextSuggestedContent,
    )
    if (session.hunks.length === 0) {
      dismissAssistSuggestion()
      if (value !== nextSuggestedContent) onChange(nextSuggestedContent)
      return
    }
    setInlineDiffSession(session)
    setInlineDiffDecisions({})
    dismissAssistSuggestion()
    if (value !== assistSuggestion.originalContent) onChange(assistSuggestion.originalContent)
  }, [assistSuggestion, dismissAssistSuggestion, onChange, value])

  const acceptAllInlineDiffHunks = useCallback(() => {
    if (inlineDiffHunkIds.length === 0) return
    setInlineDiffDecisions(Object.fromEntries(inlineDiffHunkIds.map(id => [id, 'accepted' as const])))
  }, [inlineDiffHunkIds])

  const rejectAllInlineDiffHunks = useCallback(() => {
    if (inlineDiffHunkIds.length === 0) return
    setInlineDiffDecisions(Object.fromEntries(inlineDiffHunkIds.map(id => [id, 'rejected' as const])))
  }, [inlineDiffHunkIds])

  const discardRejectedAndAcceptRemainingInlineDiffHunks = useCallback(() => {
    if (!inlineDiffSession) return
    const finalDecisions = Object.fromEntries(
      inlineDiffSession.hunks.map((hunk) => [
        hunk.id,
        inlineDiffDecisions[hunk.id] === 'rejected' ? 'rejected' as const : 'accepted' as const,
      ]),
    )
    const next = renderInlineTextDiffBlock(inlineDiffSession, finalDecisions)
    if (value !== next.content) onChange(next.content)
    setInlineDiffSession(null)
    setInlineDiffDecisions({})
  }, [inlineDiffDecisions, inlineDiffSession, onChange, value])

  const finishInlineDiffReview = useCallback(() => {
    setInlineDiffSession(null)
    setInlineDiffDecisions({})
  }, [])

  const cancelInlineDiffReview = useCallback(() => {
    if (inlineDiffSession && value !== inlineDiffSession.originalContent) {
      onChange(inlineDiffSession.originalContent)
    }
    setInlineDiffSession(null)
    setInlineDiffDecisions({})
  }, [inlineDiffSession, onChange, value])

  const undoEditor = () => {
    const view = editorViewRef.current
    if (!view) return
    undo(view)
    view.focus()
  }

  const redoEditor = () => {
    const view = editorViewRef.current
    if (!view) return
    redo(view)
    view.focus()
  }

  useImperativeHandle(ref, () => ({
    undo: undoEditor,
    redo: redoEditor,
    focus: () => {
      editorViewRef.current?.focus()
    },
  }))

  const applyWikilinkSuggestion = useCallback((suggestion: WikilinkSuggestionBlock) => {
    const view = editorViewRef.current
    if (!view) return

    const query = getWikilinkCompletionQueryFromState(view.state)
    if (!query) return

    const target = toObsidianWikilinkTargetOrch(suggestion.target) || suggestion.target
    const hasClosingBrackets = view.state.sliceDoc(query.to, query.to + 2) === ']]'
    const insertValue = hasClosingBrackets ? target : `${target}]]`

    view.dispatch({
      changes: { from: query.from, to: query.to, insert: insertValue },
      selection: { anchor: query.from + target.length },
    })
    view.focus()
    setWikilinkPickerOpen(false)
  }, [])

  const applyWikilinkQuery = useCallback((nextQuery: string) => {
    const view = editorViewRef.current
    if (!view) return

    const query = getWikilinkCompletionQueryFromState(view.state)
    if (!query) return

    view.dispatch({
      changes: { from: query.from, to: query.to, insert: nextQuery },
      selection: { anchor: query.from + nextQuery.length },
    })
    view.focus()
  }, [])

  useEffect(() => {
    if (!wikilinkPickerOpen) {
      setWikilinkSuggestions([])
      setWikilinkLoading(false)
      return
    }

    let canceled = false
    setWikilinkLoading(true)
    void getWikilinkSuggestionsOrch({
      currentPath,
      query: wikilinkQuery,
      limit: UNIVERSAL_SEARCH_DROPDOWN_PRESET_BLOCK.limit ?? 80,
    })
      .then((nextSuggestions) => {
        if (canceled) return
        setWikilinkSuggestions(nextSuggestions)
      })
      .catch(() => {
        if (canceled) return
        setWikilinkSuggestions([])
      })
      .finally(() => {
        if (canceled) return
        setWikilinkLoading(false)
      })

    return () => {
      canceled = true
    }
  }, [currentPath, wikilinkPickerOpen, wikilinkQuery])

  useEffect(() => {
    if (!inlineDiffRender) return
    if (value === inlineDiffRender.content) return
    onChange(inlineDiffRender.content)
  }, [inlineDiffRender, onChange, value])

  const inlineDiffDecorations = useMemo(() => {
    if (!inlineDiffRender) return null
    const offsets = buildLineStartOffsetsBlock(value)
    const ranges: any[] = []
    for (const hunk of inlineDiffRender.hunks) {
      // Anchor widgets at the end of the affected range so they render below the current line block.
      const anchor = lineStartFromOffsetsBlock(offsets, hunk.endLine, value.length)
      ranges.push(Decoration.widget({
        widget: new InlineDiffWidgetBlock(hunk, {
          onAccept: acceptInlineDiffHunk,
          onReject: rejectInlineDiffHunk,
          onReset: resetInlineDiffHunk,
          onUpdateAfterLines: updateInlineDiffHunkAfterLines,
        }),
        side: 1,
        block: true,
      }).range(anchor))

      const lineClass = hunk.decision === 'accepted'
        ? 'ts-ai-inline-diff-line-accepted'
        : (hunk.decision === 'pending' && hunk.kind === 'added'
            ? 'ts-ai-inline-diff-line-pending-added'
            : '')
      if (!lineClass) continue
      for (let lineIndex = hunk.startLine; lineIndex < hunk.endLine; lineIndex += 1) {
        const lineStart = lineStartFromOffsetsBlock(offsets, lineIndex, value.length)
        ranges.push(Decoration.line({ class: lineClass }).range(lineStart))
      }
    }
    return Decoration.set(ranges, true)
  }, [acceptInlineDiffHunk, inlineDiffRender, rejectInlineDiffHunk, resetInlineDiffHunk, updateInlineDiffHunkAfterLines, value])

  const extensions = useMemo(() => {
    const uiTheme = EditorView.theme({
      '&': {
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 auto',
        height: '100%',
        minHeight: '100%',
        backgroundColor: 'transparent',
        maxWidth: '100%',
        overflow: 'hidden',
      },
      '.cm-scroller': {
        height: '100%',
        minHeight: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        backgroundColor: 'transparent',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        lineHeight: '1.6',
      },
      '.cm-line': {
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
      },
      '.cm-content': {
        minHeight: '100%',
        padding: compactMobile ? '0.6rem 0.6rem 0.6rem 0.45rem' : '0.75rem 0.75rem 0.75rem 0.5rem',
        whiteSpace: 'pre-wrap',
      },
      '.cm-gutters': {
        backgroundColor: 'transparent',
        border: 'none',
        minHeight: '100%',
        marginRight: compactMobile ? '0.25rem' : '0.4rem',
        paddingLeft: compactMobile ? '0.1rem' : '0.25rem',
      },
      '.cm-lineNumbers .cm-gutterElement': {
        padding: '0 0.35rem 0 0',
      },
      '.cm-selectionBackground, ::selection': {
        backgroundColor: 'hsl(var(--primary) / 0.22)',
      },
      '.cm-focused': {
        outline: 'none',
      },
      '.ts-ai-inline-diff-widget': {
        margin: compactMobile ? '0.2rem 0.2rem 0.35rem 0' : '0.25rem 0.3rem 0.4rem 0',
        border: '1px solid hsl(var(--border) / 0.8)',
        borderRadius: '0.45rem',
        backgroundColor: 'hsl(var(--background))',
        padding: compactMobile ? '0.35rem' : '0.45rem',
        display: 'grid',
        gap: '0.3rem',
      },
      '.ts-ai-inline-diff-widget-heading': {
        fontSize: '0.72rem',
        lineHeight: '1rem',
        color: 'hsl(var(--muted-foreground))',
      },
      '.ts-ai-inline-diff-widget-preview': {
        display: 'grid',
        gap: '0.25rem',
      },
      '.ts-ai-inline-diff-widget-word-preview': {
        display: 'grid',
        gap: '0.2rem',
      },
      '.ts-ai-inline-diff-widget-word-before': {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        whiteSpace: 'pre-wrap',
        backgroundColor: 'hsl(38 92% 50% / 0.09)',
        borderRadius: '0.35rem',
        padding: '0.3rem 0.4rem',
      },
      '.ts-ai-inline-diff-widget-word-after': {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        whiteSpace: 'pre-wrap',
        backgroundColor: 'hsl(142 76% 36% / 0.12)',
        borderRadius: '0.35rem',
        padding: '0.3rem 0.4rem',
      },
      '.ts-ai-inline-diff-word-removed': {
        textDecoration: 'line-through',
        borderRadius: '0.2rem',
        backgroundColor: 'hsl(var(--destructive) / 0.25)',
        paddingInline: '0.1rem',
      },
      '.ts-ai-inline-diff-word-added': {
        borderRadius: '0.2rem',
        backgroundColor: 'hsl(142 76% 36% / 0.25)',
        paddingInline: '0.1rem',
      },
      '.ts-ai-inline-diff-widget-note': {
        fontSize: '0.72rem',
        lineHeight: '1rem',
        color: 'hsl(var(--muted-foreground))',
      },
      '.ts-ai-inline-diff-widget-before': {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        whiteSpace: 'pre-wrap',
        backgroundColor: 'hsl(38 92% 50% / 0.09)',
        borderRadius: '0.35rem',
        padding: '0.3rem 0.4rem',
      },
      '.ts-ai-inline-diff-widget-after': {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        whiteSpace: 'pre-wrap',
        backgroundColor: 'hsl(142 76% 36% / 0.12)',
        borderRadius: '0.35rem',
        padding: '0.3rem 0.4rem',
      },
      '.ts-ai-inline-diff-widget-after-input': {
        width: '100%',
        resize: 'none',
        minHeight: '2.2rem',
        maxHeight: '28rem',
        overflowY: 'hidden',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        whiteSpace: 'pre-wrap',
        backgroundColor: 'hsl(142 76% 36% / 0.12)',
        borderRadius: '0.35rem',
        border: '1px solid hsl(142 76% 36% / 0.28)',
        padding: '0.3rem 0.4rem',
      },
      '.ts-ai-inline-diff-widget-actions': {
        display: 'flex',
        gap: '0.35rem',
      },
      '.ts-ai-inline-diff-widget-btn': {
        border: '1px solid hsl(var(--border) / 0.9)',
        borderRadius: '0.35rem',
        backgroundColor: 'hsl(var(--background))',
        fontSize: '0.72rem',
        lineHeight: '1rem',
        padding: '0.2rem 0.45rem',
        cursor: 'pointer',
      },
      '.ts-ai-inline-diff-widget-btn-accept': {
        borderColor: 'hsl(142 76% 36% / 0.45)',
        color: 'hsl(142 76% 28%)',
      },
      '.ts-ai-inline-diff-widget-btn-reject': {
        borderColor: 'hsl(var(--destructive) / 0.45)',
        color: 'hsl(var(--destructive))',
      },
      '.ts-ai-inline-diff-widget-btn-reset': {
        color: 'hsl(var(--foreground))',
      },
      '.cm-line.ts-ai-inline-diff-line-accepted': {
        backgroundColor: 'hsl(142 76% 36% / 0.12)',
      },
      '.cm-line.ts-ai-inline-diff-line-pending-added': {
        backgroundColor: 'hsl(142 76% 36% / 0.08)',
      },
    })

    const nextExtensions: Extension[] = [
      markdown(),
      EditorView.lineWrapping,
      cmPlaceholder(placeholder),
      uiTheme,
      ...(inlineDiffRender ? [EditorState.readOnly.of(true)] : []),
      ...(inlineDiffDecorations ? [EditorView.decorations.of(inlineDiffDecorations)] : []),
      EditorView.domEventHandlers({
        paste: (event, view) => {
          const pastedText = event.clipboardData?.getData('text/plain') ?? ''
          const parsedTable = detectAndParseDelimitedTableBlock(pastedText)
          if (!parsedTable) return false

          event.preventDefault()
          const markdownTableText = buildMarkdownTableFromRowsBlock(parsedTable.rows)
          const { from, to } = view.state.selection.main
          view.dispatch({
            changes: { from, to, insert: markdownTableText },
            selection: { anchor: from + markdownTableText.length },
          })
          return true
        },
      }),
      EditorView.updateListener.of((update) => {
        const query = getWikilinkCompletionQueryFromState(update.state)
        if (!query) {
          setWikilinkPickerOpen(false)
          setWikilinkQuery('')
          return
        }

        setWikilinkQuery(query.query)
        setWikilinkPickerOpen(true)
      }),
      keymap.of([]),
    ]
    return nextExtensions
  }, [compactMobile, inlineDiffDecorations, inlineDiffRender, placeholder])

  const applyPatch = (patchFactory: (text: string, from: number, to: number) => { value: string; start: number; end: number }) => {
    const view = editorViewRef.current
    if (!view) return
    const state = view.state
    const { from, to } = state.selection.main
    const source = state.doc.toString()
    const patch = patchFactory(source, from, to)
    view.dispatch({
      changes: {
        from: 0,
        to: source.length,
        insert: patch.value,
      },
      selection: {
        anchor: patch.start,
        head: patch.end,
      },
    })
    view.focus()
  }

  const handleEditorChange = useCallback((next: string) => {
    onChange(next)
    if (assistSuggestion || assistError) clearAssistState()
  }, [assistError, assistSuggestion, clearAssistState, onChange])

  return (
    <div className={cn('ltm-markdown-rich-editor relative flex min-h-0 flex-col bg-white', className)}>
      {/* Toolbar toggle button (only when not always visible) */}
      {enableFormattingToolbar && !toolbarAlwaysVisible && (
        <div className="flex items-center justify-end gap-1 px-2 pt-1.5">
          {enableAiAssist && !showToolbar && (
            <button
              type="button"
              onClick={toggleAiPanel}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground',
                aiPanelOpen && 'bg-muted text-foreground',
              )}
              title={aiPanelOpen ? 'Hide AI tools' : 'Show AI tools'}
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI
            </button>
          )}
          {supportsMindmap && !showToolbar && (
            <button
              type="button"
              onClick={toggleMindmapPanel}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground',
                mindmapPanelOpen && 'bg-muted text-foreground',
              )}
              title={mindmapPanelOpen ? 'Hide mindmap tools' : 'Show mindmap tools'}
            >
              <Workflow className="h-3.5 w-3.5" />
              Mindmap
            </button>
          )}
          <button
            type="button"
            onClick={() => setToolbarOpen(prev => !prev)}
            className={cn(
              'rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground',
              toolbarOpen && 'bg-muted text-foreground',
            )}
            title={toolbarOpen ? 'Hide formatting' : 'Show formatting'}
          >
            <PenLine className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Formatting toolbar */}
      {showToolbar && (
        <div className="sticky top-0 z-30 flex flex-wrap items-center gap-1 border-b border-border/20 bg-background/95 p-2 backdrop-blur">
          <button type="button" onClick={() => applyPatch((text, from, to) => wrapSelection(text, from, to, '# ', '', 'Heading'))} className={TOOLBAR_BTN} title="Heading">
            <Heading1 className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => applyPatch((text, from, to) => wrapSelection(text, from, to, '**', '**', 'bold text'))} className={TOOLBAR_BTN} title="Bold">
            <Bold className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => applyPatch((text, from, to) => wrapSelection(text, from, to, '*', '*', 'italic text'))} className={TOOLBAR_BTN} title="Italic">
            <Italic className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => applyPatch((text, from, to) => wrapSelection(text, from, to, '`', '`', 'code'))} className={TOOLBAR_BTN} title="Code">
            <Code className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => applyPatch((text, from, to) => wrapSelection(text, from, to, '[', '](https://)', 'link text'))} className={TOOLBAR_BTN} title="Link">
            <Link2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => applyPatch((text, from, to) => insertTextAtSelectionBlock(text, from, to, buildMarkdownTableTemplateBlock(3, 2)))}
            className={TOOLBAR_BTN}
            title="Insert table"
          >
            <Table className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => applyPatch(formatMarkdownTableAtSelectionBlock)}
            className="rounded-md px-1.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Format table"
          >
            Fmt Tbl
          </button>
          <button type="button" onClick={() => applyPatch(insertWikilink)} className="rounded-md px-1.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground" title="Wikilink">
            [[ ]]
          </button>
          <button type="button" onClick={() => applyPatch((text, from, to) => prefixSelectionLines(text, from, to, (line) => `> ${line}`))} className={TOOLBAR_BTN} title="Quote">
            <Quote className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => applyPatch((text, from, to) => prefixSelectionLines(text, from, to, (line) => `- ${line}`))} className={TOOLBAR_BTN} title="Bullet list">
            <List className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => applyPatch((text, from, to) => prefixSelectionLines(text, from, to, (line, i) => `${i + 1}. ${line}`))} className={TOOLBAR_BTN} title="Numbered list">
            <ListOrdered className="h-4 w-4" />
          </button>
          <button type="button" onClick={undoEditor} className={TOOLBAR_BTN} title="Undo">
            <RotateCcw className="h-4 w-4" />
          </button>
          <button type="button" onClick={redoEditor} className={TOOLBAR_BTN} title="Redo">
            <RotateCw className="h-4 w-4" />
          </button>
          {(enableAiAssist || supportsMindmap) && (
            <span className="mx-1 h-4 w-px bg-border/60" aria-hidden="true" />
          )}
          {enableAiAssist && (
            <button
              type="button"
              onClick={toggleAiPanel}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground',
                aiPanelOpen && 'bg-muted text-foreground',
              )}
              title={aiPanelOpen ? 'Hide AI tools' : 'Show AI tools'}
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI
            </button>
          )}
          {supportsMindmap && (
            <button
              type="button"
              onClick={toggleMindmapPanel}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground',
                mindmapPanelOpen && 'bg-muted text-foreground',
              )}
              title={mindmapPanelOpen ? 'Hide mindmap tools' : 'Show mindmap tools'}
            >
              <Workflow className="h-3.5 w-3.5" />
              Mindmap
            </button>
          )}
        </div>
      )}

      {supportsMindmap && mindmapPanelOpen && (
        <div className="space-y-3 border-b border-border/30 bg-muted/[0.08] px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm font-medium text-foreground">Mindmap Preview</div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
            <button
              type="button"
              onClick={() => setMindmapSettingsOpen(prev => !prev)}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted"
            >
              <Settings2 className="h-3.5 w-3.5" />
              {mindmapSettingsOpen ? 'Hide settings' : 'Show settings'}
            </button>
            <input
              type="text"
              value={mindmapOutputPath}
              onChange={(event) => setMindmapOutputPath(event.target.value)}
              placeholder="Mindmap output path"
              className="h-8 w-full rounded-md border border-border/60 bg-background px-3 text-xs text-foreground"
            />
            <button
              type="button"
              onClick={() => { void handleSaveMindmap() }}
              disabled={mindmapLoading || mindmapSaving || !mindmapOutputPath.trim()}
              className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mindmapSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Save mindmap
                </>
              )}
            </button>
          </div>

          {mindmapSettingsOpen && (
            <div className="space-y-3 rounded-md border border-border/60 bg-background/70 p-3">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <label className="space-y-1 text-xs">
                  <span className="font-medium text-foreground">Growth mode</span>
                  <select
                    className="h-8 w-full rounded-md border border-border/60 bg-background px-2"
                    value={mindmapOptions.growthMode}
                    onChange={(event) => setMindmapOptions(prev => ({
                      ...prev,
                      growthMode: event.target.value as MindmapBuildOptions['growthMode'],
                    }))}
                  >
                    <option value="radial">Radial</option>
                    <option value="right-facing">Right-facing</option>
                    <option value="left-facing">Left-facing</option>
                    <option value="right-left">Right-left</option>
                    <option value="up-facing">Up-facing</option>
                    <option value="down-facing">Down-facing</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs">
                  <span className="font-medium text-foreground">Connector type</span>
                  <select
                    className="h-8 w-full rounded-md border border-border/60 bg-background px-2"
                    value={mindmapOptions.arrowType}
                    onChange={(event) => setMindmapOptions(prev => ({
                      ...prev,
                      arrowType: event.target.value as MindmapBuildOptions['arrowType'],
                    }))}
                  >
                    <option value="curved">Curved</option>
                    <option value="straight">Straight</option>
                    <option value="elbow">Elbow</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs">
                  <span className="font-medium text-foreground">Font scale</span>
                  <select
                    className="h-8 w-full rounded-md border border-border/60 bg-background px-2"
                    value={mindmapOptions.fontScale}
                    onChange={(event) => setMindmapOptions(prev => ({
                      ...prev,
                      fontScale: event.target.value as MindmapBuildOptions['fontScale'],
                    }))}
                  >
                    <option value="normal">Normal</option>
                    <option value="fibonacci">Fibonacci</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs">
                  <span className="font-medium text-foreground">Font family</span>
                  <select
                    className="h-8 w-full rounded-md border border-border/60 bg-background px-2"
                    value={mindmapOptions.fontFamily}
                    onChange={(event) => setMindmapOptions(prev => ({
                      ...prev,
                      fontFamily: event.target.value as MindmapBuildOptions['fontFamily'],
                    }))}
                  >
                    <option value="helvetica">Helvetica</option>
                    <option value="excalidraw">Excalidraw Script</option>
                    <option value="cascadia">Cascadia</option>
                    <option value="virgil">Virgil</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs">
                  <span className="font-medium text-foreground">Max heading depth</span>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={mindmapOptions.maxDepth}
                    onChange={(event) => setMindmapOptions(prev => ({
                      ...prev,
                      maxDepth: Math.max(1, Math.min(6, Number(event.target.value) || 1)),
                    }))}
                    className="h-8 w-full rounded-md border border-border/60 bg-background px-2"
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span className="font-medium text-foreground">Wrap width (px)</span>
                  <input
                    type="number"
                    min={100}
                    max={10000}
                    value={mindmapOptions.maxWrapWidth}
                    onChange={(event) => setMindmapOptions(prev => ({
                      ...prev,
                      maxWrapWidth: Math.max(100, Math.min(10000, Number(event.target.value) || 10000)),
                    }))}
                    className="h-8 w-full rounded-md border border-border/60 bg-background px-2"
                  />
                </label>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="flex items-center justify-between rounded-md border border-border/60 bg-background px-2.5 py-2 text-xs text-foreground">
                  Include full section text
                  <input
                    type="checkbox"
                    checked={mindmapOptions.includeFullText}
                    onChange={() => toggleMindmapOption('includeFullText')}
                    className="h-3.5 w-3.5"
                  />
                </label>
                <label className="flex items-center justify-between rounded-md border border-border/60 bg-background px-2.5 py-2 text-xs text-foreground">
                  Fill sweep
                  <input
                    type="checkbox"
                    checked={mindmapOptions.fillSweep}
                    onChange={() => toggleMindmapOption('fillSweep')}
                    className="h-3.5 w-3.5"
                  />
                </label>
                <label className="flex items-center justify-between rounded-md border border-border/60 bg-background px-2.5 py-2 text-xs text-foreground">
                  Center text
                  <input
                    type="checkbox"
                    checked={mindmapOptions.centerText}
                    onChange={() => toggleMindmapOption('centerText')}
                    className="h-3.5 w-3.5"
                  />
                </label>
                <label className="flex items-center justify-between rounded-md border border-border/60 bg-background px-2.5 py-2 text-xs text-foreground">
                  Multicolor branches
                  <input
                    type="checkbox"
                    checked={mindmapOptions.multicolorBranches}
                    onChange={() => toggleMindmapOption('multicolorBranches')}
                    className="h-3.5 w-3.5"
                  />
                </label>
                <label className="flex items-center justify-between rounded-md border border-border/60 bg-background px-2.5 py-2 text-xs text-foreground">
                  Box nodes
                  <input
                    type="checkbox"
                    checked={mindmapOptions.boxNodes}
                    onChange={() => toggleMindmapOption('boxNodes')}
                    className="h-3.5 w-3.5"
                  />
                </label>
                <label className="flex items-center justify-between rounded-md border border-border/60 bg-background px-2.5 py-2 text-xs text-foreground">
                  Rounded corners
                  <input
                    type="checkbox"
                    checked={mindmapOptions.roundedCorners}
                    onChange={() => toggleMindmapOption('roundedCorners')}
                    className="h-3.5 w-3.5"
                  />
                </label>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {mindmapStatsLine ?? 'Build a preview, then pop out for a larger view.'}
            </div>
            <button
              type="button"
              onClick={() => setMindmapImmersiveOpen(true)}
              disabled={!mindmapPreview && !mindmapLoading}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Pop out
            </button>
          </div>

          <div className="relative h-[42vh] min-h-[280px] overflow-hidden rounded-md border border-border/60 bg-background">
            {mindmapPreviewCanvas}
          </div>

          {mindmapError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {mindmapError}
            </div>
          )}
          {mindmapMessage && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {mindmapMessage}
            </div>
          )}
        </div>
      )}

      {supportsMindmap && mindmapImmersiveOpen && (
        <div className="fixed inset-2 z-[70] sm:inset-4">
          <div
            className="absolute inset-0 rounded-xl bg-black/45 backdrop-blur-[1px]"
            onClick={() => setMindmapImmersiveOpen(false)}
          />
          <div className="relative flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-background shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">Mindmap Preview (Pop-out)</div>
                <div className="truncate text-xs text-muted-foreground">{mindmapStatsLine ?? 'Previewing current markdown content'}</div>
              </div>
              <button
                type="button"
                onClick={() => setMindmapImmersiveOpen(false)}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" />
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 p-2">
              <div className="relative h-full overflow-hidden rounded-md border border-border/60 bg-background">
                {mindmapPreviewCanvas}
              </div>
            </div>
          </div>
        </div>
      )}

      {enableAiAssist && aiPanelOpen && (
        <div className="space-y-3 border-b border-border/30 bg-muted/[0.08] px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/50 bg-background/70 px-2 py-2">
            <span className="text-xs text-foreground">
              {selectedProvider && selectedModel ? `${selectedProvider} / ${selectedModel}` : 'No AI provider'}
            </span>
            <span className={cn(
              'text-xs',
              assistRunningAction ? 'text-amber-700' : 'text-muted-foreground',
            )}>
              {assistRunningAction ? `Assist running: ${assistRunningAction}` : 'Assist idle'}
            </span>
            {assistResultPill && (
              <span className={cn(
                'inline-flex h-8 items-center rounded-md border px-2 text-xs',
                assistResultPill.tone === 'success' && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700',
                assistResultPill.tone === 'error' && 'border-destructive/40 bg-destructive/10 text-destructive',
                assistResultPill.tone === 'neutral' && 'border-border/60 bg-background text-muted-foreground',
              )}>
                {assistResultPill.text}
              </span>
            )}
          </div>

          {aiStewardEnabled && (
            <>
              <div className="h-px bg-border/50" />
              <AiStewardPanelBlock
                filePath={stewardFilePath}
                disabled={aiAssistDisabled}
                onApplySuggestion={onAiStewardApplySuggestion}
              />
            </>
          )}

          {relatedThoughtsEnabled && (
            <>
              <div className="h-px bg-border/50" />
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-foreground">
                  AI suggested related thoughts
                </div>
                <button
                  type="button"
                  onClick={() => setRelatedThoughtsOpen((prev) => !prev)}
                  className="inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted"
                >
                  {relatedThoughtsOpen ? 'Hide related thoughts' : 'Show related thoughts'}
                </button>
              </div>
              <div className="text-xs text-muted-foreground">
                Related thoughts are surfaced via lexical similarity from your thought cache.
              </div>
              {relatedThoughtsOpen && (
                <RelatedThoughtsPanelBlock
                  text={value}
                  enabled={enableAiAssist && aiPanelOpen}
                  disabled={aiAssistDisabled}
                  sourceFilePath={relatedSourceFilePath || undefined}
                  limit={relatedThoughtsLimit}
                  minChars={relatedThoughtsMinChars}
                  showTitle={false}
                  onOpenPath={onRelatedThoughtOpenPath}
                  onOpenPathInNewTab={onRelatedThoughtOpenPathInNewTab}
                />
              )}
            </>
          )}

          <div className="h-px bg-border/50" />
          {inlineDiffRender && (
            <>
              <div className="rounded-md border border-border/60 bg-background px-3 py-2">
                <div className="text-xs text-muted-foreground">
                  Inline review active in editor:
                  {' '}
                  <span className="text-foreground">pending {inlineDiffRender.summary.pending}</span>
                  {' • '}
                  <span className="text-foreground">accepted {inlineDiffRender.summary.accepted}</span>
                  {' • '}
                  <span className="text-foreground">rejected {inlineDiffRender.summary.rejected}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={acceptAllInlineDiffHunks}
                    className="inline-flex h-8 items-center rounded-md border border-emerald-500/50 bg-emerald-500/10 px-3 text-xs text-emerald-700"
                  >
                    Accept all
                  </button>
                  <button
                    type="button"
                    onClick={rejectAllInlineDiffHunks}
                    className="inline-flex h-8 items-center rounded-md border border-destructive/50 bg-destructive/10 px-3 text-xs text-destructive"
                  >
                    Reject all
                  </button>
                  <button
                    type="button"
                    onClick={discardRejectedAndAcceptRemainingInlineDiffHunks}
                    className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs text-foreground hover:bg-muted"
                  >
                    Discard rejected + accept remaining
                  </button>
                  <button
                    type="button"
                    onClick={finishInlineDiffReview}
                    className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs text-foreground hover:bg-muted"
                  >
                    Finish review
                  </button>
                  <button
                    type="button"
                    onClick={cancelInlineDiffReview}
                    className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs text-foreground hover:bg-muted"
                  >
                    Cancel and restore original
                  </button>
                </div>
              </div>
              <div className="h-px bg-border/50" />
            </>
          )}
          <AiAssistControlsBlock
            selectedProvider={selectedProvider}
            selectedModel={selectedModel}
            runningAction={assistRunningAction}
            loading={aiSelectionLoading}
            disabled={aiAssistDisabled || inlineDiffSession != null}
            onRun={(action) => { void runAssistAction(action, value) }}
            onRunCustomPrompt={(prompt) => {
              void (async () => {
                const result = await runAssistAction('custom', value, prompt)
                if (!result || !result.changed) return
                applyAssistSuggestion((next) => {
                  onChange(next)
                })
              })()
            }}
            promptHistory={customPromptHistory}
            statusPill={assistResultPill}
            helperText={aiAssistHelperText}
          />

          {assistSuggestion && (
            <AiAssistReviewBlock
              suggestion={assistSuggestion}
              onStartInlineApply={startInlineDiffReview}
              onApply={(nextContent) => {
                applyAssistSuggestion((next) => {
                  onChange(next)
                }, nextContent)
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

      <div className={cn('ltm-markdown-rich-editor-surface flex min-h-0 flex-1 flex-col overflow-hidden bg-white', editorClassName)}>
        <CodeMirror
          value={value}
          height="100%"
          className="h-full bg-white"
          basicSetup={{
            lineNumbers: !isIphoneRuntime,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
            foldGutter: !isIphoneRuntime,
            dropCursor: false,
            allowMultipleSelections: true,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: false,
            highlightSelectionMatches: true,
          }}
          extensions={extensions}
          onCreateEditor={(view) => {
            editorViewRef.current = view
          }}
          onChange={handleEditorChange}
        />
      </div>

      {wikilinkPickerOpen && (
        <div className="pointer-events-none absolute inset-x-3 top-2 z-40">
          <div className="pointer-events-auto ml-auto w-full max-w-xl rounded-lg border border-border/60 bg-background/95 p-2 shadow-2xl backdrop-blur">
            <UniversalSearchBlock<WikilinkSuggestionBlock>
              {...UNIVERSAL_SEARCH_DROPDOWN_PRESET_BLOCK}
              items={wikilinkSuggestions}
              query={wikilinkQuery}
              onQueryChange={applyWikilinkQuery}
              onSelect={applyWikilinkSuggestion}
              getItemKey={(item) => `${item.path}::${item.target}`}
              getItemLabel={(item) => deriveWikilinkLabelBlock(item.target, null)}
              getItemDescription={(item) => item.path}
              getItemSearchCandidates={(item) => [item.target, item.path, deriveWikilinkLabelBlock(item.target, null)]}
              selectedItemKey={null}
              open={wikilinkPickerOpen}
              onOpenChange={(open) => {
                setWikilinkPickerOpen(open)
                if (!open) editorViewRef.current?.focus()
              }}
              onEscapeKeyDown={() => editorViewRef.current?.focus()}
              placeholder="Link a note..."
              emptyMessage={
                wikilinkLoading
                  ? 'Searching notes...'
                  : (UNIVERSAL_SEARCH_DROPDOWN_PRESET_BLOCK.emptyMessage ?? 'No matches found.')
              }
            />
          </div>
        </div>
      )}
    </div>
  )
})

export default MarkdownRichEditorBlock
