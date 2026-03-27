import type { DayDetail, MonthData, SectionMonthData } from '@/services/lego_blocks/units/typesBlock'
import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import {
  getMonthActivity as scanMonthActivity,
  getDayActivity as scanDayActivity,
  getSectionMonthActivity as scanSectionMonthActivity,
} from '@/services/lego_blocks/integrations/fileActivityBlock'
import { getJsonStorageItem, setJsonStorageItem, STORAGE_KEYS } from '@/services/lego_blocks/units/storageKeyBlock'

// ── Ignored paths settings ──

export function readFileActivityIgnoredPaths(): string[] {
  const raw = getJsonStorageItem<string[]>(STORAGE_KEYS.fileActivityIgnoredPaths, [])
  if (!Array.isArray(raw)) return []
  return raw.filter(p => typeof p === 'string' && p.trim().length > 0).map(p => p.trim())
}

export function writeFileActivityIgnoredPaths(paths: string[]): void {
  const sanitized = paths.filter(p => typeof p === 'string' && p.trim().length > 0).map(p => p.trim())
  setJsonStorageItem(STORAGE_KEYS.fileActivityIgnoredPaths, sanitized)
}

// ── Activity data fetchers ──

export async function getMonthActivity(year: number, month: number, ignoredPaths?: string[]): Promise<MonthData> {
  const fs = getVaultFS()
  const ignored = ignoredPaths ?? readFileActivityIgnoredPaths()
  return scanMonthActivity(fs, year, month, ignored)
}

export async function getDayActivity(date: string, ignoredPaths?: string[]): Promise<DayDetail> {
  const fs = getVaultFS()
  const ignored = ignoredPaths ?? readFileActivityIgnoredPaths()
  return scanDayActivity(fs, date, ignored)
}

export async function getSectionMonthActivity(
  year: number,
  month: number,
  section: string,
  ignoredPaths?: string[],
): Promise<SectionMonthData> {
  const fs = getVaultFS()
  const ignored = ignoredPaths ?? readFileActivityIgnoredPaths()
  return scanSectionMonthActivity(fs, year, month, section, ignored)
}
