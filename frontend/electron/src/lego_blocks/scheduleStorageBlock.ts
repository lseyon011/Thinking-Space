import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export type ScheduleExecutionBlock =
  | {
      kind: 'shell';
      command: string;
      args: string[];
      env?: Record<string, string>;
      cwd?: string | null;
    };

export type ScheduleTriggerBlock =
  | {
      kind: 'calendar';
      entries: Array<{ hour: number; minute: number; weekday?: number }>;
    }
  | {
      kind: 'interval';
      seconds: number;
    };

export type ScheduleManagedByBlock = 'thinking-space' | 'external';

export interface ScheduleSpecBlock {
  key: string;
  label: string;
  title: string;
  description?: string;
  enabled: boolean;
  execution: ScheduleExecutionBlock;
  schedule: ScheduleTriggerBlock;
  managedBy: ScheduleManagedByBlock;
  createdAt: string;
  updatedAt: string;
}

const SCHEDULE_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

function getSchedulesDirBlock(): string {
  return path.join(app.getPath('userData'), 'state', 'schedules');
}

function getScheduleFilePathBlock(key: string): string {
  if (!SCHEDULE_KEY_PATTERN.test(key)) {
    throw new Error(`Invalid schedule key: ${key}`);
  }
  return path.join(getSchedulesDirBlock(), `${key}.json`);
}

function isValidExecution(value: unknown): value is ScheduleExecutionBlock {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.kind !== 'shell') return false;
  if (typeof v.command !== 'string' || !v.command.trim()) return false;
  if (!Array.isArray(v.args) || !v.args.every((a) => typeof a === 'string')) return false;
  return true;
}

function isValidSchedule(value: unknown): value is ScheduleTriggerBlock {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.kind === 'calendar') {
    if (!Array.isArray(v.entries) || v.entries.length === 0) return false;
    return v.entries.every((entry) => {
      if (!entry || typeof entry !== 'object') return false;
      const e = entry as Record<string, unknown>;
      return (
        typeof e.hour === 'number' &&
        e.hour >= 0 &&
        e.hour <= 23 &&
        typeof e.minute === 'number' &&
        e.minute >= 0 &&
        e.minute <= 59 &&
        (e.weekday === undefined || (typeof e.weekday === 'number' && e.weekday >= 0 && e.weekday <= 7))
      );
    });
  }
  if (v.kind === 'interval') {
    return typeof v.seconds === 'number' && v.seconds > 0;
  }
  return false;
}

function sanitizeSpec(raw: unknown): ScheduleSpecBlock | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.key !== 'string' || !SCHEDULE_KEY_PATTERN.test(r.key)) return null;
  if (typeof r.label !== 'string' || !r.label.trim()) return null;
  if (typeof r.title !== 'string') return null;
  if (!isValidExecution(r.execution)) return null;
  if (!isValidSchedule(r.schedule)) return null;
  const managedBy: ScheduleManagedByBlock = r.managedBy === 'external' ? 'external' : 'thinking-space';
  return {
    key: r.key,
    label: r.label.trim(),
    title: r.title,
    description: typeof r.description === 'string' ? r.description : undefined,
    enabled: r.enabled !== false,
    execution: r.execution,
    schedule: r.schedule,
    managedBy,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString(),
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : new Date().toISOString(),
  };
}

export function readScheduleBlock(key: string): ScheduleSpecBlock | null {
  try {
    const raw = fs.readFileSync(getScheduleFilePathBlock(key), 'utf-8');
    return sanitizeSpec(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeScheduleBlock(spec: ScheduleSpecBlock): ScheduleSpecBlock {
  const sanitized = sanitizeSpec({ ...spec, updatedAt: new Date().toISOString() });
  if (!sanitized) throw new Error('Invalid schedule spec');
  const filePath = getScheduleFilePathBlock(sanitized.key);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(sanitized, null, 2), { encoding: 'utf-8', mode: 0o600 });
  fs.renameSync(tempPath, filePath);
  return sanitized;
}

export function deleteScheduleBlock(key: string): boolean {
  try {
    fs.unlinkSync(getScheduleFilePathBlock(key));
    return true;
  } catch {
    return false;
  }
}

export function listSchedulesBlock(): ScheduleSpecBlock[] {
  const dir = getSchedulesDirBlock();
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const specs: ScheduleSpecBlock[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const key = entry.slice(0, -'.json'.length);
    if (!SCHEDULE_KEY_PATTERN.test(key)) continue;
    const spec = readScheduleBlock(key);
    if (spec) specs.push(spec);
  }
  return specs.sort((a, b) => a.key.localeCompare(b.key));
}
