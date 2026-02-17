import { getNodeByPath } from '../lego_blocks/dbBlock'
import type { NodeRecord } from '../lego_blocks/dbBlock'

export async function getOrganizerNodeByPathOrch(path: string): Promise<NodeRecord | undefined> {
  return getNodeByPath(path)
}
