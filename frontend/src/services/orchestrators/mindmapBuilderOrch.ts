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
}

export interface MindmapSaveResult {
  outputPath: string
  nodeCount: number
  headingCount: number
  message: string
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
  const fs = getVaultFS()
  const content = await fs.read(inputPath)
  const built = buildMindmapSceneFromMarkdownBlock(content, inputPath, options)

  return {
    inputPath,
    scene: built.scene,
    sceneMarkdown: serializeMindmapSceneToMarkdownBlock(built.scene),
    sourceLines: built.stats.sourceLineCount,
    headingCount: built.stats.headingCount,
    nodeCount: built.stats.nodeCount,
    connectionCount: built.stats.connectionCount,
  }
}

export async function saveMindmapSceneOrch(params: {
  inputPath: string
  options: MindmapBuildOptions
  outputPath?: string
}): Promise<MindmapSaveResult> {
  const outputPath = params.outputPath?.trim() || suggestMindmapOutputPathOrch(params.inputPath)
  const preview = await buildMindmapPreviewOrch(params.inputPath, params.options)

  const fs = getVaultFS()
  await fs.write(outputPath, preview.sceneMarkdown)

  return {
    outputPath,
    nodeCount: preview.nodeCount,
    headingCount: preview.headingCount,
    message: `Saved mindmap to ${outputPath}`,
  }
}
