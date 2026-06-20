// Resolve a ticker logo: read from <executionRoot>/<TICKER>/<TICKER>-logo.png
// if cached, otherwise fetch from parqet's CDN and write it once.

import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'

const PARQET_BASE_BLOCK = 'https://assets.parqet.com/logos/symbol'

const inflightBlock = new Map<string, Promise<Uint8Array | null>>()
const failedKeysBlock = new Set<string>()

export function tickerLogoPathBlock(executionRoot: string, ticker: string): string {
  const upper = ticker.toUpperCase()
  const root = executionRoot.replace(/\/+$/, '')
  return `${root}/${upper}/${upper}-logo.png`
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

async function fetchLogoFromParqetBlock(ticker: string): Promise<Uint8Array | null> {
  try {
    const resp = await fetch(`${PARQET_BASE_BLOCK}/${ticker.toUpperCase()}?format=png`)
    if (!resp.ok) return null
    const buf = await resp.arrayBuffer()
    if (buf.byteLength === 0) return null
    return new Uint8Array(buf)
  } catch {
    return null
  }
}

export async function loadOrFetchTickerLogoBlock(
  executionRoot: string,
  ticker: string,
): Promise<Uint8Array | null> {
  if (!executionRoot || !ticker) return null
  const key = `${executionRoot}::${ticker.toUpperCase()}`
  if (failedKeysBlock.has(key)) return null
  const existing = inflightBlock.get(key)
  if (existing) return existing

  const work = (async () => {
    const path = tickerLogoPathBlock(executionRoot, ticker)
    const fs = getVaultFS()
    try {
      if (await fs.exists(path)) {
        const cached = await fs.readBytes(path)
        if (isPngBytesBlock(cached)) return cached
        // Stale cache from a previous code path that wrote SVG bytes into a .png file.
        // Fall through to re-fetch and overwrite.
      }
    } catch {
      // fall through and try the network
    }
    const bytes = await fetchLogoFromParqetBlock(ticker)
    if (!bytes || !isPngBytesBlock(bytes)) {
      failedKeysBlock.add(key)
      return null
    }
    try {
      await fs.writeBytes(path, bytes)
    } catch {
      // best-effort cache; still hand back bytes so we can render
    }
    return bytes
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
