import { useMemo, useRef } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
import { Bold, Code, Heading1, Italic, Link2, List, ListOrdered, Quote } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MarkdownRichEditorBlockProps {
  value: string
  onChange: (next: string) => void
  className?: string
  editorClassName?: string
  placeholder?: string
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

export default function MarkdownRichEditorBlock({
  value,
  onChange,
  className,
  editorClassName,
  placeholder = 'Write markdown...',
}: MarkdownRichEditorBlockProps) {
  const editorViewRef = useRef<EditorView | null>(null)

  const extensions = useMemo(() => {
    const uiTheme = EditorView.theme({
      '&': {
        height: '100%',
        backgroundColor: 'transparent',
      },
      '.cm-scroller': {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        lineHeight: '1.6',
      },
      '.cm-content': {
        minHeight: '24rem',
        padding: '0.75rem',
      },
      '.cm-gutters': {
        backgroundColor: 'transparent',
        border: 'none',
      },
      '.cm-activeLine, .cm-activeLineGutter': {
        backgroundColor: 'hsl(var(--muted) / 0.35)',
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
      keymap.of([]),
    ]
  }, [placeholder])

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
    <div className={cn('flex min-h-0 flex-col rounded-lg border border-border/60 bg-background', className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-border/50 p-2">
        <button
          type="button"
          onClick={() => applyPatch((text, from, to) => wrapSelection(text, from, to, '# ', '', 'Heading'))}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Heading"
        >
          <Heading1 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => applyPatch((text, from, to) => wrapSelection(text, from, to, '**', '**', 'bold text'))}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => applyPatch((text, from, to) => wrapSelection(text, from, to, '*', '*', 'italic text'))}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => applyPatch((text, from, to) => wrapSelection(text, from, to, '`', '`', 'code'))}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Code"
        >
          <Code className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => applyPatch((text, from, to) => wrapSelection(text, from, to, '[', '](https://)', 'link text'))}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Link"
        >
          <Link2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => applyPatch((text, from, to) => prefixSelectionLines(text, from, to, (line) => `> ${line}`))}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => applyPatch((text, from, to) => prefixSelectionLines(text, from, to, (line) => `- ${line}`))}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Bullet list"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => applyPatch((text, from, to) => prefixSelectionLines(text, from, to, (line, i) => `${i + 1}. ${line}`))}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Numbered list"
        >
          <ListOrdered className="h-4 w-4" />
        </button>
      </div>

      <div className={cn('min-h-0 flex-1 overflow-hidden', editorClassName)}>
        <CodeMirror
          value={value}
          height="100%"
          minHeight="24rem"
          basicSetup={{
            lineNumbers: true,
            highlightActiveLine: true,
            foldGutter: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            highlightSelectionMatches: true,
          }}
          extensions={extensions}
          onCreateEditor={(view) => {
            editorViewRef.current = view
          }}
          onChange={(next) => onChange(next)}
        />
      </div>
    </div>
  )
}
