import { execFile } from 'child_process';
import { promisify } from 'util';
import type { ScheduleSpecBlock } from './scheduleStorageBlock';

const execFileAsync = promisify(execFile);
const PMSET = '/usr/bin/pmset';

// Owner string used to tag wake events we created so we can find/cancel ours
// without disturbing events scheduled by other tools.
const OWNER_PREFIX = 'thinking-space:';

// How far ahead to keep the queue filled. 48h covers a weekend so the user
// can stay away from the machine without the queue emptying.
export const DEFAULT_PMSET_HORIZON_MS = 48 * 60 * 60 * 1000;

// Wake the Mac slightly before the launchd fire time so the system is fully
// up by the time launchd ticks. launchd's StartCalendarInterval will fire on
// its own once the system is awake.
const WAKE_LEAD_SECONDS = 60;

function ownerForLabel(label: string): string {
  return `${OWNER_PREFIX}${label}`;
}

function formatPmsetDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

export function computeUpcomingFireTimesBlock(
  spec: ScheduleSpecBlock,
  horizonMs: number,
  now: Date = new Date(),
): Date[] {
  if (spec.schedule.kind !== 'calendar') return [];
  const horizonEnd = now.getTime() + horizonMs;
  const result: Date[] = [];
  for (let dayOffset = 0; dayOffset < 60; dayOffset++) {
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() + dayOffset);
    if (dayStart.getTime() > horizonEnd) break;
    for (const entry of spec.schedule.entries) {
      if (typeof entry.weekday === 'number') {
        // launchd weekdays: 0/7 = Sunday, 1..6 = Mon..Sat. JS Date.getDay(): 0=Sun..6=Sat.
        const wd = entry.weekday === 7 ? 0 : entry.weekday;
        if (dayStart.getDay() !== wd) continue;
      }
      const fire = new Date(dayStart);
      fire.setHours(entry.hour, entry.minute, 0, 0);
      if (fire.getTime() <= now.getTime()) continue;
      if (fire.getTime() > horizonEnd) continue;
      result.push(fire);
    }
  }
  return result.sort((a, b) => a.getTime() - b.getTime());
}

export interface PmsetEntryBlock {
  date: Date;
  type: string;
  owner: string | null;
  raw: string;
}

export function parsePmsetSchedBlock(stdout: string): PmsetEntryBlock[] {
  const entries: PmsetEntryBlock[] = [];
  // Sample lines from `pmset -g sched`:
  //   [0]  wake at 05/29/2026 04:59:00 by 'thinking-space:com.foo'
  //    wake at 05/29/2026 04:59:00
  const lineRe = /(\bwake|\bpoweron|\bwakeorpoweron|\bshutdown|\bsleep|\brestart)\b\s+at\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})(?:\s+by\s+'([^']*)')?/;
  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trim();
    const m = lineRe.exec(line);
    if (!m) continue;
    const [, type, dateStr, owner] = m;
    const date = parsePmsetDateBlock(dateStr);
    if (!date) continue;
    entries.push({ date, type, owner: owner ?? null, raw: line });
  }
  return entries;
}

function parsePmsetDateBlock(s: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const [, mm, dd, yyyy, h, mi, ss] = m;
  return new Date(+yyyy, +mm - 1, +dd, +h, +mi, +ss);
}

async function listPmsetScheduleBlock(): Promise<PmsetEntryBlock[]> {
  try {
    const { stdout } = await execFileAsync(PMSET, ['-g', 'sched']);
    return parsePmsetSchedBlock(stdout);
  } catch (err) {
    console.warn('[pmset] list failed', err);
    return [];
  }
}

async function cancelEntryBlock(entry: PmsetEntryBlock): Promise<void> {
  const args = ['schedule', 'cancel', entry.type, formatPmsetDate(entry.date)];
  if (entry.owner) args.push(entry.owner);
  await execFileAsync(PMSET, args).catch((err) => {
    console.warn('[pmset] cancel failed', entry.raw, err?.message ?? err);
  });
}

export async function cancelPmsetWakesForLabelBlock(label: string): Promise<number> {
  const owner = ownerForLabel(label);
  const all = await listPmsetScheduleBlock();
  const ours = all.filter((e) => e.owner === owner);
  for (const entry of ours) {
    await cancelEntryBlock(entry);
  }
  return ours.length;
}

export interface PmsetArmResultBlock {
  label: string;
  canceled: number;
  scheduled: number;
  nextWake: Date | null;
  skipped: boolean;
}

export async function armPmsetWakesForScheduleBlock(
  spec: ScheduleSpecBlock,
  horizonMs: number = DEFAULT_PMSET_HORIZON_MS,
): Promise<PmsetArmResultBlock> {
  const canceled = await cancelPmsetWakesForLabelBlock(spec.label);
  if (!spec.enabled || spec.schedule.kind !== 'calendar') {
    return { label: spec.label, canceled, scheduled: 0, nextWake: null, skipped: true };
  }
  const owner = ownerForLabel(spec.label);
  const fires = computeUpcomingFireTimesBlock(spec, horizonMs);
  let scheduled = 0;
  let first: Date | null = null;
  for (const fire of fires) {
    const wakeAt = new Date(fire.getTime() - WAKE_LEAD_SECONDS * 1000);
    if (wakeAt.getTime() <= Date.now()) continue;
    try {
      await execFileAsync(PMSET, ['schedule', 'wake', formatPmsetDate(wakeAt), owner]);
      scheduled++;
      if (!first) first = wakeAt;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[pmset] schedule wake failed for', formatPmsetDate(wakeAt), msg);
    }
  }
  return { label: spec.label, canceled, scheduled, nextWake: first, skipped: false };
}

export async function armAllPmsetWakesBlock(specs: ScheduleSpecBlock[]): Promise<PmsetArmResultBlock[]> {
  const results: PmsetArmResultBlock[] = [];
  for (const spec of specs) {
    if (spec.managedBy !== 'thinking-space') continue;
    results.push(await armPmsetWakesForScheduleBlock(spec));
  }
  return results;
}
