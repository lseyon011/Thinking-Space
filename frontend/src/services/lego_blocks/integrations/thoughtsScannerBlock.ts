// TypeScript port of backend/app/tools/thoughts_scanner.py
// Uses VaultFS abstraction — works on web (via backend) or Capacitor (local fs).

import type { VaultFS, ListedFiles } from '@/services/lego_blocks/integrations/fsBlock'
import { EXCLUDED_DIRS, DATE_FILENAME_RE, extractSection } from '@/services/lego_blocks/units/vaultConstantsBlock'

// ── Find thought folders ──

async function findThoughtFolders(fs: VaultFS): Promise<string[]> {
  const results: string[] = []

  async function walk(dir: string, relPrefix: string) {
    let listed: ListedFiles
    try {
      listed = await fs.list(dir)
    } catch {
      return
    }
    for (const name of listed.folders) {
      if (EXCLUDED_DIRS.has(name) || name.startsWith('.')) continue

      const relPath = relPrefix ? `${relPrefix}/${name}` : name
      const fullPath = dir ? `${dir}/${name}` : name

      if (name === 'thoughts') {
        results.push(relPath)
      }
      await walk(fullPath, relPath)
    }
  }

  await walk('', '')
  return results.sort()
}

// ── Get thoughts for a month ──

export async function getThoughtsMonth(
  fs: VaultFS,
  year: number,
  month: number,
) {
  const thoughtFolders = await findThoughtFolders(fs)

  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = month === 12 ? new Date(year + 1, 0, 1) : new Date(year, month, 1)

  const dayTotals: Record<string, { total: number; done: number; pending: number }> = {}
  const sectionTotals: Record<string, { total: number; done: number; pending: number }> = {}
  const sectionDays: Record<string, Record<string, { total: number; done: number; pending: number }>> = {}

  for (const folderRel of thoughtFolders) {
    const section = extractSection(folderRel)

    let listed: ListedFiles
    try {
      listed = await fs.list(folderRel)
    } catch {
      continue
    }

    for (const fileName of listed.files) {
      if (!DATE_FILENAME_RE.test(fileName)) continue

      const dateStr = fileName.replace('.md', '')
      const fileDate = new Date(dateStr + 'T00:00:00')
      if (isNaN(fileDate.getTime())) continue
      if (fileDate < monthStart || fileDate >= monthEnd) continue

      // Thoughts just count files, no content parsing
      const total = 1
      const done = 0
      const pending = 1
      const dateKey = dateStr

      if (!dayTotals[dateKey]) dayTotals[dateKey] = { total: 0, done: 0, pending: 0 }
      dayTotals[dateKey].total += total
      dayTotals[dateKey].done += done
      dayTotals[dateKey].pending += pending

      if (!sectionTotals[section]) sectionTotals[section] = { total: 0, done: 0, pending: 0 }
      sectionTotals[section].total += total
      sectionTotals[section].done += done
      sectionTotals[section].pending += pending

      if (!sectionDays[section]) sectionDays[section] = {}
      if (!sectionDays[section][dateKey]) sectionDays[section][dateKey] = { total: 0, done: 0, pending: 0 }
      sectionDays[section][dateKey].total += total
      sectionDays[section][dateKey].done += done
      sectionDays[section][dateKey].pending += pending
    }
  }

  const days: Array<{ date: string; total: number; done: number; pending: number }> = []
  const cur = new Date(monthStart)
  while (cur < monthEnd) {
    const key = cur.toISOString().slice(0, 10)
    const d = dayTotals[key] ?? { total: 0, done: 0, pending: 0 }
    days.push({ date: key, ...d })
    cur.setDate(cur.getDate() + 1)
  }

  const sections = Object.entries(sectionTotals)
    .map(([name, counts]) => ({ name, ...counts }))
    .sort((a, b) => b.total - a.total)

  const sectionDaysOut: Record<string, Array<{ date: string; total: number; done: number; pending: number }>> = {}
  for (const [s, dateMap] of Object.entries(sectionDays)) {
    sectionDaysOut[s] = Object.entries(dateMap)
      .map(([d, counts]) => ({ date: d, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  const grandTotal = days.reduce((s, d) => s + d.total, 0)
  const grandDone = days.reduce((s, d) => s + d.done, 0)
  const grandPending = days.reduce((s, d) => s + d.pending, 0)

  return {
    year,
    month,
    days,
    total: grandTotal,
    done: grandDone,
    pending: grandPending,
    sections,
    section_days: sectionDaysOut,
  }
}

// ── Get thoughts for specific sections in a month ──

export async function getThoughtsSectionMonth(
  fs: VaultFS,
  year: number,
  month: number,
  targetSections: string[],
) {
  const thoughtFolders = await findThoughtFolders(fs)
  const sectionSet = new Set(targetSections)

  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = month === 12 ? new Date(year + 1, 0, 1) : new Date(year, month, 1)

  const byDate: Record<string, Array<{
    text: string; checked: boolean; line: number; file: string; section: string
  }>> = {}

  for (const folderRel of thoughtFolders) {
    const section = extractSection(folderRel)
    if (!sectionSet.has(section)) continue

    let listed: ListedFiles
    try {
      listed = await fs.list(folderRel)
    } catch {
      continue
    }

    for (const fileName of listed.files) {
      if (!DATE_FILENAME_RE.test(fileName)) continue

      const dateStr = fileName.replace('.md', '')
      const fileDate = new Date(dateStr + 'T00:00:00')
      if (isNaN(fileDate.getTime())) continue
      if (fileDate < monthStart || fileDate >= monthEnd) continue

      const fileRel = `${folderRel}/${fileName}`
      if (!byDate[dateStr]) byDate[dateStr] = []
      byDate[dateStr].push({
        text: dateStr,
        checked: false,
        line: 1,
        file: fileRel,
        section,
      })
    }
  }

  const days = Object.entries(byDate)
    .map(([d, items]) => ({ date: d, items }))
    .sort((a, b) => b.date.localeCompare(a.date))

  return { sections: targetSections, days }
}
