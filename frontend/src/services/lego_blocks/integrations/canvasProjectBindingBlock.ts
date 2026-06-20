import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'

/**
 * canvasProjectBindingBlock — persists which project a canvas surface is
 * currently bound to. Lives in a sibling settings file
 * (`.thinking-space/canvas-bindings.json`) instead of being baked into each
 * canvas JSON, so the canvas storage schema stays focused on tile layout and
 * different surfaces can share or rebind projects without re-versioning canvas
 * files.
 *
 * Format: `{ version, bindings: { [surfaceId]: projectId } }`.
 */

export const CANVAS_BINDINGS_PATH_BLOCK = '.thinking-space/canvas-bindings.json'
export const CANVAS_BINDINGS_DIR_BLOCK = '.thinking-space'
export const CANVAS_BINDINGS_VERSION_BLOCK = 1
export const CANVAS_BINDINGS_CHANGE_EVENT_BLOCK = 'thinking-space:canvas-bindings-changed'

interface CanvasBindingsFileBlock {
  version: number
  bindings: Record<string, string>
}

function normalizeBindingsFileBlock(value: unknown): CanvasBindingsFileBlock {
  const empty: CanvasBindingsFileBlock = { version: CANVAS_BINDINGS_VERSION_BLOCK, bindings: {} }
  if (!value || typeof value !== 'object') return empty
  const candidate = value as Partial<CanvasBindingsFileBlock>
  if (candidate.version !== CANVAS_BINDINGS_VERSION_BLOCK) return empty
  if (!candidate.bindings || typeof candidate.bindings !== 'object') return empty
  const cleaned: Record<string, string> = {}
  for (const [surfaceId, projectId] of Object.entries(candidate.bindings)) {
    if (typeof surfaceId === 'string' && typeof projectId === 'string' && projectId.length > 0) {
      cleaned[surfaceId] = projectId
    }
  }
  return { version: CANVAS_BINDINGS_VERSION_BLOCK, bindings: cleaned }
}

async function readBindingsFileBlock(): Promise<CanvasBindingsFileBlock> {
  try {
    const fs = getVaultFS()
    if (!(await fs.exists(CANVAS_BINDINGS_PATH_BLOCK))) {
      return { version: CANVAS_BINDINGS_VERSION_BLOCK, bindings: {} }
    }
    const raw = await fs.read(CANVAS_BINDINGS_PATH_BLOCK)
    return normalizeBindingsFileBlock(JSON.parse(raw))
  } catch {
    return { version: CANVAS_BINDINGS_VERSION_BLOCK, bindings: {} }
  }
}

async function writeBindingsFileBlock(file: CanvasBindingsFileBlock): Promise<void> {
  const fs = getVaultFS()
  await fs.mkdir(CANVAS_BINDINGS_DIR_BLOCK)
  await fs.write(CANVAS_BINDINGS_PATH_BLOCK, JSON.stringify(file, null, 2))
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(CANVAS_BINDINGS_CHANGE_EVENT_BLOCK))
    } catch {
      /* no-op */
    }
  }
}

export async function readAllCanvasProjectBindingsBlock(): Promise<Record<string, string>> {
  const file = await readBindingsFileBlock()
  return file.bindings
}

export async function readCanvasProjectBindingBlock(surfaceId: string): Promise<string | null> {
  const file = await readBindingsFileBlock()
  return file.bindings[surfaceId] ?? null
}

export async function setCanvasProjectBindingBlock(surfaceId: string, projectId: string | null): Promise<void> {
  const file = await readBindingsFileBlock()
  const nextBindings = { ...file.bindings }
  if (!projectId) {
    delete nextBindings[surfaceId]
  } else {
    nextBindings[surfaceId] = projectId
  }
  await writeBindingsFileBlock({ version: CANVAS_BINDINGS_VERSION_BLOCK, bindings: nextBindings })
}
