import { describe, expect, it } from 'vitest'
import {
  buildMarkdownAnnotationPointFromNativePencilEventBlock,
  eraseMarkdownAnnotationStrokesAtPointBlock,
  isNativePencilEventInsideCanvasBlock,
} from '../src/services/lego_blocks/units/markdownAnnotationCanvasBlock'

describe('markdownAnnotationCanvasBlock', () => {
  const canvas = {
    getBoundingClientRect: () => ({
      left: 100,
      top: 200,
      right: 300,
      bottom: 500,
      width: 200,
      height: 300,
    }),
  } as HTMLCanvasElement

  it('maps native pencil metrics into normalized canvas coordinates', () => {
    expect(buildMarkdownAnnotationPointFromNativePencilEventBlock({
      phase: 'moved',
      timestamp: 1,
      force: null,
      maxForce: null,
      normalizedPressure: 0.75,
      altitudeAngle: null,
      azimuthAngle: null,
      locationX: 200,
      locationY: 350,
    }, canvas)).toEqual({
      x: 0.5,
      y: 0.5,
      pressure: 0.75,
    })
  })

  it('detects whether native pencil metrics land inside the note canvas', () => {
    expect(isNativePencilEventInsideCanvasBlock({
      phase: 'began',
      timestamp: 1,
      force: null,
      maxForce: null,
      normalizedPressure: null,
      altitudeAngle: null,
      azimuthAngle: null,
      locationX: 150,
      locationY: 250,
    }, canvas)).toBe(true)

    expect(isNativePencilEventInsideCanvasBlock({
      phase: 'began',
      timestamp: 1,
      force: null,
      maxForce: null,
      normalizedPressure: null,
      altitudeAngle: null,
      azimuthAngle: null,
      locationX: 80,
      locationY: 250,
    }, canvas)).toBe(false)
  })

  it('erases strokes that intersect the eraser radius', () => {
    const strokes = [
      {
        id: 'stroke-a',
        color: '#f59e0b',
        points: [{ x: 0.5, y: 0.5, pressure: null }],
      },
      {
        id: 'stroke-b',
        color: '#f59e0b',
        points: [{ x: 0.9, y: 0.9, pressure: null }],
      },
    ]

    expect(eraseMarkdownAnnotationStrokesAtPointBlock(strokes, { x: 0.5, y: 0.5, pressure: null }, 0.05)).toEqual([
      strokes[1],
    ])
  })
})
