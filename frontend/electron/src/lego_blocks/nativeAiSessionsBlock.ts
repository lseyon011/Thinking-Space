// Read-only access to native AI CLI session stores (Claude Code, Codex).
//
// Both tools save their transcripts as JSONL outside the vault:
//   Claude Code:  ~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl
//   Codex:        ~/.codex/sessions/YYYY/MM/DD/rollout-<isots>-<id>.jsonl
//
// This block exposes list+read APIs that are hard-locked to those two roots —
// any path that resolves outside is rejected. The renderer never sees absolute
// paths; it works with paths relative to each store's root.

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

const CLAUDE_ROOT = path.join(os.homedir(), '.claude', 'projects');
const CODEX_ROOT = path.join(os.homedir(), '.codex', 'sessions');

function rootFor(source: NativeAiSource): string {
  return source === 'claude' ? CLAUDE_ROOT : CODEX_ROOT;
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
    walkJsonlBlock('claude', CLAUDE_ROOT, out).catch(() => undefined),
    walkJsonlBlock('codex', CODEX_ROOT, out).catch(() => undefined),
  ]);
  return out;
}

export async function readNativeAiSessionBlock(
  source: NativeAiSource,
  relPath: string,
): Promise<string> {
  const abs = safeResolveBlock(source, relPath);
  if (!abs) throw new Error(`Rejected unsafe native session path: ${source}:${relPath}`);
  return fsPromises.readFile(abs, 'utf-8');
}
