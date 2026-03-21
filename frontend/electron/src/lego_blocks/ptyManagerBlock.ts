import * as pty from 'node-pty';
import { webContents } from 'electron';
import { randomUUID } from 'crypto';

const MAX_BUFFER_BYTES = 512 * 1024; // 512 KB scrollback buffer per session

interface PtyEntry {
  pty: pty.IPty;
  webContentsId: number | null; // null while detached (page navigated away)
  buffer: string;               // accumulated output for replay on reattach
}

const ptys = new Map<string, PtyEntry>();

function getShell(): string {
  if (process.platform === 'win32') return process.env.COMSPEC ?? 'cmd.exe';
  return process.env.SHELL ?? '/bin/zsh';
}

export interface CreatePtyOptsBlock {
  cwd?: string;
  cols: number;
  rows: number;
  webContentsId: number;
  env?: Record<string, string>;
}

export function createPtyBlock(opts: CreatePtyOptsBlock): string {
  const id = randomUUID();
  const shell = getShell();
  const envOverrides = Object.fromEntries(
    Object.entries(opts.env ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );

  // Spawn as a login shell (-l) so it sources ~/.zprofile / ~/.bash_profile
  // and gets the user's full PATH (Homebrew, nvm, volta, npm globals, etc.)
  // This matches VS Code's behaviour when launched from the Dock.
  const shellArgs = process.platform === 'win32' ? [] : ['-l'];

  const ptyProcess = pty.spawn(shell, shellArgs, {
    name: 'xterm-color',
    cols: opts.cols,
    rows: opts.rows,
    cwd: opts.cwd ?? process.env.HOME ?? '/',
    env: {
      ...process.env,
      ...envOverrides,
      TERM: 'xterm-color',
      COLORTERM: 'truecolor',
      TERM_PROGRAM: 'Thinking Space',
    } as Record<string, string>,
  });

  const entry: PtyEntry = { pty: ptyProcess, webContentsId: opts.webContentsId, buffer: '' };
  ptys.set(id, entry);

  ptyProcess.onData((data) => {
    // Buffer output so it can be replayed when the renderer reattaches
    entry.buffer += data;
    if (entry.buffer.length > MAX_BUFFER_BYTES) {
      entry.buffer = entry.buffer.slice(entry.buffer.length - MAX_BUFFER_BYTES);
    }
    // Route to renderer only when attached
    if (entry.webContentsId === null) return;
    const wc = webContents.fromId(entry.webContentsId);
    if (wc && !wc.isDestroyed()) {
      wc.send('terminal:data', { id, data });
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    if (entry.webContentsId !== null) {
      const wc = webContents.fromId(entry.webContentsId);
      if (wc && !wc.isDestroyed()) {
        wc.send('terminal:exit', { id, exitCode });
      }
    }
    ptys.delete(id);
  });

  return id;
}

export function writePtyBlock(id: string, data: string): void {
  ptys.get(id)?.pty.write(data);
}

export function resizePtyBlock(id: string, cols: number, rows: number): void {
  ptys.get(id)?.pty.resize(cols, rows);
}

export function killPtyBlock(id: string): void {
  const entry = ptys.get(id);
  if (entry) {
    try { entry.pty.kill(); } catch { /* already dead */ }
    ptys.delete(id);
  }
}

/** Stop routing PTY output to any renderer (e.g. page navigated away). PTY keeps running. */
export function detachPtyBlock(id: string): void {
  const entry = ptys.get(id);
  if (entry) entry.webContentsId = null;
}

/**
 * Re-route PTY output to a (possibly new) webContents and return the buffered
 * output so the renderer can replay it into a fresh xterm instance.
 * Returns null if the PTY no longer exists (process already exited).
 */
export function reattachPtyBlock(id: string, webContentsId: number): { buffer: string } | null {
  const entry = ptys.get(id);
  if (!entry) return null;
  entry.webContentsId = webContentsId;
  return { buffer: entry.buffer };
}

/** Kill all PTYs belonging to a given webContents (called on window close). */
export function killPtysForWebContentsBlock(webContentsId: number): void {
  for (const [id, entry] of ptys) {
    if (entry.webContentsId === webContentsId) {
      try { entry.pty.kill(); } catch { /* already dead */ }
      ptys.delete(id);
    }
  }
}
