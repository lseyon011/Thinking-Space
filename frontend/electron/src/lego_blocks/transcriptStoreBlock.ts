import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

const KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;
const FILENAME_PATTERN = /^\d{8}-\d{6}\.log$/;
const MAX_READ_BYTES = 5 * 1024 * 1024;

export interface TranscriptEntryBlock {
  filename: string;
  startedAt: string;
  sizeBytes: number;
  modifiedAt: string;
}

function getDirBlock(key: string): string {
  if (!KEY_PATTERN.test(key)) throw new Error(`Invalid schedule key: ${key}`);
  return path.join(app.getPath('userData'), 'transcripts', key);
}

function parseTimestampFromFilename(filename: string): string {
  // Format: YYYYMMDD-HHmmss.log
  const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.log$/.exec(filename);
  if (!m) return new Date(0).toISOString();
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`).toISOString();
}

export function listTranscriptsBlock(key: string, limit = 50): TranscriptEntryBlock[] {
  const dir = getDirBlock(key);
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const results: TranscriptEntryBlock[] = [];
  for (const filename of entries) {
    if (!FILENAME_PATTERN.test(filename)) continue;
    try {
      const stat = fs.statSync(path.join(dir, filename));
      results.push({
        filename,
        startedAt: parseTimestampFromFilename(filename),
        sizeBytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      });
    } catch {
      // skip unreadable
    }
  }
  // Newest first
  results.sort((a, b) => b.filename.localeCompare(a.filename));
  return results.slice(0, limit);
}

export function readTranscriptBlock(key: string, filename: string): string {
  if (!FILENAME_PATTERN.test(filename)) throw new Error(`Invalid transcript filename: ${filename}`);
  const filePath = path.join(getDirBlock(key), filename);
  // Defense in depth — make sure resolved path is inside the schedule's dir.
  const expectedDir = getDirBlock(key);
  if (!path.resolve(filePath).startsWith(path.resolve(expectedDir) + path.sep)) {
    throw new Error('Transcript path escapes schedule directory');
  }
  const stat = fs.statSync(filePath);
  if (stat.size > MAX_READ_BYTES) {
    const buffer = Buffer.alloc(MAX_READ_BYTES);
    const fd = fs.openSync(filePath, 'r');
    try {
      fs.readSync(fd, buffer, 0, MAX_READ_BYTES, 0);
    } finally {
      fs.closeSync(fd);
    }
    return `${buffer.toString('utf-8')}\n[truncated at ${MAX_READ_BYTES} bytes; total size ${stat.size}]\n`;
  }
  return fs.readFileSync(filePath, 'utf-8');
}
