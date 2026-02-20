import type { UILayoutState } from './uiLayoutBlock'

export interface UIShellLayoutState {
  compactNav: boolean
  keyboardVisibleCompact: boolean
  showBottomNav: boolean
  topInset: number
  rightInset: number
  bottomInset: number
  leftInset: number
  drawerBottomInset: number
  bottomOffset: number
  mainBottomPadding: number
}

export const COMPACT_BOTTOM_NAV_BASE_HEIGHT = 60

function normalizeInset(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.round(value))
}

export function deriveAdaptiveShellStateBlock(layout: UILayoutState): UIShellLayoutState {
  const compactNav = !layout.hasSidebar
  const keyboardVisibleCompact = compactNav && layout.keyboardVisible
  const showBottomNav = compactNav && layout.hasBottomBar && !keyboardVisibleCompact
  const topInset = normalizeInset(layout.safeAreaInsets.top)
  const rightInset = normalizeInset(layout.safeAreaInsets.right)
  const bottomInset = normalizeInset(layout.safeAreaInsets.bottom)
  const leftInset = normalizeInset(layout.safeAreaInsets.left)
  const keyboardInset = normalizeInset(layout.keyboardInset)
  const drawerBottomInset = Math.max(bottomInset, keyboardVisibleCompact ? keyboardInset : 0)
  const bottomOffset = showBottomNav ? COMPACT_BOTTOM_NAV_BASE_HEIGHT + bottomInset : 0
  const mainBottomPadding = Math.max(bottomOffset, keyboardVisibleCompact ? keyboardInset : 0)

  return {
    compactNav,
    keyboardVisibleCompact,
    showBottomNav,
    topInset,
    rightInset,
    bottomInset,
    leftInset,
    drawerBottomInset,
    bottomOffset,
    mainBottomPadding,
  }
}
