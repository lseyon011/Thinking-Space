import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import {
  decodeGoogleDocDocumentBlock,
  encodeGoogleDocDocumentBlock,
} from '@/services/lego_blocks/integrations/googleDocDocumentCodecBlock'
import { googleDocFileKindFromPathBlock } from '@/services/lego_blocks/units/googleDocDocumentPathBlock'
import type { GoogleDocDocumentModelBlock } from '@/services/lego_blocks/units/googleDocDocumentSchemaBlock'
import { bytesToUtf8Block, utf8ToBytesBlock } from '@/services/lego_blocks/units/byteEncodingBlock'

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

function isDirectoryReadErrorBlock(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()
  return normalized.includes('eisdir')
    || normalized.includes('is a directory')
    || normalized.includes('path is a directory')
}

function joinRelativePathBlock(parent: string, child: string): string {
  const cleanParent = parent.replace(/\\/g, '/').replace(/\/+$/g, '')
  const cleanChild = child.replace(/\\/g, '/').replace(/^\/+/g, '')
  if (!cleanParent) return cleanChild
  if (!cleanChild) return cleanParent
  return `${cleanParent}/${cleanChild}`
}

function splitParentPathBlock(path: string): { parent: string; name: string } {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/g, '')
  const idx = normalized.lastIndexOf('/')
  if (idx < 0) return { parent: '', name: normalized }
  return {
    parent: normalized.slice(0, idx),
    name: normalized.slice(idx + 1),
  }
}

function googleShortcutStemBlock(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.gdoc.json')) return fileName.slice(0, -10)
  if (lower.endsWith('.gdoc')) return fileName.slice(0, -5)
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(0, dot) : fileName
}

function scoreGoogleShortcutCandidateBlock(fileName: string): number {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.gdoc.json')) return 0
  if (lower.endsWith('.gdoc')) return 1
  if (lower.endsWith('.json')) return 2
  if (lower.endsWith('.url')) return 3
  if (lower.endsWith('.txt')) return 4
  return 9
}

function summarizeErrorBlock(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  return raw.replace(/\s+/g, ' ').trim()
}

function formatListPreviewBlock(values: string[], maxItems = 12): string {
  if (values.length === 0) return '(none)'
  const head = values.slice(0, maxItems).join(', ')
  const remaining = values.length - maxItems
  return remaining > 0 ? `${head}, ... (+${remaining} more)` : head
}

function buildSiblingShortcutCandidateNamesBlock(fileName: string): string[] {
  const names: string[] = []
  const seen = new Set<string>()
  const push = (value: string) => {
    const next = value.trim()
    if (!next) return
    const key = next.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    names.push(next)
  }

  push(`${fileName}.json`)
  push(`${fileName}.url`)
  push(`${fileName}.txt`)

  const lower = fileName.toLowerCase()
  if (lower.endsWith('.gdoc.json')) {
    const stem = fileName.slice(0, -10)
    push(`${stem}.gdoc`)
    push(`${stem}.json`)
    push(`${stem}.url`)
    push(`${stem}.txt`)
    return names
  }

  if (lower.endsWith('.gdoc')) {
    const stem = fileName.slice(0, -5)
    push(`${stem}.gdoc.json`)
    push(`${stem}.json`)
    push(`${stem}.url`)
    push(`${stem}.txt`)
    return names
  }

  push(`${fileName}.gdoc.json`)
  push(`${fileName}.gdoc`)
  return names
}

async function readGoogleShortcutCandidatePathBlock(
  requestPath: string,
  candidatePath: string,
): Promise<{ bytes: Uint8Array | null; debug: string }> {
  const fs = getVaultFS()
  try {
    const text = await fs.read(candidatePath)
    const decoded = decodeGoogleDocDocumentBlock(requestPath, { text, isBinaryDocx: false })
    if (decoded.descriptor.fileId || decoded.descriptor.openUrl) {
      return {
        bytes: utf8ToBytesBlock(text),
        debug: `resolved_from_candidate: ${candidatePath}`,
      }
    }
    return {
      bytes: null,
      debug: `${candidatePath}: parsed_without_google_metadata`,
    }
  } catch (error) {
    return {
      bytes: null,
      debug: `${candidatePath}: ${summarizeErrorBlock(error)}`,
    }
  }
}

async function readGoogleDocSiblingFallbackBytesBlock(path: string): Promise<{ bytes: Uint8Array | null; debug: string }> {
  const fs = getVaultFS()
  const { parent, name } = splitParentPathBlock(path)
  const stem = googleShortcutStemBlock(name).toLowerCase()
  const probePaths: string[] = []
  const seenProbePaths = new Set<string>()
  const addProbePath = (value: string) => {
    const normalized = value.replace(/\\/g, '/').replace(/\/+$/g, '')
    if (!normalized) return
    const key = normalized.toLowerCase()
    if (seenProbePaths.has(key)) return
    seenProbePaths.add(key)
    probePaths.push(normalized)
  }

  for (const candidateName of buildSiblingShortcutCandidateNamesBlock(name)) {
    addProbePath(joinRelativePathBlock(parent, candidateName))
  }

  let parentListError: string | null = null
  let parentListedFiles: string[] = []
  try {
    const listed = await fs.list(parent)
    parentListedFiles = listed.files
      .filter(fileName => {
        if (!fileName || fileName.startsWith('.')) return false
        const lowerName = fileName.toLowerCase()
        if (lowerName === name.toLowerCase()) return false
        const score = scoreGoogleShortcutCandidateBlock(fileName)
        if (score >= 9) return false
        const candidateStem = googleShortcutStemBlock(fileName).toLowerCase()
        return candidateStem === stem
          || candidateStem.startsWith(stem)
          || stem.startsWith(candidateStem)
      })
      .sort((a, b) => {
        const scoreDelta = scoreGoogleShortcutCandidateBlock(a) - scoreGoogleShortcutCandidateBlock(b)
        if (scoreDelta !== 0) return scoreDelta
        return a.localeCompare(b, undefined, { sensitivity: 'base' })
      })
    for (const fileName of parentListedFiles.slice(0, 24)) {
      addProbePath(joinRelativePathBlock(parent, fileName))
    }
  } catch (error) {
    parentListError = summarizeErrorBlock(error)
  }

  const probeResults: string[] = []
  for (const candidatePath of probePaths.slice(0, 32)) {
    const attempt = await readGoogleShortcutCandidatePathBlock(path, candidatePath)
    if (attempt.bytes) {
      return {
        bytes: attempt.bytes,
        debug: attempt.debug,
      }
    }
    probeResults.push(attempt.debug)
  }

  return {
    bytes: null,
    debug: [
      `sibling_candidate_paths(${probePaths.length}): ${formatListPreviewBlock(probePaths)}`,
      `parent_match_files(${parentListedFiles.length}): ${formatListPreviewBlock(parentListedFiles)}`,
      parentListError ? `parent_list_error: ${parentListError}` : null,
      `probe_results(${probeResults.length}): ${formatListPreviewBlock(probeResults, 10)}`,
    ].filter(Boolean).join('\n'),
  }
}

async function readGoogleDocDirectoryFallbackBytesBlock(path: string): Promise<{ bytes: Uint8Array | null; debug: string }> {
  const fs = getVaultFS()
  let listed: { files: string[]; folders: string[] }
  try {
    listed = await fs.list(path)
  } catch (error) {
    return {
      bytes: null,
      debug: `list_error: ${summarizeErrorBlock(error)}`,
    }
  }

  const candidates = [...listed.files]
    .filter(name => !!name && !name.startsWith('.'))
    .sort((a, b) => {
      const scoreDelta = scoreGoogleShortcutCandidateBlock(a) - scoreGoogleShortcutCandidateBlock(b)
      if (scoreDelta !== 0) return scoreDelta
      return a.localeCompare(b, undefined, { sensitivity: 'base' })
    })

  const probeResults: string[] = []
  for (const name of candidates.slice(0, 24)) {
    const candidatePath = joinRelativePathBlock(path, name)
    const attempt = await readGoogleShortcutCandidatePathBlock(path, candidatePath)
    if (attempt.bytes) {
      return {
        bytes: attempt.bytes,
        debug: attempt.debug,
      }
    }
    probeResults.push(attempt.debug)
  }

  return {
    bytes: null,
    debug: [
      `directory_files(${listed.files.length}): ${formatListPreviewBlock(listed.files)}`,
      `directory_folders(${listed.folders.length}): ${formatListPreviewBlock(listed.folders)}`,
      `probe_results(${probeResults.length}): ${formatListPreviewBlock(probeResults, 10)}`,
    ].join('\n'),
  }
}

async function readGoogleDocProxyFallbackBytesBlock(path: string): Promise<{ bytes: Uint8Array | null; debug: string }> {
  const siblingFallback = await readGoogleDocSiblingFallbackBytesBlock(path)
  if (siblingFallback.bytes) return siblingFallback

  const directoryFallback = await readGoogleDocDirectoryFallbackBytesBlock(path)
  if (directoryFallback.bytes) return directoryFallback

  return {
    bytes: null,
    debug: [
      siblingFallback.debug,
      directoryFallback.debug,
    ].join('\n'),
  }
}

async function readGoogleDocTextBytesBlock(path: string, allowDirectoryFallback: boolean): Promise<Uint8Array> {
  const fs = getVaultFS()
  try {
    return utf8ToBytesBlock(await fs.read(path))
  } catch (error) {
    if (!isDirectoryReadErrorBlock(error)) throw error
    const readError = summarizeErrorBlock(error)
    if (!allowDirectoryFallback) {
      throw new Error(
        [
          `Google shortcut directory-proxy detected for "${path}".`,
          `read_error: ${readError}`,
          'Editing is disabled for this representation. Open it in your default app.',
        ].join('\n'),
      )
    }
    const fallback = await readGoogleDocProxyFallbackBytesBlock(path)
    if (fallback.bytes) return fallback.bytes
    throw new Error(
      [
        `Google shortcut directory-proxy detected for "${path}".`,
        `read_error: ${readError}`,
        fallback.debug,
        'Could not parse this shortcut in-app. Open it in your default app.',
      ].join('\n'),
    )
  }
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
  const fileKind = googleDocFileKindFromPathBlock(path)
  const bytes = fileKind === 'docx'
    ? await fs.readBytes(path)
    : await readGoogleDocTextBytesBlock(path, true)
  const isBinaryDocx = fileKind === 'docx' && isLikelyBinaryDocxBlock(path, bytes)
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
  const fileKind = googleDocFileKindFromPathBlock(params.path)
  const currentBytes = fileKind === 'docx'
    ? await fs.readBytes(params.path)
    : await readGoogleDocTextBytesBlock(params.path, false)
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
