// Scheduler self-provisioning. Runs on every Electron launch:
//   1. Copy runner.mjs from app resources to ~/.thinking-space/scheduler/.
//   2. For every user schedule (managedBy: thinking-space) write a plist that
//      invokes Electron-as-Node against runner.mjs. Bootstrap if changed.
//   3. Provision the built-in heartbeat-check agent.
//
// The whole flow is idempotent: identical state in → no writes, no launchctl.
// Source of truth is single: this code. install.sh and any external manifest
// have been removed.

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildBuiltinPlistBlock,
  type PlistBuildContextBlock,
} from './launchdPlistBlock';
import {
  bootstrapPlistBlock,
  bootoutPlistBlock,
  writePlistBlock,
  writeRawPlistBlock,
} from './launchctlBlock';
import {
  listSchedulesBlock,
  type ScheduleSpecBlock,
} from './scheduleStorageBlock';

const HEARTBEAT_LABEL = 'com.thinkingspace.scheduler.heartbeat-check';
const HEARTBEAT_INTERVAL_SECONDS = 6 * 60 * 60; // every 6 hours

const CATCHUP_LABEL = 'com.thinkingspace.scheduler.catchup-check';
const CATCHUP_INTERVAL_SECONDS = 5 * 60; // every 5 minutes

const RUNNER_RELATIVE_PATH = path.join('scheduler', 'runner.mjs');

function getInstallDirBlock(): string {
  return path.join(app.getPath('home'), '.thinking-space', 'scheduler');
}

function getInstalledRunnerPathBlock(): string {
  return path.join(getInstallDirBlock(), 'runner.mjs');
}

function getSourceRunnerPathBlock(): string {
  // Packaged: process.resourcesPath is .../Thinking Space.app/Contents/Resources/
  // Dev:      Resources path resolves to node_modules/electron/dist/.../Resources,
  //           which does NOT contain our bundled runner. Fall back to the repo.
  if (app.isPackaged) {
    return path.join(process.resourcesPath, RUNNER_RELATIVE_PATH);
  }
  // __dirname in dev is .../frontend/electron/build/src/lego_blocks
  return path.resolve(__dirname, '..', '..', '..', 'resources', RUNNER_RELATIVE_PATH);
}

function copyRunnerIfChanged(): { path: string; changed: boolean } {
  const src = getSourceRunnerPathBlock();
  const dst = getInstalledRunnerPathBlock();
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  const srcContent = fs.readFileSync(src, 'utf-8');
  let dstContent: string | null = null;
  try { dstContent = fs.readFileSync(dst, 'utf-8'); } catch { /* missing */ }
  if (dstContent === srcContent) return { path: dst, changed: false };
  const tmp = `${dst}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, srcContent, { encoding: 'utf-8', mode: 0o755 });
  fs.renameSync(tmp, dst);
  return { path: dst, changed: true };
}

function buildContextBlock(): PlistBuildContextBlock {
  return {
    electronBinary: process.execPath,
    runnerPath: getInstalledRunnerPathBlock(),
    userDataPath: app.getPath('userData'),
  };
}

export interface ProvisionResultBlock {
  runnerInstalledAt: string;
  runnerChanged: boolean;
  scheduleResults: Array<{ label: string; changed: boolean; bootstrapped: boolean; error?: string }>;
  heartbeat: { changed: boolean; bootstrapped: boolean; error?: string };
  catchup: { changed: boolean; bootstrapped: boolean; error?: string };
}

async function provisionScheduleBlock(
  spec: ScheduleSpecBlock,
  ctx: PlistBuildContextBlock,
): Promise<{ label: string; changed: boolean; bootstrapped: boolean; error?: string }> {
  try {
    const { changed } = await writePlistBlock(spec, ctx);
    if (!spec.enabled) {
      // Disabled: ensure it's not loaded.
      await bootoutPlistBlock(spec.label);
      return { label: spec.label, changed, bootstrapped: false };
    }
    if (changed) {
      await bootstrapPlistBlock(spec);
      return { label: spec.label, changed: true, bootstrapped: true };
    }
    return { label: spec.label, changed: false, bootstrapped: false };
  } catch (err) {
    return {
      label: spec.label,
      changed: false,
      bootstrapped: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function provisionBuiltinAgent(
  label: string,
  command: string,
  intervalSeconds: number,
  ctx: PlistBuildContextBlock,
): Promise<{ changed: boolean; bootstrapped: boolean; error?: string }> {
  try {
    const content = buildBuiltinPlistBlock(label, command, intervalSeconds, ctx);
    const { changed } = await writeRawPlistBlock(label, content);
    if (changed) {
      // bootout then bootstrap so launchd reloads the new content
      await bootoutPlistBlock(label);
      await execAsync_bootstrap(label);
      return { changed: true, bootstrapped: true };
    }
    return { changed: false, bootstrapped: false };
  } catch (err) {
    return {
      changed: false,
      bootstrapped: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function execAsync_bootstrap(label: string): Promise<void> {
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const run = promisify(execFile);
  const target = `gui/${process.getuid?.() ?? 501}`;
  const plistPath = path.join(app.getPath('home'), 'Library', 'LaunchAgents', `${label}.plist`);
  await run('/bin/launchctl', ['bootstrap', target, plistPath]);
}

export async function provisionSchedulerBlock(): Promise<ProvisionResultBlock> {
  const runner = copyRunnerIfChanged();
  const ctx = buildContextBlock();

  const heartbeat = await provisionBuiltinAgent(
    HEARTBEAT_LABEL, 'heartbeat-check', HEARTBEAT_INTERVAL_SECONDS, ctx,
  );
  const catchup = await provisionBuiltinAgent(
    CATCHUP_LABEL, 'catchup-check', CATCHUP_INTERVAL_SECONDS, ctx,
  );

  const specs = listSchedulesBlock().filter((s) => s.managedBy === 'thinking-space');
  const scheduleResults: ProvisionResultBlock['scheduleResults'] = [];
  for (const spec of specs) {
    // If runner location changed, force-rewrite by booting out so the next
    // bootstrap picks up the new ProgramArguments.
    if (runner.changed) {
      try { await bootoutPlistBlock(spec.label); } catch { /* not loaded */ }
    }
    scheduleResults.push(await provisionScheduleBlock(spec, ctx));
  }

  return {
    runnerInstalledAt: runner.path,
    runnerChanged: runner.changed,
    scheduleResults,
    heartbeat,
    catchup,
  };
}
