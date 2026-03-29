import { memo, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FileText, File, ExternalLink, Pencil } from 'lucide-react'
import { readMarkdownDocument } from '@/services/orchestrators/markdownDocumentsOrch'
import { isPdfDocumentPathBlock } from '@/services/lego_blocks/units/pdfDocumentPathBlock'
import { thinkingSpaceMarkdownUrlTransformBlock } from '@/services/lego_blocks/integrations/markdownUrlTransformBlock'
import { remarkObsidianWikilinksOrch } from '@/services/orchestrators/obsidianLinkOrch'
import { loadExcalidrawSvgPreviewBlock } from '@/services/lego_blocks/units/excalidrawPreviewBlock'
import type { NotebookEntry } from '@/components/lego_blocks/hooks/shared/useNotebookEntriesBlock'

function stripYamlFrontmatter(content: string): string {
  if (!content.startsWith('---')) return content
  const endIndex = content.indexOf('\n---', 3)
  if (endIndex === -1) return content
  return content.slice(endIndex + 4).trimStart()
}

interface NotebookPageBlockProps {
  entry: NotebookEntry
  pageNumber: number
  onOpenFile: (path: string) => void
}

const remarkPlugins = [remarkGfm, remarkObsidianWikilinksOrch]

// ---------------------------------------------------------------------------
// Lazy visibility hook — only renders content when near the viewport
// ---------------------------------------------------------------------------
function useLazyVisible(rootMargin = '600px'): [React.RefCallback<HTMLDivElement>, boolean] {
  const [visible, setVisible] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const refCallback = useRef<React.RefCallback<HTMLDivElement>>((el: HTMLDivElement | null) => {
    // Disconnect previous observer
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }
    if (!el) return

    const observer = new IntersectionObserver(
      ([ioEntry]) => {
        if (ioEntry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )
    observer.observe(el)
    observerRef.current = observer
  })

  return [refCallback.current, visible]
}

// ---------------------------------------------------------------------------
// Content renderers
// ---------------------------------------------------------------------------

function MarkdownPageContent({ path }: { path: string }) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void readMarkdownDocument(path, { includeHash: false }).then((doc) => {
      if (!cancelled) setContent(stripYamlFrontmatter(doc.content))
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load.')
    })
    return () => { cancelled = true }
  }, [path])

  if (error) return <div className="text-sm text-destructive">{error}</div>
  if (content === null) return <div className="text-sm text-muted-foreground">Loading...</div>

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert" data-markdown-nav-root>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        urlTransform={thinkingSpaceMarkdownUrlTransformBlock}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

function ExcalidrawPageContent({ path, name }: { path: string; name: string }) {
  const [svgHtml, setSvgHtml] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadExcalidrawSvgPreviewBlock(path).then((svg) => {
      if (!cancelled) setSvgHtml(svg)
    }).catch(() => {
      if (!cancelled) setError(true)
    })
    return () => { cancelled = true }
  }, [path])

  if (error || svgHtml === null) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 px-4 py-6">
        <Pencil className="h-8 w-8 shrink-0 text-violet-400" />
        <div>
          <div className="text-sm font-medium">{name}</div>
          <div className="text-xs text-muted-foreground">{error ? 'Could not load preview' : 'Loading preview...'}</div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="max-h-[60vh] overflow-hidden rounded-md border border-border/40 bg-white p-2 dark:bg-zinc-900"
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  )
}

function GenericPageContent({ name, icon: Icon }: { name: string; icon: typeof File }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 px-4 py-6">
      <Icon className="h-8 w-8 shrink-0 text-muted-foreground" />
      <div>
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">Click to open</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Placeholder shown while page is off-screen (lazy rendering)
// ---------------------------------------------------------------------------
function PagePlaceholder({ pageNumber, name }: { pageNumber: number; name: string }) {
  return (
    <div className="flex h-24 items-center justify-center rounded-lg border border-border/20 bg-muted/10 text-sm text-muted-foreground">
      <span className="opacity-50">Page {pageNumber} — {name}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page block
// ---------------------------------------------------------------------------

function NotebookPageBlock({ entry, pageNumber, onOpenFile }: NotebookPageBlockProps) {
  const isMarkdown = /\.md$/i.test(entry.name)
  const isPdf = isPdfDocumentPathBlock(entry.path)
  const isExcalidraw = /\.excalidraw$/i.test(entry.name)

  const [lazyRef, visible] = useLazyVisible()

  const content = useMemo(() => {
    if (!visible) return <PagePlaceholder pageNumber={pageNumber} name={entry.name} />
    if (isMarkdown) return <MarkdownPageContent path={entry.path} />
    if (isExcalidraw) return <ExcalidrawPageContent path={entry.path} name={entry.name} />
    if (isPdf) return <GenericPageContent name={entry.name} icon={FileText} />
    return <GenericPageContent name={entry.name} icon={File} />
  }, [entry.name, entry.path, isExcalidraw, isMarkdown, isPdf, pageNumber, visible])

  return (
    <div className="notebook-page group" ref={lazyRef}>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-medium text-muted-foreground/70">
          {pageNumber}
        </span>
        <button
          type="button"
          className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => onOpenFile(entry.path)}
          title="Open file"
        >
          <span className="truncate">{entry.name}</span>
          <ExternalLink className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      </div>
      <div
        className="cursor-pointer rounded-lg border border-border/40 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-zinc-50"
        onClick={() => onOpenFile(entry.path)}
      >
        {content}
      </div>
    </div>
  )
}

export default memo(NotebookPageBlock)
