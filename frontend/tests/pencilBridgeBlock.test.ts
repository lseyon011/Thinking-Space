import { describe, expect, it } from 'vitest'
import {
  mapPencilPressureToStrokeStyleBlock,
  nextPencilToolTypeBlock,
  normalizeNativePencilDoubleTapEventBlock,
  normalizeNativePencilMetricsEventBlock,
  shouldEnableNativePencilBridgeBlock,
} from '../src/services/lego_blocks/pencilBridgeBlock'

describe('pencilBridgeBlock', () => {
  it('normalizes native metrics payloads with clamped pressure', () => {
    const normalized = normalizeNativePencilMetricsEventBlock({
      phase: 'moved',
      timestamp: 123,
      normalizedPressure: 1.7,
      force: 2.3,
      maxForce: 3,
      altitudeAngle: 0.6,
      azimuthAngle: 1.2,
      locationX: 100,
      locationY: 200,
    })

    expect(normalized).not.toBeNull()
    expect(normalized?.phase).toBe('moved')
    expect(normalized?.normalizedPressure).toBe(1)
    expect(normalized?.force).toBe(2.3)
    expect(normalized?.maxForce).toBe(3)
  })

  it('maps pressure to bounded width/opacity and smooths spikes', () => {
    const began = normalizeNativePencilMetricsEventBlock({
      phase: 'began',
      normalizedPressure: 0,
    })
    const moved = normalizeNativePencilMetricsEventBlock({
      phase: 'moved',
      normalizedPressure: 1,
    })

    expect(began).not.toBeNull()
    expect(moved).not.toBeNull()

    const first = mapPencilPressureToStrokeStyleBlock(began!, null)
    const second = mapPencilPressureToStrokeStyleBlock(moved!, first.state)

    expect(first.style?.currentItemStrokeWidth).toBeGreaterThanOrEqual(1)
    expect(first.style?.currentItemStrokeWidth).toBeLessThanOrEqual(6)
    expect(first.style?.currentItemOpacity).toBeGreaterThanOrEqual(35)
    expect(first.style?.currentItemOpacity).toBeLessThanOrEqual(100)

    expect(second.state?.smoothedPressure).toBeGreaterThan(0)
    expect(second.state?.smoothedPressure).toBeLessThan(1)
    expect(second.style?.currentItemStrokeWidth).toBeLessThan(6)
  })

  it('returns no stroke patch when pressure is unavailable', () => {
    const normalized = normalizeNativePencilMetricsEventBlock({
      phase: 'moved',
      timestamp: 123,
    })
    const mapped = mapPencilPressureToStrokeStyleBlock(normalized!, null)
    expect(mapped.style).toBeNull()
  })

  it('toggles deterministic pen/eraser modes on double tap', () => {
    expect(nextPencilToolTypeBlock('freedraw')).toBe('eraser')
    expect(nextPencilToolTypeBlock('eraser')).toBe('freedraw')
    expect(nextPencilToolTypeBlock('selection')).toBe('eraser')
  })

  it('normalizes double-tap event payload and preferred action', () => {
    const normalized = normalizeNativePencilDoubleTapEventBlock({
      preferredAction: 'switchEraser',
      timestamp: 555,
    })
    expect(normalized.preferredAction).toBe('switchEraser')
    expect(normalized.timestamp).toBe(555)

    const fallback = normalizeNativePencilDoubleTapEventBlock(null)
    expect(fallback.preferredAction).toBe('unknown')
  })

  it('enables native pencil bridge only for capacitor ios runtime', () => {
    expect(shouldEnableNativePencilBridgeBlock({ isCapacitorNative: true, platform: 'ios' })).toBe(true)
    expect(shouldEnableNativePencilBridgeBlock({ isCapacitorNative: true, platform: 'android' })).toBe(false)
    expect(shouldEnableNativePencilBridgeBlock({ isCapacitorNative: false, platform: 'ios' })).toBe(false)
  })
})
