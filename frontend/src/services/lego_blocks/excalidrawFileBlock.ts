import { decompressFromBase64LzString } from './lzStringBlock'

export interface ParsedExcalidrawScene {
  elements: unknown[]
  appState?: Record<string, unknown>
  files?: Record<string, unknown>
}

function sceneToJson(scene: ParsedExcalidrawScene): string {
  return JSON.stringify({
    elements: scene.elements,
    appState: scene.appState ?? {},
    files: scene.files ?? {},
  }, null, 2)
}

function tryParseJson(value: string): ParsedExcalidrawScene | null {
  try {
    const parsed = JSON.parse(value) as {
      elements?: unknown
      appState?: Record<string, unknown>
      files?: Record<string, unknown>
    }
    if (!Array.isArray(parsed.elements)) return null
    return {
      elements: parsed.elements,
      appState: parsed.appState,
      files: parsed.files,
    }
  } catch {
    return null
  }
}

function normalizeObsidianHighlighterElements(elements: unknown[]): unknown[] {
  let changed = false

  const normalized = elements.map((element) => {
    if (!element || typeof element !== 'object') return element

    const candidate = element as Record<string, unknown>
    if (candidate.type !== 'freedraw') return element

    const customData = candidate.customData as Record<string, unknown> | undefined
    const strokeOptions = customData?.strokeOptions as Record<string, unknown> | undefined
    const isHighlighter = strokeOptions?.highlighter === true
    if (!isHighlighter) return element

    const strokeColor = typeof candidate.strokeColor === 'string' ? candidate.strokeColor.toLowerCase() : null
    const backgroundColor = typeof candidate.backgroundColor === 'string' ? candidate.backgroundColor : null

    const hasVisibleBackgroundColor = Boolean(
      backgroundColor
      && backgroundColor.trim() !== ''
      && backgroundColor.toLowerCase() !== 'transparent',
    )
    const invisibleStroke = strokeColor === '#fff' || strokeColor === '#ffffff' || strokeColor === 'white'

    if (!hasVisibleBackgroundColor || !invisibleStroke) return element

    changed = true
    return {
      ...candidate,
      // Obsidian highlighter stores visible color in backgroundColor; vanilla Excalidraw
      // renders freedraw using strokeColor, so map it for viewer compatibility.
      strokeColor: backgroundColor,
    }
  })

  return changed ? normalized : elements
}

function normalizeScene(scene: ParsedExcalidrawScene): ParsedExcalidrawScene {
  return {
    elements: normalizeObsidianHighlighterElements(scene.elements),
    appState: scene.appState,
    files: scene.files,
  }
}

function parseFromCodeFences(content: string): ParsedExcalidrawScene | null {
  const fenceRe = /```([a-zA-Z0-9_-]+)?\s*([\s\S]*?)\s*```/gi
  let match: RegExpExecArray | null
  while (true) {
    match = fenceRe.exec(content)
    if (!match) break
    const fenceType = (match[1] ?? '').trim().toLowerCase()
    const block = match[2]?.trim() ?? ''

    if (fenceType === '' || fenceType === 'json') {
      const parsed = tryParseJson(block)
      if (parsed) return normalizeScene(parsed)
      continue
    }

    if (fenceType === 'compressed-json') {
      const decompressed = decompressFromBase64LzString(block.replace(/\s+/g, ''))
      if (!decompressed) continue
      const parsed = tryParseJson(decompressed)
      if (parsed) return normalizeScene(parsed)
    }
  }
  return null
}

export function parseExcalidrawScene(content: string): ParsedExcalidrawScene | null {
  const raw = content.trim()
  if (!raw) return null

  const direct = tryParseJson(raw)
  if (direct) return normalizeScene(direct)

  return parseFromCodeFences(content)
}

export function serializeExcalidrawScene(
  originalContent: string,
  scene: ParsedExcalidrawScene,
): string {
  const serialized = sceneToJson(scene)
  const raw = originalContent.trim()

  if (raw) {
    const direct = tryParseJson(raw)
    if (direct) {
      return `${serialized}\n`
    }
  }

  const fenceRe = /```(?:json)?\s*([\s\S]*?)\s*```/gi
  let replaced = false
  const updated = originalContent.replace(fenceRe, (full, block: string) => {
    if (replaced) return full
    const parsed = tryParseJson((block ?? '').trim())
    if (!parsed) return full
    replaced = true
    return `\`\`\`json\n${serialized}\n\`\`\``
  })

  if (replaced) return updated

  return `\`\`\`json\n${serialized}\n\`\`\`\n`
}
