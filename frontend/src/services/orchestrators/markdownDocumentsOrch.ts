import { getVaultFS } from '../lego_blocks/fsBlock'

function hashContent(content: string): string {
  // FNV-1a 32-bit hash is fast and stable enough for local conflict detection.
  let hash = 0x811c9dc5
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i)
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function buildRevisionPath(filePath: string): string {
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

  const safePath = filePath
    .replace(/\//g, '__')
    .replace(/\\/g, '__')
    .replace(/ /g, '_')

  return `.think-space/revisions/${day}/${time}--${safePath}`
}

export class MarkdownDocumentConflictError extends Error {
  readonly code = 'MARKDOWN_DOCUMENT_CONFLICT'
  readonly currentMtime: number
  readonly currentHash: string
  readonly currentContent: string

  constructor(message: string, details: { currentMtime: number; currentHash: string; currentContent: string }) {
    super(message)
    this.name = 'MarkdownDocumentConflictError'
    this.currentMtime = details.currentMtime
    this.currentHash = details.currentHash
    this.currentContent = details.currentContent
  }
}

export async function readMarkdownDocument(path: string): Promise<{
  path: string
  content: string
  mtime: number
  size: number
  hash: string
}>
export async function readMarkdownDocument(
  path: string,
  options: { includeHash: false },
): Promise<{
  path: string
  content: string
  mtime: number
  size: number
  hash: null
}>
export async function readMarkdownDocument(
  path: string,
  options?: { includeHash?: boolean },
): Promise<{
  path: string
  content: string
  mtime: number
  size: number
  hash: string | null
}> {
  const fs = getVaultFS()
  const [content, stat] = await Promise.all([fs.read(path), fs.stat(path)])
  const includeHash = options?.includeHash ?? true
  return {
    path,
    content,
    mtime: stat.mtime,
    size: stat.size,
    hash: includeHash ? hashContent(content) : null,
  }
}

export async function saveMarkdownDocument(params: {
  path: string
  content: string
  baseMtime: number
  baseHash?: string | null
  baseContent?: string | null
}): Promise<{ output_path: string; revision_path: string | null; mtime: number; size: number; hash: string }> {
  const fs = getVaultFS()

  const [currentContent, currentStat] = await Promise.all([
    fs.read(params.path),
    fs.stat(params.path),
  ])
  const mtimeChanged = currentStat.mtime !== params.baseMtime
  const hashProvided = typeof params.baseHash === 'string' && params.baseHash.length > 0
  const contentProvided = typeof params.baseContent === 'string'
  const hashChanged = hashProvided ? hashContent(currentContent) !== params.baseHash : false
  const contentChanged = contentProvided ? currentContent !== params.baseContent : false

  if (mtimeChanged || hashChanged || (!hashProvided && contentProvided && contentChanged)) {
    throw new MarkdownDocumentConflictError(
      'This file changed since you opened it. Reload latest content before saving.',
      {
        currentMtime: currentStat.mtime,
        currentHash: hashContent(currentContent),
        currentContent,
      },
    )
  }

  let revisionPath: string | null = null
  if (currentContent !== params.content) {
    revisionPath = buildRevisionPath(params.path)
    const revisionDir = revisionPath.includes('/')
      ? revisionPath.slice(0, revisionPath.lastIndexOf('/'))
      : ''
    if (revisionDir) {
      await fs.mkdir(revisionDir)
    }
    await fs.write(revisionPath, currentContent)
  }

  await fs.write(params.path, params.content)
  const savedStat = await fs.stat(params.path)
  return {
    output_path: params.path,
    revision_path: revisionPath,
    mtime: savedStat.mtime,
    size: savedStat.size,
    hash: hashContent(params.content),
  }
}
