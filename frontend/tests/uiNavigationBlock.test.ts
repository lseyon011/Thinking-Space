import { describe, expect, it } from 'vitest'
import {
  deriveUILayoutStateBlock,
  type UILayoutDeriveInput,
} from '@/services/lego_blocks/units/uiLayoutBlock'
import { deriveAdaptiveShellStateBlock } from '@/services/lego_blocks/integrations/uiNavigationBlock'

interface Scenario {
  name: string
  input: UILayoutDeriveInput
  expected: {
    compactNav: boolean
    showBottomNav: boolean
    keyboardVisibleCompact: boolean
    mainBottomPadding: number
    drawerBottomInset: number
  }
}

const scenarios: Scenario[] = [
  {
    name: 'desktop-electron widescreen',
    input: {
      viewportWidth: 1512,
      viewportHeight: 982,
      isElectron: true,
      isCapacitorNative: false,
      platformName: 'electron',
      safeAreaInsets: { top: 0, bottom: 0 },
      keyboardInset: 0,
    },
    expected: {
      compactNav: false,
      showBottomNav: false,
      keyboardVisibleCompact: false,
      mainBottomPadding: 0,
      drawerBottomInset: 0,
    },
  },
  {
    name: 'ipad portrait',
    input: {
      viewportWidth: 834,
      viewportHeight: 1194,
      isElectron: false,
      isCapacitorNative: true,
      platformName: 'ios',
      safeAreaInsets: { top: 24, bottom: 20 },
      keyboardInset: 0,
    },
    expected: {
      compactNav: true,
      showBottomNav: true,
      keyboardVisibleCompact: false,
      mainBottomPadding: 80,
      drawerBottomInset: 20,
    },
  },
  {
    name: 'ipad landscape',
    input: {
      viewportWidth: 1194,
      viewportHeight: 834,
      isElectron: false,
      isCapacitorNative: true,
      platformName: 'ios',
      safeAreaInsets: { top: 0, bottom: 20 },
      keyboardInset: 0,
    },
    expected: {
      compactNav: false,
      showBottomNav: false,
      keyboardVisibleCompact: false,
      mainBottomPadding: 0,
      drawerBottomInset: 20,
    },
  },
  {
    name: 'iphone portrait with keyboard open',
    input: {
      viewportWidth: 430,
      viewportHeight: 610,
      isElectron: false,
      isCapacitorNative: true,
      platformName: 'ios',
      safeAreaInsets: { top: 47, bottom: 34 },
      keyboardInset: 322,
    },
    expected: {
      compactNav: true,
      showBottomNav: false,
      keyboardVisibleCompact: true,
      mainBottomPadding: 322,
      drawerBottomInset: 322,
    },
  },
  {
    name: 'ipad split-view compact width',
    input: {
      viewportWidth: 700,
      viewportHeight: 1024,
      isElectron: false,
      isCapacitorNative: true,
      platformName: 'ios',
      safeAreaInsets: { top: 24, bottom: 20 },
      keyboardInset: 0,
    },
    expected: {
      compactNav: true,
      showBottomNav: true,
      keyboardVisibleCompact: false,
      mainBottomPadding: 80,
      drawerBottomInset: 20,
    },
  },
]

describe('uiNavigationBlock', () => {
  for (const scenario of scenarios) {
    it(`derives shell state for ${scenario.name}`, () => {
      const layout = deriveUILayoutStateBlock(scenario.input)
      const shell = deriveAdaptiveShellStateBlock(layout)

      expect(shell.compactNav).toBe(scenario.expected.compactNav)
      expect(shell.showBottomNav).toBe(scenario.expected.showBottomNav)
      expect(shell.keyboardVisibleCompact).toBe(scenario.expected.keyboardVisibleCompact)
      expect(shell.mainBottomPadding).toBe(scenario.expected.mainBottomPadding)
      expect(shell.drawerBottomInset).toBe(scenario.expected.drawerBottomInset)
    })
  }

  it('maps horizontal safe-area insets into shell state', () => {
    const layout = deriveUILayoutStateBlock({
      viewportWidth: 1024,
      viewportHeight: 768,
      isElectron: false,
      isCapacitorNative: true,
      platformName: 'ios',
      safeAreaInsets: { top: 0, right: 20, bottom: 20, left: 24 },
      keyboardInset: 0,
    })

    const shell = deriveAdaptiveShellStateBlock(layout)

    expect(shell.leftInset).toBe(24)
    expect(shell.rightInset).toBe(20)
  })
})
