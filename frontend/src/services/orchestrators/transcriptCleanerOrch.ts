import { cleanTranscript } from '@/services/lego_blocks/units/transcriptCleanerBlock'
import { getVaultFS, type VaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import type { CleanResult, TranscriptOptions } from '@/services/lego_blocks/units/typesBlock'

/** Preview runs locally — pure text transform, no backend needed. */
export function previewTranscript(
  inputText: string,
  headingsText: string,
  options: TranscriptOptions,
): CleanResult {
  try {
    const preview = cleanTranscript(inputText, headingsText, options)
    return { success: true, output_path: null, preview, message: 'OK' }
  } catch (err) {
    return {
      success: false,
      output_path: null,
      preview: '',
      message: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

/** Clean and save using VaultFS — no backend needed. */
export async function cleanAndSave(params: {
  input_text: string
  headings_text: string
  output_folder: string
  output_name: string
  base_folder: string | null
  options: TranscriptOptions
  fs?: VaultFS
}): Promise<CleanResult> {
  const cleaned = cleanTranscript(params.input_text, params.headings_text, params.options)

  const fs = params.fs ?? getVaultFS()
  const basePath = params.base_folder
    ? `${params.base_folder}/${params.output_folder}`
    : params.output_folder

  await fs.mkdir(basePath)
  const outputPath = `${basePath}/${params.output_name}.md`
  await fs.write(outputPath, cleaned)

  return {
    success: true,
    output_path: outputPath,
    preview: cleaned.slice(0, 2000) + (cleaned.length > 2000 ? '...' : ''),
    message: 'Transcript cleaned and saved',
  }
}
