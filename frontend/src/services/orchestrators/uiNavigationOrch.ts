import {
  deriveAdaptiveShellStateBlock,
  type UIShellLayoutState,
} from '../lego_blocks/uiNavigationBlock'
import type { UILayoutState } from './uiLayoutOrch'

export function deriveAdaptiveShellStateOrch(layout: UILayoutState): UIShellLayoutState {
  return deriveAdaptiveShellStateBlock(layout)
}

export type { UIShellLayoutState }

