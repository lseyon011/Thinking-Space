import { useContext } from 'react'
import { RouteActivityContextBlock } from '@/components/lego_blocks/units/RouteActivityProviderBlock'

export function useRouteActivityBlock(): boolean {
  return useContext(RouteActivityContextBlock)
}
