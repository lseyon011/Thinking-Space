// CLI self-provisioning. Runs alongside schedulerProvisionBlock on every
// Electron launch:
//   1. Copy bundled thinkspc-runner.mjs from app resources to a stable home.
//   2. Write a shell shim at ~/.local/bin/thinkspc that invokes
//      Electron-as-Node against the bundled runner.
//   3. Write ~/.thinking-space/config.json with the current vault root so the
//      CLI works from any directory without a repo-root .env.
//
// All steps are idempotent: identical state in -> no writes. The user gets
// the new thinkspc binary, in PATH, fast (~9x vs vite-node), zero npm
// install required, and it updates automatically when the .app updates.

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { readPersistedVaultRootBlock } from './vaultRootPersistenceBlock';

const CLI_RELATIVE_PATH = path.join('cli', 'thinkspc-runner.mjs');

function getInstallDirBlock(): string {
  return path.join(app.getPath('home'), '.thinking-space', 'bin');
}

function getInstalledRunnerPathBlock(): string {
  return path.join(getInstallDirBlock(), 'thinkspc-runner.mjs');
}

function getShimPathBlock(): string {
  return path.join(app.getPath('home'), '.local', 'bin', 'thinkspc');
}

function getConfigPathBlock(): string {
  return path.join(app.getPath('home'), '.thinking-space', 'config.json');
}

function getSourceRunnerPathBlock(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, CLI_RELATIVE_PATH);
  }
  // dev: __dirname is .../frontend/electron/build/src/lego_blocks
  return path.resolve(__dirname, '..', '..', '..', 'resources', CLI_RELATIVE_PATH);
}

function copyIfChanged(src: string, dst: string, mode: number): { changed: boolean; reason?: string } {
  let srcContent: string;
  try { srcContent = fs.readFileSync(src, 'utf-8'); }
  catch (err) {
    return { changed: false, reason: `source missing: ${(err as Error).message}` };
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  let dstContent: string | null = null;
  try { dstContent = fs.readFileSync(dst, 'utf-8'); } catch { /* missing */ }
  if (dstContent === srcContent) return { changed: false };
  const tmp = `${dst}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, srcContent, { encoding: 'utf-8', mode });
  fs.renameSync(tmp, dst);
  return { changed: true };
}

function buildShimContent(electronBinary: string, runnerPath: string): string {
  // Quote both paths so spaces in /Applications/Thinking Space.app work.
  return [
    '#!/bin/sh',
    '# Thinking Space CLI shim. Provisioned by the Electron app on launch.',
    '# Source: frontend/electron/src/lego_blocks/cliProvisionBlock.ts',
    'exec env ELECTRON_RUN_AS_NODE=1 \\',
    `  "${electronBinary}" \\`,
    `  "${runnerPath}" "$@"`,
    '',
  ].join('\n');
}

function writeShimIfChanged(content: string): { changed: boolean; path: string } {
  const dst = getShimPathBlock();
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  let existing: string | null = null;
  try { existing = fs.readFileSync(dst, 'utf-8'); } catch { /* missing */ }
  if (existing === content) {
    // Ensure exec bit; harmless if already set.
    try { fs.chmodSync(dst, 0o755); } catch { /* ignore */ }
    return { changed: false, path: dst };
  }
  const tmp = `${dst}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, content, { encoding: 'utf-8', mode: 0o755 });
  fs.renameSync(tmp, dst);
  return { changed: true, path: dst };
}

interface ConfigPayload {
  vaultRoot: string | null;
  electronBinary: string;
  runnerPath: string;
  updatedAt: string;
}

function writeConfigIfChanged(payload: ConfigPayload): { changed: boolean } {
  const dst = getConfigPathBlock();
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  const content = JSON.stringify(payload, null, 2);
  try {
    const raw = fs.readFileSync(dst, 'utf-8');
    // Compare without updatedAt (which changes every launch) so we only
    // rewrite when something material moved.
    const a = JSON.parse(raw);
    const b = JSON.parse(content);
    delete a.updatedAt; delete b.updatedAt;
    if (JSON.stringify(a) === JSON.stringify(b)) return { changed: false };
  } catch { /* missing or unreadable; fall through to write */ }
  const tmp = `${dst}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, content, { encoding: 'utf-8', mode: 0o600 });
  fs.renameSync(tmp, dst);
  return { changed: true };
}

export interface CliProvisionResultBlock {
  runnerInstalledAt: string;
  runnerChanged: boolean;
  shimPath: string;
  shimChanged: boolean;
  configChanged: boolean;
  errors: string[];
}

export async function provisionCliBlock(): Promise<CliProvisionResultBlock> {
  const errors: string[] = [];
  const runnerSrc = getSourceRunnerPathBlock();
  const runnerDst = getInstalledRunnerPathBlock();

  const runnerResult = copyIfChanged(runnerSrc, runnerDst, 0o755);
  if (runnerResult.reason) errors.push(`runner copy: ${runnerResult.reason}`);

  const shim = buildShimContent(process.execPath, runnerDst);
  let shimRes: { changed: boolean; path: string };
  try {
    shimRes = writeShimIfChanged(shim);
  } catch (err) {
    shimRes = { changed: false, path: getShimPathBlock() };
    errors.push(`shim write: ${(err as Error).message}`);
  }

  let configChanged = false;
  try {
    const res = writeConfigIfChanged({
      vaultRoot: readPersistedVaultRootBlock(),
      electronBinary: process.execPath,
      runnerPath: runnerDst,
      updatedAt: new Date().toISOString(),
    });
    configChanged = res.changed;
  } catch (err) {
    errors.push(`config write: ${(err as Error).message}`);
  }

  return {
    runnerInstalledAt: runnerDst,
    runnerChanged: runnerResult.changed,
    shimPath: shimRes.path,
    shimChanged: shimRes.changed,
    configChanged,
    errors,
  };
}
