import { app } from 'electron';
import { type ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface RebuildProgressEventBlock {
  step: string;
  message: string;
  type: 'info' | 'error' | 'success';
}

type ProgressCallback = (event: RebuildProgressEventBlock) => void;

// Augment PATH with common Node installation locations so spawned processes
// find npm/node when the app is launched from Finder rather than a terminal.
function buildEnvWithNodePathBlock(): NodeJS.ProcessEnv {
  const home = process.env.HOME ?? '';
  const extraPaths = [
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/opt/homebrew/opt/node/bin',
    path.join(home, '.volta', 'bin'),
    path.join(home, '.nvm', 'versions', 'node', 'current', 'bin'),
  ].filter(Boolean);

  const existingPath = process.env.PATH ?? '';
  const merged = [...extraPaths, ...existingPath.split(':')].join(':');
  return { ...process.env, PATH: merged, FORCE_COLOR: '0' };
}

function runCommandBlock(
  cmd: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  onProgress: ProgressCallback,
  stepId: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc: ChildProcess = spawn(cmd, args, {
      cwd,
      env,
      stdio: 'pipe',
      shell: process.platform === 'win32',
    });

    const emit = (data: Buffer, type: 'info' | 'error') => {
      data.toString().split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .forEach(line => onProgress({ step: stepId, message: line, type }));
    };

    proc.stdout?.on('data', (d: Buffer) => emit(d, 'info'));
    proc.stderr?.on('data', (d: Buffer) => emit(d, 'info')); // stderr often has useful info
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(cmd)} exited with code ${code}`));
    });
  });
}

function resolveNpmBlock(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function resolveLocalBinBlock(dir: string, bin: string): string {
  const name = process.platform === 'win32' ? `${bin}.cmd` : bin;
  const local = path.join(dir, 'node_modules', '.bin', name);
  if (fs.existsSync(local)) return local;
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

function findBuiltAppBlock(electronDir: string): string | null {
  const distDir = path.join(electronDir, 'dist');
  if (!fs.existsSync(distDir)) return null;

  // electron-builder with --dir outputs: dist/mac-arm64/ or dist/mac-x64/ or dist/mac/
  try {
    const entries = fs.readdirSync(distDir);
    for (const entry of entries) {
      if (!entry.startsWith('mac')) continue;
      const candidate = path.join(distDir, entry, 'Thinking Space.app');
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch {
    return null;
  }
  return null;
}

export function getCurrentAppBundlePathBlock(): string | null {
  if (process.platform !== 'darwin') return null;
  const exe = app.getPath('exe');
  // exe inside a proper .app bundle: /path/to/App.app/Contents/MacOS/binary
  if (!exe.includes('.app/Contents/MacOS/')) return null;
  return path.resolve(exe, '../../..');
}

export async function runRebuildPipelineBlock(
  sourcePath: string,
  onProgress: ProgressCallback,
): Promise<{ newAppPath: string }> {
  const npm = resolveNpmBlock();
  const electronDir = path.join(sourcePath, 'electron');
  const env = buildEnvWithNodePathBlock();

  const step = (id: string, label: string) =>
    onProgress({ step: id, message: label, type: 'info' });

  // 1. Install frontend deps
  step('install', 'Installing frontend dependencies (npm install)...');
  await runCommandBlock(npm, ['install', '--prefer-offline'], sourcePath, env, onProgress, 'install');

  // 2. Build frontend + cap sync (equivalent to npm run electron:sync)
  step('build:frontend', 'Building frontend (Vite + TypeScript)...');
  await runCommandBlock(npm, ['run', 'build:electron'], sourcePath, env, onProgress, 'build:frontend');

  step('cap:sync', 'Syncing to Electron via Capacitor...');
  const capBin = resolveLocalBinBlock(sourcePath, 'cap');
  const capArgs = capBin.endsWith('npx') || capBin.endsWith('npx.cmd')
    ? ['cap', 'sync', '@capacitor-community/electron']
    : ['sync', '@capacitor-community/electron'];
  await runCommandBlock(capBin, capArgs, sourcePath, env, onProgress, 'cap:sync');

  // 3. Install electron deps
  step('install:electron', 'Installing Electron dependencies...');
  await runCommandBlock(npm, ['install', '--prefer-offline'], electronDir, env, onProgress, 'install:electron');

  // 4. Build electron main process
  step('build:electron', 'Compiling Electron main process...');
  await runCommandBlock(npm, ['run', 'build'], electronDir, env, onProgress, 'build:electron');

  // 5. Package as .app dir (no DMG — much faster, just what we need for swapping)
  step('package', 'Packaging app bundle (this may take ~30s)...');
  const ebBin = resolveLocalBinBlock(electronDir, 'electron-builder');
  const ebArgs = ebBin.endsWith('npx') || ebBin.endsWith('npx.cmd')
    ? ['electron-builder', 'build', '--mac', '--dir', '-c', './electron-builder.config.json']
    : ['build', '--mac', '--dir', '-c', './electron-builder.config.json'];
  await runCommandBlock(ebBin, ebArgs, electronDir, env, onProgress, 'package');

  // Locate the built .app
  const newAppPath = findBuiltAppBlock(electronDir);
  if (!newAppPath) {
    throw new Error(
      `Build completed but no .app bundle found in ${path.join(electronDir, 'dist')}. ` +
      'Check the build logs above for errors.',
    );
  }

  onProgress({ step: 'done', message: `Build succeeded: ${newAppPath}`, type: 'success' });
  return { newAppPath };
}

export function applyRebuildBlock(newAppPath: string): void {
  if (process.platform !== 'darwin') {
    throw new Error('Rebuild swap is only supported on macOS in this version.');
  }

  const currentApp = getCurrentAppBundlePathBlock();
  if (!currentApp) {
    throw new Error(
      'Cannot determine current app bundle path. ' +
      'Make sure the app is installed as a proper .app bundle.',
    );
  }

  const scriptPath = path.join(app.getPath('temp'), 'ts-relaunch.sh');

  // Shell-safe quoting helper
  const q = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;

  const script = [
    '#!/bin/bash',
    'sleep 3',
    `NEW_APP=${q(newAppPath)}`,
    `CURRENT_APP=${q(currentApp)}`,
    '',
    'if [ -d "$NEW_APP" ]; then',
    '  BACKUP="${CURRENT_APP}.bak"',
    '  rm -rf "$BACKUP"',
    '  mv "$CURRENT_APP" "$BACKUP" 2>/dev/null || true',
    '  cp -R "$NEW_APP" "$CURRENT_APP"',
    '  open "$CURRENT_APP"',
    'else',
    '  echo "New app not found at $NEW_APP, relaunching existing" >&2',
    '  open "$CURRENT_APP"',
    'fi',
    `rm -f ${q(scriptPath)}`,
    '',
  ].join('\n');

  fs.writeFileSync(scriptPath, script, { mode: 0o755 });

  const child = spawn('bash', [scriptPath], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}
