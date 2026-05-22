import { app } from 'electron';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { ScheduleSpecBlock } from './scheduleStorageBlock';

export interface ScheduleRunResultBlock {
  key: string;
  startedAt: string;
  endedAt: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  transcriptPath: string;
  durationMs: number;
  errorMessage?: string;
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

export async function runScheduleBlock(spec: ScheduleSpecBlock): Promise<ScheduleRunResultBlock> {
  if (!spec.enabled) {
    throw new Error(`Schedule ${spec.key} is disabled`);
  }
  if (spec.execution.kind !== 'shell') {
    throw new Error(`Unsupported execution kind: ${spec.execution.kind}`);
  }

  const startedAt = new Date();
  const dir = getTranscriptDirBlock(spec.key);
  fs.mkdirSync(dir, { recursive: true });
  const transcriptPath = path.join(dir, `${timestampSlug(startedAt)}.log`);
  const transcript = fs.createWriteStream(transcriptPath, { flags: 'w', encoding: 'utf-8' });

  const header =
    `# schedule: ${spec.key}\n` +
    `# label: ${spec.label}\n` +
    `# started: ${startedAt.toISOString()}\n` +
    `# command: ${spec.execution.command} ${spec.execution.args.join(' ')}\n` +
    `# cwd: ${spec.execution.cwd ?? process.cwd()}\n` +
    `---\n`;
  transcript.write(header);

  let bytesWritten = header.length;
  let truncated = false;
  const appendChunk = (channel: 'out' | 'err', chunk: Buffer) => {
    if (truncated) return;
    if (bytesWritten + chunk.length > MAX_TRANSCRIPT_BYTES) {
      transcript.write(`\n[transcript truncated at ${MAX_TRANSCRIPT_BYTES} bytes]\n`);
      truncated = true;
      return;
    }
    const prefix = channel === 'err' ? '[err] ' : '';
    if (prefix) transcript.write(prefix);
    transcript.write(chunk);
    bytesWritten += chunk.length + prefix.length;
  };

  const child = spawn(spec.execution.command, spec.execution.args, {
    cwd: spec.execution.cwd ?? undefined,
    env: { ...process.env, ...(spec.execution.env ?? {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (chunk: Buffer) => appendChunk('out', chunk));
  child.stderr?.on('data', (chunk: Buffer) => appendChunk('err', chunk));

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
          durationMs: endedAt.getTime() - startedAt.getTime(),
          errorMessage,
        });
      });
    });
  });
}
