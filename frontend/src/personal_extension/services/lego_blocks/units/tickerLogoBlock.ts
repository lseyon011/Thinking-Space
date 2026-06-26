// Resolve a ticker logo from <executionRoot>/<TICKER>/<TICKER>-logo.(png|svg),
// otherwise fetch from parqet's CDN and cache once. Parqet serves SVG by
// default and PNG isn't always honored, so we accept either format.

import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'

const PARQET_BASE_BLOCK = 'https://assets.parqet.com/logos/symbol'

export type TickerLogoFormatBlock = 'png' | 'svg'

export interface TickerLogoResultBlock {
  bytes: Uint8Array
  format: TickerLogoFormatBlock
}

const inflightBlock = new Map<string, Promise<TickerLogoResultBlock | null>>()
const failedKeysBlock = new Set<string>()

function tickerLogoDirBlock(executionRoot: string, ticker: string): { dir: string; baseName: string } {
  const upper = ticker.toUpperCase()
  const root = executionRoot.replace(/\/+$/, '')
  return { dir: `${root}/${upper}`, baseName: `${upper}-logo` }
}

export function tickerLogoPathBlock(
  executionRoot: string,
  ticker: string,
  format: TickerLogoFormatBlock = 'png',
): string {
  const { dir, baseName } = tickerLogoDirBlock(executionRoot, ticker)
  return `${dir}/${baseName}.${format}`
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

function isSvgBytesBlock(bytes: Uint8Array): boolean {
  // Sniff the first non-whitespace chunk for an XML/SVG opener.
  const sample = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 256))).trimStart().toLowerCase()
  return sample.startsWith('<svg') || sample.startsWith('<?xml')
}

function detectFormatBlock(bytes: Uint8Array): TickerLogoFormatBlock | null {
  if (isPngBytesBlock(bytes)) return 'png'
  if (isSvgBytesBlock(bytes)) return 'svg'
  return null
}

function base64ToBytesBlock(base64: string): Uint8Array {
  const binary = atob(base64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

async function fetchLogoFromParqetBlock(ticker: string): Promise<TickerLogoResultBlock | null> {
  const url = `${PARQET_BASE_BLOCK}/${ticker.toUpperCase()}`
  // Prefer the Electron main-process fetch so we bypass parqet's missing CORS
  // headers. Falls back to a renderer fetch for non-Electron surfaces (which
  // may still fail due to CORS but at least won't crash).
  const electronFetch = typeof window !== 'undefined' ? window.electronAPI?.fetchBytes : undefined
  try {
    if (electronFetch) {
      const resp = await electronFetch(url)
      if (resp.status < 200 || resp.status >= 300) return null
      if (!resp.bytesBase64) return null
      const bytes = base64ToBytesBlock(resp.bytesBase64)
      if (bytes.length === 0) return null
      const format = detectFormatBlock(bytes)
      if (!format) return null
      return { bytes, format }
    }
    const resp = await fetch(url)
    if (!resp.ok) return null
    const buf = await resp.arrayBuffer()
    if (buf.byteLength === 0) return null
    const bytes = new Uint8Array(buf)
    const format = detectFormatBlock(bytes)
    if (!format) return null
    return { bytes, format }
  } catch {
    return null
  }
}

export async function loadOrFetchTickerLogoBlock(
  executionRoot: string,
  ticker: string,
): Promise<TickerLogoResultBlock | null> {
  if (!executionRoot || !ticker) return null
  const key = `${executionRoot}::${ticker.toUpperCase()}`
  if (failedKeysBlock.has(key)) return null
  const existing = inflightBlock.get(key)
  if (existing) return existing

  const work = (async (): Promise<TickerLogoResultBlock | null> => {
    const fs = getVaultFS()
    // Look at both extensions in the cache before hitting the network.
    for (const format of ['png', 'svg'] as TickerLogoFormatBlock[]) {
      const path = tickerLogoPathBlock(executionRoot, ticker, format)
      try {
        if (await fs.exists(path)) {
          const cached = await fs.readBytes(path)
          const detected = detectFormatBlock(cached)
          // Trust the on-disk format if magic-bytes match; otherwise fall
          // through and re-fetch (covers stale .png files holding SVG bytes
          // from older code paths).
          if (detected === format) return { bytes: cached, format: detected }
        }
      } catch {
        // ignore and try next
      }
    }

    const fetched = await fetchLogoFromParqetBlock(ticker)
    if (!fetched) {
      failedKeysBlock.add(key)
      return null
    }
    try {
      await fs.writeBytes(tickerLogoPathBlock(executionRoot, ticker, fetched.format), fetched.bytes)
    } catch {
      // best-effort cache; still hand back bytes so we can render
    }
    return fetched
  })()

  inflightBlock.set(key, work)
  try {
    return await work
  } finally {
    inflightBlock.delete(key)
  }
}

const MIME_BY_FORMAT_BLOCK: Record<TickerLogoFormatBlock, string> = {
  png: 'image/png',
  svg: 'image/svg+xml',
}

export function tickerLogoToObjectUrlBlock(result: TickerLogoResultBlock): string {
  const blob = new Blob([result.bytes as BlobPart], { type: MIME_BY_FORMAT_BLOCK[result.format] })
  return URL.createObjectURL(blob)
}
