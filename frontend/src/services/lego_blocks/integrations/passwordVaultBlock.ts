import { v4 as uuidv4 } from 'uuid'
import { getVaultFS, type VaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import {
  decryptPasswordVaultPayloadBlock,
  encryptPasswordVaultPayloadBlock,
} from '@/services/lego_blocks/units/passwordCryptoBlock'

export interface PasswordVaultEntryBlock {
  id: string
  title: string
  username: string
  password: string
  website?: string
  notes?: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface PasswordVaultDataBlock {
  version: 1
  createdAt: string
  updatedAt: string
  entries: PasswordVaultEntryBlock[]
}

export interface LoadedPasswordVaultBlock {
  vault: PasswordVaultDataBlock
  exists: boolean
  sourceMtime: number | null
  filePath: string
}

export interface SavedPasswordVaultBlock {
  vault: PasswordVaultDataBlock
  sourceMtime: number | null
  filePath: string
}

const PASSWORD_VAULT_DIR_BLOCK = '.thinking-space/password-manager'
const PASSWORD_VAULT_FILE_BLOCK = `${PASSWORD_VAULT_DIR_BLOCK}/vault.ltm-passwords.json`
const MAX_REASONABLE_EPOCH_SECONDS = 10_000_000_000

function nowIsoBlock(): string {
  return new Date().toISOString()
}

function sanitizeTextBlock(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function sanitizeOptionalTextBlock(value: unknown): string | undefined {
  const normalized = sanitizeTextBlock(value)
  return normalized || undefined
}

function sanitizeTagsBlock(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const tags: string[] = []
  for (const raw of value) {
    const normalized = sanitizeTextBlock(raw)
    if (!normalized) continue
    const dedupeKey = normalized.toLowerCase()
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    tags.push(normalized)
  }
  return tags
}

function normalizeMtimeBlock(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return value > MAX_REASONABLE_EPOCH_SECONDS ? value / 1000 : value
}

function normalizePasswordVaultEntryBlock(
  raw: unknown,
  fallbackNow: string,
): PasswordVaultEntryBlock | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const title = sanitizeTextBlock(record.title)
  const password = sanitizeTextBlock(record.password)
  if (!title || !password) return null
  const createdAt = sanitizeTextBlock(record.createdAt) || fallbackNow
  const updatedAt = sanitizeTextBlock(record.updatedAt) || createdAt
  const id = sanitizeTextBlock(record.id)
    || (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : uuidv4())

  return {
    id,
    title,
    username: sanitizeTextBlock(record.username),
    password,
    ...(sanitizeOptionalTextBlock(record.website) ? { website: sanitizeOptionalTextBlock(record.website) } : {}),
    ...(sanitizeOptionalTextBlock(record.notes) ? { notes: sanitizeOptionalTextBlock(record.notes) } : {}),
    tags: sanitizeTagsBlock(record.tags),
    createdAt,
    updatedAt,
  }
}

function normalizePasswordVaultBlock(raw: unknown, fallbackNow = nowIsoBlock()): PasswordVaultDataBlock {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Password vault payload is invalid.')
  }
  const record = raw as Record<string, unknown>
  const createdAt = sanitizeTextBlock(record.createdAt) || fallbackNow
  const updatedAt = sanitizeTextBlock(record.updatedAt) || createdAt
  const rawEntries = Array.isArray(record.entries) ? record.entries : []
  const entries = rawEntries
    .map((entry) => normalizePasswordVaultEntryBlock(entry, fallbackNow))
    .filter((entry): entry is PasswordVaultEntryBlock => !!entry)

  return {
    version: 1,
    createdAt,
    updatedAt,
    entries,
  }
}

async function readPasswordVaultEnvelopeBlock(
  fs: VaultFS,
): Promise<{ exists: boolean; envelope: unknown | null; sourceMtime: number | null }> {
  const exists = await fs.exists(PASSWORD_VAULT_FILE_BLOCK)
  if (!exists) {
    return {
      exists: false,
      envelope: null,
      sourceMtime: null,
    }
  }

  const [content, stat] = await Promise.all([
    fs.read(PASSWORD_VAULT_FILE_BLOCK),
    fs.stat(PASSWORD_VAULT_FILE_BLOCK),
  ])

  let envelope: unknown
  try {
    envelope = JSON.parse(content)
  } catch {
    throw new Error('Password vault file is invalid.')
  }

  return {
    exists: true,
    envelope,
    sourceMtime: normalizeMtimeBlock(stat.mtime),
  }
}

export function getPasswordVaultFilePathBlock(): string {
  return PASSWORD_VAULT_FILE_BLOCK
}

export function createEmptyPasswordVaultBlock(now = nowIsoBlock()): PasswordVaultDataBlock {
  return {
    version: 1,
    createdAt: now,
    updatedAt: now,
    entries: [],
  }
}

export function createPasswordVaultEntryIdBlock(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return uuidv4()
}

export async function loadPasswordVaultBlock(input: {
  passphrase: string
  fs?: VaultFS
}): Promise<LoadedPasswordVaultBlock> {
  const fs = input.fs ?? getVaultFS()
  const envelope = await readPasswordVaultEnvelopeBlock(fs)
  if (!envelope.exists || !envelope.envelope) {
    return {
      vault: createEmptyPasswordVaultBlock(),
      exists: false,
      sourceMtime: null,
      filePath: PASSWORD_VAULT_FILE_BLOCK,
    }
  }

  const payloadText = await decryptPasswordVaultPayloadBlock(envelope.envelope, input.passphrase)
  let payload: unknown
  try {
    payload = JSON.parse(payloadText)
  } catch {
    throw new Error('Password vault payload is invalid.')
  }

  return {
    vault: normalizePasswordVaultBlock(payload),
    exists: true,
    sourceMtime: envelope.sourceMtime,
    filePath: PASSWORD_VAULT_FILE_BLOCK,
  }
}

export async function savePasswordVaultBlock(input: {
  passphrase: string
  vault: PasswordVaultDataBlock
  expectedMtime: number | null
  fs?: VaultFS
}): Promise<SavedPasswordVaultBlock> {
  const fs = input.fs ?? getVaultFS()
  const current = await readPasswordVaultEnvelopeBlock(fs)
  const expectedMtime = normalizeMtimeBlock(input.expectedMtime)

  if (expectedMtime == null) {
    if (current.exists) {
      throw new Error('Password vault changed on disk. Reload it before saving.')
    }
  } else if (!current.exists || current.sourceMtime !== expectedMtime) {
    throw new Error('Password vault changed on disk. Reload it before saving.')
  }

  const normalizedVault = normalizePasswordVaultBlock(input.vault)
  const payload = JSON.stringify(normalizedVault)
  const envelope = await encryptPasswordVaultPayloadBlock(payload, input.passphrase)

  await fs.mkdir(PASSWORD_VAULT_DIR_BLOCK)
  await fs.write(PASSWORD_VAULT_FILE_BLOCK, JSON.stringify({
    ...envelope,
    updatedAt: normalizedVault.updatedAt,
  }, null, 2))

  const stat = await fs.stat(PASSWORD_VAULT_FILE_BLOCK)
  return {
    vault: normalizedVault,
    sourceMtime: normalizeMtimeBlock(stat.mtime),
    filePath: PASSWORD_VAULT_FILE_BLOCK,
  }
}
