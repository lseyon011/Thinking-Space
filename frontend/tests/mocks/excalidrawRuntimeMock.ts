function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeElements(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

export function restore(
  data: { elements?: unknown; appState?: unknown; files?: unknown } | null,
): {
  elements: unknown[]
  appState: Record<string, unknown>
  files: Record<string, unknown>
} {
  return {
    elements: normalizeElements(data?.elements),
    appState: normalizeRecord(data?.appState),
    files: normalizeRecord(data?.files),
  }
}

export function serializeAsJSON(
  elements: readonly unknown[],
  appState: Record<string, unknown>,
  files: Record<string, unknown>,
  _type: 'local' | 'database',
): string {
  return JSON.stringify({
    type: 'excalidraw',
    version: 2,
    source: 'https://excalidraw.com',
    elements,
    appState,
    files,
  }, null, 2)
}
