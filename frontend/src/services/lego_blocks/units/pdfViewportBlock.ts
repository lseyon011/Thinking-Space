export interface PdfNaturalPageMetricsBlock {
  width: number
  height: number
}

export const DEFAULT_PDF_NATURAL_PAGE_METRICS_BLOCK: PdfNaturalPageMetricsBlock = {
  width: 612,
  height: 792,
}

const PDF_VIEWPORT_HORIZONTAL_PADDING_BLOCK = 24
const PDF_RENDER_OVERSCAN_PAGES_BLOCK = 2

export function computePdfPageWidthBlock(viewportWidth: number): number | undefined {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) return undefined
  return Math.max(320, viewportWidth - PDF_VIEWPORT_HORIZONTAL_PADDING_BLOCK)
}

export function computePdfFitScaleBlock(params: {
  viewportWidth: number
  naturalPageWidth: number
}): number {
  const pageWidth = computePdfPageWidthBlock(params.viewportWidth)
  if (!pageWidth) return 1

  const naturalWidth = Number.isFinite(params.naturalPageWidth) && params.naturalPageWidth > 0
    ? params.naturalPageWidth
    : DEFAULT_PDF_NATURAL_PAGE_METRICS_BLOCK.width

  return pageWidth / naturalWidth
}

export function computeDisplayedPdfScaleBlock(params: {
  fitWidth: boolean
  scale: number
  viewportWidth: number
  naturalPageWidth: number
}): number {
  if (!params.fitWidth) return params.scale
  return computePdfFitScaleBlock({
    viewportWidth: params.viewportWidth,
    naturalPageWidth: params.naturalPageWidth,
  })
}

export function computeEstimatedPdfPageHeightBlock(params: {
  fitWidth: boolean
  scale: number
  viewportWidth: number
  naturalPageMetrics?: PdfNaturalPageMetricsBlock | null
}): number {
  const naturalPageMetrics = params.naturalPageMetrics ?? DEFAULT_PDF_NATURAL_PAGE_METRICS_BLOCK
  const naturalWidth = naturalPageMetrics.width > 0 ? naturalPageMetrics.width : DEFAULT_PDF_NATURAL_PAGE_METRICS_BLOCK.width
  const naturalHeight = naturalPageMetrics.height > 0 ? naturalPageMetrics.height : DEFAULT_PDF_NATURAL_PAGE_METRICS_BLOCK.height

  const effectiveScale = computeDisplayedPdfScaleBlock({
    fitWidth: params.fitWidth,
    scale: params.scale,
    viewportWidth: params.viewportWidth,
    naturalPageWidth: naturalWidth,
  })

  const estimatedHeight = naturalHeight * effectiveScale
  return Math.max(160, Math.round(estimatedHeight))
}

export function buildPdfRenderedWindowBlock(params: {
  centerPage: number
  numPages: number
  overscan?: number
}): { start: number; end: number } {
  const overscan = params.overscan ?? PDF_RENDER_OVERSCAN_PAGES_BLOCK
  const numPages = Math.max(0, params.numPages)
  if (numPages === 0) return { start: 1, end: 0 }

  const centerPage = Math.max(1, Math.min(params.centerPage, numPages))
  return {
    start: Math.max(1, centerPage - overscan),
    end: Math.min(numPages, centerPage + overscan),
  }
}
