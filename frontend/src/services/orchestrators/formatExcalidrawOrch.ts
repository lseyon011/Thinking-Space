import { formatMarkdown } from '../lego_blocks/formatExcalidrawBlock'
import { getVaultFS } from '../lego_blocks/fsBlock'
import type { FormatOptions, FormatPreviewData, FormatResult } from '../lego_blocks/typesBlock'

/** Preview reads the file via VaultFS, formats locally. */
export async function previewFormat(
  inputPath: string,
  options: FormatOptions,
): Promise<FormatPreviewData> {
  const fs = getVaultFS()
  const content = await fs.read(inputPath)
  const formatted = formatMarkdown(content, options)

  return {
    original: content,
    formatted,
    original_lines: content.split('\n').length,
    formatted_lines: formatted.split('\n').length,
  }
}

/** Format and save using VaultFS — no backend needed. */
export async function formatAndSave(
  inputPath: string,
  options: FormatOptions,
): Promise<FormatResult> {
  const fs = getVaultFS()
  const content = await fs.read(inputPath)
  const formatted = formatMarkdown(content, options)

  // Generate output path: same folder, with "(formatted for excalidraw)" suffix
  const lastSlash = inputPath.lastIndexOf('/')
  const dir = lastSlash >= 0 ? inputPath.slice(0, lastSlash) : ''
  const filename = lastSlash >= 0 ? inputPath.slice(lastSlash + 1) : inputPath
  const stem = filename.replace(/\.md$/, '')
  const outputPath = dir
    ? `${dir}/${stem} (formatted for excalidraw).md`
    : `${stem} (formatted for excalidraw).md`

  await fs.write(outputPath, formatted)

  return {
    success: true,
    output_path: outputPath,
    message: `Formatted successfully: ${stem} (formatted for excalidraw).md`,
  }
}
