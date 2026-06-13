import { getVaultFS, type VaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import {
  extractExcalidrawHighlightsBlock,
  type ExcalidrawHighlightsExtractBlock,
} from '@/services/lego_blocks/units/excalidrawHighlightExtractBlock'

export interface ExcalidrawHighlightsResult extends ExcalidrawHighlightsExtractBlock {
  inputPath: string
}

/** Read an Excalidraw doc via VaultFS and return highlighted text grouped by tree node. */
export async function extractExcalidrawHighlights(
  inputPath: string,
  fs?: VaultFS,
): Promise<ExcalidrawHighlightsResult> {
  const vaultFs = fs ?? getVaultFS()
  const content = await vaultFs.read(inputPath)
  const extract = extractExcalidrawHighlightsBlock(content)
  return { inputPath, ...extract }
}
