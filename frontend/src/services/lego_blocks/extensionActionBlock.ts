import type { CapabilityName } from './capabilityRegistryBlock'
import type { ExtensionManifestEntryKind } from './extensionManifestBlock'

export const SUPPORTED_EXTENSION_ACTION_TARGETS = [
  'sidebar-bottom',
  'thought-context-actions',
] as const

export type ExtensionActionTarget = (typeof SUPPORTED_EXTENSION_ACTION_TARGETS)[number]

export interface ExtensionDeclarativeAction {
  id: string
  label: string
  target: ExtensionActionTarget
  capability?: CapabilityName
  input: Record<string, unknown>
  description?: string
  runtime_handler?: string
}

export type ExtensionActionValidationCode =
  | 'ACTIONS_TYPE_INVALID'
  | 'ACTION_TYPE_INVALID'
  | 'ACTION_FIELD_REQUIRED'
  | 'ACTION_FIELD_TYPE_INVALID'
  | 'ACTION_TARGET_UNSUPPORTED'
  | 'ACTION_ID_DUPLICATE'

export interface ExtensionActionValidationError {
  code: ExtensionActionValidationCode
  field: string
  message: string
}

export type ExtensionActionValidationResult =
  | { ok: true; actions: ExtensionDeclarativeAction[] }
  | { ok: false; error: ExtensionActionValidationError }

const CONTEXT_PLACEHOLDER_RE = /\{\{\s*context\.([a-zA-Z0-9_.-]+)\s*\}\}/g

export function parseExtensionActionsBlock(raw: unknown): ExtensionActionValidationResult {
  if (raw == null) {
    return { ok: true, actions: [] }
  }
  if (!Array.isArray(raw)) {
    return {
      ok: false,
      error: {
        code: 'ACTIONS_TYPE_INVALID',
        field: 'actions',
        message: 'actions must be an array when provided.',
      },
    }
  }

  const actions: ExtensionDeclarativeAction[] = []
  const ids = new Set<string>()

  for (let idx = 0; idx < raw.length; idx += 1) {
    const value = raw[idx]
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {
        ok: false,
        error: {
          code: 'ACTION_TYPE_INVALID',
          field: `actions[${idx}]`,
          message: `actions[${idx}] must be an object.`,
        },
      }
    }

    const record = value as Record<string, unknown>
    const id = parseRequiredStringField(record, 'id', idx)
    if (!id.ok) return id
    if (ids.has(id.value)) {
      return {
        ok: false,
        error: {
          code: 'ACTION_ID_DUPLICATE',
          field: `actions[${idx}].id`,
          message: `Duplicate action id "${id.value}" is not allowed.`,
        },
      }
    }
    ids.add(id.value)

    const label = parseRequiredStringField(record, 'label', idx)
    if (!label.ok) return label
    const target = parseRequiredStringField(record, 'target', idx)
    if (!target.ok) return target
    if (!isSupportedExtensionActionTargetBlock(target.value)) {
      return {
        ok: false,
        error: {
          code: 'ACTION_TARGET_UNSUPPORTED',
          field: `actions[${idx}].target`,
          message: `Unsupported action target "${target.value}".`,
        },
      }
    }

    const capability = parseRequiredStringField(record, 'capability', idx)
    if (!capability.ok) return capability

    const inputField = parseInputField(record, idx)
    if (!inputField.ok) return inputField

    const description = parseOptionalStringField(record, 'description', idx)
    if (!description.ok) return description

    actions.push({
      id: id.value,
      label: label.value,
      target: target.value,
      capability: capability.value as CapabilityName,
      input: inputField.value,
      ...(description.value ? { description: description.value } : {}),
    })
  }

  return { ok: true, actions }
}

export function parseExtensionActionsFromManifestBlock(manifestRaw: unknown): ExtensionActionValidationResult {
  if (!manifestRaw || typeof manifestRaw !== 'object' || Array.isArray(manifestRaw)) {
    return {
      ok: false,
      error: {
        code: 'ACTION_TYPE_INVALID',
        field: 'manifest',
        message: 'Manifest must be an object.',
      },
    }
  }
  const record = manifestRaw as Record<string, unknown>
  const entryKind = normalizeEntryKind(record.entry_kind)
  if (entryKind === 'electron-js') {
    return parseRuntimeExtensionActionsBlock(record.actions)
  }
  return parseExtensionActionsBlock(record.actions)
}

export function resolveExtensionActionInputBlock(
  template: Record<string, unknown>,
  context: Record<string, unknown>,
): Record<string, unknown> {
  return resolveTemplateValue(template, context) as Record<string, unknown>
}

export function isSupportedExtensionActionTargetBlock(value: string): value is ExtensionActionTarget {
  return SUPPORTED_EXTENSION_ACTION_TARGETS.includes(value as ExtensionActionTarget)
}

export function isRuntimeExtensionActionBlock(action: ExtensionDeclarativeAction): boolean {
  return typeof action.runtime_handler === 'string' && action.runtime_handler.trim().length > 0
}

function parseRequiredStringField(
  record: Record<string, unknown>,
  field: string,
  index: number,
): { ok: true; value: string } | { ok: false; error: ExtensionActionValidationError } {
  if (!(field in record)) {
    return {
      ok: false,
      error: {
        code: 'ACTION_FIELD_REQUIRED',
        field: `actions[${index}].${field}`,
        message: `${field} is required.`,
      },
    }
  }

  const raw = record[field]
  if (typeof raw !== 'string') {
    return {
      ok: false,
      error: {
        code: 'ACTION_FIELD_TYPE_INVALID',
        field: `actions[${index}].${field}`,
        message: `${field} must be a string.`,
      },
    }
  }
  const trimmed = raw.trim()
  if (!trimmed) {
    return {
      ok: false,
      error: {
        code: 'ACTION_FIELD_REQUIRED',
        field: `actions[${index}].${field}`,
        message: `${field} must not be empty.`,
      },
    }
  }
  return { ok: true, value: trimmed }
}

function parseOptionalStringField(
  record: Record<string, unknown>,
  field: string,
  index: number,
): { ok: true; value?: string } | { ok: false; error: ExtensionActionValidationError } {
  if (!(field in record) || record[field] == null) return { ok: true, value: undefined }
  const raw = record[field]
  if (typeof raw !== 'string') {
    return {
      ok: false,
      error: {
        code: 'ACTION_FIELD_TYPE_INVALID',
        field: `actions[${index}].${field}`,
        message: `${field} must be a string when provided.`,
      },
    }
  }
  const trimmed = raw.trim()
  return { ok: true, value: trimmed || undefined }
}

function parseInputField(
  record: Record<string, unknown>,
  index: number,
): { ok: true; value: Record<string, unknown> } | { ok: false; error: ExtensionActionValidationError } {
  if (!('input' in record) || record.input == null) return { ok: true, value: {} }
  if (typeof record.input !== 'object' || Array.isArray(record.input)) {
    return {
      ok: false,
      error: {
        code: 'ACTION_FIELD_TYPE_INVALID',
        field: `actions[${index}].input`,
        message: 'input must be an object when provided.',
      },
    }
  }
  return { ok: true, value: record.input as Record<string, unknown> }
}

function parseRuntimeExtensionActionsBlock(raw: unknown): ExtensionActionValidationResult {
  if (raw == null) return { ok: true, actions: [] }
  if (!Array.isArray(raw)) {
    return {
      ok: false,
      error: {
        code: 'ACTIONS_TYPE_INVALID',
        field: 'actions',
        message: 'actions must be an array when provided.',
      },
    }
  }

  const actions: ExtensionDeclarativeAction[] = []
  const ids = new Set<string>()

  for (let idx = 0; idx < raw.length; idx += 1) {
    const value = raw[idx]
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {
        ok: false,
        error: {
          code: 'ACTION_TYPE_INVALID',
          field: `actions[${idx}]`,
          message: `actions[${idx}] must be an object.`,
        },
      }
    }

    const record = value as Record<string, unknown>
    const id = parseRequiredStringField(record, 'id', idx)
    if (!id.ok) return id
    if (ids.has(id.value)) {
      return {
        ok: false,
        error: {
          code: 'ACTION_ID_DUPLICATE',
          field: `actions[${idx}].id`,
          message: `Duplicate action id "${id.value}" is not allowed.`,
        },
      }
    }
    ids.add(id.value)

    const label = parseRequiredStringField(record, 'label', idx)
    if (!label.ok) return label
    const target = parseRequiredStringField(record, 'target', idx)
    if (!target.ok) return target
    if (!isSupportedExtensionActionTargetBlock(target.value)) {
      return {
        ok: false,
        error: {
          code: 'ACTION_TARGET_UNSUPPORTED',
          field: `actions[${idx}].target`,
          message: `Unsupported action target "${target.value}".`,
        },
      }
    }

    const inputField = parseInputField(record, idx)
    if (!inputField.ok) return inputField
    const description = parseOptionalStringField(record, 'description', idx)
    if (!description.ok) return description
    const runtimeHandler = parseOptionalStringField(record, 'runtime_handler', idx)
    if (!runtimeHandler.ok) return runtimeHandler

    let capability: CapabilityName | undefined
    if ('capability' in record && record.capability != null) {
      if (typeof record.capability !== 'string') {
        return {
          ok: false,
          error: {
            code: 'ACTION_FIELD_TYPE_INVALID',
            field: `actions[${idx}].capability`,
            message: 'capability must be a string when provided.',
          },
        }
      }
      const trimmedCapability = record.capability.trim()
      if (trimmedCapability) capability = trimmedCapability as CapabilityName
    }

    actions.push({
      id: id.value,
      label: label.value,
      target: target.value,
      ...(capability ? { capability } : {}),
      input: inputField.value,
      ...(description.value ? { description: description.value } : {}),
      runtime_handler: runtimeHandler.value ?? id.value,
    })
  }

  return { ok: true, actions }
}

function normalizeEntryKind(raw: unknown): ExtensionManifestEntryKind {
  if (typeof raw !== 'string') return 'declarative'
  return raw.trim() === 'electron-js' ? 'electron-js' : 'declarative'
}

function resolveTemplateValue(value: unknown, context: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    const exact = value.match(/^\{\{\s*context\.([a-zA-Z0-9_.-]+)\s*\}\}$/)
    if (exact) {
      const resolved = getByPath(context, exact[1])
      return resolved === undefined ? null : resolved
    }

    return value.replace(CONTEXT_PLACEHOLDER_RE, (_full, path: string) => {
      const resolved = getByPath(context, path)
      if (resolved == null) return ''
      if (typeof resolved === 'string') return resolved
      if (typeof resolved === 'number' || typeof resolved === 'boolean') return String(resolved)
      return JSON.stringify(resolved)
    })
  }

  if (Array.isArray(value)) {
    return value.map(item => resolveTemplateValue(item, context))
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  const record = value as Record<string, unknown>
  const next: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(record)) {
    next[key] = resolveTemplateValue(item, context)
  }
  return next
}

function getByPath(value: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.').filter(Boolean)
  let current: unknown = value
  for (const segment of segments) {
    if (!current || typeof current !== 'object') return undefined
    const record = current as Record<string, unknown>
    current = record[segment]
  }
  return current
}
