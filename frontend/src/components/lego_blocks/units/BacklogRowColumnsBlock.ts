import type { ReactNode } from 'react'
import type { NodeRecord } from '@/services/lego_blocks/integrations/dbBlock'

export interface BacklogRowColumnBlock {
  id: string
  label: string
  widthClassName?: string
  align?: 'left' | 'center' | 'right'
  showForTypes?: NodeRecord['type'][]
  render: (node: NodeRecord) => ReactNode
}

