import { createContext, useContext, type Dispatch, type ReactNode, type SetStateAction } from 'react'

interface AppShellNavState {
  sidebarCollapsed: boolean
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>
  toggleSidebarCollapsed: () => void
}

const AppShellNavContext = createContext<AppShellNavState | undefined>(undefined)

interface Props {
  value: AppShellNavState
  children: ReactNode
}

export function AppShellNavProvider({ value, children }: Props) {
  return <AppShellNavContext.Provider value={value}>{children}</AppShellNavContext.Provider>
}

export function useAppShellNavState() {
  const context = useContext(AppShellNavContext)
  if (!context) {
    throw new Error('useAppShellNavState must be used within AppShellNavProvider')
  }
  return context
}
