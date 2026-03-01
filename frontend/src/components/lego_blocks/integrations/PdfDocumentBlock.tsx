import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw, ScanLine, ZoomIn, ZoomOut } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import PdfJsWorkerBlock from 'pdfjs-dist/build/pdf.worker.min.mjs?worker'
import pdfWorkerSrcBlock from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { cn } from '@/lib/utils'
import { readPdfDocumentOrch } from '@/services/orchestrators/pdfDocumentsOrch'

let activePdfWorkerBlock: Worker | null = null
let activePdfWorkerVersionBlock: string | null = null

function configurePdfWorkerBlock(force = false): void {
  const version = pdfjs.version

  try {
    if (!force && activePdfWorkerBlock && activePdfWorkerVersionBlock === version) {
      pdfjs.GlobalWorkerOptions.workerPort = activePdfWorkerBlock
      return
    }

    if (activePdfWorkerBlock) {
      activePdfWorkerBlock.terminate()
      activePdfWorkerBlock = null
    }

    activePdfWorkerBlock = new PdfJsWorkerBlock()
    activePdfWorkerVersionBlock = version
    pdfjs.GlobalWorkerOptions.workerPort = activePdfWorkerBlock
    return
  } catch {
    // Fallback for environments where Worker construction is restricted.
  }

  pdfjs.GlobalWorkerOptions.workerPort = null
  pdfjs.GlobalWorkerOptions.workerSrc = `${pdfWorkerSrcBlock}?pdfjs=${encodeURIComponent(version)}`
}

configurePdfWorkerBlock()

interface PdfDocumentBlockProps {
  path: string
  className?: string
}

function clampPageBlock(value: number, numPages: number): number {
  if (numPages <= 0) return 1
  return Math.max(1, Math.min(value, numPages))
}

export default function PdfDocumentBlock({
  path,
  className,
}: PdfDocumentBlockProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1)
  const [fitWidth, setFitWidth] = useState(true)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [renderNonce, setRenderNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setFileBytes(null)
    setNumPages(0)
    setPageNumber(1)
    setRenderNonce(0)
    void readPdfDocumentOrch(path)
      .then((doc) => {
        if (cancelled) return
        setFileBytes(doc.bytes)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load PDF.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [path])

  useEffect(() => {
    const target = viewportRef.current
    if (!target) return
    const observer = new ResizeObserver((entries) => {
      const nextWidth = Math.floor(entries[0]?.contentRect.width ?? 0)
      setViewportWidth(nextWidth > 0 ? nextWidth : 0)
    })
    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  const pageWidth = useMemo(() => {
    if (!fitWidth) return undefined
    if (viewportWidth <= 0) return undefined
    return Math.max(320, viewportWidth - 24)
  }, [fitWidth, viewportWidth])

  const documentFile = useMemo(() => {
    if (!fileBytes) return null
    // pdf.js may transfer/consume ArrayBuffers through worker messaging.
    // Always provide a fresh copy so retries/rerenders never reuse a detached buffer.
    return { data: fileBytes.slice() }
  }, [fileBytes, renderNonce])

  const canGoPrev = pageNumber > 1
  const canGoNext = numPages > 0 && pageNumber < numPages

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-card', className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-border/60 px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={!canGoPrev}
          onClick={() => setPageNumber((prev) => Math.max(1, prev - 1))}
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[6.5rem] text-center text-xs text-muted-foreground">
          Page {pageNumber}{numPages > 0 ? ` / ${numPages}` : ''}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={!canGoNext}
          onClick={() => setPageNumber((prev) => (numPages > 0 ? Math.min(numPages, prev + 1) : prev))}
          title="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <div className="mx-1 h-5 w-px bg-border/70" />

        <Button
          type="button"
          variant={fitWidth ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFitWidth((prev) => !prev)}
          title="Fit page to container width"
        >
          <ScanLine className="mr-1 h-3.5 w-3.5" />
          Fit Width
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={fitWidth}
          onClick={() => setScale((prev) => Math.max(0.6, Number((prev - 0.1).toFixed(2))))}
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className={cn('min-w-[3.5rem] text-center text-xs text-muted-foreground', fitWidth && 'opacity-60')}>
          {(scale * 100).toFixed(0)}%
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={fitWidth}
          onClick={() => setScale((prev) => Math.min(2.5, Number((prev + 0.1).toFixed(2))))}
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      <div ref={viewportRef} className="min-h-0 flex-1 overflow-auto bg-muted/10 p-3">
        {loading && (
          <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-muted-foreground">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Loading PDF...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && documentFile && (
          <Document
            key={`${path}:${renderNonce}`}
            file={documentFile}
            onLoadSuccess={(doc) => {
              setNumPages(doc.numPages)
              setPageNumber((prev) => clampPageBlock(prev, doc.numPages))
            }}
            onLoadError={(docError) => {
              const message = docError instanceof Error ? docError.message : 'Failed to render PDF.'
              const versionMismatch = message.includes('API version')
                && message.includes('Worker version')
                && message.includes('does not match')

              if (versionMismatch && renderNonce < 1) {
                configurePdfWorkerBlock(true)
                setRenderNonce((prev) => prev + 1)
                return
              }

              setError(message)
            }}
            loading={(
              <div className="flex min-h-[160px] items-center justify-center text-sm text-muted-foreground">
                Rendering PDF...
              </div>
            )}
            className="mx-auto w-fit"
          >
            <Page
              pageNumber={pageNumber}
              width={pageWidth}
              scale={fitWidth ? undefined : scale}
              renderAnnotationLayer
              renderTextLayer
              className="overflow-hidden rounded-md border bg-background shadow-sm"
            />
          </Document>
        )}
      </div>
    </div>
  )
}
