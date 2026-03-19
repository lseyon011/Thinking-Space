import { type ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';

let viteProcess: ChildProcess | null = null;

function resolveViteBinaryBlock(sourcePath: string): { bin: string; args: string[] } {
  const binName = process.platform === 'win32' ? 'vite.cmd' : 'vite';
  const localBin = path.join(sourcePath, 'node_modules', '.bin', binName);
  if (fs.existsSync(localBin)) {
    return { bin: localBin, args: [] };
  }
  // Fall back to npx
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  return { bin: npx, args: ['vite'] };
}

function pollViteReadyBlock(port: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    function check() {
      const req = http.get(`http://127.0.0.1:${port}`, (res) => {
        res.resume();
        resolve();
      });
      req.setTimeout(1000, () => { req.destroy(); });
      req.on('error', () => {
        if (Date.now() >= deadline) {
          reject(new Error(`Vite server on port ${port} did not become ready within ${timeoutMs}ms`));
          return;
        }
        setTimeout(check, 500);
      });
    }
    check();
  });
}

export async function startViteServerBlock(sourcePath: string, port: number): Promise<void> {
  stopViteServerBlock();

  const { bin, args: prefixArgs } = resolveViteBinaryBlock(sourcePath);
  const viteArgs = [...prefixArgs, '--port', String(port), '--strictPort', '--host', '127.0.0.1'];

  viteProcess = spawn(bin, viteArgs, {
    cwd: sourcePath,
    env: { ...process.env, BUILD_TARGET: 'electron', FORCE_COLOR: '0' },
    stdio: 'pipe',
    shell: process.platform === 'win32',
  });

  viteProcess.on('error', (err) => {
    console.error('[vite-server] spawn error:', err.message);
    viteProcess = null;
  });

  viteProcess.on('exit', (code, signal) => {
    console.log(`[vite-server] exited code=${code} signal=${signal}`);
    viteProcess = null;
  });

  await pollViteReadyBlock(port, 45_000);
}

export function stopViteServerBlock(): void {
  if (viteProcess && !viteProcess.killed) {
    viteProcess.kill('SIGTERM');
    viteProcess = null;
  }
}

export function isViteServerRunningBlock(): boolean {
  return viteProcess !== null && !viteProcess.killed;
}
