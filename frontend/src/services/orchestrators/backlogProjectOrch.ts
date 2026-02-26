import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import { hierarchyToExcalidrawMd } from '@/services/lego_blocks/integrations/hierarchyExcalidrawBlock'
import { THINKING_ORGANIZER_DIR } from '@/services/lego_blocks/integrations/projectStorageBlock'
import { generateKey } from '@/services/lego_blocks/units/yamlNoteBlock'
import type { NodeRecord } from '@/services/lego_blocks/integrations/dbBlock'

export { THINKING_ORGANIZER_DIR }

export function generateNodeKeyOrch(value: string): string {
  return generateKey(value)
}

export function getVaultFsOrch() {
  return getVaultFS()
}

export function hierarchyToExcalidrawMdOrch(nodes: NodeRecord[]): string {
  return hierarchyToExcalidrawMd(nodes)
}
