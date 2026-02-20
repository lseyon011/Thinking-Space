import { describe, expect, it } from 'vitest'
import {
  getUIShellThemeProfileBlock,
  normalizeUIThemeIdBlock,
} from '@/services/lego_blocks/uiThemeBlock'

describe('uiThemeBlock', () => {
  it('maps classic to baseline shell profiles', () => {
    expect(getUIShellThemeProfileBlock('classic')).toEqual({
      material: 'baseline',
      motion: 'baseline',
    })
  })

  it('maps modern themes to shared glass and cupertino shell profiles', () => {
    expect(getUIShellThemeProfileBlock('modern-classic')).toEqual({
      material: 'glass',
      motion: 'cupertino',
    })
    expect(getUIShellThemeProfileBlock('modern')).toEqual({
      material: 'glass',
      motion: 'cupertino',
    })
  })

  it('normalizes invalid stored theme values to classic', () => {
    expect(normalizeUIThemeIdBlock('unexpected-theme')).toBe('classic')
  })
})
