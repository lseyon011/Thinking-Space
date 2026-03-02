import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { redo, undo } from '@codemirror/commands'
import { type EditorState } from '@codemirror/state'
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
import { Bold, Code, Heading1, Italic, Link2, List, ListOrdered, PenLine, Quote, RotateCcw, RotateCw, Sparkles, Table } from 'lucide-react'
import type { AiSettingsScope } from '@/services/lego_blocks/integrations/aiSettingsBlock'
import AiAssistControlsBlock from '@/components/lego_blocks/integrations/AiAssistControlsBlock'
import AiAssistReviewBlock from '@/components/lego_blocks/integrations/AiAssistReviewBlock'
import AiStewardPanelBlock from '@/components/lego_blocks/integrations/AiStewardPanelBlock'
import RelatedThoughtsPanelBlock from '@/components/lego_blocks/integrations/RelatedThoughtsPanelBlock'
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
  const editorViewRef = useRef<EditorView | null>(null)
  const [toolbarOpen, setToolbarOpen] = useState(false)
  const [internalAiPanelOpen, setInternalAiPanelOpen] = useState(defaultAiPanelOpen)
  const [wikilinkPickerOpen, setWikilinkPickerOpen] = useState(false)
  const [wikilinkQuery, setWikilinkQuery] = useState('')
  const [wikilinkSuggestions, setWikilinkSuggestions] = useState<WikilinkSuggestionBlock[]>([])
  const [wikilinkLoading, setWikilinkLoading] = useState(false)
  const {
    aiSelectionLoading,
    selectedProvider,
    selectedModel,
    assistRunningAction,
    assistError,
    assistResultPill,
    assistSuggestion,
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

  const setAiPanelOpen = useCallback((open: boolean) => {
    if (controlledAiPanelOpen === undefined) {
      setInternalAiPanelOpen(open)
    }
    onAiPanelOpenChange?.(open)
  }, [controlledAiPanelOpen, onAiPanelOpenChange])

  const toggleAiPanel = useCallback(() => {
    setAiPanelOpen(!aiPanelOpen)
  }, [aiPanelOpen, setAiPanelOpen])

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
    })

    return [
      markdown(),
      EditorView.lineWrapping,
      cmPlaceholder(placeholder),
      uiTheme,
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
  }, [compactMobile, placeholder])

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
          {enableAiAssist && (
            <>
              <span className="mx-1 h-4 w-px bg-border/60" aria-hidden="true" />
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
            </>
          )}
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
              <RelatedThoughtsPanelBlock
                text={value}
                enabled={enableAiAssist && aiPanelOpen}
                disabled={aiAssistDisabled}
                sourceFilePath={relatedSourceFilePath || undefined}
                limit={relatedThoughtsLimit}
                minChars={relatedThoughtsMinChars}
                onOpenPath={onRelatedThoughtOpenPath}
                onOpenPathInNewTab={onRelatedThoughtOpenPathInNewTab}
              />
            </>
          )}

          <div className="h-px bg-border/50" />
          <AiAssistControlsBlock
            selectedProvider={selectedProvider}
            selectedModel={selectedModel}
            runningAction={assistRunningAction}
            loading={aiSelectionLoading}
            disabled={aiAssistDisabled}
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
            statusPill={assistResultPill}
            helperText={aiAssistHelperText}
          />

          {assistSuggestion && (
            <AiAssistReviewBlock
              suggestion={assistSuggestion}
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
            lineNumbers: true,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
            foldGutter: true,
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
