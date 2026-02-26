import { useContext } from 'react'
import { UILayoutContext, type UILayoutContextValue } from '@/components/lego_blocks/integrations/UILayoutBlock'

export function useUILayoutBlock(): UILayoutContextValue {
  return useContext(UILayoutContext)
}
