import { app } from 'electron';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { ScheduleExecutionBlock, ScheduleSpecBlock } from './scheduleStorageBlock';

const DEFAULT_CLAUDE_BINARY = '/opt/homebrew/bin/claude';

interface ResolvedSpawnBlock {
  command: string;
  args: string[];
  cwd: string | undefined;
  env: Record<string, string>;
}

function resolveSpawnBlock(execution: ScheduleExecutionBlock): ResolvedSpawnBlock {
  if (execution.kind === 'shell') {
    return {
      command: execution.command,
      args: execution.args,
      cwd: execution.cwd ?? undefined,
      env: { ...process.env, ...(execution.env ?? {}) } as Record<string, string>,
    };
  }
  // claude-code
  const args: string[] = [];
  if (execution.skipPermissions) args.push('--dangerously-skip-permissions');
  if (execution.model) args.push('--model', execution.model);
  const sessionMode = execution.session?.mode ?? 'new';
  if (sessionMode === 'continue') {
    args.push('--continue');
  } else if (sessionMode === 'resume') {
    const id = execution.session?.id;
    if (!id) throw new Error('claude-code resume mode requires session.id');
    args.push('--resume', id);
  }
  args.push('-p', execution.prompt);
  return {
    command: execution.claudeBinary ?? DEFAULT_CLAUDE_BINARY,
    args,
    cwd: execution.cwd,
    env: { ...process.env, ...(execution.env ?? {}) } as Record<string, string>,
  };
}

export interface ScheduleRunResultBlock {
  key: string;
  startedAt: string;
  endedAt: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  transcriptPath: string;
  transcriptFilename: string;
  durationMs: number;
  errorMessage?: string;
}

export interface ScheduleRunChunkBlock {
  channel: 'stdout' | 'stderr';
  timestamp: string;
  line: string;
}

export interface ScheduleRunOptionsBlock {
  onChunk?: (chunk: ScheduleRunChunkBlock) => void;
}

const MAX_TRANSCRIPT_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

function getTranscriptDirBlock(key: string): string {
  return path.join(app.getPath('userData'), 'transcripts', key);
}

function timestampSlug(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

export async function runScheduleBlock(
  spec: ScheduleSpecBlock,
  options: ScheduleRunOptionsBlock = {},
): Promise<ScheduleRunResultBlock> {
  if (!spec.enabled) {
    throw new Error(`Schedule ${spec.key} is disabled`);
  }

  const resolved = resolveSpawnBlock(spec.execution);

  const startedAt = new Date();
  const dir = getTranscriptDirBlock(spec.key);
  fs.mkdirSync(dir, { recursive: true });
  const transcriptFilename = `${timestampSlug(startedAt)}.log`;
  const transcriptPath = path.join(dir, transcriptFilename);
  const transcript = fs.createWriteStream(transcriptPath, { flags: 'w', encoding: 'utf-8' });

  const header =
    `# schedule: ${spec.key}\n` +
    `# label: ${spec.label}\n` +
    `# kind: ${spec.execution.kind}\n` +
    `# started: ${startedAt.toISOString()}\n` +
    `# command: ${resolved.command} ${resolved.args.join(' ')}\n` +
    `# cwd: ${resolved.cwd ?? process.cwd()}\n` +
    `---\n`;
  transcript.write(header);

  let bytesWritten = header.length;
  let truncated = false;
  const emit = options.onChunk;
  const lineBuffers: Record<'stdout' | 'stderr', string> = { stdout: '', stderr: '' };

  const flushLine = (channel: 'stdout' | 'stderr', line: string) => {
    const ts = new Date();
    const timestamp = ts.toISOString();
    const hhmmss = `${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}:${String(ts.getSeconds()).padStart(2, '0')}`;
    if (emit) emit({ channel, timestamp, line });
    if (truncated) return;
    const marker = channel === 'stderr' ? '!' : ' ';
    const formatted = `${hhmmss} ${marker} ${line}\n`;
    if (bytesWritten + formatted.length > MAX_TRANSCRIPT_BYTES) {
      transcript.write(`\n[transcript truncated at ${MAX_TRANSCRIPT_BYTES} bytes]\n`);
      truncated = true;
      return;
    }
    transcript.write(formatted);
    bytesWritten += formatted.length;
  };

  const ingest = (channel: 'stdout' | 'stderr', chunk: Buffer) => {
    lineBuffers[channel] += chunk.toString('utf-8');
    let newlineIdx: number;
    while ((newlineIdx = lineBuffers[channel].indexOf('\n')) !== -1) {
      const line = lineBuffers[channel].slice(0, newlineIdx).replace(/\r$/, '');
      lineBuffers[channel] = lineBuffers[channel].slice(newlineIdx + 1);
      flushLine(channel, line);
    }
  };

  const child = spawn(resolved.command, resolved.args, {
    cwd: resolved.cwd,
    env: resolved.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (chunk: Buffer) => ingest('stdout', chunk));
  child.stderr?.on('data', (chunk: Buffer) => ingest('stderr', chunk));

  const timeoutHandle = setTimeout(() => {
    if (!child.killed) {
      transcript.write(`\n[killed: timeout after ${DEFAULT_TIMEOUT_MS}ms]\n`);
      child.kill('SIGTERM');
    }
  }, DEFAULT_TIMEOUT_MS);

  let errorMessage: string | undefined;
  child.on('error', (err) => {
    errorMessage = err.message;
    transcript.write(`\n[spawn error] ${err.message}\n`);
  });

  return new Promise<ScheduleRunResultBlock>((resolve) => {
    child.on('close', (exitCode, signal) => {
      clearTimeout(timeoutHandle);
      // Flush any unterminated trailing data.
      if (lineBuffers.stdout) { flushLine('stdout', lineBuffers.stdout); lineBuffers.stdout = ''; }
      if (lineBuffers.stderr) { flushLine('stderr', lineBuffers.stderr); lineBuffers.stderr = ''; }
      const endedAt = new Date();
      const footer =
        `---\n` +
        `# ended: ${endedAt.toISOString()}\n` +
        `# exit: ${exitCode}\n` +
        `# signal: ${signal ?? 'null'}\n`;
      transcript.write(footer);
      transcript.end(() => {
        resolve({
          key: spec.key,
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          exitCode,
          signal,
          transcriptPath,
          transcriptFilename,
          durationMs: endedAt.getTime() - startedAt.getTime(),
          errorMessage,
        });
      });
    });
  });
}
