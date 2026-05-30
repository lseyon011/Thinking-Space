// Cross-device Home-page snapshot.
//
// Desktop (Electron) precomputes the heavy Home-page data (vault-wide
// dashboard series + today's file activity) after each sync and writes a
// small JSON file into the vault. iCloud propagates it to iPhone/iPad,
// which paint instantly from the snapshot instead of walking the vault.
//
// The snapshot is intentionally schema-versioned so we can evolve the
// payload without breaking older clients reading from the same vault.

import { getVaultFS, getPlatformName, type VaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import {
  clearDashboardActivityCache,
  getDashboardActivity,
  type DashboardSeries,
} from '@/services/lego_blocks/integrations/dashboardActivityBlock'
import { getDayActivity as scanDayActivity } from '@/services/lego_blocks/integrations/fileActivityBlock'
import { readFileActivityIgnoredPaths } from '@/services/orchestrators/fileActivityOrch'
import type { DayDetail } from '@/services/lego_blocks/units/typesBlock'

export const HOME_SNAPSHOT_PATH = '.thinking-space/home-snapshot.json'
export const HOME_SNAPSHOT_DIR = '.thinking-space'
export const HOME_SNAPSHOT_VERSION = 1

export interface HomeSnapshot {
  version: number
  generated_at: string
  generated_on: string
  /** ISO date (YYYY-MM-DD) the snapshot was generated for. */
  generated_for_date: string
  /** Full 365-day dashboard series — clients slice down to their preset. */
  dashboard_365d: DashboardSeries
  /** File activity for the day the snapshot was generated. */
  today: DayDetail
}

export async function loadHomeSnapshot(fs: VaultFS): Promise<HomeSnapshot | null> {
  try {
    if (!(await fs.exists(HOME_SNAPSHOT_PATH))) return null
    const raw = await fs.read(HOME_SNAPSHOT_PATH)
    const parsed = JSON.parse(raw) as HomeSnapshot
    if (!parsed || parsed.version !== HOME_SNAPSHOT_VERSION) return null
    if (!parsed.dashboard_365d || !parsed.today) return null
    return parsed
  } catch {
    return null
  }
}

export async function writeHomeSnapshot(
  fs: VaultFS,
  snapshot: HomeSnapshot,
): Promise<void> {
  await fs.mkdir(HOME_SNAPSHOT_DIR)
  await fs.write(HOME_SNAPSHOT_PATH, JSON.stringify(snapshot))
}

export function isHomeSnapshotFreshForToday(
  snapshot: HomeSnapshot | null,
  today: string,
): boolean {
  if (!snapshot) return false
  return snapshot.generated_for_date === today
}

function todayIsoLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isoOffsetDaysFromToday(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Compute and write the cross-device Home snapshot. Hard-gated to Electron —
 * iPhone/iPad/web are auxiliary readers and must not write the snapshot.
 * Returns true when a snapshot was written.
 */
export async function regenerateHomeSnapshot(): Promise<boolean> {
  const platform = getPlatformName()
  if (platform !== 'electron') return false

  const fs = getVaultFS()
  const today = todayIsoLocal()
  const start365 = isoOffsetDaysFromToday(364)

  // Force a fresh compute — bypass the in-memory dashboard cache so the
  // snapshot reflects whatever just landed during sync.
  clearDashboardActivityCache()

  const [dashboard365, todayDetail] = await Promise.all([
    getDashboardActivity(fs, start365, today),
    scanDayActivity(fs, today, readFileActivityIgnoredPaths()),
  ])

  const snapshot: HomeSnapshot = {
    version: HOME_SNAPSHOT_VERSION,
    generated_at: new Date().toISOString(),
    generated_on: platform,
    generated_for_date: today,
    dashboard_365d: dashboard365,
    today: todayDetail,
  }

  await writeHomeSnapshot(fs, snapshot)
  return true
}

/**
 * Carve a sub-range out of the 365-day snapshot series. Totals are
 * recomputed from the slice so the chart-card numbers match the chosen
 * preset, but `highlights` are left as-is — they reflect all-time
 * most-recent state and are not range-bounded.
 */
export function sliceDashboardSnapshotForRange(
  snapshot: HomeSnapshot,
  startIso: string,
  endIso: string,
): DashboardSeries {
  const start = startIso
  const end = endIso
  const days = snapshot.dashboard_365d.days.filter(
    (d) => d.date >= start && d.date <= end,
  )
  const totals = days.reduce(
    (acc, d) => {
      acc.files_modified += d.files_modified
      acc.insights_logged += d.insights_logged
      acc.memorized_sessions += d.memorized_sessions
      return acc
    },
    { files_modified: 0, insights_logged: 0, memorized_sessions: 0 },
  )
  return {
    days,
    totals,
    highlights: snapshot.dashboard_365d.highlights,
  }
}
