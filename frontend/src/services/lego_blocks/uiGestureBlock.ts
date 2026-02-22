export interface SwipeThresholds {
  edgeStartMaxX: number
  openDeltaXMin: number
  closeDeltaXMax: number
  maxVerticalDrift: number
}

export const DEFAULT_DRAWER_SWIPE_THRESHOLDS: SwipeThresholds = Object.freeze({
  edgeStartMaxX: 24,
  openDeltaXMin: 72,
  closeDeltaXMax: -56,
  maxVerticalDrift: 44,
})

const EDGE_SWIPE_IGNORE_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[role="textbox"]',
  '[contenteditable="true"]',
  '[contenteditable=""]',
  '.cm-editor',
  '.cm-content',
  '.cm-scroller',
  '.excalidraw',
  '[data-ltm-edge-swipe-ignore="true"]',
].join(', ')

function hasValidDistance(value: number): boolean {
  return Number.isFinite(value)
}

function isElementTarget(target: EventTarget | null): target is Element {
  return typeof Element !== 'undefined' && target instanceof Element
}

export function shouldIgnoreEdgeSwipeFromTargetBlock(target: EventTarget | null): boolean {
  if (!isElementTarget(target)) return false
  return target.closest(EDGE_SWIPE_IGNORE_SELECTOR) !== null
}

export function shouldStartEdgeSwipeOpenBlock(
  startX: number,
  thresholds: SwipeThresholds = DEFAULT_DRAWER_SWIPE_THRESHOLDS,
): boolean {
  if (!hasValidDistance(startX)) return false
  return startX <= thresholds.edgeStartMaxX
}

export function shouldOpenDrawerFromSwipeBlock(
  deltaX: number,
  deltaY: number,
  thresholds: SwipeThresholds = DEFAULT_DRAWER_SWIPE_THRESHOLDS,
): boolean {
  if (!hasValidDistance(deltaX) || !hasValidDistance(deltaY)) return false
  return deltaX >= thresholds.openDeltaXMin && Math.abs(deltaY) < thresholds.maxVerticalDrift
}

export function shouldCloseDrawerFromSwipeBlock(
  deltaX: number,
  deltaY: number,
  thresholds: SwipeThresholds = DEFAULT_DRAWER_SWIPE_THRESHOLDS,
): boolean {
  if (!hasValidDistance(deltaX) || !hasValidDistance(deltaY)) return false
  return deltaX <= thresholds.closeDeltaXMax && Math.abs(deltaY) < thresholds.maxVerticalDrift
}
