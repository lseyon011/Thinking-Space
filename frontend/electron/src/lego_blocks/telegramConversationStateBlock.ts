// Read-only view over telegram conversation state files produced by the
// scheduler runner and the thinkspc telegram.* capabilities. Used by the
// Schedules UI to surface "awaiting reply" / "closed" status for
// telegram-conversation schedules, since exit code alone is misleading
// (every turn exits 0 — the conversation is multi-turn across spawns).
//
// State layout (owned by runner.mjs + telegram capabilities):
//   ~/.thinking-space/state/telegram/conversations/<convId>.json

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CONVS_DIR = path.join(os.homedir(), '.thinking-space', 'state', 'telegram', 'conversations');

export interface TelegramConvHistoryEntryBlock {
  direction: 'in' | 'out';
  text: string;
  at: string;
}

export interface TelegramConvRecordBlock {
  convId: string;
  chatId: number;
  scheduleKey: string;
  sessionId: string;
  cwd?: string;
  status: 'active' | 'closed' | string;
  startedAt: string;
  ttlAt?: string | null;
  closedAt?: string | null;
  closeReason?: string | null;
  history?: TelegramConvHistoryEntryBlock[];
}

export interface TelegramConvStatusBlock {
  hasConversation: boolean;
  conv: TelegramConvRecordBlock | null;
  // Convenience derived fields for the UI.
  isActive: boolean;
  lastInboundAt: string | null;
  inboundCount: number;
}

function readConv(file: string): TelegramConvRecordBlock | null {
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.convId === 'string') return parsed as TelegramConvRecordBlock;
    return null;
  } catch {
    return null;
  }
}

// Latest conversation for a given scheduleKey, by startedAt (descending).
// We don't trust mtime here — the runner appends history entries on every
// inbound message which would mask which conv was opened most recently.
export function getLatestConvForScheduleKeyBlock(scheduleKey: string): TelegramConvStatusBlock {
  const empty: TelegramConvStatusBlock = {
    hasConversation: false, conv: null, isActive: false, lastInboundAt: null, inboundCount: 0,
  };
  let entries: string[];
  try { entries = fs.readdirSync(CONVS_DIR); }
  catch { return empty; }

  let best: TelegramConvRecordBlock | null = null;
  for (const name of entries) {
    if (!name.endsWith('.json')) continue;
    const conv = readConv(path.join(CONVS_DIR, name));
    if (!conv || conv.scheduleKey !== scheduleKey) continue;
    if (!best || Date.parse(conv.startedAt) > Date.parse(best.startedAt)) best = conv;
  }

  if (!best) return empty;
  const inbound = (best.history ?? []).filter((h) => h.direction === 'in');
  return {
    hasConversation: true,
    conv: best,
    isActive: best.status === 'active',
    lastInboundAt: inbound.length ? inbound[inbound.length - 1].at : null,
    inboundCount: inbound.length,
  };
}
