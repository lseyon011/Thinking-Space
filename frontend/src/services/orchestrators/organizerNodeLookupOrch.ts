import { getNodeByPath } from '@/services/lego_blocks/integrations/dbBlock'
import type { NodeRecord } from '@/services/lego_blocks/integrations/dbBlock'

export async function getOrganizerNodeByPathOrch(path: string): Promise<NodeRecord | undefined> {
  return getNodeByPath(path)
}
