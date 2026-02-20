export type UILayoutMode = 'desktop' | 'tablet' | 'phone'
export type UILayoutOrientation = 'portrait' | 'landscape'
export type UILayoutSurface = 'electron' | 'capacitor-ios' | 'capacitor-android' | 'browser'

export interface UISafeAreaInsets {
  top: number
  right: number
  bottom: number
  left: number
}

export interface UILayoutState {
  mode: UILayoutMode
  orientation: UILayoutOrientation
  surface: UILayoutSurface
  isElectron: boolean
  isCapacitorNative: boolean
  hasSidebar: boolean
  hasBottomBar: boolean
  safeAreaInsets: UISafeAreaInsets
  viewport: {
    width: number
    height: number
  }
}

export interface UILayoutDeriveInput {
  viewportWidth: number
  viewportHeight: number
  isElectron: boolean
  isCapacitorNative: boolean
  platformName?: 'electron' | 'ios' | 'android' | 'web'
  safeAreaInsets?: Partial<UISafeAreaInsets> | null
}

export const DESKTOP_MIN_WIDTH = 1200
export const TABLET_MIN_WIDTH = 768
export const TABLET_SIDEBAR_MIN_WIDTH = 1024

const ZERO_SAFE_AREA: UISafeAreaInsets = Object.freeze({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
})

function normalizeDimension(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.round(value)
}

function normalizeInset(value: number | null | undefined): number {
  if (!Number.isFinite(value ?? Number.NaN)) return 0
  return Math.max(0, Math.round((value ?? 0) * 100) / 100)
}

export function normalizeSafeAreaInsetsBlock(
  insets?: Partial<UISafeAreaInsets> | null,
): UISafeAreaInsets {
  if (!insets) return ZERO_SAFE_AREA
  return {
    top: normalizeInset(insets.top),
    right: normalizeInset(insets.right),
    bottom: normalizeInset(insets.bottom),
    left: normalizeInset(insets.left),
  }
}

export function deriveLayoutModeFromWidthBlock(width: number): UILayoutMode {
  if (width >= DESKTOP_MIN_WIDTH) return 'desktop'
  if (width >= TABLET_MIN_WIDTH) return 'tablet'
  return 'phone'
}

function deriveSurface(input: UILayoutDeriveInput): UILayoutSurface {
  if (input.isElectron) return 'electron'
  if (input.isCapacitorNative && input.platformName === 'ios') return 'capacitor-ios'
  if (input.isCapacitorNative) return 'capacitor-android'
  return 'browser'
}

export function deriveUILayoutStateBlock(input: UILayoutDeriveInput): UILayoutState {
  const viewportWidth = normalizeDimension(input.viewportWidth, DESKTOP_MIN_WIDTH)
  const viewportHeight = normalizeDimension(input.viewportHeight, 800)
  const mode = deriveLayoutModeFromWidthBlock(viewportWidth)
  const orientation: UILayoutOrientation = viewportHeight >= viewportWidth ? 'portrait' : 'landscape'
  const hasSidebar = mode === 'desktop'
    || (mode === 'tablet' && orientation === 'landscape' && viewportWidth >= TABLET_SIDEBAR_MIN_WIDTH)
  const hasBottomBar = mode === 'phone' || (mode === 'tablet' && !hasSidebar)

  return {
    mode,
    orientation,
    surface: deriveSurface(input),
    isElectron: input.isElectron,
    isCapacitorNative: input.isCapacitorNative,
    hasSidebar,
    hasBottomBar,
    safeAreaInsets: normalizeSafeAreaInsetsBlock(input.safeAreaInsets),
    viewport: {
      width: viewportWidth,
      height: viewportHeight,
    },
  }
}

