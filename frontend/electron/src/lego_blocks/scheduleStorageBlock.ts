import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export type ScheduleSessionModeBlock = 'new' | 'continue' | 'resume';

export type ScheduleExecutionBlock =
  | {
      kind: 'shell';
      command: string;
      args: string[];
      env?: Record<string, string>;
      cwd?: string | null;
    }
  | {
      kind: 'claude-code';
      prompt: string;
      cwd: string;
      session?: {
        mode: ScheduleSessionModeBlock;
        id?: string | null;
      };
      model?: string | null;
      skipPermissions?: boolean;
      claudeBinary?: string | null;
      env?: Record<string, string>;
      // When true and the run completes successfully with a captured
      // sessionId, the scheduler auto-opens a Telegram conversation pinned
      // to that sessionId. The poller then resumes this session on user
      // replies. See telegramConversationBlock.ts for state schema.
      telegramConversation?: boolean;
    };

export type ScheduleTriggerBlock =
  | {
      kind: 'calendar';
      entries: Array<{ hour: number; minute: number; weekday?: number }>;
    }
  | {
      kind: 'interval';
      seconds: number;
    }
  | {
      kind: 'window';
      // Window jobs spawn at `start` and are SIGTERM'd at `stop`. Both times
      // fire on the listed weekdays (launchd weekday numbers: 0/7 = Sunday,
      // 1..6 = Mon..Sat). Empty/missing weekdays means every day.
      start: { hour: number; minute: number };
      stop: { hour: number; minute: number };
      weekdays?: number[];
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
  if (v.kind === 'shell') {
    if (typeof v.command !== 'string' || !v.command.trim()) return false;
    if (!Array.isArray(v.args) || !v.args.every((a) => typeof a === 'string')) return false;
    return true;
  }
  if (v.kind === 'claude-code') {
    if (typeof v.prompt !== 'string' || !v.prompt.trim()) return false;
    if (typeof v.cwd !== 'string' || !v.cwd.trim()) return false;
    if (v.session !== undefined) {
      if (!v.session || typeof v.session !== 'object') return false;
      const s = v.session as Record<string, unknown>;
      if (s.mode !== 'new' && s.mode !== 'continue' && s.mode !== 'resume') return false;
      if (s.mode === 'resume' && (typeof s.id !== 'string' || !s.id.trim())) return false;
    }
    return true;
  }
  return false;
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
  if (v.kind === 'window') {
    const isTime = (x: unknown): x is { hour: number; minute: number } => {
      if (!x || typeof x !== 'object') return false;
      const t = x as Record<string, unknown>;
      return (
        typeof t.hour === 'number' && t.hour >= 0 && t.hour <= 23 &&
        typeof t.minute === 'number' && t.minute >= 0 && t.minute <= 59
      );
    };
    if (!isTime(v.start) || !isTime(v.stop)) return false;
    if (v.weekdays !== undefined) {
      if (!Array.isArray(v.weekdays)) return false;
      if (!v.weekdays.every((d) => typeof d === 'number' && d >= 0 && d <= 7)) return false;
    }
    return true;
  }
  return false;
}

export function sanitizeScheduleSpecBlock(raw: unknown): ScheduleSpecBlock | null {
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
    return sanitizeScheduleSpecBlock(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeScheduleBlock(spec: ScheduleSpecBlock): ScheduleSpecBlock {
  const sanitized = sanitizeScheduleSpecBlock({ ...spec, updatedAt: new Date().toISOString() });
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
