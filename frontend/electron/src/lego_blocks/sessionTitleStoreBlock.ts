// Sidecar JSON store for AI-generated session titles. Lives in a hidden dir
// in the user's home (`~/.thinking-space/session-titles/`) so titles survive
// app cache wipes and stay out of the Claude/Codex data dirs and the vault.
// One file per cache key (chain's first sessionId). Cheap, append-only-style
// writes — no global lock, last writer wins.

import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

const STORE_DIR = path.join(os.homedir(), '.thinking-space', 'session-titles');

export interface SessionTitleRecord {
  /** Cache key — typically chain.sessions[0].sessionId. */
  sessionId: string;
  /** Generated short title (≤6 words, no trailing punctuation). */
  title: string;
  /** Model id that produced the title (for debugging / future invalidation). */
  model: string;
  /** ISO when generated. */
  generatedAt: string;
  /** Source-file mtime (unix ms) for invalidation when the session grows. */
  sourceMtimeMs: number;
  /** Message count at generation time — regen when this grows. */
  msgCount: number;
  /** Prompt/sanitizer revision so we can invalidate on prompt changes. */
  promptVersion?: number;
}

function safeFilename(key: string): string {
  return key.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
}

async function ensureStoreDir(): Promise<void> {
  await fsPromises.mkdir(STORE_DIR, { recursive: true, mode: 0o700 });
}

export async function readSessionTitleBlock(key: string): Promise<SessionTitleRecord | null> {
  const file = path.join(STORE_DIR, `${safeFilename(key)}.json`);
  try {
    const raw = await fsPromises.readFile(file, 'utf8');
    const parsed = JSON.parse(raw) as Partial<SessionTitleRecord>;
    if (
      typeof parsed?.sessionId === 'string' &&
      typeof parsed.title === 'string' &&
      parsed.title.trim().length > 0
    ) {
      return {
        sessionId: parsed.sessionId,
        title: parsed.title,
        model: typeof parsed.model === 'string' ? parsed.model : 'unknown',
        generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : '',
        sourceMtimeMs: typeof parsed.sourceMtimeMs === 'number' ? parsed.sourceMtimeMs : 0,
        msgCount: typeof parsed.msgCount === 'number' ? parsed.msgCount : 0,
        ...(typeof parsed.promptVersion === 'number' ? { promptVersion: parsed.promptVersion } : {}),
      };
    }
    return null;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') return null;
    return null;
  }
}

export async function writeSessionTitleBlock(record: SessionTitleRecord): Promise<void> {
  await ensureStoreDir();
  const file = path.join(STORE_DIR, `${safeFilename(record.sessionId)}.json`);
  const tmp = `${file}.tmp`;
  await fsPromises.writeFile(tmp, JSON.stringify(record, null, 2), { mode: 0o600 });
  await fsPromises.rename(tmp, file);
}

export function sessionTitleStoreDirBlock(): string {
  return STORE_DIR;
}

// Quick existence probe used by the renderer at startup to decide whether to
// even surface the feature (no-op when the dir is empty).
export function sessionTitleStoreHasAnyBlock(): boolean {
  try {
    const entries = fs.readdirSync(STORE_DIR);
    return entries.some((f) => f.endsWith('.json'));
  } catch {
    return false;
  }
}
