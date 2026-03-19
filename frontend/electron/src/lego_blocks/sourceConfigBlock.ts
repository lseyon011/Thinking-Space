import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export type SourceModeBlock = 'live-source' | 'locked';

export interface SourceConfigBlock {
  mode: SourceModeBlock;
  sourcePath: string | null;
  vitePort: number;
}

const DEFAULT_CONFIG: SourceConfigBlock = {
  mode: 'locked',
  sourcePath: null,
  vitePort: 5173,
};

function getConfigPathBlock(): string {
  return path.join(app.getPath('userData'), 'state', 'source-config.json');
}

export function readSourceConfigBlock(): SourceConfigBlock {
  const filePath = getConfigPathBlock();
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    if (!raw.trim()) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw) as Partial<SourceConfigBlock>;
    return {
      mode: parsed.mode === 'live-source' ? 'live-source' : 'locked',
      sourcePath:
        typeof parsed.sourcePath === 'string' && parsed.sourcePath.trim()
          ? parsed.sourcePath.trim()
          : null,
      vitePort:
        typeof parsed.vitePort === 'number' && parsed.vitePort > 0
          ? parsed.vitePort
          : 5173,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function writeSourceConfigBlock(config: Partial<SourceConfigBlock>): SourceConfigBlock {
  const current = readSourceConfigBlock();
  const next: SourceConfigBlock = { ...current, ...config };
  const filePath = getConfigPathBlock();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(next, null, 2), { encoding: 'utf-8', mode: 0o600 });
  fs.renameSync(tempPath, filePath);
  return next;
}
