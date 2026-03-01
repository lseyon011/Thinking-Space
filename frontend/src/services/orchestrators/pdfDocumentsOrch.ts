import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'

export interface PdfDocumentDataOrch {
  path: string
  bytes: Uint8Array
  mtime: number
  ctime: number
  size: number
}

export async function readPdfDocumentOrch(path: string): Promise<PdfDocumentDataOrch> {
  const fs = getVaultFS()
  const stat = await fs.stat(path)
  const bytes = await fs.readBytes(path)
  return {
    path,
    bytes,
    mtime: stat.mtime,
    ctime: stat.ctime ?? stat.mtime,
    size: stat.size,
  }
}
