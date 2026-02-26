import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  UI_THEME_OPTIONS_BLOCK,
  initializeUIThemeOrch,
  setStoredUIThemeOrch,
  applyUIThemeOrch,
  type UIThemeId,
} from '@/services/orchestrators/uiThemeOrch'

interface UIThemeContextValue {
  themeId: UIThemeId
  setThemeId: (themeId: UIThemeId) => void
}

const defaultTheme = initializeUIThemeOrch()

const UIThemeContext = createContext<UIThemeContextValue>({
  themeId: defaultTheme,
  setThemeId: () => {},
})

export function UIThemeProviderBlock({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<UIThemeId>(defaultTheme)

  const setThemeId = useCallback((nextTheme: UIThemeId) => {
    setThemeIdState(nextTheme)
  }, [])

  useEffect(() => {
    setStoredUIThemeOrch(themeId)
    applyUIThemeOrch(themeId)
  }, [themeId])

  const value = useMemo(
    () => ({
      themeId,
      setThemeId,
    }),
    [themeId, setThemeId],
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

export { UI_THEME_OPTIONS_BLOCK }
export type { UIThemeId }
