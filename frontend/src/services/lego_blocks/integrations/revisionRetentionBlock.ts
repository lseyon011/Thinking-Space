import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'

export const REVISION_HISTORY_ROOT_BLOCK = '.thinking-space/revisions'
export const DEFAULT_REVISION_RETENTION_LIMIT_BLOCK = 5

function getRevisionMarkerBlock(revisionPath: string): string | null {
  const filename = revisionPath.split('/').pop()?.trim() ?? ''
  const separatorIndex = filename.indexOf('--')
  if (separatorIndex === -1) return null
  const marker = filename.slice(separatorIndex + 2).trim()
  return marker.length > 0 ? marker : null
}

async function listRevisionFilesRecursiveBlock(dirPath: string): Promise<string[]> {
  const fs = getVaultFS()
  const exists = await fs.exists(dirPath).catch(() => false)
  if (!exists) return []

  const listed = await fs.list(dirPath)
  const nested = await Promise.all(
    listed.folders.map((folder) => listRevisionFilesRecursiveBlock(`${dirPath}/${folder}`)),
  )
  return [
    ...listed.files.map((file) => `${dirPath}/${file}`),
    ...nested.flat(),
  ]
}

export async function pruneRevisionHistoryBlock(
  revisionPath: string,
  options: { keepLatest?: number } = {},
): Promise<void> {
  const marker = getRevisionMarkerBlock(revisionPath)
  if (!marker) return

  const keepLatest = Math.max(1, Math.floor(options.keepLatest ?? DEFAULT_REVISION_RETENTION_LIMIT_BLOCK))
  const fs = getVaultFS()
  const allRevisionPaths = await listRevisionFilesRecursiveBlock(REVISION_HISTORY_ROOT_BLOCK)
  const matchingPaths = allRevisionPaths
    .filter((candidate) => getRevisionMarkerBlock(candidate) === marker)
    .sort((left, right) => right.localeCompare(left))

  const stalePaths = matchingPaths.slice(keepLatest)
  await Promise.all(stalePaths.map(async (stalePath) => {
    try {
      await fs.delete(stalePath)
    } catch (error) {
      console.warn('[revisionRetentionBlock] Failed to prune revision snapshot:', stalePath, error)
    }
  }))
}
