import type { ParsedExcalidrawScene } from '../../src/services/lego_blocks/excalidrawFileBlock'
import { normalizeExcalidrawSceneForInteropBlock } from '../../src/services/lego_blocks/excalidrawSceneCompatBlock'

const MAX_DIFF_MESSAGES = 30

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

export type SceneParityProfile = 'strict' | 'parity-focused'

const NON_SEMANTIC_ELEMENT_KEYS = new Set([
  'id',
  'index',
  'seed',
  'version',
  'versionNonce',
  'updated',
  'containerId',
  'frameId',
  'groupIds',
  'link',
  'locked',
  'boundElements',
  'startBinding',
  'endBinding',
  'fileId',
])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeScene(scene: ParsedExcalidrawScene): ParsedExcalidrawScene {
  const normalized = normalizeExcalidrawSceneForInteropBlock(scene)
  return {
    elements: Array.isArray(normalized.elements) ? normalized.elements : [],
    appState: normalized.appState ?? {},
    files: normalized.files ?? {},
  }
}

function stripElementMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => stripElementMetadata(item))
  }

  if (!isPlainObject(value)) return value

  const out: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (NON_SEMANTIC_ELEMENT_KEYS.has(key)) continue
    out[key] = stripElementMetadata(raw)
  }
  return out
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function simplifyElementForParity(value: unknown): unknown {
  const stripped = stripElementMetadata(value)
  if (!isPlainObject(stripped)) return stripped

  const elementType = typeof stripped.type === 'string' ? stripped.type : 'unknown'

  const out: Record<string, unknown> = {
    type: elementType,
    x: asFiniteNumber(stripped.x),
    y: asFiniteNumber(stripped.y),
    width: asFiniteNumber(stripped.width),
    height: asFiniteNumber(stripped.height),
    angle: asFiniteNumber(stripped.angle),
    isDeleted: stripped.isDeleted === true,
  }

  if (elementType === 'text') {
    out.text = typeof stripped.text === 'string' ? stripped.text : ''
    out.fontSize = asFiniteNumber(stripped.fontSize, 20)
    out.fontFamily = asFiniteNumber(stripped.fontFamily, 2)
    out.lineHeight = asFiniteNumber(stripped.lineHeight, 1.25)
    out.textAlign = typeof stripped.textAlign === 'string' ? stripped.textAlign : 'left'
    out.verticalAlign = typeof stripped.verticalAlign === 'string' ? stripped.verticalAlign : 'middle'
  }

  if (elementType === 'arrow' || elementType === 'line' || elementType === 'freedraw') {
    out.points = Array.isArray(stripped.points) ? stripped.points : []
  }

  return out
}

function normalizeSceneForProfile(
  scene: ParsedExcalidrawScene,
  profile: SceneParityProfile,
): ParsedExcalidrawScene {
  const normalized = normalizeScene(scene)
  if (profile === 'strict') return normalized

  return {
    elements: normalized.elements.map(element => simplifyElementForParity(element)),
    appState: {},
    files: {},
  }
}

function canonicalizeJson(value: unknown): JsonValue {
  if (Array.isArray(value)) {
    return value.map(item => canonicalizeJson(item))
  }

  if (isPlainObject(value)) {
    const out: { [key: string]: JsonValue } = {}
    for (const key of Object.keys(value).sort()) {
      out[key] = canonicalizeJson(value[key])
    }
    return out
  }

  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  return String(value)
}

function collectDiffs(actual: JsonValue, expected: JsonValue, path: string, out: string[]): void {
  if (out.length >= MAX_DIFF_MESSAGES) return

  if (Array.isArray(actual) || Array.isArray(expected)) {
    if (!Array.isArray(actual) || !Array.isArray(expected)) {
      out.push(`${path}: type mismatch (${Array.isArray(actual) ? 'array' : typeof actual} vs ${Array.isArray(expected) ? 'array' : typeof expected})`)
      return
    }

    if (actual.length !== expected.length) {
      out.push(`${path}: array length mismatch (${actual.length} vs ${expected.length})`)
    }

    const count = Math.min(actual.length, expected.length)
    for (let i = 0; i < count; i += 1) {
      collectDiffs(actual[i], expected[i], `${path}[${i}]`, out)
      if (out.length >= MAX_DIFF_MESSAGES) return
    }
    return
  }

  if (isPlainObject(actual) || isPlainObject(expected)) {
    if (!isPlainObject(actual) || !isPlainObject(expected)) {
      out.push(`${path}: type mismatch (${typeof actual} vs ${typeof expected})`)
      return
    }

    const actualKeys = Object.keys(actual).sort()
    const expectedKeys = Object.keys(expected).sort()

    const actualKeyList = actualKeys.join(',')
    const expectedKeyList = expectedKeys.join(',')
    if (actualKeyList !== expectedKeyList) {
      out.push(`${path}: object keys mismatch (${actualKeyList} vs ${expectedKeyList})`)
    }

    const keySet = new Set([...actualKeys, ...expectedKeys])
    for (const key of [...keySet].sort()) {
      if (!(key in actual)) {
        out.push(`${path}.${key}: missing in actual`)
        if (out.length >= MAX_DIFF_MESSAGES) return
        continue
      }
      if (!(key in expected)) {
        out.push(`${path}.${key}: missing in expected`)
        if (out.length >= MAX_DIFF_MESSAGES) return
        continue
      }
      collectDiffs(
        (actual as Record<string, JsonValue>)[key],
        (expected as Record<string, JsonValue>)[key],
        `${path}.${key}`,
        out,
      )
      if (out.length >= MAX_DIFF_MESSAGES) return
    }
    return
  }

  if (!Object.is(actual, expected)) {
    out.push(`${path}: value mismatch (${JSON.stringify(actual)} vs ${JSON.stringify(expected)})`)
  }
}

export function canonicalizeScene(
  scene: ParsedExcalidrawScene,
  profile: SceneParityProfile = 'strict',
): JsonValue {
  return canonicalizeJson(normalizeSceneForProfile(scene, profile))
}

export function diffScenes(
  actual: ParsedExcalidrawScene,
  expected: ParsedExcalidrawScene,
  profile: SceneParityProfile = 'strict',
): string[] {
  const actualCanonical = canonicalizeScene(actual, profile)
  const expectedCanonical = canonicalizeScene(expected, profile)
  const diffs: string[] = []
  collectDiffs(actualCanonical, expectedCanonical, 'scene', diffs)
  return diffs
}

export function diffScenesStrict(actual: ParsedExcalidrawScene, expected: ParsedExcalidrawScene): string[] {
  return diffScenes(actual, expected, 'strict')
}

export function diffScenesParityFocused(actual: ParsedExcalidrawScene, expected: ParsedExcalidrawScene): string[] {
  return diffScenes(actual, expected, 'parity-focused')
}
