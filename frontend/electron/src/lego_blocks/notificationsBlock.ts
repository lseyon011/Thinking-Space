// ntfy.sh failure notifications for scheduled runs.
//
// Config lives at userData/state/notifications.json:
//   { "ntfy": { "topic": "anurag-thinking-space-xxxxxx", "server": "ntfy.sh" } }
//
// Topic should be hard-to-guess (it's a public namespace) — pick a random
// suffix or use a self-hosted ntfy instance via the server field.

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface NotificationsConfigBlock {
  ntfy: {
    topic: string | null;
    server: string;
    onSuccess: boolean;
    onFailure: boolean;
  };
}

const DEFAULT_CONFIG: NotificationsConfigBlock = {
  ntfy: {
    topic: null,
    server: 'ntfy.sh',
    onSuccess: false,
    onFailure: true,
  },
};

function getConfigPathBlock(): string {
  return path.join(app.getPath('userData'), 'state', 'notifications.json');
}

export function readNotificationsConfigBlock(): NotificationsConfigBlock {
  try {
    const raw = fs.readFileSync(getConfigPathBlock(), 'utf-8');
    const parsed = JSON.parse(raw) as { ntfy?: Partial<NotificationsConfigBlock['ntfy']> };
    const ntfy: Partial<NotificationsConfigBlock['ntfy']> = parsed?.ntfy ?? {};
    return {
      ntfy: {
        topic: typeof ntfy.topic === 'string' && ntfy.topic.trim() ? ntfy.topic.trim() : null,
        server: typeof ntfy.server === 'string' && ntfy.server.trim() ? ntfy.server.trim() : 'ntfy.sh',
        onSuccess: ntfy.onSuccess === true,
        onFailure: ntfy.onFailure !== false,
      },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function writeNotificationsConfigBlock(partial: Partial<NotificationsConfigBlock>): NotificationsConfigBlock {
  const current = readNotificationsConfigBlock();
  const next: NotificationsConfigBlock = {
    ntfy: { ...current.ntfy, ...(partial.ntfy ?? {}) },
  };
  const filePath = getConfigPathBlock();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(next, null, 2), { encoding: 'utf-8', mode: 0o600 });
  fs.renameSync(tempPath, filePath);
  return next;
}

export interface NotifyPayloadBlock {
  title: string;
  message: string;
  priority?: 'min' | 'low' | 'default' | 'high' | 'urgent';
  tags?: string[];
}

export async function notifyNtfyBlock(payload: NotifyPayloadBlock): Promise<{ sent: boolean; reason?: string }> {
  const cfg = readNotificationsConfigBlock();
  if (!cfg.ntfy.topic) return { sent: false, reason: 'no_topic_configured' };
  const url = `https://${cfg.ntfy.server.replace(/^https?:\/\//, '').replace(/\/$/, '')}/${encodeURIComponent(cfg.ntfy.topic)}`;
  const headers: Record<string, string> = {
    'Title': payload.title,
    'Content-Type': 'text/plain; charset=utf-8',
  };
  if (payload.priority) headers['Priority'] = payload.priority;
  if (payload.tags && payload.tags.length) headers['Tags'] = payload.tags.join(',');
  try {
    const res = await fetch(url, { method: 'POST', headers, body: payload.message });
    if (!res.ok) {
      return { sent: false, reason: `http_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : 'fetch_failed' };
  }
}
