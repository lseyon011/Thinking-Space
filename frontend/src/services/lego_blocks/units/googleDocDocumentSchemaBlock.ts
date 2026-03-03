import type { GoogleDocFileKindBlock } from '@/services/lego_blocks/units/googleDocDocumentPathBlock'

export interface GoogleDocDescriptorBlock {
  kind: 'google_doc'
  fileId?: string
  title?: string
  openUrl?: string
  embedViewUrl?: string
  embedEditUrl?: string
}

export interface GoogleDocDocumentModelBlock {
  kind: GoogleDocFileKindBlock
  descriptor: GoogleDocDescriptorBlock
  isBinaryDocx: boolean
}
