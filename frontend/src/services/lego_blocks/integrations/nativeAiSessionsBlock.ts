// Renderer-side wrapper for the native AI session IPCs (Electron-only).
//
// On non-Electron platforms (iOS/web) the IPCs aren't present and we return
// an empty list rather than erroring — the activity panel falls back to the
// vault markdown source only.

import {
  parseNativeAiSession,
  type NativeSource,
} from '@/services/lego_blocks/units/nativeAiSessionParserBlock'
import type { ParsedSession } from '@/services/lego_blocks/units/aiActivityParserBlock'

interface NativeListEntry {
  source: NativeSource
  relPath: string
  mtime: number
  size: number
}

interface NativeApi {
  nativeAiSessionsList?: () => Promise<NativeListEntry[]>
  nativeAiSessionRead?: (source: NativeSource, relPath: string) => Promise<string>
}

function getApi(): NativeApi | null {
  if (typeof window === 'undefined') return null
  const api = (window as unknown as { electronAPI?: NativeApi }).electronAPI
  if (!api) return null
  if (!api.nativeAiSessionsList || !api.nativeAiSessionRead) return null
  return api
}

export function nativeAiSourcesAvailable(): boolean {
  return getApi() !== null
}

export async function listNativeAiSessions(): Promise<NativeListEntry[]> {
  const api = getApi()
  if (!api) return []
  try {
    return (await api.nativeAiSessionsList!()) ?? []
  } catch {
    return []
  }
}

export async function readNativeAiSession(
  source: NativeSource,
  relPath: string,
): Promise<string> {
  const api = getApi()
  if (!api) throw new Error('Native AI session API not available on this platform')
  return api.nativeAiSessionRead!(source, relPath)
}

/**
 * Convenience: read + parse a single native session. Returns null for
 * unparseable files so the caller can keep going through the batch.
 */
export async function loadAndParseNativeAiSession(
  entry: NativeListEntry,
): Promise<ParsedSession | null> {
  try {
    const text = await readNativeAiSession(entry.source, entry.relPath)
    return parseNativeAiSession({
      source: entry.source,
      relPath: entry.relPath,
      mtime: entry.mtime,
      text,
    })
  } catch {
    return null
  }
}
