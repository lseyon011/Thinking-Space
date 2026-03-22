import {
  getVaultFS,
  isCapacitorNative,
  isDesktop,
  isElectron,
  selectAndSetVaultRoot,
  setVaultRoot,
} from '@/services/lego_blocks/integrations/fsBlock'
import { hasNativeDrawerContentBlock } from '@/services/lego_blocks/units/nativeDrawerContentBlock'
import { hasNativeDrawerShellBlock } from '@/services/lego_blocks/units/nativeDrawerShellBlock'

export {
  getVaultFS,
  hasNativeDrawerContentBlock,
  hasNativeDrawerShellBlock,
  isCapacitorNative,
  isDesktop,
  isElectron,
  selectAndSetVaultRoot,
  setVaultRoot,
}
