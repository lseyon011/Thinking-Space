import { describe, expect, it } from 'vitest'
import {
  DEFAULT_UI_COLOR_MODE_ID_BLOCK,
  DEFAULT_UI_THEME_ID_BLOCK,
  UI_THEME_OPTIONS_BLOCK,
  isUIThemeIdBlock,
  normalizeUIThemeIdBlock,
} from '@/services/lego_blocks/units/uiThemeBlock'

describe('uiThemeBlock', () => {
  it('exposes classic light as the default theme', () => {
    expect(DEFAULT_UI_THEME_ID_BLOCK).toBe('classic')
    expect(DEFAULT_UI_COLOR_MODE_ID_BLOCK).toBe('light')
  })

  it('accepts every listed theme option id', () => {
    for (const option of UI_THEME_OPTIONS_BLOCK) {
      expect(isUIThemeIdBlock(option.id)).toBe(true)
      expect(normalizeUIThemeIdBlock(option.id)).toBe(option.id)
    }
  })

  it('normalizes invalid stored theme values to classic', () => {
    expect(normalizeUIThemeIdBlock('unexpected-theme')).toBe('classic')
    expect(normalizeUIThemeIdBlock(undefined)).toBe('classic')
    expect(normalizeUIThemeIdBlock(42)).toBe('classic')
  })
})
