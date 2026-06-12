// Scan the F9-execution folder for study records.
// Source patterns (watchlist now uses a nested folder per ticker):
//   <executionRoot>/watchlist/*.md                       — legacy flat watchlist records
//   <executionRoot>/watchlist/<ticker>/<ticker>-study.md — nested watchlist records
//   <executionRoot>/<TICKER>/<ticker>-study.md           — held company study records

import { getFileContent, listFolderEntries } from '@/services/orchestrators/fileSystemOrch'
import {
  parseWebullStudyRecordBlock,
  type WebullStudyRecordBlock,
} from '../units/webullStudyRecordBlock'

export type WebullStudyRecordSourceBlock = 'watchlist' | 'held-folder'

export interface WebullStudyLoadedRecordBlock {
  record: WebullStudyRecordBlock
  source: WebullStudyRecordSourceBlock
}

export interface WebullStudyVaultScanBlock {
  executionRoot: string
  records: WebullStudyLoadedRecordBlock[]
  warnings: string[]
}

function isTickerFolderNameBlock(name: string): boolean {
  // Conservative: uppercase letters/digits, 1-6 chars (matches DELL, AMZN, BRKB style)
  return /^[A-Z][A-Z0-9]{0,5}$/.test(name)
}

// Pick the study markdown inside a ticker folder. Prefer `<folder>-study.md`
// (case-insensitive), else fall back to any `*-study.md`.
function pickStudyFileNameBlock(files: string[], folderName: string): string | null {
  const expected = `${folderName.toLowerCase()}-study.md`
  const exact = files.find((f) => f.toLowerCase() === expected)
  if (exact) return exact
  return files.find((f) => f.toLowerCase().endsWith('-study.md')) ?? null
}

async function readRecordBlock(
  executionRoot: string,
  relativePath: string,
  source: WebullStudyRecordSourceBlock,
  warnings: string[],
): Promise<WebullStudyLoadedRecordBlock | null> {
  const filePath = `${executionRoot}/${relativePath}`
  try {
    const { content } = await getFileContent(filePath)
    const parts = relativePath.split('/')
    const fileName = parts[parts.length - 1] ?? relativePath
    const record = parseWebullStudyRecordBlock({ filePath, fileName, content })
    if (!record) {
      warnings.push(`skipped (no parseable frontmatter or missing ticker): ${filePath}`)
      return null
    }
    return { record, source }
  } catch (err) {
    warnings.push(
      `failed to read ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
    )
    return null
  }
}

export async function scanWebullStudyVaultBlock(executionRoot: string): Promise<WebullStudyVaultScanBlock> {
  const trimmedRoot = executionRoot.trim().replace(/\/+$/, '')
  const warnings: string[] = []
  const out: WebullStudyLoadedRecordBlock[] = []

  if (!trimmedRoot) {
    return { executionRoot: '', records: [], warnings: ['execution root not configured'] }
  }

  const rootEntries = await listFolderEntries(trimmedRoot)
  if (rootEntries.folders.length === 0 && rootEntries.files.length === 0) {
    warnings.push(`execution root has no entries (path may not exist): ${trimmedRoot}`)
  }

  // 1) Watchlist (not-held) records. Supports both the legacy flat layout
  //    (<root>/watchlist/*.md) and the current nested layout
  //    (<root>/watchlist/<ticker>/<ticker>-study.md).
  if (rootEntries.folders.includes('watchlist')) {
    const watchlistRoot = `${trimmedRoot}/watchlist`
    const watchlistEntries = await listFolderEntries(watchlistRoot)

    // a) Legacy flat files directly under watchlist/.
    for (const file of watchlistEntries.files) {
      if (!file.toLowerCase().endsWith('.md')) continue
      const loaded = await readRecordBlock(trimmedRoot, `watchlist/${file}`, 'watchlist', warnings)
      if (loaded) out.push(loaded)
    }

    // b) Nested per-ticker folders: watchlist/<ticker>/<ticker>-study.md.
    for (const sub of watchlistEntries.folders) {
      const subEntries = await listFolderEntries(`${watchlistRoot}/${sub}`)
      const studyFile = pickStudyFileNameBlock(subEntries.files, sub)
      if (!studyFile) continue
      const loaded = await readRecordBlock(
        trimmedRoot,
        `watchlist/${sub}/${studyFile}`,
        'watchlist',
        warnings,
      )
      if (loaded) out.push(loaded)
    }
  }

  // 2) Held records: <root>/<TICKER>/<ticker>-study.md
  for (const folder of rootEntries.folders) {
    if (!isTickerFolderNameBlock(folder)) continue
    const tickerEntries = await listFolderEntries(`${trimmedRoot}/${folder}`)
    const studyFile = pickStudyFileNameBlock(tickerEntries.files, folder)
    if (!studyFile) continue
    const loaded = await readRecordBlock(trimmedRoot, `${folder}/${studyFile}`, 'held-folder', warnings)
    if (loaded) out.push(loaded)
  }

  return { executionRoot: trimmedRoot, records: out, warnings }
}
