import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

interface PersistedVaultRootPayloadBlock {
  vaultRoot: string | null;
}

const PERSISTED_VAULT_ROOT_RELATIVE_PATH_BLOCK = path.join('state', 'vault-root.json');

function getPersistedVaultRootPathBlock(): string {
  return path.join(app.getPath('userData'), PERSISTED_VAULT_ROOT_RELATIVE_PATH_BLOCK);
}

function normalizeVaultRootValueBlock(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function readPersistedVaultRootBlock(): string | null {
  const filePath = getPersistedVaultRootPathBlock();
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedVaultRootPayloadBlock>;
    return normalizeVaultRootValueBlock(parsed.vaultRoot);
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
    if (code === 'ENOENT') return null;
    return null;
  }
}

export function writePersistedVaultRootBlock(vaultRoot: string | null): void {
  const normalized = normalizeVaultRootValueBlock(vaultRoot);
  const filePath = getPersistedVaultRootPathBlock();
  const directoryPath = path.dirname(filePath);
  fs.mkdirSync(directoryPath, { recursive: true });
  const payload: PersistedVaultRootPayloadBlock = { vaultRoot: normalized };
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), { encoding: 'utf-8', mode: 0o600 });
  fs.renameSync(tempPath, filePath);
}
