import type { ParsedExcalidrawScene } from '../../src/services/lego_blocks/excalidrawFileBlock'

const MAX_DIFF_MESSAGES = 30

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeScene(scene: ParsedExcalidrawScene): ParsedExcalidrawScene {
  return {
    elements: Array.isArray(scene.elements) ? scene.elements : [],
    appState: scene.appState ?? {},
    files: scene.files ?? {},
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

export function canonicalizeScene(scene: ParsedExcalidrawScene): JsonValue {
  return canonicalizeJson(normalizeScene(scene))
}

export function diffScenesStrict(actual: ParsedExcalidrawScene, expected: ParsedExcalidrawScene): string[] {
  const actualCanonical = canonicalizeScene(actual)
  const expectedCanonical = canonicalizeScene(expected)
  const diffs: string[] = []
  collectDiffs(actualCanonical, expectedCanonical, 'scene', diffs)
  return diffs
}
