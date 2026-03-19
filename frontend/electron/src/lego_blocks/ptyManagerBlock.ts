import * as pty from 'node-pty';
import { webContents } from 'electron';
import { randomUUID } from 'crypto';

interface PtyEntry {
  pty: pty.IPty;
  webContentsId: number;
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
}

export function createPtyBlock(opts: CreatePtyOptsBlock): string {
  const id = randomUUID();
  const shell = getShell();

  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: opts.cols,
    rows: opts.rows,
    cwd: opts.cwd ?? process.env.HOME ?? '/',
    env: {
      ...process.env,
      TERM: 'xterm-color',
      COLORTERM: 'truecolor',
      TERM_PROGRAM: 'Thinking Space',
    } as Record<string, string>,
  });

  ptyProcess.onData((data) => {
    const wc = webContents.fromId(opts.webContentsId);
    if (wc && !wc.isDestroyed()) {
      wc.send('terminal:data', { id, data });
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    const wc = webContents.fromId(opts.webContentsId);
    if (wc && !wc.isDestroyed()) {
      wc.send('terminal:exit', { id, exitCode });
    }
    ptys.delete(id);
  });

  ptys.set(id, { pty: ptyProcess, webContentsId: opts.webContentsId });
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

/** Kill all PTYs belonging to a given webContents (called on window close). */
export function killPtysForWebContentsBlock(webContentsId: number): void {
  for (const [id, entry] of ptys) {
    if (entry.webContentsId === webContentsId) {
      try { entry.pty.kill(); } catch { /* already dead */ }
      ptys.delete(id);
    }
  }
}
