import { createContext, type ReactNode } from 'react'

export const RouteActivityContextBlock = createContext(true)

interface RouteActivityProviderBlockProps {
  active: boolean
  children: ReactNode
}

export default function RouteActivityProviderBlock({
  active,
  children,
}: RouteActivityProviderBlockProps) {
  return (
    <RouteActivityContextBlock.Provider value={active}>
      {children}
    </RouteActivityContextBlock.Provider>
  )
}
