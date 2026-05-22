import { app } from 'electron';
import * as path from 'path';
import type { ScheduleSpecBlock } from './scheduleStorageBlock';

export interface PlistBuildContextBlock {
  baseUrl: string;
  secret: string;
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

function programArgsBlock(spec: ScheduleSpecBlock, ctx: PlistBuildContextBlock): string[] {
  return [
    '/usr/bin/curl',
    '-fsS',
    '-X',
    'POST',
    '-H',
    `X-Schedule-Secret: ${ctx.secret}`,
    `${ctx.baseUrl}/schedules/${spec.key}/fire`,
  ];
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
  const args = programArgsBlock(spec, ctx);
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

export function getPlistPathBlock(label: string): string {
  return path.join(app.getPath('home'), 'Library', 'LaunchAgents', `${label}.plist`);
}

export function getLaunchdLogPathsBlock(spec: ScheduleSpecBlock): { stdout: string; stderr: string } {
  return getLogPathsBlock(spec);
}
