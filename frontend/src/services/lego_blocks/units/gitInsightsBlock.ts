// TypeScript port of backend/app/tools/git_insights.py
// Desktop-only — uses Electron IPC to run git commands via child_process.

// ── Helpers ──

async function runGit(vaultRoot: string, args: string[]): Promise<string> {
  if (!window.electronAPI?.git) {
    throw new Error('Git is only available on desktop')
  }
  return window.electronAPI.git(vaultRoot, args)
}

function dateRangeStart(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - (days - 1))
  return d.toISOString().slice(0, 10)
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function weekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1 // Monday = 0
  d.setDate(d.getDate() - diff)
  return d.toISOString().slice(0, 10)
}

function parseNumstat(lines: string[]): [number, number] {
  let additions = 0
  let deletions = 0
  for (const line of lines) {
    const parts = line.split('\t')
    if (parts.length < 3) continue
    const add = parseInt(parts[0], 10)
    const del = parseInt(parts[1], 10)
    if (!isNaN(add)) additions += add
    if (!isNaN(del)) deletions += del
  }
  return [additions, deletions]
}

// ── Individual insight functions ──

async function getPulse(vaultRoot: string, days: number) {
  const since = dateRangeStart(days)
  const log = await runGit(vaultRoot, ['log', `--since=${since}`, '--numstat', '--pretty=%H'])
  let commits = 0
  const filesChanged = new Set<string>()
  let addTotal = 0
  let delTotal = 0
  let currentNumstat: string[] = []

  for (const line of log.split('\n')) {
    if (!line.trim()) continue
    if (line.trim().length === 40 && !/\t/.test(line)) {
      if (currentNumstat.length > 0) {
        const [a, d] = parseNumstat(currentNumstat)
        addTotal += a
        delTotal += d
        currentNumstat = []
      }
      commits++
      continue
    }
    if (line.includes('\t')) {
      currentNumstat.push(line)
      const parts = line.split('\t')
      if (parts.length >= 3) filesChanged.add(parts[2])
    }
  }
  if (currentNumstat.length > 0) {
    const [a, d] = parseNumstat(currentNumstat)
    addTotal += a
    delTotal += d
  }

  const authors = await runGit(vaultRoot, ['log', `--since=${since}`, '--format=%an'])
  const uniqueAuthors = new Set(authors.split('\n').map(a => a.trim()).filter(Boolean)).size

  return {
    days,
    commits,
    authors: uniqueAuthors,
    files_changed: filesChanged.size,
    additions: addTotal,
    deletions: delTotal,
  }
}

async function getContributors(vaultRoot: string, days: number) {
  const since = dateRangeStart(days)
  const shortlog = await runGit(vaultRoot, ['shortlog', '-s', '-n', `--since=${since}`])
  const contributors: Array<{ name: string; commits: number }> = []
  for (const line of shortlog.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const parts = trimmed.split('\t')
    if (parts.length !== 2) continue
    const count = parseInt(parts[0].trim(), 10)
    if (!isNaN(count)) {
      contributors.push({ name: parts[1].trim(), commits: count })
    }
  }
  return contributors
}

async function getWeeklyCommits(vaultRoot: string, days: number) {
  const since = dateRangeStart(days)
  const raw = await runGit(vaultRoot, ['log', `--since=${since}`, '--date=short', '--pretty=%ad'])
  const counts: Record<string, number> = {}
  for (const line of raw.split('\n')) {
    const d = line.trim()
    if (!d) continue
    const wk = weekStart(d)
    counts[wk] = (counts[wk] || 0) + 1
  }

  // Build ordered range
  const start = weekStart(dateRangeStart(days))
  const end = weekStart(todayStr())
  const weeks: Array<{ week_start: string; count: number }> = []
  let cur = start
  while (cur <= end) {
    weeks.push({ week_start: cur, count: counts[cur] || 0 })
    const d = new Date(cur + 'T00:00:00')
    d.setDate(d.getDate() + 7)
    cur = d.toISOString().slice(0, 10)
  }
  return weeks
}

async function getCodeFrequency(vaultRoot: string, days: number) {
  const since = dateRangeStart(days)
  const raw = await runGit(vaultRoot, ['log', `--since=${since}`, '--numstat', '--date=short', '--pretty=---%ad'])

  const weekly: Record<string, { additions: number; deletions: number }> = {}
  let currentDate: string | null = null
  let currentNumstat: string[] = []

  function flush() {
    if (!currentDate) return
    const [adds, dels] = parseNumstat(currentNumstat)
    const wk = weekStart(currentDate)
    if (!weekly[wk]) weekly[wk] = { additions: 0, deletions: 0 }
    weekly[wk].additions += adds
    weekly[wk].deletions += dels
    currentNumstat = []
  }

  for (const line of raw.split('\n')) {
    if (line.startsWith('---')) {
      flush()
      currentDate = line.replace('---', '').trim()
      continue
    }
    if (line.includes('\t')) {
      currentNumstat.push(line)
    }
  }
  flush()

  const start = weekStart(dateRangeStart(days))
  const end = weekStart(todayStr())
  const weeks: Array<{ week_start: string; additions: number; deletions: number }> = []
  let cur = start
  while (cur <= end) {
    const data = weekly[cur] || { additions: 0, deletions: 0 }
    weeks.push({ week_start: cur, ...data })
    const d = new Date(cur + 'T00:00:00')
    d.setDate(d.getDate() + 7)
    cur = d.toISOString().slice(0, 10)
  }
  return weeks
}

async function getActivityHeatmap(vaultRoot: string, days: number) {
  const since = dateRangeStart(days)
  const raw = await runGit(vaultRoot, ['log', `--since=${since}`, '--date=short', '--pretty=%ad'])
  const counts: Record<string, number> = {}
  for (const line of raw.split('\n')) {
    const d = line.trim()
    if (!d) continue
    counts[d] = (counts[d] || 0) + 1
  }

  const startDate = dateRangeStart(days)
  const endDate = todayStr()
  const daily: Array<{ date: string; count: number }> = []
  let cur = startDate
  while (cur <= endDate) {
    daily.push({ date: cur, count: counts[cur] || 0 })
    const d = new Date(cur + 'T00:00:00')
    d.setDate(d.getDate() + 1)
    cur = d.toISOString().slice(0, 10)
  }

  return { start_date: startDate, end_date: endDate, daily }
}

async function getChangeBreakdown(vaultRoot: string, days: number) {
  const since = dateRangeStart(days)
  const raw = await runGit(vaultRoot, ['log', `--since=${since}`, '--name-status', '--pretty=%H'])
  const statusCounts = { A: 0, M: 0, D: 0, R: 0 } as { A: number; M: number; D: number; R: number }
  const fileEdits: Record<string, number> = {}

  for (const line of raw.split('\n')) {
    if (!line.includes('\t')) continue
    const parts = line.split('\t')
    const status = parts[0]
    if (status.startsWith('R') && parts.length >= 3) {
      statusCounts.R++
      fileEdits[parts[2]] = (fileEdits[parts[2]] || 0) + 1
    } else if (status && parts.length >= 2) {
      const key = status[0] as keyof typeof statusCounts
      if (key in statusCounts) {
        statusCounts[key]++
        fileEdits[parts[1]] = (fileEdits[parts[1]] || 0) + 1
      }
    }
  }

  return { status_counts: statusCounts, unique_files: Object.keys(fileEdits).length, file_edits: fileEdits }
}

async function getTopFiles(vaultRoot: string, days: number, limit = 10) {
  const since = dateRangeStart(days)
  const raw = await runGit(vaultRoot, ['log', `--since=${since}`, '--numstat', '--pretty=%H'])
  const fileStats: Record<string, { edits: number; additions: number; deletions: number }> = {}

  for (const line of raw.split('\n')) {
    if (!line.includes('\t')) continue
    const parts = line.split('\t')
    if (parts.length < 3) continue
    const [add, del, path] = parts
    if (!fileStats[path]) fileStats[path] = { edits: 0, additions: 0, deletions: 0 }
    fileStats[path].edits++
    const addNum = parseInt(add, 10)
    const delNum = parseInt(del, 10)
    if (!isNaN(addNum)) fileStats[path].additions += addNum
    if (!isNaN(delNum)) fileStats[path].deletions += delNum
  }

  return Object.entries(fileStats)
    .map(([file, stats]) => ({ file, ...stats }))
    .sort((a, b) => b.edits - a.edits)
    .slice(0, limit)
}

async function getRangeAdditionsDeletions(vaultRoot: string, days: number): Promise<[number, number]> {
  const since = dateRangeStart(days)
  const raw = await runGit(vaultRoot, ['log', `--since=${since}`, '--numstat', '--pretty=%H'])
  let addTotal = 0
  let delTotal = 0
  for (const line of raw.split('\n')) {
    if (!line.includes('\t')) continue
    const [add, del] = line.split('\t')
    const addNum = parseInt(add, 10)
    const delNum = parseInt(del, 10)
    if (!isNaN(addNum)) addTotal += addNum
    if (!isNaN(delNum)) delTotal += delNum
  }
  return [addTotal, delTotal]
}

async function getTimeDistribution(vaultRoot: string, days: number) {
  const since = dateRangeStart(days)
  const raw = await runGit(vaultRoot, ['log', `--since=${since}`, '--date=iso-strict', '--pretty=%ad'])
  const dayCounts: number[] = Array(7).fill(0)
  const hourCounts: number[] = Array(24).fill(0)
  const timeBuckets = {
    night: Array(7).fill(0) as number[],
    morning: Array(7).fill(0) as number[],
    afternoon: Array(7).fill(0) as number[],
    evening: Array(7).fill(0) as number[],
  }

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const dt = new Date(trimmed)
    if (isNaN(dt.getTime())) continue
    const weekday = (dt.getDay() + 6) % 7 // Monday = 0
    const hour = dt.getHours()
    dayCounts[weekday]++
    hourCounts[hour]++
    if (hour <= 4) timeBuckets['night'][weekday]++
    else if (hour <= 11) timeBuckets['morning'][weekday]++
    else if (hour <= 17) timeBuckets['afternoon'][weekday]++
    else timeBuckets['evening'][weekday]++
  }

  const mostActiveDay = dayCounts.indexOf(Math.max(...dayCounts))
  const mostActiveHour = hourCounts.indexOf(Math.max(...hourCounts))

  return {
    by_day: dayCounts,
    by_hour: hourCounts,
    most_active_day: mostActiveDay,
    most_active_hour: mostActiveHour,
    time_buckets: timeBuckets,
  }
}

// ── Main function ──

export async function getGitInsightsLocal(vaultRoot: string, days = 365) {
  // Verify it's a git repo
  await runGit(vaultRoot, ['rev-parse', '--is-inside-work-tree'])

  const breakdown = await getChangeBreakdown(vaultRoot, days)
  const timeDist = await getTimeDistribution(vaultRoot, days)
  const weekly = await getWeeklyCommits(vaultRoot, days)
  const [additions, deletions] = await getRangeAdditionsDeletions(vaultRoot, days)

  return {
    range_days: days,
    summary: {
      total_commits: weekly.reduce((s, w) => s + w.count, 0),
      unique_files: breakdown.unique_files,
      additions,
      deletions,
      net_change: additions - deletions,
    },
    pulse: await getPulse(vaultRoot, Math.min(7, days)),
    contributors: await getContributors(vaultRoot, days),
    weekly_commits: weekly,
    code_frequency: await getCodeFrequency(vaultRoot, days),
    heatmap: await getActivityHeatmap(vaultRoot, days),
    event_breakdown: breakdown.status_counts,
    top_files: await getTopFiles(vaultRoot, days, 10),
    time_distribution: timeDist,
  }
}
