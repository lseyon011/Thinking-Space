import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const MIN_NODE_MAJOR = 18;

export interface NodeEnvStatusBlock {
  nodeVersion: string | null;      // e.g. "v20.11.0" or null if not found
  nodeMeetsMinimum: boolean;       // node >= 18
  npmVersion: string | null;       // e.g. "10.2.4" or null if not found
  depsInstalled: boolean;          // node_modules/.bin/vite exists at sourcePath
  isGitRepo: boolean;              // .git exists at sourcePath
  gitBranch: string | null;        // current branch, or null
}

export interface NodeEnvProgressBlock {
  step: string;
  message: string;
  type: 'info' | 'error' | 'success';
}

// Augment PATH with common Node installation locations — matches viteRebuildBlock pattern.
function buildNodePathEnv(): NodeJS.ProcessEnv {
  const home = process.env.HOME ?? '';
  const extra = [
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/opt/homebrew/opt/node/bin',
    path.join(home, '.volta', 'bin'),
    path.join(home, '.nvm', 'versions', 'node', 'current', 'bin'),
  ];
  const merged = [...extra, process.env.PATH ?? ''].join(':');
  return { ...process.env, PATH: merged };
}

function tryExecBlock(cmd: string): string | null {
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      env: buildNodePathEnv(),
      timeout: 5_000,
    }).trim();
  } catch {
    return null;
  }
}

function parseNodeMajorBlock(version: string): number {
  const m = version.match(/v?(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

export function checkNodeEnvBlock(sourcePath: string | null): NodeEnvStatusBlock {
  const nodeVersion = tryExecBlock('node --version');
  const npmVersion = tryExecBlock('npm --version');
  const nodeMeetsMinimum = nodeVersion
    ? parseNodeMajorBlock(nodeVersion) >= MIN_NODE_MAJOR
    : false;

  let depsInstalled = false;
  let isGitRepo = false;
  let gitBranch: string | null = null;

  if (sourcePath) {
    const viteBin = path.join(sourcePath, 'node_modules', '.bin', 'vite');
    depsInstalled = fs.existsSync(viteBin);

    // .git can be a directory (normal repo) or a file (worktree/submodule)
    isGitRepo = fs.existsSync(path.join(sourcePath, '.git'));
    if (isGitRepo) {
      gitBranch = tryExecBlock(`git -C "${sourcePath}" rev-parse --abbrev-ref HEAD`);
    }
  }

  return { nodeVersion, nodeMeetsMinimum, npmVersion, depsInstalled, isGitRepo, gitBranch };
}

export function installDepsBlock(
  sourcePath: string,
  onProgress: (entry: NodeEnvProgressBlock) => void,
): Promise<void> {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const env = { ...buildNodePathEnv(), FORCE_COLOR: '0' };

  return new Promise((resolve, reject) => {
    const proc = spawn(npm, ['install', '--prefer-offline'], {
      cwd: sourcePath,
      env,
      stdio: 'pipe',
      shell: process.platform === 'win32',
    });

    const emit = (data: Buffer, type: 'info' | 'error') => {
      data.toString()
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .forEach(line => onProgress({ step: 'install', message: line, type }));
    };

    proc.stdout?.on('data', (d: Buffer) => emit(d, 'info'));
    proc.stderr?.on('data', (d: Buffer) => emit(d, 'info'));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm install exited with code ${code}`));
    });
  });
}
