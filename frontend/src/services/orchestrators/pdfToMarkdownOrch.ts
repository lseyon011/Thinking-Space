import type { ConvertOptions, PdfPreviewData, PdfConvertResult } from '../lego_blocks/typesBlock'

export async function previewPdf(
  inputPath: string,
  options: ConvertOptions,
): Promise<PdfPreviewData> {
  const res = await fetch('/api/tools/pdf-to-markdown/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input_path: inputPath, options }),
  })
  if (!res.ok) throw new Error('Failed to load preview')
  return res.json()
}

export async function convertPdf(
  inputPath: string,
  options: ConvertOptions,
): Promise<PdfConvertResult> {
  const res = await fetch('/api/tools/pdf-to-markdown', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input_path: inputPath, options }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Conversion failed')
  return data
}
