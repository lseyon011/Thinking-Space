// Attribute GoodNotes reading sessions from the Apple Screen Time mirror.
//
// Source of truth: the per-day `ai_raw/raw/apple_screen_time/app_usage/*.jsonl`
// files written by the Screen Time dumper. We filter to GoodNotes' bundle id,
// then for each focus session find the doc whose `document_meta.last_modified`
// (from GoodNotes' fts.sqlite) falls inside the focus window. The latest
// matching doc wins; sessions with no matching annotation are recorded under
// a synthetic "(reading — unattributed)" bucket so app-time stays visible
// without poisoning per-book stats.
//
// Output: `ai_raw/raw/goodnotes/reading.jsonl` — the same shape the AI
// Activity panel already consumes. Dumper drives the cliff-proof persistence;
// this block does pure transformation + dedup.
//
// Read-only against GoodNotes' fts.sqlite and the dumped JSONL. Only write
// target is the vault's reading.jsonl.

import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

import { appleScreenTimeAvailableBlock } from './appleScreenTimeBlock';

const execFileAsync = promisify(execFile);

const GOODNOTES_BUNDLE_ID = 'com.goodnotesapp.x';

const GOODNOTES_CONTAINER = path.join(
  os.homedir(),
  'Library',
  'Containers',
  'com.goodnotesapp.x',
  'Data',
);
const FTS_DB = path.join(GOODNOTES_CONTAINER, 'Library', 'Databases', 'fts.sqlite');

const APP_USAGE_DIR_REL = path.join('ai_raw', 'raw', 'apple_screen_time', 'app_usage');
const READING_LOG_RELPATH = path.join('ai_raw', 'raw', 'goodnotes', 'reading.jsonl');

const UNATTRIBUTED_DOC_ID = 'goodnotes-unattributed';
const UNATTRIBUTED_TITLE = '(reading — unattributed)';

/** A doc's last_modified within ±this many ms of a focus session is considered
 *  to have been annotated during that session. Covers clock drift between
 *  Screen Time's focus stamps and fts.sqlite's commit time. */
const ATTRIBUTION_GRACE_MS = 30_000;

/** Cap per-session duration so a forgotten-foreground window doesn't dwarf
 *  real reading. 90 min — Screen Time already splits on app-switch / lock /
 *  idle so longer is almost always background-pinned focus. */
const MAX_SESSION_MS = 90 * 60_000;

export interface GoodnotesReadingRecord {
  key: string;
  documentId: string;
  title: string;
  timeMs: number;
  durationMs: number;
  numPage: number;
  documentType: string;
  harvestedAt: number;
  docModifiedMs: number;
}

export interface GoodnotesHarvestResult {
  added: number;
  total: number;
  unavailable?: boolean;
  needsFullDiskAccess?: boolean;
}

export function goodnotesAvailableBlock(): boolean {
  try {
    return fs.existsSync(FTS_DB);
  } catch {
    return false;
  }
}

// ── fts.sqlite document metadata ────────────────────────────────────────────

interface DocMeta {
  documentId: string;
  name: string;
  /** last_modified as epoch ms (UTC). 0 when fts has the sentinel zero. */
  lastModifiedMs: number;
}

function parseFtsDateMs(s: string): number {
  const t = s.trim();
  if (!t || t.startsWith('1970-01-01')) return 0;
  const ms = Date.parse(`${t.replace(' ', 'T')}Z`);
  return Number.isFinite(ms) ? ms : 0;
}

async function readDocMetaBlock(): Promise<DocMeta[]> {
  const out: DocMeta[] = [];
  try {
    await fsPromises.access(FTS_DB);
  } catch {
    return out;
  }
  const sql =
    `SELECT document_id, COALESCE(name, ''), last_modified FROM document_meta ` +
    `WHERE is_deleted=0;`;
  try {
    const { stdout } = await execFileAsync(
      'sqlite3',
      ['-readonly', '-separator', '\x1f', `file:${FTS_DB}?immutable=1`, sql],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    for (const line of stdout.split('\n')) {
      if (!line) continue;
      const a = line.indexOf('\x1f');
      if (a === -1) continue;
      const b = line.indexOf('\x1f', a + 1);
      if (b === -1) continue;
      const documentId = line.slice(0, a);
      const name = line.slice(a + 1, b);
      if (!documentId) continue;
      out.push({
        documentId,
        name,
        lastModifiedMs: parseFtsDateMs(line.slice(b + 1)),
      });
    }
  } catch {
    // sqlite3 missing / DB locked.
  }
  return out;
}

async function readPageCountsBlock(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  try {
    await fsPromises.access(FTS_DB);
  } catch {
    return counts;
  }
  const sql =
    `SELECT document_id, COUNT(*) FROM page_meta ` +
    `WHERE is_page_deleted=0 GROUP BY document_id;`;
  try {
    const { stdout } = await execFileAsync(
      'sqlite3',
      ['-readonly', '-separator', '\x1f', `file:${FTS_DB}?immutable=1`, sql],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    for (const line of stdout.split('\n')) {
      if (!line) continue;
      const sep = line.indexOf('\x1f');
      if (sep === -1) continue;
      const id = line.slice(0, sep);
      const n = parseInt(line.slice(sep + 1), 10);
      if (id && Number.isFinite(n)) counts.set(id, n);
    }
  } catch {
    // sqlite3 missing / DB locked.
  }
  return counts;
}

// ── Read GoodNotes focus events from the Screen Time mirror ─────────────────

interface FocusSession {
  zpk: number;
  startMs: number;
  endMs: number;
}

/** Walk every per-day `app_usage` JSONL and yield the focus events for
 *  GoodNotes' bundle id. Returns events in arbitrary order — caller dedups. */
async function readGoodnotesFocusFromMirror(vaultRoot: string): Promise<FocusSession[]> {
  const dir = path.resolve(vaultRoot, APP_USAGE_DIR_REL);
  let files: string[];
  try {
    files = (await fsPromises.readdir(dir)).filter(f => f.endsWith('.jsonl'));
  } catch {
    return [];
  }
  const out: FocusSession[] = [];
  for (const f of files) {
    let raw: string;
    try {
      raw = await fsPromises.readFile(path.join(dir, f), 'utf-8');
    } catch {
      continue;
    }
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      let rec: { zpk?: number; startMs?: number; endMs?: number; valueString?: string | null };
      try {
        rec = JSON.parse(t);
      } catch {
        continue;
      }
      if (rec.valueString !== GOODNOTES_BUNDLE_ID) continue;
      const startMs = typeof rec.startMs === 'number' ? rec.startMs : 0;
      const endMs = typeof rec.endMs === 'number' ? rec.endMs : 0;
      const zpk = typeof rec.zpk === 'number' ? rec.zpk : 0;
      if (!zpk || endMs <= startMs) continue;
      out.push({ zpk, startMs, endMs });
    }
  }
  return out;
}

// ── reading.jsonl: load (with self-heal) + append ───────────────────────────

function readingLogPath(vaultRoot: string): string {
  const resolved = path.resolve(vaultRoot, READING_LOG_RELPATH);
  const rootResolved = path.resolve(vaultRoot);
  if (!resolved.startsWith(rootResolved + path.sep)) {
    throw new Error('Reading-log path escaped the vault root');
  }
  return resolved;
}

async function loadExistingBlock(
  logPath: string,
): Promise<{ records: GoodnotesReadingRecord[]; dirty: boolean }> {
  let raw: string;
  try {
    raw = await fsPromises.readFile(logPath, 'utf-8');
  } catch {
    return { records: [], dirty: false };
  }
  const byKey = new Map<string, GoodnotesReadingRecord>();
  let dirty = false;
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const t = lines[i].trim();
    if (!t) {
      if (i !== lines.length - 1) dirty = true;
      continue;
    }
    let parsed: GoodnotesReadingRecord | null = null;
    try {
      parsed = JSON.parse(t) as GoodnotesReadingRecord;
    } catch {
      dirty = true;
    }
    if (!parsed || typeof parsed.key !== 'string' || !parsed.key) {
      dirty = true;
      continue;
    }
    if (byKey.has(parsed.key)) {
      dirty = true;
      continue;
    }
    byKey.set(parsed.key, parsed);
  }
  return { records: [...byKey.values()], dirty };
}

async function rewriteLogBlock(
  logPath: string,
  records: GoodnotesReadingRecord[],
): Promise<void> {
  await fsPromises.mkdir(path.dirname(logPath), { recursive: true });
  const tmp = `${logPath}.${process.pid}.${Date.now()}.tmp`;
  const payload = records.length === 0
    ? ''
    : records.map(r => JSON.stringify(r)).join('\n') + '\n';
  await fsPromises.writeFile(tmp, payload, 'utf-8');
  await fsPromises.rename(tmp, logPath);
}

// ── Attribution ─────────────────────────────────────────────────────────────

function attributeFocusSession(
  startMs: number,
  endMs: number,
  docMetas: DocMeta[],
): DocMeta | null {
  let best: DocMeta | null = null;
  const winStart = startMs - ATTRIBUTION_GRACE_MS;
  const winEnd = endMs + ATTRIBUTION_GRACE_MS;
  for (const d of docMetas) {
    if (d.lastModifiedMs <= 0) continue;
    if (d.lastModifiedMs < winStart || d.lastModifiedMs > winEnd) continue;
    if (!best || d.lastModifiedMs > best.lastModifiedMs) best = d;
  }
  return best;
}

// ── Harvest driver ──────────────────────────────────────────────────────────

const inflightHarvests = new Map<string, Promise<GoodnotesHarvestResult>>();

/**
 * Re-derive `reading.jsonl` from the Apple Screen Time mirror + fts.sqlite.
 * Assumes the dumper has already run (caller responsibility). Idempotent —
 * keys are stable so re-running adds zero rows when nothing new came in.
 */
export async function harvestGoodnotesReadingBlock(
  vaultRoot: string,
): Promise<GoodnotesHarvestResult> {
  if (!vaultRoot) return { added: 0, total: 0 };
  if (!appleScreenTimeAvailableBlock() && !goodnotesAvailableBlock()) {
    return { added: 0, total: 0, unavailable: true };
  }
  const inflight = inflightHarvests.get(vaultRoot);
  if (inflight) return inflight;
  const run = harvestGoodnotesReadingInner(vaultRoot)
    .finally(() => { inflightHarvests.delete(vaultRoot); });
  inflightHarvests.set(vaultRoot, run);
  return run;
}

async function harvestGoodnotesReadingInner(
  vaultRoot: string,
): Promise<GoodnotesHarvestResult> {
  const logPath = readingLogPath(vaultRoot);
  const [focusSessions, docMetas, pageCounts, loaded] = await Promise.all([
    readGoodnotesFocusFromMirror(vaultRoot),
    readDocMetaBlock(),
    readPageCountsBlock(),
    loadExistingBlock(logPath),
  ]);

  let existing = loaded.records;
  if (loaded.dirty) {
    try {
      await rewriteLogBlock(logPath, existing);
    } catch {
      // Best-effort heal.
    }
  }

  const seen = new Set(existing.map(r => r.key));
  const titlesById = new Map(docMetas.map(d => [d.documentId, d.name] as const));
  const harvestedAt = Math.floor(Date.now() / 1000);

  const fresh: GoodnotesReadingRecord[] = [];
  for (const s of focusSessions) {
    const doc = attributeFocusSession(s.startMs, s.endMs, docMetas);
    const documentId = doc?.documentId ?? UNATTRIBUTED_DOC_ID;
    // Key includes Z_PK so the same focus event always dedups to the same row
    // even if attribution flips (e.g., a new doc's last_modified falls in the
    // window on a re-run).
    const key = `screentime|${s.zpk}|${documentId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const durationMs = Math.min(s.endMs - s.startMs, MAX_SESSION_MS);
    fresh.push({
      key,
      documentId,
      title: doc ? (titlesById.get(doc.documentId) ?? '') : UNATTRIBUTED_TITLE,
      timeMs: s.endMs,
      durationMs,
      numPage: doc ? (pageCounts.get(doc.documentId) ?? 0) : 0,
      documentType: 'screentime',
      harvestedAt,
      docModifiedMs: doc?.lastModifiedMs ?? 0,
    });
  }

  if (fresh.length === 0) {
    return { added: 0, total: existing.length };
  }

  await fsPromises.mkdir(path.dirname(logPath), { recursive: true });
  const payload = fresh.map(r => JSON.stringify(r)).join('\n') + '\n';
  await fsPromises.appendFile(logPath, payload, 'utf-8');

  return { added: fresh.length, total: existing.length + fresh.length };
}

export async function readGoodnotesReadingLogBlock(
  vaultRoot: string,
): Promise<GoodnotesReadingRecord[]> {
  if (!vaultRoot) return [];
  const { records } = await loadExistingBlock(readingLogPath(vaultRoot));
  return records;
}

// Legacy no-ops kept for back-compat (previously armed the Amplitude watcher).
export function startGoodnotesWatcherBlock(_vaultRoot: string): void {}
export function stopGoodnotesWatcherBlock(): void {}
