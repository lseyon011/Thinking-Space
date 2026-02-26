import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getUILayoutStateOrch, subscribeUILayoutOrch, type UILayoutState } from '@/services/orchestrators/uiLayoutOrch'

export interface UILayoutContextValue {
  layout: UILayoutState
  refreshLayout: () => void
}

const defaultLayoutState = getUILayoutStateOrch()

export const UILayoutContext = createContext<UILayoutContextValue>({
  layout: defaultLayoutState,
  refreshLayout: () => {},
})

export function UILayoutProviderBlock({ children }: { children: ReactNode }) {
  const [layout, setLayout] = useState<UILayoutState>(defaultLayoutState)

  const refreshLayout = useCallback(() => {
    setLayout(getUILayoutStateOrch())
  }, [])

  useEffect(() => subscribeUILayoutOrch(setLayout), [])

  const value = useMemo(
    () => ({
      layout,
      refreshLayout,
    }),
    [layout, refreshLayout],
  )

  return (
    <UILayoutContext.Provider value={value}>
      {children}
    </UILayoutContext.Provider>
  )
}
