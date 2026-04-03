import { describe, expect, it } from 'vitest'
import {
  buildPdfRenderedWindowBlock,
  computeDisplayedPdfScaleBlock,
  computeEstimatedPdfPageHeightBlock,
  computePdfFitScaleBlock,
  computePdfPageWidthBlock,
} from '@/services/lego_blocks/units/pdfViewportBlock'

describe('pdfViewportBlock', () => {
  it('derives fit-width scale from viewport width and natural page width', () => {
    expect(computePdfPageWidthBlock(1000)).toBe(976)
    expect(computePdfFitScaleBlock({
      viewportWidth: 1000,
      naturalPageWidth: 610,
    })).toBeCloseTo(1.6, 1)
  })

  it('uses fit-width scale as the displayed scale while fit mode is active', () => {
    expect(computeDisplayedPdfScaleBlock({
      fitWidth: true,
      scale: 1,
      viewportWidth: 900,
      naturalPageWidth: 600,
    })).toBeCloseTo(1.46, 2)

    expect(computeDisplayedPdfScaleBlock({
      fitWidth: false,
      scale: 1.25,
      viewportWidth: 900,
      naturalPageWidth: 600,
    })).toBe(1.25)
  })

  it('estimates page height using the effective visible scale', () => {
    expect(computeEstimatedPdfPageHeightBlock({
      fitWidth: true,
      scale: 1,
      viewportWidth: 900,
      naturalPageMetrics: { width: 600, height: 780 },
    })).toBe(1139)

    expect(computeEstimatedPdfPageHeightBlock({
      fitWidth: false,
      scale: 1.5,
      viewportWidth: 900,
      naturalPageMetrics: { width: 600, height: 780 },
    })).toBe(1170)
  })

  it('builds a bounded render window around the active page', () => {
    expect(buildPdfRenderedWindowBlock({
      centerPage: 1,
      numPages: 10,
    })).toEqual({ start: 1, end: 3 })

    expect(buildPdfRenderedWindowBlock({
      centerPage: 5,
      numPages: 10,
    })).toEqual({ start: 3, end: 7 })

    expect(buildPdfRenderedWindowBlock({
      centerPage: 10,
      numPages: 10,
    })).toEqual({ start: 8, end: 10 })
  })
})
