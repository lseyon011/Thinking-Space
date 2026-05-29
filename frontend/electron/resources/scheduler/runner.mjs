#!/usr/bin/env node
// Thinking Space standalone scheduler runner.
// Invoked by launchd plists. No dependency on the Electron app being running.
//
// Commands:
//   runner.mjs run <key>            — execute the schedule with the given key
//   runner.mjs catchup-check        — fire any missed calendar slots since last run
//   runner.mjs heartbeat-check      — alert if Electron heartbeat is stale
//   runner.mjs notify <text>        — send a Telegram message
//   runner.mjs status               — print state + recent log entries

import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, openSync, futimesSync, closeSync,
         readFileSync, writeFileSync, renameSync, statSync, appendFileSync,
         readdirSync, existsSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

const HOME = homedir();
// userData path is injected by the Electron provisioner via the plist
// EnvironmentVariables dict. The provisioner uses app.getPath('userData'),
// which is the only correct value (it depends on package.json name vs
// productName and on dev vs packaged builds). Fallback is best-effort.
const USERDATA = process.env.THINKING_SPACE_USERDATA
  ?? join(HOME, 'Library', 'Application Support', 'Thinking Space');
const SCHEDULES_DIR = join(USERDATA, 'state', 'schedules');
const TRANSCRIPTS_DIR = join(USERDATA, 'transcripts');
const SECRETS_PATH = join(HOME, '.thinking-space', 'secrets.json');
const STATE_DIR = join(HOME, '.thinking-space', 'scheduler');
const STATE_PATH = join(STATE_DIR, 'state.json');
const LOG_PATH = join(STATE_DIR, 'runner.log');
const HEARTBEAT_ELECTRON_PATH = join(HOME, '.thinking-space-alive');
const HEARTBEAT_RUNNER_PATH = join(HOME, '.thinking-space-runner-alive');

const MAX_TRANSCRIPT_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const HEARTBEAT_STALE_MS = 36 * 60 * 60 * 1000;
const DEFAULT_CLAUDE_BINARY = '/opt/homebrew/bin/claude';
// Catch-up only fires a scheduled slot if it's at least this old. Gives
// launchd time to do its normal on-time fire without us racing it.
const CATCHUP_MIN_AGE_MS = 2 * 60 * 1000;
// Lock files older than this are considered stale (process died). 2x the
// schedule timeout: enough slack for slow exits, short enough that a real
// hang doesn't block catch-up for hours.
const LOCK_STALE_MS = 20 * 60 * 1000;
const LOCKS_DIR = join(STATE_DIR, 'locks');

// ---------- low-level helpers ----------

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function readJsonOr(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); }
  catch { return fallback; }
}

function writeJsonAtomic(path, value) {
  ensureDir(dirname(path));
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), { encoding: 'utf-8', mode: 0o600 });
  renameSync(tmp, path);
}

function touchFile(path) {
  ensureDir(dirname(path));
  const now = new Date();
  const fd = openSync(path, 'w');
  futimesSync(fd, now, now);
  closeSync(fd);
}

function nowIso() { return new Date().toISOString(); }

function logEvent(event) {
  ensureDir(dirname(LOG_PATH));
  const line = JSON.stringify({ ts: nowIso(), ...event }) + '\n';
  try { appendFileSync(LOG_PATH, line, { encoding: 'utf-8' }); }
  catch (err) { console.warn('[log] append failed', err.message); }
}

// ---------- state ----------

function readState() {
  return readJsonOr(STATE_PATH, { schedules: {}, lastUpdated: null });
}

function updateScheduleState(key, patch) {
  const state = readState();
  state.schedules[key] = { ...(state.schedules[key] ?? {}), ...patch };
  state.lastUpdated = nowIso();
  writeJsonAtomic(STATE_PATH, state);
}

// ---------- per-key locks ----------

function lockPathFor(key) {
  return join(LOCKS_DIR, `${key}.lock`);
}

function tryAcquireLock(key, origin) {
  ensureDir(LOCKS_DIR);
  const path = lockPathFor(key);
  const body = JSON.stringify({ pid: process.pid, origin, startedAt: nowIso() });
  try {
    // O_CREAT | O_EXCL: atomic, fails if file exists.
    const fd = openSync(path, 'wx', 0o600);
    writeFileSync(fd, body, { encoding: 'utf-8' });
    closeSync(fd);
    return path;
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    // Existing lock — if it's older than the stale threshold, the prior
    // process almost certainly died without releasing. Take it over.
    try {
      const st = statSync(path);
      if (Date.now() - st.mtimeMs > LOCK_STALE_MS) {
        writeFileSync(path, body, { encoding: 'utf-8', mode: 0o600 });
        logEvent({ kind: 'lock_stale_taken', key, origin });
        return path;
      }
    } catch { /* race: file vanished, just retry once */ }
    return null;
  }
}

function releaseLock(path) {
  if (!path) return;
  try { unlinkSync(path); } catch { /* already gone */ }
}

// ---------- calendar math ----------

// Most recent scheduled fire time at or before `now`. Mirrors the launchd
// StartCalendarInterval semantics from the existing pmsetWakeBlock, but in
// reverse: walk backward up to 7 days (to cover weekday-filtered entries).
function computeMostRecentScheduledTime(spec, now = new Date()) {
  if (spec.schedule?.kind !== 'calendar') return null;
  for (let dayOffset = 0; dayOffset >= -7; dayOffset--) {
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() + dayOffset);
    const candidates = [];
    for (const entry of spec.schedule.entries) {
      if (typeof entry.weekday === 'number') {
        // launchd weekdays: 0/7 = Sunday, 1..6 = Mon..Sat. JS getDay(): 0=Sun.
        const wd = entry.weekday === 7 ? 0 : entry.weekday;
        if (dayStart.getDay() !== wd) continue;
      }
      const fire = new Date(dayStart);
      fire.setHours(entry.hour, entry.minute, 0, 0);
      if (fire.getTime() <= now.getTime()) candidates.push(fire);
    }
    if (candidates.length) {
      candidates.sort((a, b) => b.getTime() - a.getTime());
      return candidates[0];
    }
  }
  return null;
}

// ---------- telegram ----------

function readSecrets() {
  const s = readJsonOr(SECRETS_PATH, null);
  if (!s?.telegram?.bot_token || !s?.telegram?.chat_id) {
    throw new Error(`Telegram creds missing at ${SECRETS_PATH}`);
  }
  return s.telegram;
}

async function sendTelegram(text, { parseMode = 'Markdown' } = {}) {
  let tg;
  try { tg = readSecrets(); }
  catch (err) { logEvent({ kind: 'telegram_skip', reason: err.message }); return { sent: false, reason: err.message }; }

  const url = `https://api.telegram.org/bot${tg.bot_token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: tg.chat_id, text, parse_mode: parseMode }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logEvent({ kind: 'telegram_fail', status: res.status, body: body.slice(0, 200) });
      return { sent: false, reason: `http_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    logEvent({ kind: 'telegram_error', message: err.message });
    return { sent: false, reason: err.message };
  }
}

// ---------- schedule execution ----------

function readSpec(key) {
  const path = join(SCHEDULES_DIR, `${key}.json`);
  return readJsonOr(path, null);
}

function resolveSpawn(execution) {
  if (execution.kind === 'shell') {
    return {
      command: execution.command,
      args: execution.args ?? [],
      cwd: execution.cwd ?? undefined,
      env: { ...process.env, ...(execution.env ?? {}) },
    };
  }
  if (execution.kind === 'claude-code') {
    const args = [];
    if (execution.skipPermissions) args.push('--dangerously-skip-permissions');
    if (execution.model) args.push('--model', execution.model);
    const sessionMode = execution.session?.mode ?? 'new';
    if (sessionMode === 'continue') args.push('--continue');
    else if (sessionMode === 'resume') {
      if (!execution.session?.id) throw new Error('claude-code resume requires session.id');
      args.push('--resume', execution.session.id);
    }
    args.push('-p', execution.prompt);
    return {
      command: execution.claudeBinary ?? DEFAULT_CLAUDE_BINARY,
      args,
      cwd: execution.cwd,
      env: { ...process.env, ...(execution.env ?? {}) },
    };
  }
  throw new Error(`Unknown execution kind: ${execution.kind}`);
}

function timestampSlug(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
         `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

async function runSchedule(key, { origin = 'launchd' } = {}) {
  const spec = readSpec(key);
  if (!spec) {
    logEvent({ kind: 'run_skip', key, reason: 'spec_not_found' });
    return { ok: false, reason: 'spec_not_found' };
  }
  if (!spec.enabled) {
    logEvent({ kind: 'run_skip', key, reason: 'disabled' });
    return { ok: false, reason: 'disabled' };
  }

  const lockPath = tryAcquireLock(key, origin);
  if (!lockPath) {
    logEvent({ kind: 'run_skip', key, reason: 'lock_held', origin });
    return { ok: false, reason: 'lock_held' };
  }

  try {
    return await runScheduleLocked(spec, origin);
  } finally {
    releaseLock(lockPath);
  }
}

async function runScheduleLocked(spec, origin) {
  const key = spec.key;
  const startedAt = new Date();
  // The scheduled slot this fire corresponds to. Recorded in state so the
  // catch-up watcher knows this slot has been claimed and won't re-fire it.
  const scheduledSlot = computeMostRecentScheduledTime(spec, startedAt);

  let resolved;
  try { resolved = resolveSpawn(spec.execution); }
  catch (err) {
    logEvent({ kind: 'run_error', key, phase: 'resolve', message: err.message, origin });
    await sendTelegram(`❌ *${spec.title}*\nresolve error: ${err.message}`);
    return { ok: false, reason: err.message };
  }

  const transcriptDir = join(TRANSCRIPTS_DIR, key);
  ensureDir(transcriptDir);
  const transcriptFilename = `${timestampSlug(startedAt)}.log`;
  const transcriptPath = join(transcriptDir, transcriptFilename);
  const transcript = createWriteStream(transcriptPath, { flags: 'w', encoding: 'utf-8' });

  const header =
    `# schedule: ${spec.key}\n` +
    `# label: ${spec.label}\n` +
    `# kind: ${spec.execution.kind}\n` +
    `# started: ${startedAt.toISOString()}\n` +
    `# origin: ${origin}\n` +
    `# scheduledSlot: ${scheduledSlot ? scheduledSlot.toISOString() : 'n/a'}\n` +
    `# command: ${resolved.command} ${resolved.args.join(' ')}\n` +
    `# cwd: ${resolved.cwd ?? process.cwd()}\n` +
    `# runner: standalone-mjs\n` +
    `---\n`;
  transcript.write(header);
  let bytes = header.length;
  let truncated = false;

  const writeLine = (channel, line) => {
    if (truncated) return;
    const hhmmss = new Date().toISOString().slice(11, 19);
    const marker = channel === 'stderr' ? '!' : ' ';
    const formatted = `${hhmmss} ${marker} ${line}\n`;
    if (bytes + formatted.length > MAX_TRANSCRIPT_BYTES) {
      transcript.write(`\n[transcript truncated at ${MAX_TRANSCRIPT_BYTES} bytes]\n`);
      truncated = true;
      return;
    }
    transcript.write(formatted);
    bytes += formatted.length;
  };

  const buffers = { stdout: '', stderr: '' };
  const ingest = (channel, chunk) => {
    buffers[channel] += chunk.toString('utf-8');
    let idx;
    while ((idx = buffers[channel].indexOf('\n')) !== -1) {
      const line = buffers[channel].slice(0, idx).replace(/\r$/, '');
      buffers[channel] = buffers[channel].slice(idx + 1);
      writeLine(channel, line);
    }
  };

  const child = spawn(resolved.command, resolved.args, {
    cwd: resolved.cwd, env: resolved.env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (c) => ingest('stdout', c));
  child.stderr?.on('data', (c) => ingest('stderr', c));

  const timeoutHandle = setTimeout(() => {
    if (!child.killed) {
      transcript.write(`\n[killed: timeout after ${DEFAULT_TIMEOUT_MS}ms]\n`);
      child.kill('SIGTERM');
    }
  }, DEFAULT_TIMEOUT_MS);

  let spawnError;
  child.on('error', (err) => {
    spawnError = err.message;
    transcript.write(`\n[spawn error] ${err.message}\n`);
  });

  const result = await new Promise((resolve) => {
    child.on('close', (exitCode, signal) => {
      clearTimeout(timeoutHandle);
      if (buffers.stdout) { writeLine('stdout', buffers.stdout); buffers.stdout = ''; }
      if (buffers.stderr) { writeLine('stderr', buffers.stderr); buffers.stderr = ''; }
      const endedAt = new Date();
      transcript.write(`---\n# ended: ${endedAt.toISOString()}\n# exit: ${exitCode}\n# signal: ${signal ?? 'null'}\n`);
      transcript.end(() => resolve({ exitCode, signal, endedAt }));
    });
  });

  const failed = result.exitCode !== 0 || spawnError;
  const durationMs = result.endedAt.getTime() - startedAt.getTime();

  updateScheduleState(key, {
    lastFiredAt: startedAt.toISOString(),
    lastEndedAt: result.endedAt.toISOString(),
    lastExitCode: result.exitCode,
    lastSignal: result.signal,
    lastDurationMs: durationMs,
    lastTranscript: transcriptFilename,
    lastError: spawnError ?? null,
    lastOrigin: origin,
    // Mark the scheduled slot as claimed so the catch-up watcher does not
    // re-fire it. Stored even on failure: a failed run still consumed the
    // slot, and the right response is to escalate (Telegram alert), not loop.
    lastScheduledSlot: scheduledSlot ? scheduledSlot.toISOString() : null,
    consecutiveFailures: failed
      ? (readState().schedules[key]?.consecutiveFailures ?? 0) + 1
      : 0,
  });

  logEvent({
    kind: 'run', key, origin,
    scheduledSlot: scheduledSlot ? scheduledSlot.toISOString() : null,
    exitCode: result.exitCode, signal: result.signal,
    durationMs, transcript: transcriptFilename, failed: !!failed,
    error: spawnError ?? null,
  });

  // Touch runner heartbeat so the watcher knows the runner itself is alive.
  touchFile(HEARTBEAT_RUNNER_PATH);

  if (failed) {
    const reason = spawnError ? `error: ${spawnError}` : `exit ${result.exitCode}${result.signal ? ` (signal ${result.signal})` : ''}`;
    await sendTelegram(
      `❌ *${spec.title}*\n${reason} · ${durationMs}ms\ntranscript: \`${transcriptFilename}\``,
    );
  }

  return { ok: !failed, exitCode: result.exitCode, transcriptPath };
}

// ---------- heartbeat watcher ----------

function ageMs(path) {
  try { return Date.now() - statSync(path).mtimeMs; }
  catch { return Infinity; }
}

async function heartbeatCheck() {
  // The watcher's own execution proves the runner subsystem is wired and
  // firing on schedule — touch its heartbeat first so it shows fresh.
  touchFile(HEARTBEAT_RUNNER_PATH);
  const electronAge = ageMs(HEARTBEAT_ELECTRON_PATH);
  const runnerAge = ageMs(HEARTBEAT_RUNNER_PATH);
  const state = readState();
  const lastAlert = state.lastHeartbeatAlert ?? {};

  const checks = [
    { name: 'electron', path: HEARTBEAT_ELECTRON_PATH, age: electronAge },
    { name: 'runner',   path: HEARTBEAT_RUNNER_PATH,   age: runnerAge },
  ];

  let alerted = false;
  for (const c of checks) {
    // Skip "never seen" — file has never existed. Either the subsystem hasn't
    // started yet (fresh install) or the path is wrong. Either way, no signal.
    if (!Number.isFinite(c.age)) continue;
    const stale = c.age > HEARTBEAT_STALE_MS;
    const alertedRecently = lastAlert[c.name] && (Date.now() - Date.parse(lastAlert[c.name])) < 24 * 60 * 60 * 1000;
    if (stale && !alertedRecently) {
      const hours = Number.isFinite(c.age) ? Math.round(c.age / 3600000) : 'never seen';
      await sendTelegram(
        `⚠️ *${c.name} heartbeat stale*\nlast update: ${hours === 'never seen' ? 'never' : `${hours}h ago`}\npath: \`${c.path}\``,
        { parseMode: 'Markdown' },
      );
      lastAlert[c.name] = nowIso();
      alerted = true;
    } else if (!stale && lastAlert[c.name]) {
      // recovered — clear so we alert again next time it goes stale
      delete lastAlert[c.name];
    }
  }
  const next = readState();
  next.lastHeartbeatAlert = lastAlert;
  writeJsonAtomic(STATE_PATH, next);
  logEvent({ kind: 'heartbeat_check', electronAge, runnerAge, alerted });
  return { electronAge, runnerAge, alerted };
}

// ---------- catch-up watcher ----------

// Walks every calendar schedule, figures out the most recent scheduled time
// in the past, and re-fires it if the state file says we haven't claimed
// that slot yet. Skips schedules that just fired (within CATCHUP_MIN_AGE_MS)
// so launchd's on-time fire wins the race.
//
// dryRun=true returns the list of slots that WOULD fire without invoking any
// runs and without touching state. Useful for safe inspection.
async function catchupCheck({ dryRun = false } = {}) {
  touchFile(HEARTBEAT_RUNNER_PATH);
  if (!existsSync(SCHEDULES_DIR)) {
    logEvent({ kind: 'catchup_check', considered: 0, fired: 0, dryRun });
    return { considered: 0, fired: 0, fires: [], dryRun };
  }
  const state = readState();
  const files = readdirSync(SCHEDULES_DIR).filter((f) => f.endsWith('.json'));
  const now = new Date();
  let considered = 0;
  let fired = 0;
  const fires = [];

  for (const file of files) {
    const key = file.replace(/\.json$/, '');
    const spec = readSpec(key);
    if (!spec || !spec.enabled) continue;
    if (spec.schedule?.kind !== 'calendar') continue; // interval handled by launchd
    considered++;

    const mostRecent = computeMostRecentScheduledTime(spec, now);
    if (!mostRecent) continue;
    const slotAgeMs = now.getTime() - mostRecent.getTime();
    if (slotAgeMs < CATCHUP_MIN_AGE_MS) continue; // launchd should be handling it

    const lastSlotIso = state.schedules?.[key]?.lastScheduledSlot ?? null;
    const lastSlot = lastSlotIso ? Date.parse(lastSlotIso) : 0;
    if (lastSlot >= mostRecent.getTime()) continue; // already claimed

    fires.push({ key, scheduledSlot: mostRecent.toISOString(), ageMs: slotAgeMs });
  }

  if (dryRun) {
    logEvent({ kind: 'catchup_check', considered, fired: 0, dryRun: true, would: fires });
    return { considered, fired: 0, fires, dryRun: true };
  }

  // Fire serially so we don't hammer the system if many slots were missed.
  for (const f of fires) {
    logEvent({ kind: 'catchup_fire', key: f.key, scheduledSlot: f.scheduledSlot, ageMs: f.ageMs });
    const r = await runSchedule(f.key, { origin: 'catchup' });
    if (r.reason !== 'lock_held') fired++;
  }

  logEvent({ kind: 'catchup_check', considered, fired });
  return { considered, fired, fires };
}

// ---------- status ----------

function status() {
  const state = readState();
  const schedules = existsSync(SCHEDULES_DIR) ? readdirSync(SCHEDULES_DIR).filter(f => f.endsWith('.json')) : [];
  const recentLog = (() => {
    try {
      const lines = readFileSync(LOG_PATH, 'utf-8').trim().split('\n').slice(-20);
      return lines.map(l => { try { return JSON.parse(l); } catch { return { raw: l }; } });
    } catch { return []; }
  })();
  console.log(JSON.stringify({
    secretsPresent: existsSync(SECRETS_PATH),
    schedulesDir: SCHEDULES_DIR,
    schedulesFound: schedules,
    electronHeartbeatAgeMs: ageMs(HEARTBEAT_ELECTRON_PATH),
    runnerHeartbeatAgeMs: ageMs(HEARTBEAT_RUNNER_PATH),
    state,
    recentLog,
  }, null, 2));
}

// ---------- dispatch ----------

async function main() {
  const [, , cmd, ...rest] = process.argv;
  switch (cmd) {
    case 'run': {
      const key = rest[0];
      if (!key) { console.error('usage: runner.mjs run <key>'); process.exit(2); }
      const r = await runSchedule(key);
      process.exit(r.ok ? 0 : 1);
    }
    case 'heartbeat-check': {
      await heartbeatCheck();
      process.exit(0);
    }
    case 'catchup-check': {
      const dryRun = rest.includes('--dry-run');
      const r = await catchupCheck({ dryRun });
      console.log(JSON.stringify(r, null, 2));
      process.exit(0);
    }
    case 'notify': {
      const text = rest.join(' ');
      if (!text) { console.error('usage: runner.mjs notify <text>'); process.exit(2); }
      const r = await sendTelegram(text);
      console.log(JSON.stringify(r));
      process.exit(r.sent ? 0 : 1);
    }
    case 'status': {
      status();
      process.exit(0);
    }
    default:
      console.error('usage: runner.mjs <run|catchup-check|heartbeat-check|notify|status> [args]');
      process.exit(2);
  }
}

main().catch((err) => {
  logEvent({ kind: 'fatal', message: err.message, stack: err.stack });
  console.error(err);
  process.exit(1);
});
