// Low-level reader for macOS Apple Screen Time's local store (knowledgeC.db).
//
// The DB carries every per-app focus event, web visit, lock/unlock, etc.
// macOS keeps only the last ~28 days — anything older is auto-purged. We mirror
// the streams we care about into the vault (see appleScreenTimeDumperBlock)
// so history survives past the cliff. This block is the lowest layer: query
// a single stream for events newer than a Z_PK cursor.
//
// Requires Full Disk Access for Thinking Space (the DB is TCC-protected).
// When FDA isn't granted, sqlite3 returns "authorization denied"; we surface
// that as `needsFullDiskAccess` so the caller can prompt the user. Read-only
// (`?immutable=1`) so we never touch the live DB.

import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const KNOWLEDGE_DB = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'Knowledge',
  'knowledgeC.db',
);

// macOS Cocoa absolute time epoch: 2001-01-01 00:00:00 UTC. DB stores
// ZSTARTDATE/ZENDDATE as seconds since this epoch; convert by adding
// 978307200 to get Unix-epoch seconds.
const COCOA_EPOCH_OFFSET_SEC = 978307200;

/** One ZOBJECT row from the DB, normalized to epoch-ms timestamps. */
export interface AppleScreenTimeEvent {
  /** Primary key — auto-increment, never reused. Used as the dedup/cursor key. */
  zpk: number;
  /** ZSTREAMNAME — e.g. "/app/usage", "/safari/history". */
  stream: string;
  /** Event start, epoch ms (UTC). */
  startMs: number;
  /** Event end, epoch ms (UTC). Equal to startMs for instantaneous events. */
  endMs: number;
  /** ZVALUESTRING — usually the bundle id for app streams; URL for /safari/history. */
  valueString: string | null;
  /** ZVALUEINTEGER — numeric payload for streams that use it. */
  valueInteger: number | null;
  /** ZVALUEDOUBLE — float payload for streams that use it (battery percent, etc.). */
  valueDouble: number | null;
  /** When the OS captured the event, epoch ms. */
  creationMs: number;
}

export interface AppleScreenTimeReadResult {
  events: AppleScreenTimeEvent[];
  /** True when the Knowledge DB exists but FDA isn't granted (TCC denied). */
  needsFullDiskAccess: boolean;
  /** True when knowledgeC.db isn't on disk at all (non-macOS, fresh install). */
  unavailable: boolean;
}

/** Does the Knowledge DB exist on disk? */
export function appleScreenTimeAvailableBlock(): boolean {
  try {
    return fs.existsSync(KNOWLEDGE_DB);
  } catch {
    return false;
  }
}

export interface ReadStreamOptions {
  /** Only return rows with Z_PK strictly greater than this. 0 = all. */
  sinceZpk?: number;
  /** When set, restrict to rows whose ZVALUESTRING equals this (e.g. bundle id). */
  valueString?: string;
  /** Optional row cap — primarily for tests/debug. */
  limit?: number;
}

/**
 * Read events from one ZSTREAMNAME, newer than the given Z_PK cursor.
 *
 * Z_PK is monotonic, so passing the max Z_PK already persisted makes the
 * subsequent run O(new rows). Returns events in ascending Z_PK order so the
 * caller can persist them in insertion order.
 */
export async function readStreamBlock(
  stream: string,
  opts: ReadStreamOptions = {},
): Promise<AppleScreenTimeReadResult> {
  if (!appleScreenTimeAvailableBlock()) {
    return { events: [], needsFullDiskAccess: false, unavailable: true };
  }
  // Stream names live in code (caller-supplied) but never come from user
  // input, so we still single-quote-escape defensively.
  const safeStream = stream.replace(/'/g, "''");
  const where: string[] = [`ZSTREAMNAME = '${safeStream}'`];
  if (typeof opts.sinceZpk === 'number' && opts.sinceZpk > 0) {
    where.push(`Z_PK > ${Math.floor(opts.sinceZpk)}`);
  }
  if (typeof opts.valueString === 'string' && opts.valueString) {
    const safeValue = opts.valueString.replace(/'/g, "''");
    where.push(`ZVALUESTRING = '${safeValue}'`);
  }
  const limitClause = typeof opts.limit === 'number' && opts.limit > 0
    ? ` LIMIT ${Math.floor(opts.limit)}`
    : '';
  const sql =
    `SELECT Z_PK, ZSTREAMNAME, ZSTARTDATE, ZENDDATE, ZVALUESTRING, ` +
    `ZVALUEINTEGER, ZVALUEDOUBLE, ZCREATIONDATE FROM ZOBJECT ` +
    `WHERE ${where.join(' AND ')} ORDER BY Z_PK ASC${limitClause};`;
  let stdout: string;
  try {
    const res = await execFileAsync(
      'sqlite3',
      ['-readonly', '-separator', '\x1f', `file:${KNOWLEDGE_DB}?immutable=1`, sql],
      { maxBuffer: 64 * 1024 * 1024 },
    );
    stdout = res.stdout;
  } catch (err) {
    const msg = (err as { stderr?: string; message?: string }).stderr
      ?? (err as Error).message ?? '';
    if (/authorization denied|operation not permitted|unable to open database/i.test(msg)) {
      return { events: [], needsFullDiskAccess: true, unavailable: false };
    }
    return { events: [], needsFullDiskAccess: false, unavailable: false };
  }

  const events: AppleScreenTimeEvent[] = [];
  for (const line of stdout.split('\n')) {
    if (!line) continue;
    const cols = line.split('\x1f');
    if (cols.length < 8) continue;
    const zpk = parseInt(cols[0], 10);
    if (!Number.isFinite(zpk)) continue;
    const startCocoa = parseFloat(cols[2]);
    const endCocoa = parseFloat(cols[3]);
    const creationCocoa = parseFloat(cols[7]);
    events.push({
      zpk,
      stream: cols[1],
      startMs: Number.isFinite(startCocoa)
        ? Math.round((startCocoa + COCOA_EPOCH_OFFSET_SEC) * 1000)
        : 0,
      endMs: Number.isFinite(endCocoa)
        ? Math.round((endCocoa + COCOA_EPOCH_OFFSET_SEC) * 1000)
        : 0,
      valueString: cols[4] || null,
      valueInteger: cols[5] ? parseInt(cols[5], 10) : null,
      valueDouble: cols[6] ? parseFloat(cols[6]) : null,
      creationMs: Number.isFinite(creationCocoa)
        ? Math.round((creationCocoa + COCOA_EPOCH_OFFSET_SEC) * 1000)
        : 0,
    });
  }
  return { events, needsFullDiskAccess: false, unavailable: false };
}
