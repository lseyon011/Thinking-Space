import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import { pruneRevisionHistoryBlock } from '@/services/lego_blocks/integrations/revisionRetentionBlock'
import {
  decodeGoogleDocDocumentBlock,
  encodeGoogleDocDocumentBlock,
} from '@/services/lego_blocks/integrations/googleDocDocumentCodecBlock'
import type { GoogleDocDocumentModelBlock } from '@/services/lego_blocks/units/googleDocDocumentSchemaBlock'
import { bytesToUtf8Block } from '@/services/lego_blocks/units/byteEncodingBlock'

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

function isLikelyBinaryDocxBlock(path: string, bytes: Uint8Array): boolean {
  if (!/\.docx$/i.test(path)) return false
  return bytes.length >= 4
    && bytes[0] === 0x50
    && bytes[1] === 0x4b
    && bytes[2] === 0x03
    && bytes[3] === 0x04
}

export class GoogleDocDocumentConflictError extends Error {
  readonly code = 'GOOGLE_DOC_DOCUMENT_CONFLICT'
  readonly currentMtime: number
  readonly currentHash: string
  readonly currentDocument: GoogleDocDocumentModelBlock

  constructor(message: string, details: { currentMtime: number; currentHash: string; currentDocument: GoogleDocDocumentModelBlock }) {
    super(message)
    this.name = 'GoogleDocDocumentConflictError'
    this.currentMtime = details.currentMtime
    this.currentHash = details.currentHash
    this.currentDocument = details.currentDocument
  }
}

export async function readGoogleDocDocument(path: string): Promise<{
  path: string
  document: GoogleDocDocumentModelBlock
  mtime: number
  ctime: number
  size: number
  hash: string
}> {
  const fs = getVaultFS()
  const stat = await fs.stat(path)
  const bytes = await fs.readBytes(path)
  const isBinaryDocx = isLikelyBinaryDocxBlock(path, bytes)
  return {
    path,
    document: decodeGoogleDocDocumentBlock(path, {
      text: isBinaryDocx ? null : bytesToUtf8Block(bytes),
      isBinaryDocx,
    }),
    mtime: stat.mtime,
    ctime: stat.ctime ?? stat.mtime,
    size: stat.size,
    hash: hashBytesBlock(bytes),
  }
}

export async function saveGoogleDocDocument(params: {
  path: string
  document: GoogleDocDocumentModelBlock
  baseMtime: number
  baseHash?: string | null
}): Promise<{ output_path: string; revision_path: string | null; mtime: number; ctime: number; size: number; hash: string }> {
  if (params.document.isBinaryDocx) {
    throw new Error('Cannot overwrite a binary DOCX file with Google Doc metadata.')
  }

  const fs = getVaultFS()
  const currentStat = await fs.stat(params.path)
  const currentBytes = await fs.readBytes(params.path)
  const currentHash = hashBytesBlock(currentBytes)
  const mtimeChanged = currentStat.mtime !== params.baseMtime
  const hashProvided = typeof params.baseHash === 'string' && params.baseHash.length > 0
  const hashChanged = hashProvided ? currentHash !== params.baseHash : false

  if (mtimeChanged || hashChanged) {
    const isBinaryDocx = isLikelyBinaryDocxBlock(params.path, currentBytes)
    throw new GoogleDocDocumentConflictError(
      'This file changed since you opened it. Reload latest content before saving.',
      {
        currentMtime: currentStat.mtime,
        currentHash,
        currentDocument: decodeGoogleDocDocumentBlock(params.path, {
          text: isBinaryDocx ? null : bytesToUtf8Block(currentBytes),
          isBinaryDocx,
        }),
      },
    )
  }

  const encoded = encodeGoogleDocDocumentBlock(params.document)
  const nextBytes = encoded.bytes
  const nextHash = hashBytesBlock(nextBytes)
  let revisionPath: string | null = null

  if (nextHash !== currentHash) {
    revisionPath = buildRevisionPathBlock(params.path)
    await ensureRevisionDirBlock(revisionPath)
    await fs.writeBytes(revisionPath, currentBytes)
  }

  await fs.writeBytes(params.path, nextBytes)
  if (revisionPath) {
    await pruneRevisionHistoryBlock(revisionPath).catch((error) => {
      console.warn('[googleDocDocumentsOrch] Failed to prune revision history:', error)
    })
  }
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
