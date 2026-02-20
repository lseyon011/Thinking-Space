import { getPlatformName, isCapacitorNative, isElectron } from '../lego_blocks/fsBlock'
import {
  deriveUILayoutStateBlock,
  normalizeSafeAreaInsetsBlock,
  type UILayoutState,
  type UISafeAreaInsets,
} from '../lego_blocks/uiLayoutBlock'

type UILayoutListener = (state: UILayoutState) => void
type UILayoutEventCallback = () => void

interface ProbeElementLike {
  style: { cssText: string }
  remove?: () => void
}

interface BodyLike {
  appendChild: (node: ProbeElementLike) => void
}

interface DocumentLike {
  body?: BodyLike
  createElement: (tag: string) => ProbeElementLike
}

interface StyleLike {
  paddingTop?: string
  paddingRight?: string
  paddingBottom?: string
  paddingLeft?: string
}

interface EventSourceLike {
  addEventListener: (type: string, callback: UILayoutEventCallback) => void
  removeEventListener: (type: string, callback: UILayoutEventCallback) => void
}

interface VisualViewportLike extends EventSourceLike {
  width: number
  height: number
}

export interface UILayoutWindowLike extends EventSourceLike {
  innerWidth: number
  innerHeight: number
  visualViewport?: VisualViewportLike | null
  document?: DocumentLike
  getComputedStyle?: (element: ProbeElementLike) => StyleLike
}

export interface UILayoutRuntimeFlags {
  isElectron: boolean
  isCapacitorNative: boolean
  platformName: 'electron' | 'ios' | 'android' | 'web'
}

export interface UILayoutSnapshotOptions {
  windowRef?: UILayoutWindowLike | null
  runtimeFlags?: Partial<UILayoutRuntimeFlags>
  keyboardInset?: number
  safeAreaInsets?: Partial<UISafeAreaInsets> | null
}

export interface UILayoutSubscriptionOptions extends UILayoutSnapshotOptions {
  debounceMs?: number
}

const DEFAULT_DEBOUNCE_MS = 120
const KEYBOARD_INSET_MIN_PX = 120

function parseInsetPx(value: string | undefined): number {
  const parsed = Number.parseFloat((value ?? '').trim())
  if (!Number.isFinite(parsed)) return 0
  return parsed
}

function resolveWindowRef(windowRef?: UILayoutWindowLike | null): UILayoutWindowLike | null {
  if (windowRef) return windowRef
  if (typeof window === 'undefined') return null
  return window as unknown as UILayoutWindowLike
}

function resolveRuntimeFlags(flags?: Partial<UILayoutRuntimeFlags>): UILayoutRuntimeFlags {
  const electron = flags?.isElectron ?? isElectron()
  const capacitor = flags?.isCapacitorNative ?? isCapacitorNative()
  const platform = flags?.platformName ?? getPlatformName()
  return {
    isElectron: electron,
    isCapacitorNative: capacitor,
    platformName: platform,
  }
}

function readSafeAreaInsetsFromWindow(windowRef: UILayoutWindowLike | null): UISafeAreaInsets {
  if (!windowRef?.document?.body || !windowRef.document.createElement) {
    return normalizeSafeAreaInsetsBlock()
  }

  const probe = windowRef.document.createElement('div')
  probe.style.cssText = [
    'position: fixed',
    'visibility: hidden',
    'pointer-events: none',
    'inset: 0',
    'padding-top: env(safe-area-inset-top)',
    'padding-right: env(safe-area-inset-right)',
    'padding-bottom: env(safe-area-inset-bottom)',
    'padding-left: env(safe-area-inset-left)',
  ].join(';')

  try {
    windowRef.document.body.appendChild(probe)
    const style = windowRef.getComputedStyle?.(probe)
    return normalizeSafeAreaInsetsBlock({
      top: parseInsetPx(style?.paddingTop),
      right: parseInsetPx(style?.paddingRight),
      bottom: parseInsetPx(style?.paddingBottom),
      left: parseInsetPx(style?.paddingLeft),
    })
  } catch {
    return normalizeSafeAreaInsetsBlock()
  } finally {
    probe.remove?.()
  }
}

function readViewport(windowRef: UILayoutWindowLike | null): { width: number; height: number } {
  if (!windowRef) {
    return { width: 1280, height: 800 }
  }

  const viewportWidth = windowRef.visualViewport?.width ?? windowRef.innerWidth
  const viewportHeight = windowRef.visualViewport?.height ?? windowRef.innerHeight

  return {
    width: Number.isFinite(viewportWidth) ? viewportWidth : 1280,
    height: Number.isFinite(viewportHeight) ? viewportHeight : 800,
  }
}

function readKeyboardInset(windowRef: UILayoutWindowLike | null): number {
  if (!windowRef?.visualViewport) return 0
  const inset = windowRef.innerHeight - windowRef.visualViewport.height
  if (!Number.isFinite(inset) || inset < KEYBOARD_INSET_MIN_PX) return 0
  return inset
}

export function getUILayoutStateOrch(options: UILayoutSnapshotOptions = {}): UILayoutState {
  const windowRef = resolveWindowRef(options.windowRef)
  const viewport = readViewport(windowRef)
  const runtime = resolveRuntimeFlags(options.runtimeFlags)
  const keyboardInset = typeof options.keyboardInset === 'number'
    ? options.keyboardInset
    : readKeyboardInset(windowRef)
  const safeAreaInsets = options.safeAreaInsets
    ? normalizeSafeAreaInsetsBlock(options.safeAreaInsets)
    : readSafeAreaInsetsFromWindow(windowRef)

  return deriveUILayoutStateBlock({
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    isElectron: runtime.isElectron,
    isCapacitorNative: runtime.isCapacitorNative,
    platformName: runtime.platformName,
    keyboardInset,
    safeAreaInsets,
  })
}

export function subscribeUILayoutOrch(
  listener: UILayoutListener,
  options: UILayoutSubscriptionOptions = {},
): () => void {
  const windowRef = resolveWindowRef(options.windowRef)
  if (!windowRef) {
    listener(getUILayoutStateOrch(options))
    return () => {}
  }

  const debounceMs = Math.max(0, Math.floor(options.debounceMs ?? DEFAULT_DEBOUNCE_MS))
  let timer: ReturnType<typeof setTimeout> | null = null

  const emit = () => {
    listener(getUILayoutStateOrch(options))
  }

  const scheduleEmit = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      emit()
    }, debounceMs)
  }

  emit()
  windowRef.addEventListener('resize', scheduleEmit)
  windowRef.addEventListener('orientationchange', scheduleEmit)
  windowRef.addEventListener('focusin', scheduleEmit)
  windowRef.addEventListener('focusout', scheduleEmit)
  windowRef.visualViewport?.addEventListener('resize', scheduleEmit)

  return () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    windowRef.removeEventListener('resize', scheduleEmit)
    windowRef.removeEventListener('orientationchange', scheduleEmit)
    windowRef.removeEventListener('focusin', scheduleEmit)
    windowRef.removeEventListener('focusout', scheduleEmit)
    windowRef.visualViewport?.removeEventListener('resize', scheduleEmit)
  }
}

export type {
  UILayoutMode,
  UILayoutOrientation,
  UILayoutSurface,
  UILayoutState,
  UISafeAreaInsets,
} from '../lego_blocks/uiLayoutBlock'
