import 'fake-indexeddb/auto'

import * as fsPromises from 'node:fs/promises'
import * as path from 'node:path'
import process from 'node:process'

import { EXCLUDED_DIRS } from '../../src/services/lego_blocks/vaultConstantsBlock'
import type { ListedFiles, VaultEntry, VaultFS, VaultStat } from '../../src/services/lego_blocks/fsBlock'
import {
  invokeCapabilityOrch,
  listCapabilitiesOrch,
  type CapabilityInvokeRequest,
} from '../../src/services/orchestrators/capabilityRouterOrch'
import { fullSync } from '../../src/services/orchestrators/vaultSyncOrch'

interface InvokePayload {
  vaultRoot: string
  request: CapabilityInvokeRequest
}

class NodeVaultFS implements VaultFS {
  private readonly vaultRoot: string

  constructor(vaultRoot: string) {
    this.vaultRoot = path.resolve(vaultRoot)
  }

  async read(relPath: string): Promise<string> {
    const full = this.assertInsideVault(relPath)
    return fsPromises.readFile(full, 'utf-8')
  }

  async write(relPath: string, data: string): Promise<void> {
    const full = this.assertInsideVault(relPath)
    await fsPromises.mkdir(path.dirname(full), { recursive: true })
    await fsPromises.writeFile(full, data, 'utf-8')
  }

  async create(relPath: string, data: string): Promise<void> {
    if (await this.exists(relPath)) {
      throw new Error(`File already exists: ${relPath}`)
    }
    await this.write(relPath, data)
  }

  async list(relPath: string): Promise<ListedFiles> {
    const full = this.assertInsideVault(relPath || '.')
    const entries = await fsPromises.readdir(full, { withFileTypes: true })
    const files: string[] = []
    const folders: string[] = []
    for (const entry of entries) {
      if (entry.name.startsWith('.') || EXCLUDED_DIRS.has(entry.name)) continue
      if (entry.isDirectory()) folders.push(entry.name)
      else files.push(entry.name)
    }
    return { files, folders }
  }

  async walkVault(extensions: string[] = ['.md']): Promise<VaultEntry[]> {
    const extSet = new Set(extensions.map(ext => ext.toLowerCase()))
    const results: VaultEntry[] = []

    const walk = async (dir: string): Promise<void> => {
      let entries: Awaited<ReturnType<typeof fsPromises.readdir>>
      try {
        entries = await fsPromises.readdir(dir, { withFileTypes: true })
      } catch {
        return
      }

      for (const entry of entries) {
        if (entry.name.startsWith('.') || EXCLUDED_DIRS.has(entry.name)) continue
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          await walk(full)
          continue
        }
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase()
          if (!extSet.has(ext)) continue

          try {
            const stat = await fsPromises.stat(full)
            results.push({
              path: this.toVaultRelativePath(full),
              size: stat.size,
              mtime: stat.mtimeMs / 1000,
              ctime: stat.birthtimeMs / 1000,
            })
          } catch {
            // Skip unreadable files.
          }
        }
      }
    }

    await walk(this.vaultRoot)
    return results
  }

  async stat(relPath: string): Promise<VaultStat> {
    const full = this.assertInsideVault(relPath)
    const stat = await fsPromises.stat(full)
    return {
      size: stat.size,
      mtime: stat.mtimeMs / 1000,
      ctime: stat.birthtimeMs / 1000,
      isDirectory: stat.isDirectory(),
    }
  }

  async exists(relPath: string): Promise<boolean> {
    const full = this.assertInsideVault(relPath)
    try {
      await fsPromises.access(full)
      return true
    } catch {
      return false
    }
  }

  async mkdir(relPath: string): Promise<void> {
    const full = this.assertInsideVault(relPath)
    await fsPromises.mkdir(full, { recursive: true })
  }

  async process(relPath: string, fn: (data: string) => string): Promise<void> {
    const content = await this.read(relPath)
    await this.write(relPath, fn(content))
  }

  private assertInsideVault(relPath: string): string {
    const candidate = path.resolve(this.vaultRoot, relPath || '.')
    const relative = path.relative(this.vaultRoot, candidate)
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Path traversal detected: ${relPath}`)
    }
    return candidate
  }

  private toVaultRelativePath(fullPath: string): string {
    return path.relative(this.vaultRoot, fullPath).split(path.sep).join('/')
  }
}

async function main(): Promise<void> {
  const command = process.argv[2]

  if (command === 'list') {
    writeJson({
      ok: true,
      capabilities: listCapabilitiesOrch(),
    })
    return
  }

  if (command === 'invoke') {
    const payload = await parseInvokePayload()
    const fs = new NodeVaultFS(payload.vaultRoot)
    await fullSync(fs)
    const response = await invokeCapabilityOrch(payload.request, { fs })
    writeJson(response)
    return
  }

  throw new Error(`Unknown command: ${command ?? '<missing>'}`)
}

async function parseInvokePayload(): Promise<InvokePayload> {
  const stdin = await readStdin()
  if (!stdin.trim()) {
    throw new Error('Missing invoke payload in stdin.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stdin)
  } catch (error) {
    throw new Error(`Invalid JSON payload: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invoke payload must be a JSON object.')
  }

  const payload = parsed as Partial<InvokePayload>
  if (!payload.vaultRoot || typeof payload.vaultRoot !== 'string') {
    throw new Error('Invoke payload requires a string "vaultRoot".')
  }
  if (!payload.request || typeof payload.request !== 'object') {
    throw new Error('Invoke payload requires a "request" object.')
  }

  return {
    vaultRoot: payload.vaultRoot,
    request: payload.request as CapabilityInvokeRequest,
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf-8')
}

function writeJson(payload: unknown): void {
  process.stdout.write(`${JSON.stringify(payload)}\n`)
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exit(1)
})
