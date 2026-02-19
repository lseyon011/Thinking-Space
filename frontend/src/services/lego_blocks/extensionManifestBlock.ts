export interface ExtensionManifest {
  id: string
  name: string
  version: string
  api_version: string
  min_app_version: string
  permissions: string[]
  targets: string[]
  author?: string
  description?: string
  entry?: string
}

export type ExtensionManifestErrorCode =
  | 'MANIFEST_NOT_OBJECT'
  | 'FIELD_REQUIRED'
  | 'FIELD_TYPE_INVALID'
  | 'FIELD_EMPTY'
  | 'FIELD_SEMVER_INVALID'
  | 'ARRAY_ITEM_INVALID'

export interface ExtensionManifestValidationError {
  code: ExtensionManifestErrorCode
  field: string
  message: string
}

export type ExtensionManifestValidationResult =
  | { ok: true; manifest: ExtensionManifest }
  | { ok: false; error: ExtensionManifestValidationError }

export type ExtensionManifestCompatibilityCode =
  | 'UNSUPPORTED_API_VERSION'
  | 'APP_VERSION_TOO_LOW'
  | 'APP_VERSION_INVALID'
  | 'SUPPORTED_API_VERSIONS_INVALID'

export interface ExtensionManifestCompatibilityReason {
  code: ExtensionManifestCompatibilityCode
  message: string
}

export interface ExtensionManifestCompatibilityResult {
  loadable: boolean
  reason: ExtensionManifestCompatibilityReason | null
}

export interface ExtensionManifestCompatibilityInput {
  appVersion: string
  supportedApiVersions: string[]
}

interface ParsedSemver {
  major: number
  minor: number
  patch: number
  preRelease: string[]
}

const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-.]+))?(?:\+[0-9A-Za-z-.]+)?$/

export function parseExtensionManifestBlock(raw: unknown): ExtensionManifestValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      error: {
        code: 'MANIFEST_NOT_OBJECT',
        field: 'manifest',
        message: 'Extension manifest must be an object.',
      },
    }
  }

  const record = raw as Record<string, unknown>
  const id = parseRequiredStringField(record, 'id')
  if (!id.ok) return id
  const name = parseRequiredStringField(record, 'name')
  if (!name.ok) return name
  const version = parseRequiredStringField(record, 'version')
  if (!version.ok) return version
  if (!isSemver(version.value)) {
    return {
      ok: false,
      error: {
        code: 'FIELD_SEMVER_INVALID',
        field: 'version',
        message: 'version must be a valid semver string (x.y.z).',
      },
    }
  }

  const apiVersion = parseRequiredStringField(record, 'api_version')
  if (!apiVersion.ok) return apiVersion
  const minAppVersion = parseRequiredStringField(record, 'min_app_version')
  if (!minAppVersion.ok) return minAppVersion
  if (!isSemver(minAppVersion.value)) {
    return {
      ok: false,
      error: {
        code: 'FIELD_SEMVER_INVALID',
        field: 'min_app_version',
        message: 'min_app_version must be a valid semver string (x.y.z).',
      },
    }
  }

  const permissions = parseRequiredStringArrayField(record, 'permissions')
  if (!permissions.ok) return permissions
  const targets = parseRequiredStringArrayField(record, 'targets')
  if (!targets.ok) return targets
  const author = parseOptionalStringField(record, 'author')
  if (!author.ok) return author
  const description = parseOptionalStringField(record, 'description')
  if (!description.ok) return description
  const entry = parseOptionalStringField(record, 'entry')
  if (!entry.ok) return entry

  return {
    ok: true,
    manifest: {
      id: id.value,
      name: name.value,
      version: version.value,
      api_version: apiVersion.value,
      min_app_version: minAppVersion.value,
      permissions: permissions.value,
      targets: targets.value,
      ...(author.value ? { author: author.value } : {}),
      ...(description.value ? { description: description.value } : {}),
      ...(entry.value ? { entry: entry.value } : {}),
    },
  }
}

export function getExtensionManifestCompatibilityBlock(
  manifest: ExtensionManifest,
  input: ExtensionManifestCompatibilityInput,
): ExtensionManifestCompatibilityResult {
  const appVersion = input.appVersion.trim()
  if (!isSemver(appVersion)) {
    return {
      loadable: false,
      reason: {
        code: 'APP_VERSION_INVALID',
        message: `Runtime app version "${input.appVersion}" is not valid semver.`,
      },
    }
  }

  const supportedApiVersions = normalizeStringArray(input.supportedApiVersions)
  if (supportedApiVersions.length === 0) {
    return {
      loadable: false,
      reason: {
        code: 'SUPPORTED_API_VERSIONS_INVALID',
        message: 'supportedApiVersions must include at least one API version.',
      },
    }
  }

  if (!supportedApiVersions.includes(manifest.api_version)) {
    return {
      loadable: false,
      reason: {
        code: 'UNSUPPORTED_API_VERSION',
        message: `Manifest api_version "${manifest.api_version}" is not supported.`,
      },
    }
  }

  if (compareSemver(appVersion, manifest.min_app_version) < 0) {
    return {
      loadable: false,
      reason: {
        code: 'APP_VERSION_TOO_LOW',
        message: `Manifest requires app version >= ${manifest.min_app_version}, current is ${appVersion}.`,
      },
    }
  }

  return {
    loadable: true,
    reason: null,
  }
}

function parseRequiredStringField(
  record: Record<string, unknown>,
  field: string,
): { ok: true; value: string } | { ok: false; error: ExtensionManifestValidationError } {
  if (!(field in record)) {
    return {
      ok: false,
      error: {
        code: 'FIELD_REQUIRED',
        field,
        message: `${field} is required.`,
      },
    }
  }

  const raw = record[field]
  if (typeof raw !== 'string') {
    return {
      ok: false,
      error: {
        code: 'FIELD_TYPE_INVALID',
        field,
        message: `${field} must be a string.`,
      },
    }
  }

  const trimmed = raw.trim()
  if (!trimmed) {
    return {
      ok: false,
      error: {
        code: 'FIELD_EMPTY',
        field,
        message: `${field} must not be empty.`,
      },
    }
  }

  return {
    ok: true,
    value: trimmed,
  }
}

function parseOptionalStringField(
  record: Record<string, unknown>,
  field: string,
): { ok: true; value: string | undefined } | { ok: false; error: ExtensionManifestValidationError } {
  if (!(field in record)) {
    return { ok: true, value: undefined }
  }

  const raw = record[field]
  if (raw == null) {
    return { ok: true, value: undefined }
  }
  if (typeof raw !== 'string') {
    return {
      ok: false,
      error: {
        code: 'FIELD_TYPE_INVALID',
        field,
        message: `${field} must be a string when provided.`,
      },
    }
  }

  const trimmed = raw.trim()
  return { ok: true, value: trimmed || undefined }
}

function parseRequiredStringArrayField(
  record: Record<string, unknown>,
  field: string,
): { ok: true; value: string[] } | { ok: false; error: ExtensionManifestValidationError } {
  if (!(field in record)) {
    return {
      ok: false,
      error: {
        code: 'FIELD_REQUIRED',
        field,
        message: `${field} is required.`,
      },
    }
  }

  const raw = record[field]
  if (!Array.isArray(raw)) {
    return {
      ok: false,
      error: {
        code: 'FIELD_TYPE_INVALID',
        field,
        message: `${field} must be an array of strings.`,
      },
    }
  }

  const normalized: string[] = []
  for (let idx = 0; idx < raw.length; idx += 1) {
    const value = raw[idx]
    if (typeof value !== 'string') {
      return {
        ok: false,
        error: {
          code: 'ARRAY_ITEM_INVALID',
          field: `${field}[${idx}]`,
          message: `${field}[${idx}] must be a string.`,
        },
      }
    }
    const trimmed = value.trim()
    if (!trimmed) {
      return {
        ok: false,
        error: {
          code: 'ARRAY_ITEM_INVALID',
          field: `${field}[${idx}]`,
          message: `${field}[${idx}] must not be empty.`,
        },
      }
    }
    if (!normalized.includes(trimmed)) normalized.push(trimmed)
  }

  if (normalized.length === 0) {
    return {
      ok: false,
      error: {
        code: 'FIELD_EMPTY',
        field,
        message: `${field} must include at least one value.`,
      },
    }
  }

  return { ok: true, value: normalized }
}

function normalizeStringArray(values: string[]): string[] {
  const next: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    if (!next.includes(trimmed)) next.push(trimmed)
  }
  return next
}

function isSemver(value: string): boolean {
  return SEMVER_RE.test(value.trim())
}

function parseSemver(value: string): ParsedSemver {
  const match = value.trim().match(SEMVER_RE)
  if (!match) throw new Error(`Invalid semver: ${value}`)
  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
    preRelease: match[4] ? match[4].split('.') : [],
  }
}

function compareSemver(left: string, right: string): number {
  const a = parseSemver(left)
  const b = parseSemver(right)
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  if (a.patch !== b.patch) return a.patch - b.patch
  return comparePreRelease(a.preRelease, b.preRelease)
}

function comparePreRelease(left: string[], right: string[]): number {
  if (left.length === 0 && right.length === 0) return 0
  if (left.length === 0) return 1
  if (right.length === 0) return -1

  const limit = Math.max(left.length, right.length)
  for (let idx = 0; idx < limit; idx += 1) {
    const a = left[idx]
    const b = right[idx]
    if (a == null) return -1
    if (b == null) return 1
    const numericA = isNumericIdentifier(a) ? Number.parseInt(a, 10) : null
    const numericB = isNumericIdentifier(b) ? Number.parseInt(b, 10) : null
    if (numericA != null && numericB != null && numericA !== numericB) return numericA - numericB
    if (numericA != null && numericB == null) return -1
    if (numericA == null && numericB != null) return 1
    if (a !== b) return a < b ? -1 : 1
  }
  return 0
}

function isNumericIdentifier(value: string): boolean {
  return /^(0|[1-9]\d*)$/.test(value)
}
