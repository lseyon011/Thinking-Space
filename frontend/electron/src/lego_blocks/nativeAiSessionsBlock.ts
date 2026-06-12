// Read-only access to native AI CLI session stores (Claude Code, Codex).
//
// Default locations (both tools save their transcripts as JSONL outside the vault):
//   Claude Code:  ~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl
//   Codex:        ~/.codex/sessions/YYYY/MM/DD/rollout-<isots>-<id>.jsonl
//
// The user can re-point either root (Settings ▸ AI Activity ▸ Session sources);
// overrides persist in `userData/state/ai-session-roots.json`. List+read APIs
// are locked to the configured roots — any path that resolves outside is
// rejected. The renderer never sees absolute session paths; it works with
// paths relative to each store's root.

import { app } from 'electron';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

export type NativeAiSource = 'claude' | 'codex';

export interface NativeSessionEntry {
  source: NativeAiSource;
  /** Path relative to the source root (forward slashes). */
  relPath: string;
  /** Unix-seconds mtime — used for incremental cache invalidation. */
  mtime: number;
  size: number;
}

const DEFAULT_ROOTS: Record<NativeAiSource, string> = {
  claude: path.join(os.homedir(), '.claude', 'projects'),
  codex: path.join(os.homedir(), '.codex', 'sessions'),
};

export interface NativeAiRootsBlock {
  /** Effective root per source (override or default). */
  claude: string;
  codex: string;
  /** Built-in defaults, so the UI can show/reset them. */
  claudeDefault: string;
  codexDefault: string;
}

function getRootsConfigPathBlock(): string {
  return path.join(app.getPath('userData'), 'state', 'ai-session-roots.json');
}

function normalizeRootOverride(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let v = value.trim();
  if (!v) return null;
  if (v === '~' || v.startsWith('~/')) v = path.join(os.homedir(), v.slice(1));
  if (!path.isAbsolute(v)) return null;
  return path.resolve(v);
}

let cachedRoots: NativeAiRootsBlock | null = null;

export function readNativeAiRootsBlock(): NativeAiRootsBlock {
  if (cachedRoots) return cachedRoots;
  let overrides: Record<string, unknown> = {};
  try {
    const raw = fs.readFileSync(getRootsConfigPathBlock(), 'utf-8');
    if (raw.trim()) overrides = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // Missing/corrupt config — fall back to defaults.
  }
  cachedRoots = {
    claude: normalizeRootOverride(overrides.claude) ?? DEFAULT_ROOTS.claude,
    codex: normalizeRootOverride(overrides.codex) ?? DEFAULT_ROOTS.codex,
    claudeDefault: DEFAULT_ROOTS.claude,
    codexDefault: DEFAULT_ROOTS.codex,
  };
  return cachedRoots;
}

/**
 * Persist root overrides. `null`/empty string resets a source to its default.
 * A non-empty value must be an absolute path (after `~` expansion) or it throws.
 */
export function writeNativeAiRootsBlock(
  next: Partial<Record<NativeAiSource, string | null>>,
): NativeAiRootsBlock {
  const current = readNativeAiRootsBlock();
  const stored: Partial<Record<NativeAiSource, string>> = {};
  for (const source of ['claude', 'codex'] as const) {
    const raw = source in next ? next[source] : current[source];
    if (raw == null || !String(raw).trim()) continue; // reset → omit from config
    const normalized = normalizeRootOverride(raw);
    if (!normalized) {
      throw new Error(`Session root for ${source} must be an absolute path: ${raw}`);
    }
    if (normalized !== DEFAULT_ROOTS[source]) stored[source] = normalized;
  }
  const filePath = getRootsConfigPathBlock();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(stored, null, 2), { encoding: 'utf-8', mode: 0o600 });
  fs.renameSync(tempPath, filePath);
  cachedRoots = null;
  return readNativeAiRootsBlock();
}

function rootFor(source: NativeAiSource): string {
  const roots = readNativeAiRootsBlock();
  return source === 'claude' ? roots.claude : roots.codex;
}

function relPosix(absPath: string, root: string): string {
  return path.relative(root, absPath).split(path.sep).join('/');
}

/**
 * Resolve a renderer-supplied relative path against the source root, ensuring
 * the resolved path stays inside the root. Returns null if the path escapes.
 */
function safeResolveBlock(source: NativeAiSource, relPath: string): string | null {
  const root = rootFor(source);
  // Reject absolute paths and any segment that's `..`.
  if (path.isAbsolute(relPath)) return null;
  const normalized = path.normalize(relPath);
  if (normalized.startsWith('..')) return null;
  const resolved = path.resolve(root, normalized);
  const rootResolved = path.resolve(root);
  const rel = path.relative(rootResolved, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return resolved;
}

async function walkJsonlBlock(
  source: NativeAiSource,
  startDir: string,
  out: NativeSessionEntry[],
): Promise<void> {
  let entries: fs.Dirent[];
  try {
    entries = await fsPromises.readdir(startDir, { withFileTypes: true });
  } catch {
    return;
  }
  const subdirs: Promise<void>[] = [];
  const fileStats: Promise<void>[] = [];
  const root = rootFor(source);
  for (const entry of entries) {
    const full = path.join(startDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.')) continue;
      subdirs.push(walkJsonlBlock(source, full, out));
    } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      fileStats.push(
        fsPromises.stat(full).then(stat => {
          out.push({
            source,
            relPath: relPosix(full, root),
            mtime: Math.floor(stat.mtimeMs / 1000),
            size: stat.size,
          });
        }).catch(() => {
          /* unreadable file — skip */
        }),
      );
    }
  }
  await Promise.all([...subdirs, Promise.all(fileStats)]);
}

export async function listNativeAiSessionsBlock(): Promise<NativeSessionEntry[]> {
  const out: NativeSessionEntry[] = [];
  // Each store may or may not exist on a given machine — treat missing roots
  // as "no sessions" rather than errors.
  await Promise.all([
    walkJsonlBlock('claude', rootFor('claude'), out).catch(() => undefined),
    walkJsonlBlock('codex', rootFor('codex'), out).catch(() => undefined),
  ]);
  return out;
}

/**
 * Read Claude Code's permanent prompt log (`~/.claude/history.jsonl` — sibling
 * of the projects root). It survives transcript cleanup, so the renderer uses
 * it to reconstruct sessions whose JSONL transcripts were deleted. Returns ''
 * when the file doesn't exist.
 */
export async function readClaudeHistoryBlock(): Promise<string> {
  const claudeRoot = readNativeAiRootsBlock().claude;
  const historyPath = path.join(path.dirname(claudeRoot), 'history.jsonl');
  try {
    return await fsPromises.readFile(historyPath, 'utf-8');
  } catch {
    return '';
  }
}

export async function readNativeAiSessionBlock(
  source: NativeAiSource,
  relPath: string,
): Promise<string> {
  const abs = safeResolveBlock(source, relPath);
  if (!abs) throw new Error(`Rejected unsafe native session path: ${source}:${relPath}`);
  return fsPromises.readFile(abs, 'utf-8');
}
