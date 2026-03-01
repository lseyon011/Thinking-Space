import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw, ScanLine, ZoomIn, ZoomOut } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import PdfJsWorkerBlock from 'pdfjs-dist/build/pdf.worker.min.mjs?worker'
import pdfWorkerSrcBlock from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { select } from 'd3-selection'
import { zoom, zoomIdentity } from 'd3-zoom'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { cn } from '@/lib/utils'
import { readPdfDocumentOrch } from '@/services/orchestrators/pdfDocumentsOrch'

let activePdfWorkerBlock: Worker | null = null
let activePdfWorkerVersionBlock: string | null = null

const ELECTRON_SAFE_MAX_DEVICE_PIXEL_RATIO_BLOCK = 1.25
const LARGE_PDF_BYTES_THRESHOLD_BLOCK = 24 * 1024 * 1024
const MIN_SCALE_BLOCK = 0.6
const MAX_SCALE_BLOCK = 2.5
const TRACKPAD_ZOOM_SENSITIVITY_BLOCK = 0.0015
const TRACKPAD_COMMIT_DEBOUNCE_MS_BLOCK = 120

function isElectronRuntimeBlock(): boolean {
  if (typeof window === 'undefined') return false
  return !!window.electronAPI?.isElectron
}

function configurePdfWorkerBlock(force = false): void {
  const version = pdfjs.version

  if (isElectronRuntimeBlock()) {
    // Electron is more stable using workerSrc than module Worker construction.
    pdfjs.GlobalWorkerOptions.workerPort = null
    pdfjs.GlobalWorkerOptions.workerSrc = `${pdfWorkerSrcBlock}?pdfjs=${encodeURIComponent(version)}`
    return
  }

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

function clampScaleBlock(value: number): number {
  return Math.max(MIN_SCALE_BLOCK, Math.min(value, MAX_SCALE_BLOCK))
}

function normalizeScaleBlock(value: number): number {
  return Number(clampScaleBlock(value).toFixed(2))
}

export default function PdfDocumentBlock({
  path,
  className,
}: PdfDocumentBlockProps) {
  const electronRuntime = isElectronRuntimeBlock()
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const zoomBehaviorRef = useRef<any>(null)
  const zoomSelectionRef = useRef<any>(null)
  const suppressZoomEventRef = useRef(false)
  const fitWidthRef = useRef(true)
  const scaleRef = useRef(1)
  const pendingScaleRef = useRef<number | null>(null)
  const previewRafRef = useRef<number | null>(null)
  const commitTimerRef = useRef<number | null>(null)
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null)
  const [fileSizeBytes, setFileSizeBytes] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1)
  const [gesturePreviewScale, setGesturePreviewScale] = useState<number | null>(null)
  const [fitWidth, setFitWidth] = useState(true)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [renderNonce, setRenderNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setFileBytes(null)
    setFileSizeBytes(null)
    setNumPages(0)
    setPageNumber(1)
    setRenderNonce(0)
    void readPdfDocumentOrch(path)
      .then((doc) => {
        if (cancelled) return
        setFileBytes(doc.bytes)
        setFileSizeBytes(doc.size)
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

  useEffect(() => {
    fitWidthRef.current = fitWidth
  }, [fitWidth])

  useEffect(() => {
    scaleRef.current = scale
  }, [scale])

  useEffect(() => {
    if (!fitWidth) return
    pendingScaleRef.current = null
    setGesturePreviewScale(null)
  }, [fitWidth])

  useEffect(() => {
    const target = viewportRef.current
    if (!target) return

    const clearPendingRenderHandlesBlock = () => {
      if (previewRafRef.current !== null) {
        window.cancelAnimationFrame(previewRafRef.current)
        previewRafRef.current = null
      }
      if (commitTimerRef.current !== null) {
        window.clearTimeout(commitTimerRef.current)
        commitTimerRef.current = null
      }
    }

    const commitPreviewScaleBlock = () => {
      const nextScale = pendingScaleRef.current
      clearPendingRenderHandlesBlock()
      pendingScaleRef.current = null
      setGesturePreviewScale(null)
      if (nextScale === null || Math.abs(scaleRef.current - nextScale) < 0.01) return
      scaleRef.current = nextScale
      setScale(nextScale)
    }

    const schedulePreviewScaleBlock = (nextScale: number) => {
      pendingScaleRef.current = nextScale
      if (previewRafRef.current !== null) return
      previewRafRef.current = window.requestAnimationFrame(() => {
        previewRafRef.current = null
        if (pendingScaleRef.current !== null) setGesturePreviewScale(pendingScaleRef.current)
      })
    }

    const scheduleCommitScaleBlock = (delayMs: number) => {
      if (commitTimerRef.current !== null) {
        window.clearTimeout(commitTimerRef.current)
      }
      commitTimerRef.current = window.setTimeout(() => {
        commitTimerRef.current = null
        commitPreviewScaleBlock()
      }, delayMs)
    }

    const selection = select(target)
    const zoomBehavior = zoom()
      .scaleExtent([MIN_SCALE_BLOCK, MAX_SCALE_BLOCK])
      .wheelDelta((event: WheelEvent) => {
        if (!event.ctrlKey || !Number.isFinite(event.deltaY)) return 0
        return -event.deltaY * TRACKPAD_ZOOM_SENSITIVITY_BLOCK * 120
      })
      .filter((event: Event) => {
        if (event.type === 'wheel') {
          return (event as WheelEvent).ctrlKey
        }
        return event.type.startsWith('touch')
      })
      .on('start', (event: any) => {
        if (suppressZoomEventRef.current) return
        const sourceEventType = String(event?.sourceEvent?.type ?? '')
        if (!sourceEventType) return

        if (commitTimerRef.current !== null) {
          window.clearTimeout(commitTimerRef.current)
          commitTimerRef.current = null
        }

        if (fitWidthRef.current) {
          fitWidthRef.current = false
          setFitWidth(false)
        }
      })
      .on('zoom', (event: any) => {
        if (suppressZoomEventRef.current) return
        const nextScale = normalizeScaleBlock(event?.transform?.k ?? scaleRef.current)
        if (Math.abs((pendingScaleRef.current ?? scaleRef.current) - nextScale) < 0.01) return

        schedulePreviewScaleBlock(nextScale)

        const sourceEventType = String(event?.sourceEvent?.type ?? '')
        if (sourceEventType === 'wheel') {
          scheduleCommitScaleBlock(TRACKPAD_COMMIT_DEBOUNCE_MS_BLOCK)
        }
      })
      .on('end', (event: any) => {
        if (suppressZoomEventRef.current) return
        const sourceEventType = String(event?.sourceEvent?.type ?? '')
        if (sourceEventType === 'wheel') {
          scheduleCommitScaleBlock(TRACKPAD_COMMIT_DEBOUNCE_MS_BLOCK)
          return
        }
        scheduleCommitScaleBlock(0)
      })

    zoomBehaviorRef.current = zoomBehavior
    zoomSelectionRef.current = selection

    selection.call(zoomBehavior)
    selection.on('dblclick.zoom', null)

    suppressZoomEventRef.current = true
    selection.call(zoomBehavior.transform, zoomIdentity.scale(fitWidthRef.current ? 1 : scaleRef.current))
    suppressZoomEventRef.current = false

    return () => {
      clearPendingRenderHandlesBlock()
      selection.on('.zoom', null)
      zoomBehaviorRef.current = null
      zoomSelectionRef.current = null
      suppressZoomEventRef.current = false
    }
  }, [])

  useEffect(() => {
    const selection = zoomSelectionRef.current
    const zoomBehavior = zoomBehaviorRef.current
    if (!selection || !zoomBehavior) return

    const targetScale = fitWidth ? 1 : scale
    suppressZoomEventRef.current = true
    selection.call(zoomBehavior.transform, zoomIdentity.scale(targetScale))
    suppressZoomEventRef.current = false
  }, [fitWidth, scale])

  const pageWidth = useMemo(() => {
    if (!fitWidth) return undefined
    if (viewportWidth <= 0) return undefined
    return Math.max(320, viewportWidth - 24)
  }, [fitWidth, viewportWidth])

  const documentFile = useMemo(() => {
    if (!fileBytes) return null
    const skipCopyForLargeElectronPdf = electronRuntime && fileBytes.byteLength >= LARGE_PDF_BYTES_THRESHOLD_BLOCK
    // pdf.js may transfer/consume ArrayBuffers through worker messaging.
    // For very large Electron PDFs, avoid extra copy to reduce crash-prone memory spikes.
    if (skipCopyForLargeElectronPdf) return { data: fileBytes }
    // Otherwise provide a fresh copy so retries/rerenders never reuse a detached buffer.
    return { data: fileBytes.slice() }
  }, [electronRuntime, fileBytes, renderNonce])

  const pageDevicePixelRatio = useMemo(() => {
    if (typeof window === 'undefined') return 1
    const current = Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : 1
    if (!electronRuntime) return current
    return Math.max(1, Math.min(current, ELECTRON_SAFE_MAX_DEVICE_PIXEL_RATIO_BLOCK))
  }, [electronRuntime])

  const canGoPrev = pageNumber > 1
  const canGoNext = numPages > 0 && pageNumber < numPages
  const displayedScale = fitWidth ? scale : (gesturePreviewScale ?? scale)
  const previewScaleMultiplier = (
    fitWidth
      || gesturePreviewScale === null
      || Math.abs(scale) < 0.0001
  )
    ? 1
    : gesturePreviewScale / scale
  const pagePreviewStyle = previewScaleMultiplier === 1
    ? undefined
    : {
      transform: `scale(${previewScaleMultiplier})`,
      transformOrigin: 'top center',
      willChange: 'transform',
    }

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
          onClick={() => {
            pendingScaleRef.current = null
            setGesturePreviewScale(null)
            setScale((prev) => normalizeScaleBlock(prev - 0.1))
          }}
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className={cn('min-w-[3.5rem] text-center text-xs text-muted-foreground', fitWidth && 'opacity-60')}>
          {(displayedScale * 100).toFixed(0)}%
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={fitWidth}
          onClick={() => {
            pendingScaleRef.current = null
            setGesturePreviewScale(null)
            setScale((prev) => normalizeScaleBlock(prev + 0.1))
          }}
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      <div
        ref={viewportRef}
        className="min-h-0 flex-1 overflow-auto bg-muted/10 p-3"
        style={{ touchAction: 'pan-x pan-y' }}
      >
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
          <div className="mx-auto w-fit origin-top" style={pagePreviewStyle}>
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
              className="w-fit"
            >
              <Page
                pageNumber={pageNumber}
                width={pageWidth}
                scale={fitWidth ? undefined : scale}
                devicePixelRatio={pageDevicePixelRatio}
                renderAnnotationLayer={!electronRuntime}
                renderTextLayer={!electronRuntime}
                className="overflow-hidden rounded-md border bg-background shadow-sm"
              />
            </Document>
          </div>
        )}
        {!loading && !error && electronRuntime && fileSizeBytes !== null && fileSizeBytes >= LARGE_PDF_BYTES_THRESHOLD_BLOCK && (
          <p className="mx-auto mt-2 max-w-[40rem] text-center text-[11px] text-muted-foreground">
            Large PDF safety mode is active for Electron to reduce crash risk.
          </p>
        )}
      </div>
    </div>
  )
}
