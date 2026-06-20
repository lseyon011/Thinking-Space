import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// Mirrors vaultRootPersistenceBlock. The renderer is the source of truth for the
// user's Open Source AI base URL (it lives in localStorage there), but the main
// process needs to know it at startup so the CSP `connect-src` directive can be
// built to permit fetch() calls to that origin. The renderer writes through here
// on save; the main process reads here during setupContentSecurityPolicy().

interface PersistedOpensourceAiBaseUrlPayloadBlock {
  baseUrl: string | null;
}

const PERSISTED_OPENSOURCE_AI_BASE_URL_RELATIVE_PATH_BLOCK = path.join(
  'state',
  'opensource-ai-base-url.json',
);

function getPersistedOpensourceAiBaseUrlPathBlock(): string {
  return path.join(
    app.getPath('userData'),
    PERSISTED_OPENSOURCE_AI_BASE_URL_RELATIVE_PATH_BLOCK,
  );
}

function normalizeOpensourceAiBaseUrlValueBlock(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function readPersistedOpensourceAiBaseUrlBlock(): string | null {
  const filePath = getPersistedOpensourceAiBaseUrlPathBlock();
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedOpensourceAiBaseUrlPayloadBlock>;
    return normalizeOpensourceAiBaseUrlValueBlock(parsed.baseUrl);
  } catch {
    return null;
  }
}

export function writePersistedOpensourceAiBaseUrlBlock(baseUrl: string | null): void {
  const normalized = normalizeOpensourceAiBaseUrlValueBlock(baseUrl);
  const filePath = getPersistedOpensourceAiBaseUrlPathBlock();
  const directoryPath = path.dirname(filePath);
  fs.mkdirSync(directoryPath, { recursive: true });
  const payload: PersistedOpensourceAiBaseUrlPayloadBlock = { baseUrl: normalized };
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });
  fs.renameSync(tempPath, filePath);
}
