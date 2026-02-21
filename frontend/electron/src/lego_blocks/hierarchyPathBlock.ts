import * as fs from 'fs'
import * as path from 'path'

function normalizeRelativePathBlock(value: string): string {
  const normalized = value.trim().replace(/\\/g, '/')
  if (!normalized) throw new Error('Path cannot be empty')
  if (normalized.startsWith('/')) throw new Error('Path must be vault-relative')
  const parts = normalized.split('/').filter(Boolean)
  if (parts.includes('..')) throw new Error('Path must be vault-relative')
  return parts.join('/')
}

function resolveVaultRelativePathBlock(vaultRoot: string, relativePath: string): string {
  const cleanRel = normalizeRelativePathBlock(relativePath)
  const rootResolved = path.resolve(vaultRoot)
  const resolved = path.resolve(vaultRoot, cleanRel)
  if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) {
    throw new Error('Path traversal detected')
  }
  return resolved
}

export function ensureNodeMarkdownFileBlock(params: {
  vaultRoot: string
  relativePath: string
  nodeType: string
  title: string
}): void {
  const target = resolveVaultRelativePathBlock(params.vaultRoot, params.relativePath)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  if (fs.existsSync(target)) return
  const content = `# ${params.title.trim()}\n\n<!-- type: ${params.nodeType} -->\n`
  fs.writeFileSync(target, content, 'utf-8')
}

export function copyAndArchivePathTransitionBlock(params: {
  vaultRoot: string
  fromRelativePath: string
  toRelativePath: string
}): boolean {
  const fromAbs = resolveVaultRelativePathBlock(params.vaultRoot, params.fromRelativePath)
  const toAbs = resolveVaultRelativePathBlock(params.vaultRoot, params.toRelativePath)
  if (fromAbs === toAbs) return false

  if (!fs.existsSync(fromAbs)) return false
  if (fs.existsSync(toAbs)) throw new Error(`Cannot copy to existing path: ${params.toRelativePath}`)

  fs.mkdirSync(path.dirname(toAbs), { recursive: true })
  fs.copyFileSync(fromAbs, toAbs)

  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  const hh = String(now.getUTCHours()).padStart(2, '0')
  const mm = String(now.getUTCMinutes()).padStart(2, '0')
  const ss = String(now.getUTCSeconds()).padStart(2, '0')
  const ms = String(now.getUTCMilliseconds()).padStart(3, '0')

  const archiveRel = path.join(
    '.think-space',
    'archive',
    `${y}-${m}-${d}`,
    `${hh}${mm}${ss}-${ms}`,
    normalizeRelativePathBlock(params.fromRelativePath),
  )
  const archiveAbs = resolveVaultRelativePathBlock(params.vaultRoot, archiveRel)
  fs.mkdirSync(path.dirname(archiveAbs), { recursive: true })
  fs.renameSync(fromAbs, archiveAbs)
  return true
}

export function normalizeHierarchyRelativePathBlock(value: string): string {
  return normalizeRelativePathBlock(value)
}
