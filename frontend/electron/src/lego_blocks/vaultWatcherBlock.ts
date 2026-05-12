/**
 * Vault filesystem watcher. Wraps chokidar with a single watcher per vault
 * root, ref-counted across windows. Emits change events back to renderers
 * via the supplied broadcast function.
 */

import * as chokidar from 'chokidar';
import * as path from 'path';

export type VaultWatchEventKind = 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';

export interface VaultWatchEvent {
  kind: VaultWatchEventKind;
  path: string;
}

interface WatcherEntry {
  watcher: chokidar.FSWatcher;
  refCount: number;
}

const watchers = new Map<string, WatcherEntry>();

const IGNORED_GLOBS: RegExp[] = [
  /(^|[\\/])\.git([\\/]|$)/,
  /(^|[\\/])\.obsidian[\\/]workspace/,
  /(^|[\\/])node_modules([\\/]|$)/,
  /(^|[\\/])\.DS_Store$/,
  /(^|[\\/])\.trash([\\/]|$)/,
  /(^|[\\/])\.thinkspc[\\/]cache/,
];

function isIgnored(p: string): boolean {
  return IGNORED_GLOBS.some((rx) => rx.test(p));
}

function normalizeVaultRoot(vaultRoot: string): string {
  return path.resolve(vaultRoot);
}

export interface StartVaultWatcherBlockOptions {
  /** Called for each event after chokidar's own internal batching. */
  onEvent: (vaultRoot: string, event: VaultWatchEvent) => void;
}

export function startVaultWatcherBlock(
  rawVaultRoot: string,
  options: StartVaultWatcherBlockOptions,
): { ok: true } | { ok: false; error: string } {
  const vaultRoot = normalizeVaultRoot(rawVaultRoot);
  const existing = watchers.get(vaultRoot);
  if (existing) {
    existing.refCount++;
    return { ok: true };
  }

  try {
    const watcher = chokidar.watch(vaultRoot, {
      ignored: (p: string) => isIgnored(p),
      ignoreInitial: true,
      persistent: true,
      // iCloud / network drives — polling fallback in case native events miss
      // some changes. Tradeoff: a bit of background work, but accuracy on
      // iCloud is worth it.
      usePolling: false,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
      depth: 99,
    });

    const dispatch = (kind: VaultWatchEventKind) => (filePath: string) => {
      if (isIgnored(filePath)) return;
      options.onEvent(vaultRoot, { kind, path: filePath });
    };

    watcher.on('add', dispatch('add'));
    watcher.on('change', dispatch('change'));
    watcher.on('unlink', dispatch('unlink'));
    watcher.on('addDir', dispatch('addDir'));
    watcher.on('unlinkDir', dispatch('unlinkDir'));
    watcher.on('error', (err: unknown) => {
      console.warn('[vaultWatcher] error', err);
    });

    watchers.set(vaultRoot, { watcher, refCount: 1 });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function stopVaultWatcherBlock(rawVaultRoot: string): { ok: true } {
  const vaultRoot = normalizeVaultRoot(rawVaultRoot);
  const entry = watchers.get(vaultRoot);
  if (!entry) return { ok: true };
  entry.refCount--;
  if (entry.refCount <= 0) {
    void entry.watcher.close();
    watchers.delete(vaultRoot);
  }
  return { ok: true };
}

export function stopAllVaultWatcherBlocks(): void {
  for (const [, entry] of watchers) {
    void entry.watcher.close();
  }
  watchers.clear();
}
