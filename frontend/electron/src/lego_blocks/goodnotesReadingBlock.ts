// Harvest GoodNotes reading/edit sessions into a durable, vault-backed log.
//
// Why this exists: GoodNotes is where the user does long-form reading (mostly
// on iPad, synced to this Mac). Its document store is an offline-first CRDT
// using logical/Lamport clocks — there is NO queryable per-document wall-clock
// timestamp anywhere in the durable stores (fts.sqlite `last_modified` is all
// zeros; RocksDB carries only logical clocks). The ONLY source of true
// wall-clock per-document sessions + durations is the Amplitude analytics
// queue (`Documents/amplitude/**/*.tmp`), which preserves the original device
// timestamp — but it is EPHEMERAL: GoodNotes purges it after uploading to
// Amplitude's servers.
//
// So this block is a reconciling harvester. The Amplitude queue is the accurate
// feed; we copy its `complete_document_edit_session` events into a TS-owned
// append-only JSONL in the vault (`ai_raw/raw/goodnotes/reading.jsonl`) the
// moment we see them. Once written, purging no longer loses data, and the JSONL
// syncs cross-device like the rest of the vault. Titles are joined from
// fts.sqlite (the one queryable store) via the system `sqlite3` CLI — no new
// dependency. A background fs.watch on the Amplitude dir re-harvests on change
// so we win the purge race while the app is open.
//
// Read-only against GoodNotes' own files; the only write target is the vault.

import { execFile } from 'child_process';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const GOODNOTES_CONTAINER = path.join(
  os.homedir(),
  'Library',
  'Containers',
  'com.goodnotesapp.x',
  'Data',
);
const AMPLITUDE_DIR = path.join(GOODNOTES_CONTAINER, 'Documents', 'amplitude');
const FTS_DB = path.join(GOODNOTES_CONTAINER, 'Library', 'Databases', 'fts.sqlite');

// The vault-relative home of the durable log. Lives under the same
// `ai_raw/raw/<source>/` family as the Claude/Codex/ChatGPT raw sessions, so
// the activity pipeline finds it next to its siblings.
const READING_LOG_RELPATH = path.join('ai_raw', 'raw', 'goodnotes', 'reading.jsonl');

// GoodNotes emits this Amplitude event when a document edit/reading session
// ends. `session_event_duration` is the open-duration in SECONDS; `time` is the
// session's wall-clock end in epoch ms (preserved from the originating device).
const EDIT_SESSION_EVENT = 'complete_document_edit_session';

/** One harvested reading session, as persisted to the durable JSONL. */
export interface GoodnotesReadingRecord {
  /** Dedup key: documentId|timeMs|roundedDurationSec. Stable across re-harvests. */
  key: string;
  documentId: string;
  /** Raw fts.sqlite document name (e.g. "Murakami - Norwegian Wood ... .pdf").
   *  Left raw on purpose — display cleaning happens renderer-side so it can be
   *  tweaked without re-harvesting. Empty when fts has no row for the id. */
  title: string;
  /** Wall-clock session end, epoch ms (the Amplitude `time`). */
  timeMs: number;
  /** Session open-duration in ms (converted from Amplitude seconds). */
  durationMs: number;
  /** Page count of the document at session time, when reported. */
  numPage: number;
  /** Document kind reported by GoodNotes (e.g. "freeform"). */
  documentType: string;
  /** Unix-seconds timestamp when this record was first written. */
  harvestedAt: number;
}

export interface GoodnotesHarvestResult {
  /** New records appended this run. */
  added: number;
  /** Total records in the durable log after this run. */
  total: number;
  /** True when GoodNotes isn't installed / has no Amplitude dir. */
  unavailable?: boolean;
}

/** Whether GoodNotes' Amplitude queue exists on this machine. */
export function goodnotesAvailableBlock(): boolean {
  try {
    return fs.existsSync(AMPLITUDE_DIR);
  } catch {
    return false;
  }
}

interface AmplitudeSession {
  documentId: string;
  timeMs: number;
  durationMs: number;
  numPage: number;
  documentType: string;
}

/** Decode a file that holds one-or-more concatenated JSON objects (Amplitude's
 *  on-disk `.tmp` format — not a clean array, not JSONL). Tolerates leading/
 *  trailing array brackets and comma separators. */
function decodeConcatenatedJson(raw: string): unknown[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  // Fast path: a well-formed array or single object.
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    // Fall through to the streaming decoder.
  }
  const out: unknown[] = [];
  let i = 0;
  const n = trimmed.length;
  while (i < n) {
    // Skip separators/whitespace/brackets between objects.
    while (i < n && (trimmed[i] === ' ' || trimmed[i] === '\n' || trimmed[i] === '\r' ||
                     trimmed[i] === '\t' || trimmed[i] === ',' || trimmed[i] === '[' ||
                     trimmed[i] === ']')) {
      i += 1;
    }
    if (i >= n) break;
    if (trimmed[i] !== '{') break; // not at an object boundary — give up cleanly
    // Brace-match to find this object's end (string-aware so braces inside
    // string values don't fool the counter).
    let depth = 0;
    let inStr = false;
    let esc = false;
    let j = i;
    for (; j < n; j += 1) {
      const ch = trimmed[j];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) { j += 1; break; }
      }
    }
    const slice = trimmed.slice(i, j);
    try {
      out.push(JSON.parse(slice));
    } catch {
      // Skip the unparseable chunk; advance past it.
    }
    i = j;
  }
  return out;
}

function num(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** Read every Amplitude `.tmp` and collect the document edit/reading sessions. */
async function readAmplitudeSessionsBlock(): Promise<AmplitudeSession[]> {
  const files: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fsPromises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.isFile() && e.name.endsWith('.tmp')) files.push(full);
    }
  }
  await walk(AMPLITUDE_DIR);

  const sessions: AmplitudeSession[] = [];
  await Promise.all(files.map(async f => {
    let raw: string;
    try {
      raw = await fsPromises.readFile(f, 'utf-8');
    } catch {
      return;
    }
    for (const evt of decodeConcatenatedJson(raw)) {
      if (!evt || typeof evt !== 'object') continue;
      const e = evt as Record<string, unknown>;
      if (e.event_type !== EDIT_SESSION_EVENT) continue;
      const props = (e.event_properties as Record<string, unknown> | undefined) ?? {};
      const documentId = typeof props.document_id === 'string' ? props.document_id : '';
      const timeMs = num(e, 'time');
      if (!documentId || !timeMs) continue;
      sessions.push({
        documentId,
        timeMs,
        durationMs: Math.round(num(props, 'session_event_duration') * 1000),
        numPage: num(props, 'num_page'),
        documentType: typeof props.document_type === 'string' ? props.document_type : '',
      });
    }
  }));
  return sessions;
}

function dedupKey(s: { documentId: string; timeMs: number; durationMs: number }): string {
  return `${s.documentId}|${s.timeMs}|${Math.round(s.durationMs / 1000)}`;
}

/** Join document_id → title from fts.sqlite via the system `sqlite3` CLI.
 *  Opened immutable so we never touch GoodNotes' live DB. Returns an empty map
 *  if sqlite3 is missing or the DB can't be read. */
async function readTitlesBlock(documentIds: string[]): Promise<Map<string, string>> {
  const titles = new Map<string, string>();
  if (documentIds.length === 0) return titles;
  try {
    await fsPromises.access(FTS_DB);
  } catch {
    return titles;
  }
  // Query all ids at once. Ids are GoodNotes UUIDs (hex + hyphens) — sanitize
  // to be safe even though they're machine-generated, then build an IN-list.
  const safeIds = documentIds
    .filter(id => /^[0-9A-Fa-f-]{36}$/.test(id))
    .map(id => `'${id}'`);
  if (safeIds.length === 0) return titles;
  // ASCII unit separator (0x1f) as the column delimiter so titles containing
  // commas/pipes survive intact.
  const sql =
    `SELECT document_id, COALESCE(name, '') FROM document_meta ` +
    `WHERE document_id IN (${safeIds.join(',')});`;
  try {
    const { stdout } = await execFileAsync(
      'sqlite3',
      ['-readonly', '-separator', '\x1f', `file:${FTS_DB}?immutable=1`, sql],
      { maxBuffer: 8 * 1024 * 1024 },
    );
    for (const line of stdout.split('\n')) {
      if (!line) continue;
      const sep = line.indexOf('\x1f');
      if (sep === -1) continue;
      const id = line.slice(0, sep);
      const name = line.slice(sep + 1);
      if (id) titles.set(id, name);
    }
  } catch {
    // sqlite3 unavailable / DB locked — titles stay empty, sessions still log.
  }
  return titles;
}

function readingLogPath(vaultRoot: string): string {
  const resolved = path.resolve(vaultRoot, READING_LOG_RELPATH);
  const rootResolved = path.resolve(vaultRoot);
  if (!resolved.startsWith(rootResolved + path.sep)) {
    throw new Error('Reading-log path escaped the vault root');
  }
  return resolved;
}

async function readExistingRecordsBlock(logPath: string): Promise<GoodnotesReadingRecord[]> {
  let raw: string;
  try {
    raw = await fsPromises.readFile(logPath, 'utf-8');
  } catch {
    return [];
  }
  const out: GoodnotesReadingRecord[] = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t) as GoodnotesReadingRecord);
    } catch {
      // Skip a corrupt line rather than failing the whole load.
    }
  }
  return out;
}

/**
 * Harvest the Amplitude queue into the durable vault JSONL. Idempotent: only
 * sessions whose dedup key isn't already logged are appended. Safe to call on
 * every activity load and from the background watcher.
 */
export async function harvestGoodnotesReadingBlock(
  vaultRoot: string,
): Promise<GoodnotesHarvestResult> {
  if (!goodnotesAvailableBlock()) return { added: 0, total: 0, unavailable: true };
  if (!vaultRoot) return { added: 0, total: 0 };

  const logPath = readingLogPath(vaultRoot);
  const [sessions, existing] = await Promise.all([
    readAmplitudeSessionsBlock(),
    readExistingRecordsBlock(logPath),
  ]);

  const seen = new Set(existing.map(r => r.key));
  // Collapse same-session duplicates within this harvest too — GoodNotes emits
  // each edit session twice (different insert_id, identical doc/time/duration).
  const fresh = new Map<string, AmplitudeSession>();
  for (const s of sessions) {
    const key = dedupKey(s);
    if (seen.has(key) || fresh.has(key)) continue;
    fresh.set(key, s);
  }
  if (fresh.size === 0) return { added: 0, total: existing.length };

  const titles = await readTitlesBlock([...new Set([...fresh.values()].map(s => s.documentId))]);
  const harvestedAt = Math.floor(Date.now() / 1000);
  const newRecords: GoodnotesReadingRecord[] = [...fresh.entries()].map(([key, s]) => ({
    key,
    documentId: s.documentId,
    title: titles.get(s.documentId) ?? '',
    timeMs: s.timeMs,
    durationMs: s.durationMs,
    numPage: s.numPage,
    documentType: s.documentType,
    harvestedAt,
  }));

  await fsPromises.mkdir(path.dirname(logPath), { recursive: true });
  const payload = newRecords.map(r => JSON.stringify(r)).join('\n') + '\n';
  // Append-only — the log is the source of truth and grows monotonically.
  await fsPromises.appendFile(logPath, payload, 'utf-8');

  return { added: newRecords.length, total: existing.length + newRecords.length };
}

/** Read the durable log back (used by the renderer-facing IPC so non-Electron
 *  clients aren't the only ones that can parse it, and so the renderer doesn't
 *  need vault-read permissions for this path). */
export async function readGoodnotesReadingLogBlock(
  vaultRoot: string,
): Promise<GoodnotesReadingRecord[]> {
  if (!vaultRoot) return [];
  return readExistingRecordsBlock(readingLogPath(vaultRoot));
}

// ── Background watcher ───────────────────────────────────────────────────────
// Amplitude can purge the queue after upload, so we re-harvest on every change
// while the app is open. One watcher per process; the vaultRoot is captured on
// first start (re-pointing the vault restarts the app anyway).

let watcher: fs.FSWatcher | null = null;
let debounceTimer: NodeJS.Timeout | null = null;

export function startGoodnotesWatcherBlock(vaultRoot: string): void {
  if (watcher || !vaultRoot || !goodnotesAvailableBlock()) return;
  try {
    watcher = fs.watch(AMPLITUDE_DIR, { recursive: true }, () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      // Debounce: a single reading session produces a burst of fs events.
      debounceTimer = setTimeout(() => {
        void harvestGoodnotesReadingBlock(vaultRoot).catch(() => undefined);
      }, 2000);
    });
  } catch {
    watcher = null;
  }
}

export function stopGoodnotesWatcherBlock(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (watcher) {
    watcher.close();
    watcher = null;
  }
}
