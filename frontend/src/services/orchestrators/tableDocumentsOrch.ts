import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import {
  decodeTableDocumentBlock,
  encodeTableDocumentBlock,
} from '@/services/lego_blocks/integrations/tableDocumentCodecBlock'
import type { TableDocumentBlock } from '@/services/lego_blocks/units/tableDocumentSchemaBlock'
import {
  bytesToUtf8Block,
  utf8ToBytesBlock,
} from '@/services/lego_blocks/units/byteEncodingBlock'

function hashBytesBlock(bytes: Uint8Array): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i]
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function buildRevisionPathBlock(filePath: string): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const ms = String(now.getMilliseconds()).padStart(3, '0')
  const day = `${y}-${m}-${d}`
  const time = `${hh}${mm}${ss}-${ms}`
  const safePath = filePath.replace(/\//g, '__').replace(/\\/g, '__').replace(/ /g, '_')
  return `.thinking-space/revisions/${day}/${time}--${safePath}`
}

function isAlreadyExistsFsErrorBlock(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()
  return normalized.includes('already exists')
    || normalized.includes('cannot be overwritten')
    || normalized.includes('eexist')
}

async function ensureRevisionDirBlock(revisionPath: string): Promise<void> {
  const fs = getVaultFS()
  const dir = revisionPath.includes('/') ? revisionPath.slice(0, revisionPath.lastIndexOf('/')) : ''
  if (!dir) return
  const exists = await fs.exists(dir).catch(() => false)
  if (exists) return
  try {
    await fs.mkdir(dir)
  } catch (error) {
    const appeared = await fs.exists(dir).catch(() => false)
    if (!appeared && !isAlreadyExistsFsErrorBlock(error)) throw error
  }
}

export class TableDocumentConflictError extends Error {
  readonly code = 'TABLE_DOCUMENT_CONFLICT'
  readonly currentMtime: number
  readonly currentHash: string
  readonly currentDocument: TableDocumentBlock

  constructor(message: string, details: { currentMtime: number; currentHash: string; currentDocument: TableDocumentBlock }) {
    super(message)
    this.name = 'TableDocumentConflictError'
    this.currentMtime = details.currentMtime
    this.currentHash = details.currentHash
    this.currentDocument = details.currentDocument
  }
}

async function readRawBytesBlock(path: string): Promise<Uint8Array> {
  const fs = getVaultFS()
  if (/\.xlsx$/i.test(path)) return fs.readBytes(path)
  const text = await fs.read(path)
  return utf8ToBytesBlock(text)
}

async function writeRawBytesBlock(path: string, bytes: Uint8Array): Promise<void> {
  const fs = getVaultFS()
  if (/\.xlsx$/i.test(path)) {
    await fs.writeBytes(path, bytes)
    return
  }
  await fs.write(path, bytesToUtf8Block(bytes))
}

export async function readTableDocument(path: string): Promise<{
  path: string
  document: TableDocumentBlock
  mtime: number
  ctime: number
  size: number
  hash: string
}> {
  const fs = getVaultFS()
  const stat = await fs.stat(path)
  const bytes = await readRawBytesBlock(path)
  return {
    path,
    document: decodeTableDocumentBlock(path, {
      text: /\.xlsx$/i.test(path) ? null : bytesToUtf8Block(bytes),
      bytes,
    }),
    mtime: stat.mtime,
    ctime: stat.ctime ?? stat.mtime,
    size: stat.size,
    hash: hashBytesBlock(bytes),
  }
}

export async function saveTableDocument(params: {
  path: string
  document: TableDocumentBlock
  baseMtime: number
  baseHash?: string | null
}): Promise<{ output_path: string; revision_path: string | null; mtime: number; ctime: number; size: number; hash: string }> {
  const fs = getVaultFS()
  const currentStat = await fs.stat(params.path)
  const currentBytes = await readRawBytesBlock(params.path)
  const currentHash = hashBytesBlock(currentBytes)
  const mtimeChanged = currentStat.mtime !== params.baseMtime
  const hashProvided = typeof params.baseHash === 'string' && params.baseHash.length > 0
  const hashChanged = hashProvided ? currentHash !== params.baseHash : false

  if (mtimeChanged || hashChanged) {
    throw new TableDocumentConflictError(
      'This table changed since you opened it. Reload latest content before saving.',
      {
        currentMtime: currentStat.mtime,
        currentHash,
        currentDocument: decodeTableDocumentBlock(params.path, {
          text: /\.xlsx$/i.test(params.path) ? null : bytesToUtf8Block(currentBytes),
          bytes: currentBytes,
        }),
      },
    )
  }

  const encoded = encodeTableDocumentBlock(params.path, params.document)
  const nextBytes = encoded.bytes ?? utf8ToBytesBlock(encoded.text ?? '')
  const nextHash = hashBytesBlock(nextBytes)
  let revisionPath: string | null = null

  if (nextHash !== currentHash) {
    revisionPath = buildRevisionPathBlock(params.path)
    await ensureRevisionDirBlock(revisionPath)
    await writeRawBytesBlock(revisionPath, currentBytes)
  }

  await writeRawBytesBlock(params.path, nextBytes)
  const savedStat = await fs.stat(params.path)
  return {
    output_path: params.path,
    revision_path: revisionPath,
    mtime: savedStat.mtime,
    ctime: savedStat.ctime ?? savedStat.mtime,
    size: savedStat.size,
    hash: nextHash,
  }
}

