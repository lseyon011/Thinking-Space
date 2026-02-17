import 'fake-indexeddb/auto'

import * as fsPromises from 'node:fs/promises'
import * as path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { EXCLUDED_DIRS } from '../../src/services/lego_blocks/vaultConstantsBlock'
import type { ListedFiles, VaultEntry, VaultFS, VaultStat } from '../../src/services/lego_blocks/fsBlock'
import { STORAGE_KEYS } from '../../src/services/lego_blocks/storageKeyBlock'
import {
  invokeCapabilityOrch,
  listCapabilitiesOrch,
  type CapabilityInvokeRequest,
} from '../../src/services/orchestrators/capabilityRouterOrch'
import { fullSync } from '../../src/services/orchestrators/vaultSyncOrch'

interface InvokePayload {
  vaultRoot: string
  request: CapabilityInvokeRequest
  apiBaseUrl?: string
}

class InMemoryLocalStorage {
  private readonly store = new Map<string, string>()

  get length(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }

  key(index: number): string | null {
    if (index < 0 || index >= this.store.size) return null
    return [...this.store.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

export class NodeVaultFS implements VaultFS {
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

// ── CLI arg parsing for direct capability invocation ──

const NUMBER_FIELDS = new Set(['limit', 'lineNumber'])
const ARRAY_FIELDS = new Set(['tags', 'items', 'artifacts', 'relatedNodes', 'emotions', 'comments'])
const BOOLEAN_FIELDS = new Set(['dryRun', 'dry-run', 'date_header'])

/** Capabilities where non-identity fields are wrapped in an `updates` sub-object. */
const WRAPPED_CAPABILITIES: Record<string, string> = {
  'organizer.node.update': 'updates',
}

/** Identity fields that stay at the top level even for wrapped capabilities. */
const IDENTITY_FIELDS = new Set(['uuid', 'key'])

const EXTRA_FIELD_ALIASES: Record<string, Record<string, string>> = {
  'organizer.node.create': {
    'extra-type': 'type',
    'extra-title': 'title',
    'extra-parentKey': 'parentKey',
    'extra-parentUuid': 'parentUuid',
    'extra-parentType': 'parentType',
    'extra-tags': 'tags',
    'extra-body': 'body',
    'extra-description': 'description',
    'extra-comments': 'comments',
    'extra-projectRoot': 'projectRoot',
  },
  'organizer.node.update': {
    'extra-type': 'type',
    'extra-title': 'title',
    'extra-tags': 'tags',
    'extra-status': 'status',
    'extra-priority': 'priority',
    'extra-description': 'description',
    'extra-comments': 'comments',
  },
}

interface ParsedCLIArgsResult {
  input: Record<string, unknown>
  warnings: string[]
}

function parseScalarOrCollectionValue(key: string, value: string): unknown {
  if (NUMBER_FIELDS.has(key)) return Number(value)
  if (ARRAY_FIELDS.has(key)) return value.split(',').map(s => s.trim())
  return value
}

function getAliasedKey(capability: string, key: string): { key: string; warning?: string } {
  const aliases = EXTRA_FIELD_ALIASES[capability]
  if (!aliases) return { key }
  const canonical = aliases[key]
  if (!canonical) return { key }

  if (canonical === 'comments') {
    return {
      key: canonical,
      warning: `Flag --${key} is deprecated for ${capability}. Use --comments. For append-only notes, use comment.add with --text.`,
    }
  }

  return {
    key: canonical,
    warning: `Flag --${key} is deprecated for ${capability}. Use --${canonical} instead.`,
  }
}

function parseCLIArgs(capability: string, args: string[]): ParsedCLIArgsResult {
  const result: Record<string, unknown> = {}
  const warnings: string[] = []
  let i = 0
  while (i < args.length) {
    const arg = args[i]!
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected positional argument: ${arg}`)
    }
    const key = arg.slice(2)
    // Boolean flags: if next arg is missing or starts with --, treat as true
    if (BOOLEAN_FIELDS.has(key) && (i + 1 >= args.length || args[i + 1]!.startsWith('--'))) {
      result[key] = true
      i++
      continue
    }
    if (i + 1 >= args.length) {
      throw new Error(`Missing value for --${key}`)
    }
    const value = args[i + 1]!
    i += 2
    const { key: resolvedKey, warning } = getAliasedKey(capability, key)
    if (warning) warnings.push(warning)

    if (resolvedKey.startsWith('extra-')) {
      const extraKey = resolvedKey.slice(6)
      const extraFields = (result.extraFields as Record<string, unknown>) ?? {}
      extraFields[extraKey] = value
      result.extraFields = extraFields
    } else {
      result[resolvedKey] = parseScalarOrCollectionValue(resolvedKey, value)
    }
  }
  return { input: result, warnings }
}

function writeCLIWarnings(warnings: string[]): void {
  for (const warning of warnings) {
    process.stderr.write(`[ltm] ${warning}\n`)
  }
}

export function buildCLIInvokePayload(
  capability: string,
  cliArgs: string[],
): { payload: InvokePayload; warnings: string[] } {
  const vaultRoot = process.env.LTM_VAULT_ROOT
  if (!vaultRoot) {
    throw new Error(
      'LTM_VAULT_ROOT is not set. Use the ./ltm wrapper script or set it in .env.',
    )
  }

  const parsed = parseCLIArgs(capability, cliArgs)
  const { input: inputArgs, warnings } = parsed

  // Extract actor overrides
  const actorKind = (inputArgs['actor-kind'] as string) ?? 'agent'
  const actorId = (inputArgs['actor-id'] as string) ?? 'claude-code'
  delete inputArgs['actor-kind']
  delete inputArgs['actor-id']

  // Extract dryRun (accept both --dryRun and --dry-run)
  const dryRun = inputArgs.dryRun === true || inputArgs['dry-run'] === true
  delete inputArgs.dryRun
  delete inputArgs['dry-run']

  // Handle wrapped capabilities (e.g., organizer.node.update wraps non-uuid fields in `updates`)
  const wrapKey = WRAPPED_CAPABILITIES[capability]
  let input: Record<string, unknown>
  if (wrapKey) {
    const identity: Record<string, unknown> = {}
    const wrapped: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(inputArgs)) {
      if (IDENTITY_FIELDS.has(k)) {
        identity[k] = v
      } else {
        wrapped[k] = v
      }
    }
    input = { ...identity, [wrapKey]: wrapped }
  } else {
    input = inputArgs
  }

  return {
    payload: {
      vaultRoot,
      request: {
        capability: capability as CapabilityInvokeRequest['capability'],
        input,
        actor: { kind: actorKind as 'agent' | 'human' | 'system', id: actorId },
        dryRun,
      },
    },
    warnings,
  }
}

async function main(): Promise<void> {
  const command = process.argv[2]

  if (command === 'list') {
    writeJson(await runCapabilityRunnerCommand('list'))
    return
  }

  if (command === 'invoke') {
    const payload = await parseInvokePayload()
    writeJson(await runCapabilityRunnerCommand('invoke', payload))
    return
  }

  // CLI-arg mode: treat argv[2] as a capability name
  if (command && command.includes('.')) {
    const cliArgs = process.argv.slice(3)
    const { payload, warnings } = buildCLIInvokePayload(command, cliArgs)
    writeCLIWarnings(warnings)
    writeJson(await runCapabilityRunnerCommand('invoke', payload))
    return
  }

  throw new Error(`Unknown command: ${command ?? '<missing>'}. Use "list", "invoke", or a capability name (e.g. organizer.nodes.list_roots).`)
}

export async function runCapabilityRunnerCommand(
  command: 'list' | 'invoke',
  payload?: InvokePayload,
): Promise<unknown> {
  ensureRunnerEnvironment()

  if (command === 'list') {
    return {
      ok: true,
      capabilities: listCapabilitiesOrch(),
    }
  }

  if (!payload) {
    throw new Error('Invoke command requires payload.')
  }

  if (payload.apiBaseUrl) {
    ;(globalThis as any).__LTM_API_BASE__ = payload.apiBaseUrl
  }

  const fs = new NodeVaultFS(payload.vaultRoot)
  await fullSync(fs)
  return invokeCapabilityOrch(payload.request, { fs })
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

function ensureRunnerEnvironment(): void {
  installLocalStorageShim()
  applyRunnerFeatureFlagsFromEnv()
}

function installLocalStorageShim(): void {
  if (typeof globalThis.localStorage !== 'undefined') return
  Object.defineProperty(globalThis, 'localStorage', {
    value: new InMemoryLocalStorage(),
    configurable: true,
    enumerable: false,
    writable: false,
  })
}

function applyRunnerFeatureFlagsFromEnv(): void {
  const hasAgent = process.env.LTM_AGENT_CAPABILITIES_ENABLED !== undefined
  const hasFastapi = process.env.LTM_FASTAPI_CAPABILITY_ADAPTER_ENABLED !== undefined
  if (!hasAgent && !hasFastapi) return

  let flags = {
    agent_capabilities_enabled: false,
    fastapi_capability_adapter_enabled: false,
  }

  try {
    const existingRaw = globalThis.localStorage.getItem(STORAGE_KEYS.capabilityFeatureFlags)
    if (existingRaw) {
      const existing = JSON.parse(existingRaw) as Partial<typeof flags>
      flags = {
        agent_capabilities_enabled: existing.agent_capabilities_enabled ?? flags.agent_capabilities_enabled,
        fastapi_capability_adapter_enabled:
          existing.fastapi_capability_adapter_enabled ?? flags.fastapi_capability_adapter_enabled,
      }
    }
  } catch {
    // ignore malformed storage entry
  }

  if (hasAgent) {
    flags.agent_capabilities_enabled = parseBooleanEnv(process.env.LTM_AGENT_CAPABILITIES_ENABLED)
  }
  if (hasFastapi) {
    flags.fastapi_capability_adapter_enabled = parseBooleanEnv(process.env.LTM_FASTAPI_CAPABILITY_ADAPTER_ENABLED)
  }

  globalThis.localStorage.setItem(STORAGE_KEYS.capabilityFeatureFlags, JSON.stringify(flags))
}

function parseBooleanEnv(value: string | undefined): boolean {
  const normalized = (value || '').trim().toLowerCase()
  return normalized === '1'
    || normalized === 'true'
    || normalized === 'yes'
    || normalized === 'on'
}

const isDirectRun = (() => {
  if (process.env.LTM_CAPABILITY_RUNNER_CLI === '1') return true
  try {
    const current = fileURLToPath(import.meta.url)
    const currentName = path.basename(current)
    return process.argv.some(arg => arg.includes(currentName))
  } catch {
    return false
  }
})()

if (isDirectRun) {
  main().catch(error => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exit(1)
  })
}
