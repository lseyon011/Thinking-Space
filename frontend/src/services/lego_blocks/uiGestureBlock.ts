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

function hasValidDistance(value: number): boolean {
  return Number.isFinite(value)
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
