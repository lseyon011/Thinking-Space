import {
  decodeDelimitedTableBlock,
  encodeDelimitedTableBlock,
} from '@/services/lego_blocks/units/csvTableCodecBlock'
import {
  decodeGoogleSheetFileBlock,
  encodeGoogleSheetFileBlock,
  pullGoogleSheetValuesBlock,
  pushGoogleSheetValuesBlock,
} from '@/services/lego_blocks/units/googleSheetTableCodecBlock'
import {
  decodeXlsxTableBlock,
  encodeXlsxTableBlock,
} from '@/services/lego_blocks/units/xlsxTableCodecBlock'
import {
  tableDocumentKindFromPathBlock,
} from '@/services/lego_blocks/units/tableDocumentPathBlock'
import {
  createEmptyTableDocumentBlock,
  normalizeTableDocumentBlock,
  type TableDocKind,
  type TableDocumentBlock,
} from '@/services/lego_blocks/units/tableDocumentSchemaBlock'
import {
  bytesToUtf8Block,
  utf8ToBytesBlock,
} from '@/services/lego_blocks/units/byteEncodingBlock'

export interface EncodedTableDocumentBlock {
  kind: TableDocKind
  text: string | null
  bytes: Uint8Array | null
}

export function decodeTableDocumentBlock(path: string, input: { text?: string | null; bytes?: Uint8Array | null }): TableDocumentBlock {
  const kind = tableDocumentKindFromPathBlock(path)
  if (kind === 'xlsx') {
    const bytes = input.bytes ?? utf8ToBytesBlock(input.text ?? '')
    return normalizeTableDocumentBlock(decodeXlsxTableBlock(bytes), 'xlsx')
  }
  if (kind === 'tsv') {
    return normalizeTableDocumentBlock(decodeDelimitedTableBlock(input.text ?? '', '\t'), 'tsv')
  }
  if (kind === 'csv') {
    return normalizeTableDocumentBlock(decodeDelimitedTableBlock(input.text ?? '', ','), 'csv')
  }
  return normalizeTableDocumentBlock(decodeGoogleSheetFileBlock(input.text ?? ''), 'gsheet')
}

export function encodeTableDocumentBlock(path: string, document: TableDocumentBlock): EncodedTableDocumentBlock {
  const kind = tableDocumentKindFromPathBlock(path)
  const normalized = normalizeTableDocumentBlock(document, kind)

  if (kind === 'xlsx') {
    return {
      kind,
      text: null,
      bytes: encodeXlsxTableBlock(normalized),
    }
  }
  if (kind === 'tsv') {
    const text = encodeDelimitedTableBlock(normalized, '\t')
    return {
      kind,
      text,
      bytes: utf8ToBytesBlock(text),
    }
  }
  if (kind === 'csv') {
    const text = encodeDelimitedTableBlock(normalized, ',')
    return {
      kind,
      text,
      bytes: utf8ToBytesBlock(text),
    }
  }
  const text = encodeGoogleSheetFileBlock(normalized)
  return {
    kind,
    text,
    bytes: utf8ToBytesBlock(text),
  }
}

export function encodedBytesToTextMaybeBlock(kind: TableDocKind, bytes: Uint8Array): string | null {
  if (kind === 'xlsx') return null
  return bytesToUtf8Block(bytes)
}

export function createEmptyTableDocumentByPathBlock(path: string): TableDocumentBlock {
  return createEmptyTableDocumentBlock(tableDocumentKindFromPathBlock(path))
}

export async function pullGoogleSheetDocumentBlock(document: TableDocumentBlock): Promise<TableDocumentBlock> {
  if (document.kind !== 'gsheet') return document
  return pullGoogleSheetValuesBlock(document)
}

export async function pullGoogleSheetDocumentWithTokenBlock(
  document: TableDocumentBlock,
  accessToken: string,
): Promise<TableDocumentBlock> {
  if (document.kind !== 'gsheet') return document
  return pullGoogleSheetValuesBlock(document, { accessToken })
}

export async function pushGoogleSheetDocumentBlock(document: TableDocumentBlock): Promise<void> {
  if (document.kind !== 'gsheet') return
  await pushGoogleSheetValuesBlock(document)
}

export async function pushGoogleSheetDocumentWithTokenBlock(
  document: TableDocumentBlock,
  accessToken: string,
): Promise<void> {
  if (document.kind !== 'gsheet') return
  await pushGoogleSheetValuesBlock(document, { accessToken })
}
