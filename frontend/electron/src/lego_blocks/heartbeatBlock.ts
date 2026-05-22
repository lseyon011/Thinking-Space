// Heartbeat file outside the app sandbox so external tools (or you, via a
// terminal) can detect whether Thinking Space is currently running. The file's
// mtime is the signal — if it's older than 2× the interval, the app is
// effectively down for scheduling purposes.
//
// Path: ~/.thinking-space-alive  (intentionally simple, no nested dirs)

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

const HEARTBEAT_INTERVAL_MS = 60_000;

let timer: NodeJS.Timeout | null = null;

function getHeartbeatPathBlock(): string {
  return path.join(app.getPath('home'), '.thinking-space-alive');
}

function touch(): void {
  const filePath = getHeartbeatPathBlock();
  const now = new Date();
  try {
    // O_CREAT | O_WRONLY — create if missing, otherwise just update mtime.
    const fd = fs.openSync(filePath, 'w');
    fs.futimesSync(fd, now, now);
    fs.closeSync(fd);
  } catch (err) {
    console.warn('[heartbeat] touch failed', err);
  }
}

export function startHeartbeatBlock(): void {
  if (timer) return;
  touch();
  timer = setInterval(touch, HEARTBEAT_INTERVAL_MS);
  // Don't keep the event loop alive purely for the heartbeat — if everything
  // else has shut down, let the process exit.
  timer.unref?.();
  console.log('[heartbeat] started at', getHeartbeatPathBlock());
}

export function stopHeartbeatBlock(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
