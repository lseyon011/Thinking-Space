import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import { imageDocumentMimeFromPathBlock } from '@/services/lego_blocks/units/imageDocumentPathBlock'

export async function readImageDocumentOrch(path: string): Promise<{
  path: string
  bytes: Uint8Array
  size: number
  mime: string
}> {
  const fs = getVaultFS()
  const bytes = await fs.readBytes(path)
  let size = bytes.byteLength
  try {
    const stat = await fs.stat(path)
    if (Number.isFinite(stat.size) && stat.size > 0) {
      size = stat.size
    }
  } catch {
    // Some runtimes/filesystems can read bytes even when stat metadata is flaky.
    // Keep image viewing resilient by falling back to byte length.
  }
  return {
    path,
    bytes,
    size,
    mime: imageDocumentMimeFromPathBlock(path),
  }
}
