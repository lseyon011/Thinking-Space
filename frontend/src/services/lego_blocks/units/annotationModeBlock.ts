/**
 * annotationModeBlock — pure utilities for annotation mode interactions.
 *
 * Maps pointer/pencil screen coordinates to markdown source offsets by
 * querying the rendered DOM spans that carry `data-md-source-start` /
 * `data-md-source-end` attributes (set by `remarkMarkdownSourceSpansBlock`).
 */

export interface AnnotationModePointBlock {
  x: number
  y: number
}

export interface AnnotationModeSourceHitBlock {
  sourceOffset: number
  element: HTMLElement
}

export interface AnnotationModeRangeBlock {
  start: number
  end: number
}

/**
 * Given a viewport coordinate, find the nearest text position inside the
 * markdown view root and return the corresponding source offset.
 */
export function resolveSourceOffsetFromPointBlock(
  x: number,
  y: number,
  rootElement: HTMLElement,
): AnnotationModeSourceHitBlock | null {
  // Use the cross-browser caret-from-point API
  let range: Range | null = null

  if (typeof document.caretRangeFromPoint === 'function') {
    range = document.caretRangeFromPoint(x, y)
  } else if (typeof (document as any).caretPositionFromPoint === 'function') {
    const pos = (document as any).caretPositionFromPoint(x, y) as { offsetNode: Node; offset: number } | null
    if (pos) {
      range = document.createRange()
      range.setStart(pos.offsetNode, pos.offset)
      range.collapse(true)
    }
  }

  if (!range) return null

  const node = range.startContainer
  if (!rootElement.contains(node)) return null

  // Walk up to find the span with data-md-source-start
  const span = findClosestWithAttrBlock(node, 'data-md-source-start', rootElement)
  if (!span) return null

  const sourceStart = Number(span.dataset.mdSourceStart ?? '')
  if (!Number.isFinite(sourceStart)) return null

  // Compute offset within the span
  const textOffset = getTextOffsetBlock(span, range.startContainer, range.startOffset)
  return {
    sourceOffset: sourceStart + textOffset,
    element: span,
  }
}

/**
 * Given a series of pointer/pencil points, compute the union source range
 * covering all text touched.
 */
export function buildSourceRangeFromPointsBlock(
  points: AnnotationModePointBlock[],
  rootElement: HTMLElement,
): AnnotationModeRangeBlock | null {
  let minOffset = Infinity
  let maxOffset = -Infinity

  for (const point of points) {
    const hit = resolveSourceOffsetFromPointBlock(point.x, point.y, rootElement)
    if (!hit) continue
    if (hit.sourceOffset < minOffset) minOffset = hit.sourceOffset
    if (hit.sourceOffset > maxOffset) maxOffset = hit.sourceOffset
  }

  if (minOffset === Infinity || maxOffset === -Infinity || maxOffset <= minOffset) return null

  return { start: minOffset, end: maxOffset }
}

/**
 * Expand a source range to cover complete words at the boundaries.
 * This prevents partial-word highlights that look broken.
 */
export function expandRangeToWordBoundariesBlock(
  source: string,
  range: AnnotationModeRangeBlock,
): AnnotationModeRangeBlock {
  let start = range.start
  let end = range.end

  // Expand start backwards to word boundary
  while (start > 0 && !/\s/.test(source[start - 1])) {
    start--
  }

  // Expand end forwards to word boundary
  while (end < source.length && !/\s/.test(source[end])) {
    end++
  }

  return { start, end }
}

/**
 * Apply or remove `user-select: none` on the markdown root to suppress
 * the native blue selection while annotation mode is active.
 */
export function suppressBrowserSelectionBlock(element: HTMLElement): void {
  element.style.userSelect = 'none'
  element.style.webkitUserSelect = 'none'
  window.getSelection()?.removeAllRanges()
}

export function restoreBrowserSelectionBlock(element: HTMLElement): void {
  element.style.userSelect = ''
  element.style.webkitUserSelect = ''
}

// ── internal helpers ──

function findClosestWithAttrBlock(
  node: Node | null,
  attr: string,
  boundary: HTMLElement,
): HTMLElement | null {
  let current: Node | null = node
  while (current && current !== boundary) {
    if (current instanceof HTMLElement && current.hasAttribute(attr)) return current
    current = current.parentNode
  }
  return null
}

function getTextOffsetBlock(element: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange()
  range.selectNodeContents(element)
  try {
    range.setEnd(node, offset)
  } catch {
    return 0
  }
  return range.toString().length
}
