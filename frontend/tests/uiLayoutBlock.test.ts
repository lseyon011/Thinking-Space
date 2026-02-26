import { describe, expect, it } from 'vitest'
import {
  deriveLayoutModeFromWidthBlock,
  deriveUILayoutStateBlock,
  normalizeSafeAreaInsetsBlock,
} from '@/services/lego_blocks/units/uiLayoutBlock'

describe('uiLayoutBlock', () => {
  it('derives desktop mode for wide viewports', () => {
    expect(deriveLayoutModeFromWidthBlock(1280)).toBe('desktop')
  })

  it('derives tablet mode for medium viewports', () => {
    expect(deriveLayoutModeFromWidthBlock(900)).toBe('tablet')
  })

  it('derives phone mode for narrow viewports', () => {
    expect(deriveLayoutModeFromWidthBlock(430)).toBe('phone')
  })

  it('enables sidebar for tablet landscape when width is large enough', () => {
    const layout = deriveUILayoutStateBlock({
      viewportWidth: 1080,
      viewportHeight: 810,
      isElectron: false,
      isCapacitorNative: true,
      platformName: 'ios',
      safeAreaInsets: { top: 24, bottom: 20 },
    })

    expect(layout.mode).toBe('tablet')
    expect(layout.orientation).toBe('landscape')
    expect(layout.hasSidebar).toBe(true)
    expect(layout.hasBottomBar).toBe(false)
    expect(layout.surface).toBe('capacitor-ios')
  })

  it('enables bottom bar for tablet portrait', () => {
    const layout = deriveUILayoutStateBlock({
      viewportWidth: 834,
      viewportHeight: 1194,
      isElectron: false,
      isCapacitorNative: true,
      platformName: 'ios',
    })

    expect(layout.mode).toBe('tablet')
    expect(layout.orientation).toBe('portrait')
    expect(layout.hasSidebar).toBe(false)
    expect(layout.hasBottomBar).toBe(true)
  })

  it('normalizes invalid safe-area values', () => {
    const insets = normalizeSafeAreaInsetsBlock({
      top: -4,
      right: Number.NaN,
      bottom: 12.3456,
      left: undefined,
    })

    expect(insets).toEqual({
      top: 0,
      right: 0,
      bottom: 12.35,
      left: 0,
    })
  })

  it('sets keyboard visibility from keyboard inset', () => {
    const layout = deriveUILayoutStateBlock({
      viewportWidth: 430,
      viewportHeight: 520,
      isElectron: false,
      isCapacitorNative: true,
      platformName: 'ios',
      keyboardInset: 312,
    })

    expect(layout.keyboardVisible).toBe(true)
    expect(layout.keyboardInset).toBe(312)
  })
})
