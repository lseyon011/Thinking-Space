import {
  deriveAdaptiveShellStateBlock,
  type UIShellLayoutState,
} from '@/services/lego_blocks/integrations/uiNavigationBlock'
import type { UILayoutState } from './uiLayoutOrch'

export function deriveAdaptiveShellStateOrch(layout: UILayoutState): UIShellLayoutState {
  return deriveAdaptiveShellStateBlock(layout)
}

export type { UIShellLayoutState }

