import { describe, expect, it } from 'vitest'
import {
  EXCALIDRAW_HIGHLIGHTER_PRESETS_BLOCK,
  buildExcalidrawDisableHighlighterAppStatePatchBlock,
  buildExcalidrawHighlighterAppStatePatchBlock,
  extractObsidianHighlighterPresetsFromPluginDataBlock,
  isExcalidrawHighlighterEnabledBlock,
  matchExcalidrawHighlighterPresetBlock,
  parseObsidianHighlighterPresetsJsonBlock,
} from '../src/services/lego_blocks/units/excalidrawHighlighterBlock'

describe('excalidrawHighlighterBlock', () => {
  it('defines Obsidian-style highlighter presets for quick pen switching', () => {
    expect(EXCALIDRAW_HIGHLIGHTER_PRESETS_BLOCK.length).toBeGreaterThanOrEqual(5)
    expect(EXCALIDRAW_HIGHLIGHTER_PRESETS_BLOCK.map((preset) => preset.id)).toContain('yellow')
    expect(EXCALIDRAW_HIGHLIGHTER_PRESETS_BLOCK.map((preset) => preset.id)).toContain('pink')
    for (const preset of EXCALIDRAW_HIGHLIGHTER_PRESETS_BLOCK) {
      expect(preset.strokeOptions.highlighter).toBe(true)
      expect(preset.strokeWidth).toBeGreaterThan(0)
    }
  })

  it('matches known presets from appState when highlighter mode is active', () => {
    const appState = {
      currentItemStrokeColor: '#FFF9DB',
      currentItemBackgroundColor: '#fff9db',
      currentStrokeOptions: {
        highlighter: true,
      },
    }

    expect(isExcalidrawHighlighterEnabledBlock(appState)).toBe(true)
    expect(matchExcalidrawHighlighterPresetBlock(appState)).toBe('yellow')
  })

  it('returns custom when highlighter mode is active with a non-preset color', () => {
    const appState = {
      currentItemStrokeColor: '#abcdef',
      currentItemBackgroundColor: '#abcdef',
      currentStrokeOptions: {
        highlighter: true,
      },
    }

    expect(matchExcalidrawHighlighterPresetBlock(appState)).toBe('custom')
  })

  it('builds highlighter patch that switches tool to freedraw with highlighter options', () => {
    const preset = EXCALIDRAW_HIGHLIGHTER_PRESETS_BLOCK[0]
    const patch = buildExcalidrawHighlighterAppStatePatchBlock(preset, {
      activeTool: {
        type: 'selection',
        locked: true,
      },
    })

    expect((patch.activeTool as Record<string, unknown>).type).toBe('freedraw')
    expect((patch.activeTool as Record<string, unknown>).locked).toBe(false)
    expect(patch.currentItemStrokeColor).toBe(preset.strokeColor)
    expect((patch.currentStrokeOptions as Record<string, unknown>).highlighter).toBe(true)
  })

  it('builds disable patch that keeps freedraw and disables highlighter behavior', () => {
    const patch = buildExcalidrawDisableHighlighterAppStatePatchBlock({
      activeTool: {
        type: 'freedraw',
      },
      currentStrokeOptions: {
        highlighter: true,
        hasOutline: true,
      },
    })

    expect((patch.activeTool as Record<string, unknown>).type).toBe('freedraw')
    expect((patch.currentStrokeOptions as Record<string, unknown>).highlighter).toBe(false)
    expect((patch.currentStrokeOptions as Record<string, unknown>).hasOutline).toBe(false)
    expect(patch.currentItemBackgroundColor).toBe('transparent')
  })

  it('extracts highlighter presets from Obsidian customPens data', () => {
    const presets = extractObsidianHighlighterPresetsFromPluginDataBlock({
      customPens: [
        {
          type: 'highlighter',
          strokeColor: '#ffffff',
          backgroundColor: '#fff9db',
          strokeWidth: 2.6,
          penOptions: {
            highlighter: true,
            constantPressure: true,
            hasOutline: true,
            outlineWidth: 4,
            options: {
              thinning: 1,
              smoothing: 0.5,
              streamline: 0.5,
              easing: 'linear',
              start: { taper: 0, cap: true, easing: 'linear' },
              end: { taper: true, cap: true, easing: 'linear' },
            },
          },
        },
      ],
    })

    expect(presets).toHaveLength(1)
    expect(presets[0]?.label).toBe('Highlighter')
    expect(presets[0]?.strokeColor).toBe('#fff9db')
    expect((presets[0]?.strokeOptions.options.end.taper)).toBe(true)
  })

  it('parses Obsidian plugin settings JSON and ignores non-highlighter pens', () => {
    const raw = JSON.stringify({
      customPens: [
        {
          type: 'default',
          strokeColor: '#000000',
          backgroundColor: 'transparent',
          strokeWidth: 1,
          penOptions: { highlighter: false },
        },
        {
          type: 'marker',
          strokeColor: '#fff',
          backgroundColor: '#ffe8cc',
          strokeWidth: 2,
          penOptions: { highlighter: true },
        },
      ],
    })

    const parsed = parseObsidianHighlighterPresetsJsonBlock(raw)
    expect(parsed).toHaveLength(1)
    expect(parsed[0]?.label).toBe('Marker')
  })
})
