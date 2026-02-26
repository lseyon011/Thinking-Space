import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DRAWER_SWIPE_THRESHOLDS,
  shouldCloseDrawerFromSwipeBlock,
  shouldOpenDrawerFromSwipeBlock,
  shouldStartEdgeSwipeOpenBlock,
} from '@/services/lego_blocks/units/uiGestureBlock'

describe('uiGestureBlock', () => {
  it('starts edge swipe only near the left edge', () => {
    expect(shouldStartEdgeSwipeOpenBlock(0)).toBe(true)
    expect(shouldStartEdgeSwipeOpenBlock(DEFAULT_DRAWER_SWIPE_THRESHOLDS.edgeStartMaxX)).toBe(true)
    expect(shouldStartEdgeSwipeOpenBlock(DEFAULT_DRAWER_SWIPE_THRESHOLDS.edgeStartMaxX + 1)).toBe(false)
  })

  it('opens drawer when horizontal swipe passes threshold with small vertical drift', () => {
    expect(shouldOpenDrawerFromSwipeBlock(90, 10)).toBe(true)
    expect(shouldOpenDrawerFromSwipeBlock(90, -10)).toBe(true)
    expect(shouldOpenDrawerFromSwipeBlock(60, 10)).toBe(false)
    expect(shouldOpenDrawerFromSwipeBlock(90, 50)).toBe(false)
  })

  it('closes drawer when left swipe passes threshold with small vertical drift', () => {
    expect(shouldCloseDrawerFromSwipeBlock(-70, 10)).toBe(true)
    expect(shouldCloseDrawerFromSwipeBlock(-70, -10)).toBe(true)
    expect(shouldCloseDrawerFromSwipeBlock(-40, 10)).toBe(false)
    expect(shouldCloseDrawerFromSwipeBlock(-70, 50)).toBe(false)
  })

  it('rejects invalid swipe distances', () => {
    expect(shouldOpenDrawerFromSwipeBlock(Number.NaN, 0)).toBe(false)
    expect(shouldCloseDrawerFromSwipeBlock(-80, Number.NaN)).toBe(false)
    expect(shouldStartEdgeSwipeOpenBlock(Number.POSITIVE_INFINITY)).toBe(false)
  })
})
