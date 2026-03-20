import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import {
  type OrganizerPinBoardGroupEntryBlock,
  organizerUiStatePathBlock,
  readOrganizerUiStateBlock,
  writeOrganizerUiStateBlock,
  type OrganizerProgramGroupEntryBlock,
  type OrganizerUiStateBlock,
} from '@/services/lego_blocks/integrations/organizerUiStateBlock'

export type OrganizerProgramGroupEntryOrch = OrganizerProgramGroupEntryBlock
export type OrganizerPinBoardGroupEntryOrch = OrganizerPinBoardGroupEntryBlock
export type OrganizerUiStateOrch = OrganizerUiStateBlock

export function organizerUiStatePathOrch(projectRoot: string): string {
  return organizerUiStatePathBlock(projectRoot)
}

export async function readOrganizerUiStateOrch(projectRoot: string): Promise<OrganizerUiStateOrch | null> {
  return readOrganizerUiStateBlock(getVaultFS(), projectRoot)
}

export async function writeOrganizerUiStateOrch(
  projectRoot: string,
  input: OrganizerUiStateOrch,
): Promise<OrganizerUiStateOrch> {
  return writeOrganizerUiStateBlock(getVaultFS(), projectRoot, input)
}
