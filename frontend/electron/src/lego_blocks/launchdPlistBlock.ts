import { app } from 'electron';
import * as path from 'path';
import type { ScheduleSpecBlock } from './scheduleStorageBlock';

// Plist generation for launchd agents that fire schedules via runner.mjs.
//
// Plists invoke the Electron binary in node mode (ELECTRON_RUN_AS_NODE=1)
// against the standalone runner.mjs that the provisioner copies to a stable
// location. This means:
//   - No external Node dependency (Electron IS the Node runtime).
//   - No HTTP server, no random ports, no shared secret.
//   - Works whether the Electron UI is running or not.

export interface PlistBuildContextBlock {
  /** Absolute path to the Electron binary (process.execPath). */
  electronBinary: string;
  /** Absolute path to runner.mjs after provisioning. */
  runnerPath: string;
  /** Absolute path to Electron's userData dir, passed to runner via env. */
  userDataPath: string;
  /** Optional override for stdout log path; if absent, derived from userData. */
  stdoutPath?: string;
  /** Optional override for stderr log path; if absent, derived from userData. */
  stderrPath?: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderArray(items: string[]): string {
  return items.map((item) => `    <string>${escapeXml(item)}</string>`).join('\n');
}

function renderCalendarEntries(spec: ScheduleSpecBlock): string {
  if (spec.schedule.kind !== 'calendar') return '';
  const entries = spec.schedule.entries.map((entry) => {
    const parts = [
      `      <key>Hour</key><integer>${entry.hour}</integer>`,
      `      <key>Minute</key><integer>${entry.minute}</integer>`,
    ];
    if (typeof entry.weekday === 'number') {
      parts.push(`      <key>Weekday</key><integer>${entry.weekday}</integer>`);
    }
    return `    <dict>\n${parts.join('\n')}\n    </dict>`;
  });
  return `  <key>StartCalendarInterval</key>\n  <array>\n${entries.join('\n')}\n  </array>\n`;
}

function renderIntervalSeconds(spec: ScheduleSpecBlock): string {
  if (spec.schedule.kind !== 'interval') return '';
  return `  <key>StartInterval</key>\n  <integer>${spec.schedule.seconds}</integer>\n`;
}

function getLogPathsBlock(spec: ScheduleSpecBlock): { stdout: string; stderr: string } {
  const dir = path.join(app.getPath('userData'), 'launchd-logs');
  return {
    stdout: path.join(dir, `${spec.label}.out.log`),
    stderr: path.join(dir, `${spec.label}.err.log`),
  };
}

export function buildPlistBlock(spec: ScheduleSpecBlock, ctx: PlistBuildContextBlock): string {
  const args = [ctx.electronBinary, ctx.runnerPath, 'run', spec.key];
  const fallbackLogs = ctx.stdoutPath && ctx.stderrPath ? null : getLogPathsBlock(spec);
  const logs = {
    stdout: ctx.stdoutPath ?? fallbackLogs!.stdout,
    stderr: ctx.stderrPath ?? fallbackLogs!.stderr,
  };
  const calendarBlock = renderCalendarEntries(spec);
  const intervalBlock = renderIntervalSeconds(spec);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${escapeXml(spec.label)}</string>

  <key>ProgramArguments</key>
  <array>
${renderArray(args)}
  </array>

  <key>EnvironmentVariables</key>
  <dict>
    <key>ELECTRON_RUN_AS_NODE</key>
    <string>1</string>
    <key>THINKING_SPACE_USERDATA</key>
    <string>${escapeXml(ctx.userDataPath)}</string>
  </dict>

${calendarBlock}${intervalBlock}  <key>StandardOutPath</key>
  <string>${escapeXml(logs.stdout)}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(logs.stderr)}</string>

  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
`;
}

export function buildBuiltinPlistBlock(
  label: string,
  command: string,
  intervalSeconds: number,
  ctx: PlistBuildContextBlock,
): string {
  const args = [ctx.electronBinary, ctx.runnerPath, command];
  const dir = path.join(app.getPath('userData'), 'launchd-logs');
  const stdout = path.join(dir, `${label}.out.log`);
  const stderr = path.join(dir, `${label}.err.log`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${escapeXml(label)}</string>

  <key>ProgramArguments</key>
  <array>
${renderArray(args)}
  </array>

  <key>EnvironmentVariables</key>
  <dict>
    <key>ELECTRON_RUN_AS_NODE</key>
    <string>1</string>
    <key>THINKING_SPACE_USERDATA</key>
    <string>${escapeXml(ctx.userDataPath)}</string>
  </dict>

  <key>StartInterval</key>
  <integer>${intervalSeconds}</integer>

  <key>RunAtLoad</key>
  <true/>

  <key>StandardOutPath</key>
  <string>${escapeXml(stdout)}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(stderr)}</string>
</dict>
</plist>
`;
}

export function getPlistPathBlock(label: string): string {
  return path.join(app.getPath('home'), 'Library', 'LaunchAgents', `${label}.plist`);
}

export function getLaunchdLogPathsBlock(spec: ScheduleSpecBlock): { stdout: string; stderr: string } {
  return getLogPathsBlock(spec);
}
