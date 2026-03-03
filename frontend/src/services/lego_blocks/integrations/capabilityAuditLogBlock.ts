import type { VaultFS } from '@/services/lego_blocks/integrations/fsBlock'

export interface CapabilityAuditEntry {
  auditId: string
  timestamp: string
  requestId: string
  capability: string
  origin?: 'core' | 'extension'
  extensionId?: string
  extensionRegistryKey?: string
  actorKind: 'human' | 'agent' | 'system'
  actorId?: string
  dryRun: boolean
  ok: boolean
  inputHash: string
  touchedPaths: string[]
  warnings: string[]
  errorCode?: string
  errorMessage?: string
}

const THINKING_SPACE_DIR = '.thinking-space'
const LEGACY_THINK_SPACE_DIR = '.think-space'
const AUDIT_DIR = `${THINKING_SPACE_DIR}/audit`
const AUDIT_FILE = `${AUDIT_DIR}/capability-audit.log`
const LEGACY_AUDIT_FILE = `${LEGACY_THINK_SPACE_DIR}/audit/capability-audit.log`

export async function writeCapabilityAuditEntry(
  entry: CapabilityAuditEntry,
  fs?: VaultFS,
): Promise<void> {
  if (!fs) return

  await ensureAuditDir(fs)
  await migrateLegacyAuditLogIfNeeded(fs)
  const line = JSON.stringify(entry)
  const exists = await fs.exists(AUDIT_FILE)
  if (!exists) {
    await fs.create(AUDIT_FILE, `${line}\n`)
    return
  }

  await fs.process(AUDIT_FILE, current => {
    const needsBreak = current.length > 0 && !current.endsWith('\n')
    return `${current}${needsBreak ? '\n' : ''}${line}\n`
  })
}

export function createCapabilityInputHash(value: unknown): string {
  const stable = stableStringify(value)
  return hashString(stable)
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value !== 'object') return JSON.stringify(value)

  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(',')}]`
  }

  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
}

function hashString(value: string): string {
  let hash = 5381
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i)
  }
  return `h${(hash >>> 0).toString(16)}`
}

async function ensureAuditDir(fs: VaultFS): Promise<void> {
  try {
    await fs.mkdir(THINKING_SPACE_DIR)
  } catch {
    // Directory likely exists.
  }
  try {
    await fs.mkdir(AUDIT_DIR)
  } catch {
    // Directory likely exists.
  }
}

async function migrateLegacyAuditLogIfNeeded(fs: VaultFS): Promise<void> {
  const hasCurrent = await fs.exists(AUDIT_FILE).catch(() => false)
  if (hasCurrent) return
  const hasLegacy = await fs.exists(LEGACY_AUDIT_FILE).catch(() => false)
  if (!hasLegacy) return
  const legacyContent = await fs.read(LEGACY_AUDIT_FILE).catch(() => '')
  await fs.create(AUDIT_FILE, legacyContent)
}
