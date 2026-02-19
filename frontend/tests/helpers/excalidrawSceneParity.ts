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

function asRoundedNumber(value: unknown, decimals = 3): number {
  const n = asFiniteNumber(value)
  const factor = 10 ** decimals
  return Math.round(n * factor) / factor
}

function normalizeParityText(text: string): string {
  return text
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parityTextKey(text: string): string {
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  const digest = (hash >>> 0).toString(16).padStart(8, '0')
  const preview = text.slice(0, 48).replace(/\s+/g, ' ')
  return `${digest}:${preview}`
}

function simplifyElementForParity(value: unknown): unknown {
  const stripped = stripElementMetadata(value)
  if (!isPlainObject(stripped)) return stripped

  const elementType = typeof stripped.type === 'string' ? stripped.type : 'unknown'

  const out: Record<string, unknown> = {
    type: elementType,
    x: asRoundedNumber(stripped.x),
    y: asRoundedNumber(stripped.y),
    width: asRoundedNumber(stripped.width),
    height: asRoundedNumber(stripped.height),
    angle: asRoundedNumber(stripped.angle),
    isDeleted: stripped.isDeleted === true,
  }

  if (elementType === 'text') {
    out.text = normalizeParityText(typeof stripped.text === 'string' ? stripped.text : '')
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

function isParityRelevantElement(value: unknown): boolean {
  if (!isPlainObject(value)) return false
  if (value.isDeleted === true) return false
  return value.type === 'text'
}

function normalizeElementOriginAndOrder(elements: unknown[]): unknown[] {
  if (elements.length === 0) return elements

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY

  for (const element of elements) {
    if (!isPlainObject(element)) continue
    const x = asFiniteNumber(element.x)
    const y = asFiniteNumber(element.y)
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
  }

  const shifted = elements.map((element) => {
    if (!isPlainObject(element)) return element
    return {
      ...element,
      x: asRoundedNumber(asFiniteNumber(element.x) - minX),
      y: asRoundedNumber(asFiniteNumber(element.y) - minY),
    }
  })

  const sortKey = (element: unknown): string => {
    if (!isPlainObject(element)) return 'zzz'
    const type = String(element.type ?? '')
    const x = asRoundedNumber(element.x)
    const y = asRoundedNumber(element.y)
    const w = asRoundedNumber(element.width)
    const h = asRoundedNumber(element.height)
    const text = typeof element.text === 'string' ? element.text : ''
    const points = Array.isArray(element.points) ? element.points.length : 0
    return `${type}|${text}|${x}|${y}|${w}|${h}|${points}`
  }

  shifted.sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
  return shifted
}

function groupParityElementsByText(elements: unknown[]): Record<string, unknown[]> {
  const buckets = new Map<string, unknown[]>()

  for (const element of elements) {
    if (!isPlainObject(element)) continue
    const text = typeof element.text === 'string' ? element.text : ''
    const entry = {
      x: asRoundedNumber(element.x),
      y: asRoundedNumber(element.y),
      width: asRoundedNumber(element.width),
      height: asRoundedNumber(element.height),
      textAlign: typeof element.textAlign === 'string' ? element.textAlign : 'left',
      fontSize: asFiniteNumber(element.fontSize, 20),
      fontFamily: asFiniteNumber(element.fontFamily, 2),
      lineHeight: asFiniteNumber(element.lineHeight, 1.25),
      verticalAlign: typeof element.verticalAlign === 'string' ? element.verticalAlign : 'middle',
    }

    const list = buckets.get(text) ?? []
    list.push(entry)
    buckets.set(text, list)
  }

  const out: Record<string, unknown[]> = {}
  for (const [text, list] of [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const key = parityTextKey(text)
    out[key] = list.sort((left, right) => {
      const lx = asFiniteNumber((left as Record<string, unknown>).x)
      const rx = asFiniteNumber((right as Record<string, unknown>).x)
      if (lx !== rx) return lx - rx
      const ly = asFiniteNumber((left as Record<string, unknown>).y)
      const ry = asFiniteNumber((right as Record<string, unknown>).y)
      if (ly !== ry) return ly - ry
      const lw = asFiniteNumber((left as Record<string, unknown>).width)
      const rw = asFiniteNumber((right as Record<string, unknown>).width)
      if (lw !== rw) return lw - rw
      const lh = asFiniteNumber((left as Record<string, unknown>).height)
      const rh = asFiniteNumber((right as Record<string, unknown>).height)
      return lh - rh
    })
  }

  return out
}

function normalizeSceneForProfile(
  scene: ParsedExcalidrawScene,
  profile: SceneParityProfile,
): ParsedExcalidrawScene {
  const normalized = normalizeScene(scene)
  if (profile === 'strict') return normalized

  const parityElements = normalizeElementOriginAndOrder(
    normalized.elements
      .map(element => simplifyElementForParity(element))
      .filter(isParityRelevantElement),
  )

  return {
    elements: groupParityElementsByText(parityElements) as unknown as ParsedExcalidrawScene['elements'],
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

    const missingInActual = expectedKeys.filter(key => !(key in actual))
    const missingInExpected = actualKeys.filter(key => !(key in expected))
    if (missingInActual.length > 0 || missingInExpected.length > 0) {
      const summarize = (keys: string[]): string => {
        if (keys.length === 0) return 'none'
        const preview = keys.slice(0, 3).join(', ')
        return keys.length > 3 ? `${preview} (+${keys.length - 3} more)` : preview
      }
      out.push(
        `${path}: object keys mismatch (missing in actual: ${summarize(missingInActual)}; missing in expected: ${summarize(missingInExpected)})`,
      )
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
