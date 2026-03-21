import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const CODEX_PROFILE_ROOT = path.join(os.homedir(), '.thinking-space', 'codex-profiles');
const DEFAULT_CODEX_HOME = path.join(os.homedir(), '.codex');
const ACTIVE_PROFILE_STATE_PATH = path.join(CODEX_PROFILE_ROOT, 'active-profile.json');

let activeCodexHomeOverrideBlock: string | null = null;

interface PersistedActiveCodexProfileStateBlock {
  activeHomePath: string;
}

export interface CodexProfileStatusBlock {
  siteId: string;
  profileId: string;
  homePath: string;
  active: boolean;
  exists: boolean;
  hasAuthFile: boolean;
  accountId: string | null;
  authMode: string | null;
  lastRefresh: string | null;
  expiresAt: string | null;
  authFileUpdatedAt: string | null;
  launchctlMatches: boolean;
  error?: string;
}

export interface CodexProfileRuntimeSummaryBlock {
  activeHomePath: string;
  launchctlHomePath: string | null;
  profileRootPath: string;
  profiles: CodexProfileStatusBlock[];
}

export interface ActivateCodexProfileResultBlock {
  activeHomePath: string;
  launchctlHomePath: string | null;
  launchctlApplied: boolean;
  warning: string | null;
  profile: CodexProfileStatusBlock;
}

function sanitizeSegmentBlock(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'profile';
}

export function buildCodexProfileIdBlock(siteId: string): string {
  return `codex-${sanitizeSegmentBlock(siteId)}`;
}

export function buildCodexProfileHomePathBlock(siteId: string): string {
  return path.join(CODEX_PROFILE_ROOT, buildCodexProfileIdBlock(siteId));
}

function normalizeComparablePathBlock(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    return fs.realpathSync.native(trimmed);
  } catch {
    return path.resolve(trimmed);
  }
}

function readPersistedActiveCodexHomeBlock(): string | null {
  try {
    const raw = fs.readFileSync(ACTIVE_PROFILE_STATE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as PersistedActiveCodexProfileStateBlock;
    return normalizeComparablePathBlock(parsed.activeHomePath);
  } catch {
    return null;
  }
}

function persistActiveCodexHomeBlock(homePath: string): void {
  fs.mkdirSync(CODEX_PROFILE_ROOT, { recursive: true });
  fs.writeFileSync(
    ACTIVE_PROFILE_STATE_PATH,
    `${JSON.stringify({ activeHomePath: homePath } satisfies PersistedActiveCodexProfileStateBlock, null, 2)}\n`,
    'utf8',
  );
}

function applyActiveCodexHomeToProcessBlock(homePath: string): string {
  const normalized = normalizeComparablePathBlock(homePath) ?? homePath;
  activeCodexHomeOverrideBlock = normalized;
  process.env.CODEX_HOME = normalized;
  return normalized;
}

function resolveActiveCodexHomeBlock(): string {
  return normalizeComparablePathBlock(activeCodexHomeOverrideBlock)
    ?? normalizeComparablePathBlock(process.env.CODEX_HOME)
    ?? readPersistedActiveCodexHomeBlock()
    ?? normalizeComparablePathBlock(DEFAULT_CODEX_HOME)
    ?? DEFAULT_CODEX_HOME;
}

function readLaunchctlCodexHomeBlock(): string | null {
  if (process.platform !== 'darwin') return null;
  try {
    const raw = execFileSync('launchctl', ['getenv', 'CODEX_HOME'], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return normalizeComparablePathBlock(raw);
  } catch {
    return null;
  }
}

function computeExpiresAtBlock(lastRefresh: unknown, fallbackMtimeMs?: number): string | null {
  const lastRefreshMs =
    typeof lastRefresh === 'string' || typeof lastRefresh === 'number'
      ? new Date(lastRefresh).getTime()
      : NaN;
  const baselineMs = Number.isFinite(lastRefreshMs)
    ? lastRefreshMs
    : (typeof fallbackMtimeMs === 'number' && Number.isFinite(fallbackMtimeMs) ? fallbackMtimeMs : NaN);
  if (!Number.isFinite(baselineMs)) return null;
  return new Date(baselineMs + 60 * 60 * 1000).toISOString();
}

function readCodexProfileStatusBlock(siteId: string, launchctlHomePath: string | null): CodexProfileStatusBlock {
  const profileId = buildCodexProfileIdBlock(siteId);
  const homePath = buildCodexProfileHomePathBlock(siteId);
  const activeHomePath = resolveActiveCodexHomeBlock();
  const normalizedHomePath = normalizeComparablePathBlock(homePath) ?? homePath;
  const status: CodexProfileStatusBlock = {
    siteId,
    profileId,
    homePath,
    active: normalizedHomePath === activeHomePath,
    exists: false,
    hasAuthFile: false,
    accountId: null,
    authMode: null,
    lastRefresh: null,
    expiresAt: null,
    authFileUpdatedAt: null,
    launchctlMatches: normalizedHomePath === launchctlHomePath,
  };

  try {
    const homeStat = fs.statSync(homePath);
    status.exists = homeStat.isDirectory();
  } catch {
    return status;
  }

  const authPath = path.join(homePath, 'auth.json');
  try {
    const authStat = fs.statSync(authPath);
    status.hasAuthFile = authStat.isFile();
    status.authFileUpdatedAt = new Date(authStat.mtimeMs).toISOString();

    const raw = fs.readFileSync(authPath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const tokens = parsed.tokens && typeof parsed.tokens === 'object'
      ? parsed.tokens as Record<string, unknown>
      : null;

    status.authMode = typeof parsed.auth_mode === 'string' ? parsed.auth_mode : null;
    status.lastRefresh = typeof parsed.last_refresh === 'string' ? parsed.last_refresh : null;
    status.accountId = typeof tokens?.account_id === 'string' ? tokens.account_id : null;
    status.expiresAt = computeExpiresAtBlock(parsed.last_refresh, authStat.mtimeMs);
  } catch (error) {
    status.error = error instanceof Error ? error.message : String(error);
  }

  return status;
}

export function listCodexProfilesBlock(siteIds: string[]): CodexProfileRuntimeSummaryBlock {
  applyActiveCodexHomeToProcessBlock(resolveActiveCodexHomeBlock());
  const launchctlHomePath = readLaunchctlCodexHomeBlock();
  return {
    activeHomePath: resolveActiveCodexHomeBlock(),
    launchctlHomePath,
    profileRootPath: CODEX_PROFILE_ROOT,
    profiles: siteIds.map((siteId) => readCodexProfileStatusBlock(siteId, launchctlHomePath)),
  };
}

export function initializeCodexProfileBlock(): void {
  applyActiveCodexHomeToProcessBlock(resolveActiveCodexHomeBlock());
}

export function activateCodexProfileBlock(siteId: string): ActivateCodexProfileResultBlock {
  const homePath = buildCodexProfileHomePathBlock(siteId);
  fs.mkdirSync(homePath, { recursive: true });

  const normalizedHomePath = applyActiveCodexHomeToProcessBlock(homePath);
  persistActiveCodexHomeBlock(normalizedHomePath);

  let launchctlApplied = false;
  let warning: string | null = null;

  if (process.platform === 'darwin') {
    try {
      execFileSync('launchctl', ['setenv', 'CODEX_HOME', homePath], {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      launchctlApplied = true;
    } catch (error) {
      warning = error instanceof Error ? error.message : String(error);
    }
  }

  const launchctlHomePath = launchctlApplied ? normalizeComparablePathBlock(normalizedHomePath) : readLaunchctlCodexHomeBlock();
  return {
    activeHomePath: resolveActiveCodexHomeBlock(),
    launchctlHomePath,
    launchctlApplied,
    warning,
    profile: readCodexProfileStatusBlock(siteId, launchctlHomePath),
  };
}
