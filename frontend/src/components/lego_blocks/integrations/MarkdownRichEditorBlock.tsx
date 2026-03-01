import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { redo, undo } from '@codemirror/commands'
import { type EditorState } from '@codemirror/state'
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
import { Bold, Code, Heading1, Italic, Link2, List, ListOrdered, PenLine, Quote, RotateCcw, RotateCw, Table } from 'lucide-react'
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
}, ref) {
  const editorViewRef = useRef<EditorView | null>(null)
  const [toolbarOpen, setToolbarOpen] = useState(false)
  const [wikilinkPickerOpen, setWikilinkPickerOpen] = useState(false)
  const [wikilinkQuery, setWikilinkQuery] = useState('')
  const [wikilinkSuggestions, setWikilinkSuggestions] = useState<WikilinkSuggestionBlock[]>([])
  const [wikilinkLoading, setWikilinkLoading] = useState(false)

  const showToolbar = enableFormattingToolbar && (toolbarAlwaysVisible || toolbarOpen)

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

  return (
    <div className={cn('ltm-markdown-rich-editor relative flex min-h-0 flex-col bg-transparent', className)}>
      {/* Toolbar toggle button (only when not always visible) */}
      {enableFormattingToolbar && !toolbarAlwaysVisible && (
        <div className="flex items-center justify-end px-2 pt-1.5">
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
        </div>
      )}

      <div className={cn('ltm-markdown-rich-editor-surface flex min-h-0 flex-1 flex-col overflow-hidden', editorClassName)}>
        <CodeMirror
          value={value}
          height="100%"
          className="h-full bg-transparent"
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
          onChange={(next) => onChange(next)}
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
