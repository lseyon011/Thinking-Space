import { app } from 'electron';
import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { readScheduleBlock, type ScheduleSpecBlock } from './scheduleStorageBlock';
import { runScheduleBlock, ScheduleRunResultBlock } from './scheduleRunnerBlock';
import { notifyNtfyBlock, readNotificationsConfigBlock } from './notificationsBlock';

export interface ScheduleServerInfoBlock {
  port: number;
  secret: string;
  baseUrl: string;
}

interface PersistedServerInfo {
  secret: string;
}

let activeServer: Server | null = null;
let activeInfo: ScheduleServerInfoBlock | null = null;
const lastResults: Map<string, ScheduleRunResultBlock> = new Map();
const inFlight: Set<string> = new Set();

function notifyAfterRunBlock(spec: ScheduleSpecBlock, result: ScheduleRunResultBlock): void {
  const cfg = readNotificationsConfigBlock();
  if (!cfg.ntfy.topic) return;
  const failed = result.exitCode !== 0 || result.errorMessage;
  if (failed && !cfg.ntfy.onFailure) return;
  if (!failed && !cfg.ntfy.onSuccess) return;
  const reason = result.errorMessage
    ? `error: ${result.errorMessage}`
    : `exit ${result.exitCode ?? 'null'}${result.signal ? ` (signal ${result.signal})` : ''}`;
  notifyNtfyBlock({
    title: `${failed ? '❌' : '✅'} ${spec.title}`,
    message: `${reason} · ${result.durationMs}ms\ntranscript: ${result.transcriptFilename}`,
    priority: failed ? 'high' : 'low',
    tags: failed ? ['rotating_light'] : ['white_check_mark'],
  }).catch((err) => console.warn('[notifications] post failed', err));
}

function getServerInfoPathBlock(): string {
  return path.join(app.getPath('userData'), 'state', 'schedule-server.json');
}

function readPersistedSecret(): string {
  try {
    const raw = fs.readFileSync(getServerInfoPathBlock(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<PersistedServerInfo>;
    if (typeof parsed.secret === 'string' && parsed.secret.length >= 32) {
      return parsed.secret;
    }
  } catch {
    // fall through
  }
  const next = randomBytes(32).toString('hex');
  const filePath = getServerInfoPathBlock();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify({ secret: next }, null, 2), { encoding: 'utf-8', mode: 0o600 });
  fs.renameSync(tempPath, filePath);
  return next;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function handleRequest(req: IncomingMessage, res: ServerResponse, secret: string): Promise<void> {
  const url = req.url ?? '/';
  const method = req.method ?? 'GET';

  if (method === 'GET' && url === '/healthz') {
    sendJson(res, 200, { ok: true });
    return;
  }

  const providedSecret = req.headers['x-schedule-secret'];
  if (providedSecret !== secret) {
    sendJson(res, 401, { error: 'unauthorized' });
    return;
  }

  const fireMatch = /^\/schedules\/([a-z0-9][a-z0-9-]{0,62})\/fire$/.exec(url);
  if (method === 'POST' && fireMatch) {
    const key = fireMatch[1];
    const spec = readScheduleBlock(key);
    if (!spec) {
      sendJson(res, 404, { error: 'schedule_not_found', key });
      return;
    }
    if (!spec.enabled) {
      sendJson(res, 409, { error: 'schedule_disabled', key });
      return;
    }
    if (inFlight.has(key)) {
      sendJson(res, 409, { error: 'already_running', key });
      return;
    }
    inFlight.add(key);
    try {
      const result = await runScheduleBlock(spec);
      lastResults.set(key, result);
      notifyAfterRunBlock(spec, result);
      sendJson(res, 200, { ok: true, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: 'run_failed', key, message });
    } finally {
      inFlight.delete(key);
    }
    return;
  }

  const statusMatch = /^\/schedules\/([a-z0-9][a-z0-9-]{0,62})\/status$/.exec(url);
  if (method === 'GET' && statusMatch) {
    const key = statusMatch[1];
    const spec = readScheduleBlock(key);
    if (!spec) {
      sendJson(res, 404, { error: 'schedule_not_found', key });
      return;
    }
    sendJson(res, 200, {
      key,
      enabled: spec.enabled,
      running: inFlight.has(key),
      lastResult: lastResults.get(key) ?? null,
    });
    return;
  }

  sendJson(res, 404, { error: 'not_found', url });
}

export async function startScheduleHttpServerBlock(): Promise<ScheduleServerInfoBlock> {
  if (activeInfo) return activeInfo;
  const secret = readPersistedSecret();
  return new Promise<ScheduleServerInfoBlock>((resolve, reject) => {
    const server = createServer((req, res) => {
      handleRequest(req, res, secret).catch((err) => {
        console.error('[scheduleHttpServer] handler error', err);
        if (!res.headersSent) sendJson(res, 500, { error: 'internal_error' });
        else res.end();
      });
    });
    server.on('error', (err) => {
      console.error('[scheduleHttpServer] server error', err);
      reject(err);
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to resolve server address'));
        return;
      }
      activeServer = server;
      activeInfo = {
        port: address.port,
        secret,
        baseUrl: `http://127.0.0.1:${address.port}`,
      };
      console.log(`[scheduleHttpServer] listening on ${activeInfo.baseUrl}`);
      resolve(activeInfo);
    });
  });
}

export async function stopScheduleHttpServerBlock(): Promise<void> {
  if (!activeServer) return;
  await new Promise<void>((resolve) => {
    activeServer?.close(() => resolve());
  });
  activeServer = null;
  activeInfo = null;
}

export function getScheduleServerInfoBlock(): ScheduleServerInfoBlock | null {
  return activeInfo;
}
