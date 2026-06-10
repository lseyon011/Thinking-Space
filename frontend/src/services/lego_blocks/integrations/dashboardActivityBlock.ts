import type { VaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import {
  getNodesByMetadataKey,
  getNodesByRecordKind,
} from '@/services/lego_blocks/integrations/dbBlock'
import { normalizeMemorizedSessions } from '@/services/lego_blocks/units/memorizedSessionsBlock'

export interface DashboardDay {
  date: string
  files_modified: number
  insights_logged: number
  memorized_sessions: number
}

export interface RecentInsightHighlight {
  date: string
  text: string
  filePath: string
}

export interface RecentMemorizedHighlight {
  date: string
  title: string
  filePath: string
}

export interface DashboardHighlights {
  mostRecentInsight: RecentInsightHighlight | null
  mostRecentMemorized: RecentMemorizedHighlight | null
  todayInsightsCount: number
  todayMemorizedCount: number
}

export interface DashboardSeries {
  days: DashboardDay[]
  totals: {
    files_modified: number
    insights_logged: number
    memorized_sessions: number
  }
  highlights: DashboardHighlights
}

const IGNORE_PATH_PREFIXES = ['.git/', '.obsidian/', 'node_modules/']

function isoDay(ts: number): string {
  const d = new Date(ts * 1000)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysBetween(startIso: string, endIso: string): string[] {
  const out: string[] = []
  const start = new Date(startIso + 'T00:00:00')
  const end = new Date(endIso + 'T00:00:00')
  const cur = new Date(start)
  while (cur <= end) {
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    const d = String(cur.getDate()).padStart(2, '0')
    out.push(`${y}-${m}-${d}`)
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

let _cache: { ts: number; series: DashboardSeries; startIso: string; endIso: string } | null = null
const CACHE_TTL_MS = 90_000

export function clearDashboardActivityCache(): void {
  _cache = null
}

export async function getDashboardActivity(
  fs: VaultFS,
  startIso: string,
  endIso: string,
): Promise<DashboardSeries> {
  const now = Date.now()
  if (
    _cache
    && _cache.startIso === startIso
    && _cache.endIso === endIso
    && now - _cache.ts < CACHE_TTL_MS
  ) {
    return _cache.series
  }

  const range = daysBetween(startIso, endIso)
  const inRange = new Set(range)

  const filesByDate = new Map<string, number>()
  const insightsByDate = new Map<string, number>()
  const memorizedByDate = new Map<string, number>()

  // 1) Files modified per day (walk vault by mtime). Same approach as fileActivityBlock,
  //    but counts a file under its mtime day regardless of ctime.
  const entries = await fs.walkVault(['.md'])
  for (const entry of entries) {
    if (IGNORE_PATH_PREFIXES.some((p) => entry.path.startsWith(p))) continue
    const day = isoDay(entry.mtime)
    if (!inRange.has(day)) continue
    filesByDate.set(day, (filesByDate.get(day) ?? 0) + 1)
  }

  // 2) Insights per day — indexed by record_kind. Use the `date` field on the note
  //    frontmatter (stored in metadata.date), falling back to filename pattern.
  //    Also track the most-recent insight string (all-time) for the Day Summary card.
  const today = endIso
  let mostRecentInsight: RecentInsightHighlight | null = null
  let mostRecentInsightDate: string | null = null
  let todayInsightsCount = 0
  const insightNodes = await getNodesByRecordKind('insight')
  for (const node of insightNodes) {
    const metaDate = typeof node.metadata?.date === 'string' ? (node.metadata.date as string) : null
    let day = metaDate
    if (!day) {
      const m = node.filePath.match(/(\d{4}-\d{2}-\d{2})-insights\.md$/)
      day = m?.[1] ?? null
    }
    if (!day) continue
    if (inRange.has(day)) {
      insightsByDate.set(day, (insightsByDate.get(day) ?? 0) + 1)
    }
    const items = Array.isArray(node.metadata?.insights)
      ? (node.metadata!.insights as unknown[]).filter(
          (v): v is string => typeof v === 'string' && v.trim().length > 0,
        )
      : []
    if (day === today) todayInsightsCount += items.length
    if (items.length > 0 && (!mostRecentInsightDate || day > mostRecentInsightDate)) {
      mostRecentInsightDate = day
      mostRecentInsight = {
        date: day,
        text: items[items.length - 1],
        filePath: node.filePath,
      }
    }
  }

  // 3) Memorization sessions per day — any note that has memorized_sessions YAML
  //    contributes one count per listed date. Also surface the most-recent
  //    memorized note (all-time) for the Day Summary card.
  let mostRecentMemorized: RecentMemorizedHighlight | null = null
  let mostRecentMemorizedDate: string | null = null
  let todayMemorizedCount = 0
  const memorizedNodes = await getNodesByMetadataKey('memorized_sessions')
  for (const node of memorizedNodes) {
    const sessions = normalizeMemorizedSessions(node.metadata?.memorized_sessions)
    for (const session of sessions) {
      const date = session.date
      if (inRange.has(date)) {
        memorizedByDate.set(date, (memorizedByDate.get(date) ?? 0) + 1)
      }
      if (date === today) todayMemorizedCount += 1
      if (!mostRecentMemorizedDate || date > mostRecentMemorizedDate) {
        mostRecentMemorizedDate = date
        mostRecentMemorized = {
          date,
          title: node.title || node.filePath,
          filePath: node.filePath,
        }
      }
    }
  }

  const days: DashboardDay[] = range.map((date) => ({
    date,
    files_modified: filesByDate.get(date) ?? 0,
    insights_logged: insightsByDate.get(date) ?? 0,
    memorized_sessions: memorizedByDate.get(date) ?? 0,
  }))

  const totals = days.reduce(
    (acc, d) => {
      acc.files_modified += d.files_modified
      acc.insights_logged += d.insights_logged
      acc.memorized_sessions += d.memorized_sessions
      return acc
    },
    { files_modified: 0, insights_logged: 0, memorized_sessions: 0 },
  )

  const highlights: DashboardHighlights = {
    mostRecentInsight,
    mostRecentMemorized,
    todayInsightsCount,
    todayMemorizedCount,
  }

  const series: DashboardSeries = { days, totals, highlights }
  _cache = { ts: now, series, startIso, endIso }
  return series
}
