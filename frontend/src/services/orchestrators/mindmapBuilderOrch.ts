import { getVaultFS } from '../lego_blocks/fsBlock'
import {
  buildMindmapSceneFromMarkdownBlock,
  DEFAULT_MINDMAP_BUILD_OPTIONS,
  serializeMindmapSceneToMarkdownBlock,
  suggestMindmapOutputPathBlock,
  type MindmapBuildOptions,
} from '../lego_blocks/mindmapBuilderBlock'
import type { ParsedExcalidrawScene } from '../lego_blocks/excalidrawFileBlock'

export type { MindmapBuildOptions }

export interface MindmapPreviewData {
  inputPath: string
  scene: ParsedExcalidrawScene
  sceneMarkdown: string
  sourceLines: number
  headingCount: number
  nodeCount: number
  connectionCount: number
  timingMs: {
    read: number
    build: number
    serialize: number
    total: number
  }
}

export interface MindmapSaveResult {
  outputPath: string
  nodeCount: number
  headingCount: number
  message: string
  timingMs: {
    previewTotal: number
    write: number
    total: number
  }
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

export function getDefaultMindmapBuildOptionsOrch(): MindmapBuildOptions {
  return { ...DEFAULT_MINDMAP_BUILD_OPTIONS }
}

export async function listMindmapSourceFilesOrch(limit = 2000): Promise<string[]> {
  const fs = getVaultFS()
  const entries = await fs.walkVault(['.md'])
  return entries
    .map(entry => entry.path)
    .filter(path => !/\.excalidraw(\.md)?$/i.test(path))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, Math.max(limit, 1))
}

export function suggestMindmapOutputPathOrch(inputPath: string): string {
  return suggestMindmapOutputPathBlock(inputPath)
}

export async function buildMindmapPreviewOrch(
  inputPath: string,
  options: MindmapBuildOptions,
): Promise<MindmapPreviewData> {
  const started = nowMs()
  const fs = getVaultFS()
  const readStarted = nowMs()
  const content = await fs.read(inputPath)
  const readMs = nowMs() - readStarted
  const buildStarted = nowMs()
  const built = buildMindmapSceneFromMarkdownBlock(content, inputPath, options)
  const buildMs = nowMs() - buildStarted
  const serializeStarted = nowMs()
  const sceneMarkdown = serializeMindmapSceneToMarkdownBlock(built.scene)
  const serializeMs = nowMs() - serializeStarted

  return {
    inputPath,
    scene: built.scene,
    sceneMarkdown,
    sourceLines: built.stats.sourceLineCount,
    headingCount: built.stats.headingCount,
    nodeCount: built.stats.nodeCount,
    connectionCount: built.stats.connectionCount,
    timingMs: {
      read: readMs,
      build: buildMs,
      serialize: serializeMs,
      total: nowMs() - started,
    },
  }
}

export async function saveMindmapSceneOrch(params: {
  inputPath: string
  options: MindmapBuildOptions
  outputPath?: string
}): Promise<MindmapSaveResult> {
  const started = nowMs()
  const outputPath = params.outputPath?.trim() || suggestMindmapOutputPathOrch(params.inputPath)
  const preview = await buildMindmapPreviewOrch(params.inputPath, params.options)

  const fs = getVaultFS()
  const writeStarted = nowMs()
  await fs.write(outputPath, preview.sceneMarkdown)
  const writeMs = nowMs() - writeStarted

  return {
    outputPath,
    nodeCount: preview.nodeCount,
    headingCount: preview.headingCount,
    message: `Saved mindmap to ${outputPath}`,
    timingMs: {
      previewTotal: preview.timingMs.total,
      write: writeMs,
      total: nowMs() - started,
    },
  }
}
