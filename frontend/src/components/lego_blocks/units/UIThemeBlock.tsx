import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  UI_COLOR_MODE_OPTIONS_BLOCK,
  UI_THEME_OPTIONS_BLOCK,
  initializeUIColorModeOrch,
  setStoredUIColorModeOrch,
  initializeUIThemeOrch,
  applyUIColorModeOrch,
  setStoredUIThemeOrch,
  applyUIThemeOrch,
  type UIColorModeId,
  type UIThemeId,
} from '@/services/orchestrators/uiThemeOrch'

interface UIThemeContextValue {
  themeId: UIThemeId
  setThemeId: (themeId: UIThemeId) => void
  colorModeId: UIColorModeId
  setColorModeId: (colorModeId: UIColorModeId) => void
}

const defaultTheme = initializeUIThemeOrch()
const defaultColorMode = initializeUIColorModeOrch()

const UIThemeContext = createContext<UIThemeContextValue>({
  themeId: defaultTheme,
  setThemeId: () => {},
  colorModeId: defaultColorMode,
  setColorModeId: () => {},
})

export function UIThemeProviderBlock({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<UIThemeId>(defaultTheme)
  const [colorModeId, setColorModeIdState] = useState<UIColorModeId>(defaultColorMode)

  const setThemeId = useCallback((nextTheme: UIThemeId) => {
    setThemeIdState(nextTheme)
  }, [])

  const setColorModeId = useCallback((nextColorMode: UIColorModeId) => {
    setColorModeIdState(nextColorMode)
  }, [])

  useEffect(() => {
    setStoredUIThemeOrch(themeId)
    applyUIThemeOrch(themeId)
  }, [themeId])

  useEffect(() => {
    setStoredUIColorModeOrch(colorModeId)
    applyUIColorModeOrch(colorModeId)
  }, [colorModeId])

  const value = useMemo(
    () => ({
      themeId,
      setThemeId,
      colorModeId,
      setColorModeId,
    }),
    [colorModeId, setColorModeId, themeId, setThemeId],
  )

  return (
    <UIThemeContext.Provider value={value}>
      {children}
    </UIThemeContext.Provider>
  )
}

export function useUIThemeBlock(): UIThemeContextValue {
  return useContext(UIThemeContext)
}

export { UI_COLOR_MODE_OPTIONS_BLOCK }
export { UI_THEME_OPTIONS_BLOCK }
export type { UIColorModeId, UIThemeId }
