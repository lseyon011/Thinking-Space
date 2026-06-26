// Load a ticker's bands chart image from <executionRoot>/<TICKER>/bands.png.
// Unlike the logo, there's no network fallback — if the file is missing the
// caller renders nothing.

import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'

const inflightBlock = new Map<string, Promise<Uint8Array | null>>()
const missingKeysBlock = new Set<string>()

export function tickerChartPathBlock(executionRoot: string, ticker: string): string {
  const upper = ticker.toUpperCase()
  const root = executionRoot.replace(/\/+$/, '')
  return `${root}/${upper}/bands.png`
}

function isPngBytesBlock(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
}

export async function loadTickerChartBlock(
  executionRoot: string,
  ticker: string,
): Promise<Uint8Array | null> {
  if (!executionRoot || !ticker) return null
  const key = `${executionRoot}::${ticker.toUpperCase()}`
  if (missingKeysBlock.has(key)) return null
  const existing = inflightBlock.get(key)
  if (existing) return existing

  const work = (async () => {
    const path = tickerChartPathBlock(executionRoot, ticker)
    const fs = getVaultFS()
    try {
      if (!(await fs.exists(path))) {
        missingKeysBlock.add(key)
        return null
      }
      const bytes = await fs.readBytes(path)
      if (!isPngBytesBlock(bytes)) {
        missingKeysBlock.add(key)
        return null
      }
      return bytes
    } catch {
      missingKeysBlock.add(key)
      return null
    }
  })()

  inflightBlock.set(key, work)
  try {
    return await work
  } finally {
    inflightBlock.delete(key)
  }
}

export function bytesToPngObjectUrlBlock(bytes: Uint8Array): string {
  const blob = new Blob([bytes as BlobPart], { type: 'image/png' })
  return URL.createObjectURL(blob)
}
