/**
 * AI credential reading for Electron main process.
 *
 * Claude: macOS Keychain → fallback ~/.claude/.credentials.json
 * Azure:  `az account get-access-token` CLI
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';

// ── Types ──

export interface ClaudeCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO timestamp
}

export interface AzureCredentials {
  accessToken: string;
  expiresOn: string; // ISO timestamp
}

// ── Claude ──

const KEYCHAIN_SERVICE = 'Claude Code-credentials';
const CREDENTIALS_FILE = path.join(os.homedir(), '.claude', '.credentials.json');
const CLAUDE_TOKEN_ENDPOINT = 'https://console.anthropic.com/v1/oauth/token';
const CLAUDE_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5f';

function parseKeychainPayload(raw: string): ClaudeCredentials | null {
  try {
    const parsed = JSON.parse(raw);
    const oauth = parsed?.claudeAiOauth;
    if (!oauth?.accessToken || !oauth?.refreshToken) return null;
    return {
      accessToken: oauth.accessToken,
      refreshToken: oauth.refreshToken,
      expiresAt: oauth.expiresAt ?? '',
    };
  } catch {
    return null;
  }
}

export function readClaudeCredentialsBlock(): ClaudeCredentials | null {
  // Try macOS Keychain first
  try {
    const raw = execSync(
      `security find-generic-password -s "${KEYCHAIN_SERVICE}" -w`,
      { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
    const creds = parseKeychainPayload(raw);
    if (creds) return creds;
  } catch {
    // Keychain not available or entry missing — fall through
  }

  // Fallback: credentials file
  try {
    const raw = fs.readFileSync(CREDENTIALS_FILE, 'utf-8');
    return parseKeychainPayload(raw);
  } catch {
    return null;
  }
}

export function refreshClaudeTokenBlock(refreshToken: string): Promise<ClaudeCredentials> {
  const body = JSON.stringify({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLAUDE_CLIENT_ID,
  });

  return new Promise((resolve, reject) => {
    const url = new URL(CLAUDE_TOKEN_ENDPOINT);
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          const status = res.statusCode ?? 0;
          const text = Buffer.concat(chunks).toString('utf-8');
          if (status < 200 || status >= 300) {
            reject(new Error(`Claude token refresh failed (HTTP ${status}): ${text.slice(0, 300)}`));
            return;
          }
          try {
            const data = JSON.parse(text);
            resolve({
              accessToken: data.access_token,
              refreshToken: data.refresh_token ?? refreshToken,
              expiresAt: data.expires_at ?? new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
            });
          } catch (err) {
            reject(new Error(`Failed to parse token refresh response: ${err}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Azure ──

const AZURE_RESOURCE = 'https://cognitiveservices.azure.com';

export function readAzureTokenBlock(): AzureCredentials | null {
  try {
    const raw = execSync(
      `az account get-access-token --resource ${AZURE_RESOURCE} --output json`,
      { encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
    const parsed = JSON.parse(raw);
    if (!parsed?.accessToken) return null;
    return {
      accessToken: parsed.accessToken,
      expiresOn: parsed.expiresOn ?? '',
    };
  } catch {
    return null;
  }
}
