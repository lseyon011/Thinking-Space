import type { CapacitorElectronConfig } from '@capacitor-community/electron';
import { getCapacitorElectronConfig, setupElectronDeepLinking } from '@capacitor-community/electron';
import type { MenuItemConstructorOptions } from 'electron';
import { app, dialog, ipcMain, MenuItem, shell } from 'electron';
import electronIsDev from 'electron-is-dev';
import unhandled from 'electron-unhandled';
import { autoUpdater } from 'electron-updater';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import * as https from 'https';
import { spawn } from 'child_process';

import { ElectronCapacitorApp, setupContentSecurityPolicy, setupReloadWatcher } from './setup';
import {
  readClaudeCredentialsBlock,
  refreshClaudeTokenBlock,
  readCodexCredentialsBlock,
  refreshCodexTokenBlock,
  chatCodexWithOauthBlock,
  readAzureTokenBlock,
} from './lego_blocks/aiCredentialBlock';
import {
  createHierarchyEdgeOrch,
  createHierarchyNodeOrch,
  createHierarchyThoughtLinkOrch,
  deleteHierarchyEdgeOrch,
  deleteHierarchyNodeOrch,
  deleteHierarchyThoughtLinkOrch,
  getHierarchyNodeOrch,
  listHierarchyEdgesOrch,
  listHierarchyNodesOrch,
  listHierarchyThoughtLinksOrch,
  listHierarchyThoughtsOrch,
  moveHierarchyNodeOrch,
  resolveHierarchyPathOrch,
  upsertHierarchyThoughtOrch,
  updateHierarchyNodeOrch,
} from './orchestrators/hierarchyOrch';
import { getHierarchyDbStatusOrch, initializeHierarchyDbOrch } from './orchestrators/hierarchyDbOrch';
import { EXCLUDED_DIRS } from './lego_blocks/vaultConstantsBlock';
import {
  invokeSandboxedExtensionActionBlock,
  type ExtensionRuntimeInvokePayload,
} from './lego_blocks/extensionRuntimeSandboxBlock';

// Graceful handling of unhandled errors.
unhandled();

// Define our menu templates (these are optional)
const trayMenuTemplate: (MenuItemConstructorOptions | MenuItem)[] = [new MenuItem({ label: 'Quit App', role: 'quit' })];
const appMenuBarMenuTemplate: (MenuItemConstructorOptions | MenuItem)[] = [
  { role: process.platform === 'darwin' ? 'appMenu' : 'fileMenu' },
  {
    label: 'File',
    submenu: [
      {
        label: 'New Window',
        accelerator: 'CmdOrCtrl+Shift+N',
        click: () => { myCapacitorApp.createWindow(); },
      },
      { type: 'separator' },
      { role: 'close' },
    ],
  },
  { role: 'editMenu' },
  { role: 'viewMenu' },
  {
    label: 'Tools',
    submenu: [
      {
        label: 'Install CLI Tool',
        click: async () => {
          try {
            const result = await installCliTool();
            dialog.showMessageBox({
              type: 'info',
              title: 'CLI Installed',
              message: `thinkspc CLI installed successfully.`,
              detail: `Symlink created at ${result.targetPath}\n\nYou can now run 'thinkspc' from any terminal.\n\nSet your vault root in ~/.config/thinkspc/.env:\nTHINKSPC_VAULT_ROOT="/path/to/vault"`,
            });
          } catch (err) {
            dialog.showErrorBox(
              'CLI Install Failed',
              err instanceof Error ? err.message : String(err),
            );
          }
        },
      },
    ],
  },
];

// Get Config options from capacitor.config
const capacitorFileConfig: CapacitorElectronConfig = getCapacitorElectronConfig();

// Initialize our app. You can pass menu templates into the app here.
// const myCapacitorApp = new ElectronCapacitorApp(capacitorFileConfig);
const myCapacitorApp = new ElectronCapacitorApp(capacitorFileConfig, trayMenuTemplate, appMenuBarMenuTemplate);

// If deeplinking is enabled then we will set it up here.
if (capacitorFileConfig.electron?.deepLinkingEnabled) {
  setupElectronDeepLinking(myCapacitorApp, {
    customProtocol: capacitorFileConfig.electron.deepLinkingCustomProtocol ?? 'mycapacitorapp',
  });
}

// If we are in Dev mode, use the file watcher components.
if (electronIsDev) {
  setupReloadWatcher(myCapacitorApp);
}

// Run Application
(async () => {
  // Wait for electron app to be ready.
  await app.whenReady();
  // Security - Set Content-Security-Policy based on whether or not we are in dev mode.
  setupContentSecurityPolicy(myCapacitorApp.getCustomURLScheme());
  // Initialize our app, build windows, and load content.
  await myCapacitorApp.init();
  // Check for updates if we are in a packaged app (skip in dev or if no valid publish config).
  if (!electronIsDev) {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {
      // Silently ignore update check failures (e.g. no releases published yet)
    });
  }
})();

// Handle when all of our windows are close (platforms have their own expectations).
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// When the dock icon is clicked.
app.on('activate', async function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (myCapacitorApp.getWindowCount() === 0) {
    await myCapacitorApp.createWindow();
  }
});

// -- New window IPC --
ipcMain.handle('window:new', async (_event, route?: string) => {
  await myCapacitorApp.createWindow(route);
});

// =====================================================================
// CLI Install
// =====================================================================

function getCliSourcePath(): string {
  const resourcesPath = process.resourcesPath;
  const cliWrapper = path.join(resourcesPath, 'cli', 'thinkspc-standalone.sh');
  if (!fs.existsSync(cliWrapper)) {
    throw new Error(
      `CLI wrapper not found at ${cliWrapper}. The app may not have been built with CLI resources bundled.`,
    );
  }
  return cliWrapper;
}

function getCliTargetPath(): string {
  if (process.platform === 'win32') {
    const appData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
    return path.join(appData, 'thinkspc', 'thinkspc.cmd');
  }
  return '/usr/local/bin/thinkspc';
}

async function installCliTool(): Promise<{ targetPath: string }> {
  const sourcePath = getCliSourcePath();
  const targetPath = getCliTargetPath();

  if (process.platform === 'win32') {
    // Windows: copy a .cmd wrapper that invokes the bundled script
    const targetDir = path.dirname(targetPath);
    await fsPromises.mkdir(targetDir, { recursive: true });
    const cmdContent = `@echo off\r\nbash "${sourcePath}" %*\r\n`;
    await fsPromises.writeFile(targetPath, cmdContent, 'utf-8');
  } else {
    // macOS/Linux: create a symlink
    const targetDir = path.dirname(targetPath);
    try {
      await fsPromises.mkdir(targetDir, { recursive: true });
    } catch {
      // /usr/local/bin usually exists
    }

    // Remove existing symlink/file if present
    try {
      const stat = await fsPromises.lstat(targetPath);
      if (stat.isSymbolicLink() || stat.isFile()) {
        await fsPromises.unlink(targetPath);
      }
    } catch {
      // File doesn't exist, that's fine
    }

    await fsPromises.symlink(sourcePath, targetPath);
  }

  return { targetPath };
}

// -- CLI install IPC --
ipcMain.handle('cli:install', async () => {
  return installCliTool();
});

// =====================================================================
// IPC Handlers — Filesystem, Dialog, Git
// =====================================================================

const EXCALIDRAW_PLUGIN_ID = 'obsidian-excalidraw-plugin';
const EXCALIDRAW_RELEASE_API = 'https://api.github.com/repos/zsviczian/obsidian-excalidraw-plugin/releases/latest';
const EXCALIDRAW_SOURCE_REPO = 'zsviczian/obsidian-excalidraw-plugin';
const EXCALIDRAW_REQUIRED_ASSETS = ['manifest.json', 'main.js'];
const EXCALIDRAW_OPTIONAL_ASSETS = ['styles.css'];

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  published_at: string;
  assets: GitHubReleaseAsset[];
}

interface ExcalidrawPluginStatus {
  plugin_id: string;
  source_repo: string;
  plugin_dir: string;
  installed: boolean;
  enabled: boolean;
  installed_version: string | null;
  latest_version: string | null;
  release_url: string | null;
  release_published_at: string | null;
  update_available: boolean;
  status_error: string | null;
}

type CapabilityActorKind = 'human' | 'agent' | 'system';

interface ElectronCapabilityInvokePayload {
  vaultRoot: string;
  request: {
    capability: string;
    input: Record<string, unknown>;
    actor?: { kind: CapabilityActorKind; id?: string };
    requestId?: string;
    dryRun?: boolean;
    extensionContext?: {
      extensionId: string;
      extensionRegistryKey?: string;
    };
  };
  apiBaseUrl?: string;
}

interface CapabilityRunnerLocation {
  frontendRoot: string;
  viteNodeExec: string;
  runnerScript: string;
}

function resolveCapabilityRunnerLocation(): CapabilityRunnerLocation {
  const viteNodeBinary = process.platform === 'win32' ? 'vite-node.cmd' : 'vite-node';
  const candidates = [
    path.resolve(__dirname, '../../..'),
    path.resolve(process.cwd()),
    path.resolve(process.cwd(), '..'),
    app.getAppPath(),
    path.resolve(app.getAppPath(), '..'),
  ];
  const uniqueCandidates = [...new Set(candidates)];

  for (const frontendRoot of uniqueCandidates) {
    const runnerScript = path.join(frontendRoot, 'scripts', 'agent', 'capabilityRunner.ts');
    const viteNodeExec = path.join(frontendRoot, 'node_modules', '.bin', viteNodeBinary);
    if (fs.existsSync(runnerScript) && fs.existsSync(viteNodeExec)) {
      return { frontendRoot, viteNodeExec, runnerScript };
    }
  }

  throw new Error(
    `Capability runner is unavailable: unable to find frontend/scripts/agent/capabilityRunner.ts and vite-node binary in candidates: ${uniqueCandidates.join(', ')}`,
  );
}

async function runCapabilityRunnerViaViteNode(
  command: 'list' | 'invoke',
  payload?: ElectronCapabilityInvokePayload,
): Promise<unknown> {
  const { frontendRoot, viteNodeExec, runnerScript } = resolveCapabilityRunnerLocation();
  const stdin = payload == null ? '' : JSON.stringify(payload);

  const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const proc = spawn(
      viteNodeExec,
      [runnerScript, '--json', command],
      {
        cwd: frontendRoot,
        env: { ...process.env, LTM_CAPABILITY_RUNNER_CLI: '1' },
      },
    );

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => resolve({ code, stdout, stderr }));

    if (stdin) {
      proc.stdin.write(stdin);
    }
    proc.stdin.end();
  });

  if (result.code !== 0) {
    const reason = result.stderr.trim() || 'unknown error';
    throw new Error(`Capability runner failed (command=${command}): ${reason}`);
  }

  const raw = result.stdout.trim();
  if (!raw) {
    throw new Error('Capability runner returned an empty response.');
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Capability runner returned invalid JSON: ${message}`);
  }
}

function resolvePluginDir(vaultRoot: string): string {
  return assertInsideVault(vaultRoot, path.join('.obsidian', 'plugins', EXCALIDRAW_PLUGIN_ID));
}

function resolveCommunityPluginsPath(vaultRoot: string): string {
  return assertInsideVault(vaultRoot, path.join('.obsidian', 'community-plugins.json'));
}

function normalizeSemver(version: string): number[] {
  return version
    .replace(/^v/i, '')
    .split('.')
    .map(part => {
      const match = part.match(/^(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });
}

function compareSemver(a: string, b: string): number {
  const aa = normalizeSemver(a);
  const bb = normalizeSemver(b);
  const len = Math.max(aa.length, bb.length);
  for (let i = 0; i < len; i += 1) {
    const av = aa[i] ?? 0;
    const bv = bb[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

function fetchBuffer(url: string, headers: Record<string, string> = {}, redirects = 0): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          'User-Agent': 'think-space-electron',
          ...headers,
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;

        if ([301, 302, 303, 307, 308].includes(status) && location) {
          if (redirects >= 5) {
            res.resume();
            reject(new Error('Too many redirects while downloading plugin asset'));
            return;
          }
          const redirected = new URL(location, url).toString();
          res.resume();
          fetchBuffer(redirected, headers, redirects + 1).then(resolve).catch(reject);
          return;
        }

        if (status < 200 || status >= 300) {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          res.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf-8').slice(0, 300);
            reject(new Error(`HTTP ${status} while fetching ${url}: ${body}`));
          });
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      },
    );

    request.on('error', reject);
  });
}

async function fetchJson<T>(url: string): Promise<T> {
  const data = await fetchBuffer(url, { Accept: 'application/vnd.github+json' });
  return JSON.parse(data.toString('utf-8')) as T;
}

async function fetchLatestExcalidrawRelease(): Promise<GitHubRelease> {
  return fetchJson<GitHubRelease>(EXCALIDRAW_RELEASE_API);
}

async function readInstalledExcalidrawState(vaultRoot: string): Promise<{
  pluginDir: string;
  installed: boolean;
  installedVersion: string | null;
  enabled: boolean;
}> {
  const pluginDir = resolvePluginDir(vaultRoot);
  const manifestPath = path.join(pluginDir, 'manifest.json');
  const mainPath = path.join(pluginDir, 'main.js');

  let installed = false;
  let installedVersion: string | null = null;

  try {
    await fsPromises.access(manifestPath);
    await fsPromises.access(mainPath);
    installed = true;
    const manifestRaw = await fsPromises.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestRaw) as { version?: string };
    installedVersion = manifest.version ?? null;
  } catch {
    installed = false;
    installedVersion = null;
  }

  const communityPluginsPath = resolveCommunityPluginsPath(vaultRoot);
  let enabled = false;
  try {
    const raw = await fsPromises.readFile(communityPluginsPath, 'utf-8');
    const arr = JSON.parse(raw);
    enabled = Array.isArray(arr) && arr.includes(EXCALIDRAW_PLUGIN_ID);
  } catch {
    enabled = false;
  }

  return { pluginDir, installed, installedVersion, enabled };
}

async function enableCommunityPlugin(vaultRoot: string, pluginId: string): Promise<void> {
  const obsidianDir = assertInsideVault(vaultRoot, '.obsidian');
  await fsPromises.mkdir(obsidianDir, { recursive: true });

  const communityPluginsPath = resolveCommunityPluginsPath(vaultRoot);
  let plugins: string[] = [];
  try {
    const raw = await fsPromises.readFile(communityPluginsPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      plugins = parsed.filter(item => typeof item === 'string');
    }
  } catch {
    plugins = [];
  }

  if (!plugins.includes(pluginId)) {
    plugins.push(pluginId);
    await fsPromises.writeFile(communityPluginsPath, JSON.stringify(plugins, null, 2), 'utf-8');
  }
}

async function getExcalidrawPluginStatus(vaultRoot: string): Promise<ExcalidrawPluginStatus> {
  const local = await readInstalledExcalidrawState(vaultRoot);

  let latestVersion: string | null = null;
  let releaseUrl: string | null = null;
  let releasePublishedAt: string | null = null;
  let statusError: string | null = null;

  try {
    const release = await fetchLatestExcalidrawRelease();
    latestVersion = release.tag_name ?? null;
    releaseUrl = release.html_url ?? null;
    releasePublishedAt = release.published_at ?? null;
  } catch (err) {
    statusError = err instanceof Error ? err.message : 'Failed to fetch latest release metadata';
  }

  const updateAvailable = Boolean(
    local.installed &&
    local.installedVersion &&
    latestVersion &&
    compareSemver(local.installedVersion, latestVersion) < 0,
  );

  return {
    plugin_id: EXCALIDRAW_PLUGIN_ID,
    source_repo: EXCALIDRAW_SOURCE_REPO,
    plugin_dir: local.pluginDir,
    installed: local.installed,
    enabled: local.enabled,
    installed_version: local.installedVersion,
    latest_version: latestVersion,
    release_url: releaseUrl,
    release_published_at: releasePublishedAt,
    update_available: updateAvailable,
    status_error: statusError,
  };
}

async function installOrUpdateExcalidrawPlugin(vaultRoot: string): Promise<ExcalidrawPluginStatus> {
  const release = await fetchLatestExcalidrawRelease();
  const assetsByName = new Map(release.assets.map(asset => [asset.name, asset]));

  for (const fileName of EXCALIDRAW_REQUIRED_ASSETS) {
    if (!assetsByName.has(fileName)) {
      throw new Error(`Latest release is missing required plugin asset: ${fileName}`);
    }
  }

  const pluginDir = resolvePluginDir(vaultRoot);
  await fsPromises.mkdir(pluginDir, { recursive: true });

  const installFiles = [...EXCALIDRAW_REQUIRED_ASSETS, ...EXCALIDRAW_OPTIONAL_ASSETS];
  for (const fileName of installFiles) {
    const asset = assetsByName.get(fileName);
    if (!asset) continue;
    const targetPath = path.join(pluginDir, fileName);
    const tmpPath = `${targetPath}.tmp`;
    const data = await fetchBuffer(asset.browser_download_url);
    await fsPromises.writeFile(tmpPath, data);
    await fsPromises.rename(tmpPath, targetPath);
  }

  await enableCommunityPlugin(vaultRoot, EXCALIDRAW_PLUGIN_ID);
  return getExcalidrawPluginStatus(vaultRoot);
}

function assertInsideVault(vaultRoot: string, targetPath: string): string {
  const resolved = path.resolve(vaultRoot, targetPath);
  if (!resolved.startsWith(path.resolve(vaultRoot))) {
    throw new Error('Path traversal detected');
  }
  return resolved;
}

// -- Capability adapter list --
ipcMain.handle('capabilities:list', async () => {
  return runCapabilityRunnerViaViteNode('list');
});

// -- Capability adapter invoke --
ipcMain.handle('capabilities:invoke', async (_event, payload: ElectronCapabilityInvokePayload) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Capability invoke payload must be an object.');
  }
  if (!payload.vaultRoot || typeof payload.vaultRoot !== 'string') {
    throw new Error('Capability invoke payload requires a string "vaultRoot".');
  }
  if (!payload.request || typeof payload.request !== 'object') {
    throw new Error('Capability invoke payload requires a "request" object.');
  }
  return runCapabilityRunnerViaViteNode('invoke', payload);
});

// -- Extension runtime sandbox invoke --
ipcMain.handle('extension-runtime:invoke', async (_event, payload: ExtensionRuntimeInvokePayload) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Extension runtime payload must be an object.');
  }
  if (!payload.vaultRoot || typeof payload.vaultRoot !== 'string') {
    throw new Error('Extension runtime payload requires a string "vaultRoot".');
  }
  return invokeSandboxedExtensionActionBlock(payload, {
    runCapability: (invokePayload) => runCapabilityRunnerViaViteNode('invoke', invokePayload as ElectronCapabilityInvokePayload),
  });
});

// -- Vault folder picker --
ipcMain.handle('vault:selectFolder', async () => {
  const result = await dialog.showOpenDialog(myCapacitorApp.getMainWindow(), {
    properties: ['openDirectory'],
    title: 'Select your Obsidian vault folder',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// -- Read file --
ipcMain.handle('vault:read', async (_event, vaultRoot: string, relPath: string) => {
  const full = assertInsideVault(vaultRoot, relPath);
  return fsPromises.readFile(full, 'utf-8');
});

// -- Write file --
ipcMain.handle('vault:write', async (_event, vaultRoot: string, relPath: string, data: string) => {
  const full = assertInsideVault(vaultRoot, relPath);
  await fsPromises.mkdir(path.dirname(full), { recursive: true });
  await fsPromises.writeFile(full, data, 'utf-8');
});

// -- List directory (returns { files, folders }) --
ipcMain.handle('vault:list', async (_event, vaultRoot: string, relPath: string) => {
  const full = assertInsideVault(vaultRoot, relPath || '.');
  const entries = await fsPromises.readdir(full, { withFileTypes: true });
  const files: string[] = [];
  const folders: string[] = [];
  for (const e of entries) {
    if (e.name.startsWith('.') || EXCLUDED_DIRS.has(e.name)) continue;
    if (e.isDirectory()) folders.push(e.name);
    else files.push(e.name);
  }
  return { files, folders };
});

// -- Walk vault --
ipcMain.handle('vault:walk', async (_event, vaultRoot: string, extensions: string[]) => {
  const extSet = new Set(extensions);
  const results: Array<{ path: string; size: number; mtime: number; ctime: number }> = [];
  const rootResolved = path.resolve(vaultRoot);

  async function walk(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = await fsPromises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || EXCLUDED_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (!extSet.has(ext)) continue;
        try {
          const st = await fsPromises.stat(full);
          results.push({
            path: path.relative(rootResolved, full),
            size: st.size,
            mtime: st.mtimeMs / 1000,
            ctime: st.birthtimeMs / 1000,
          });
        } catch {
          // skip unreadable files
        }
      }
    }
  }

  await walk(rootResolved);
  return results;
});

// -- Stat --
ipcMain.handle('vault:stat', async (_event, vaultRoot: string, relPath: string) => {
  const full = assertInsideVault(vaultRoot, relPath);
  const st = await fsPromises.stat(full);
  return {
    size: st.size,
    mtime: st.mtimeMs / 1000,
    ctime: st.birthtimeMs / 1000,
    isDirectory: st.isDirectory(),
  };
});

// -- Exists --
ipcMain.handle('vault:exists', async (_event, vaultRoot: string, relPath: string) => {
  const full = assertInsideVault(vaultRoot, relPath);
  try {
    await fsPromises.access(full);
    return true;
  } catch {
    return false;
  }
});

// -- Mkdir --
ipcMain.handle('vault:mkdir', async (_event, vaultRoot: string, relPath: string) => {
  const full = assertInsideVault(vaultRoot, relPath);
  await fsPromises.mkdir(full, { recursive: true });
});

// -- Rename path --
ipcMain.handle('vault:rename', async (_event, vaultRoot: string, fromRelPath: string, toRelPath: string) => {
  const fromFull = assertInsideVault(vaultRoot, fromRelPath);
  const toFull = assertInsideVault(vaultRoot, toRelPath);
  await fsPromises.mkdir(path.dirname(toFull), { recursive: true });
  await fsPromises.rename(fromFull, toFull);
});

// -- Delete path --
ipcMain.handle('vault:delete', async (_event, vaultRoot: string, relPath: string, recursive = true) => {
  const full = assertInsideVault(vaultRoot, relPath);
  await fsPromises.rm(full, { recursive: Boolean(recursive), force: false });
});

// -- Copy path --
ipcMain.handle('vault:copy', async (_event, vaultRoot: string, fromRelPath: string, toRelPath: string) => {
  const fromFull = assertInsideVault(vaultRoot, fromRelPath);
  const toFull = assertInsideVault(vaultRoot, toRelPath);
  await fsPromises.mkdir(path.dirname(toFull), { recursive: true });
  await fsPromises.cp(fromFull, toFull, { recursive: true, force: false, errorOnExist: true });
});

// -- Reveal path in file manager --
ipcMain.handle('vault:reveal', async (_event, vaultRoot: string, relPath: string) => {
  const full = assertInsideVault(vaultRoot, relPath);
  const stat = await fsPromises.stat(full);
  if (stat.isDirectory()) {
    const openErr = await shell.openPath(full);
    if (openErr) throw new Error(openErr);
    return;
  }
  shell.showItemInFolder(full);
});

// -- Git command --
ipcMain.handle('vault:git', async (_event, vaultRoot: string, args: string[]) => {
  return new Promise<string>((resolve, reject) => {
    const proc = spawn('git', args, { cwd: vaultRoot });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(stderr.trim() || 'Git command failed'));
      else resolve(stdout);
    });
    proc.on('error', (err) => reject(err));
  });
});

// -- Excalidraw plugin status --
ipcMain.handle('plugin:excalidraw:status', async (_event, vaultRoot: string) => {
  return getExcalidrawPluginStatus(vaultRoot);
});

// -- Excalidraw plugin install/update --
ipcMain.handle('plugin:excalidraw:installLatest', async (_event, vaultRoot: string) => {
  return installOrUpdateExcalidrawPlugin(vaultRoot);
});

// -- Hierarchy db status --
ipcMain.handle('hierarchy:status', async (_event, vaultRoot: string) => {
  return getHierarchyDbStatusOrch(vaultRoot);
});

// -- Hierarchy db init --
ipcMain.handle('hierarchy:init', async (_event, vaultRoot: string) => {
  return initializeHierarchyDbOrch(vaultRoot);
});

// -- Hierarchy nodes list --
ipcMain.handle(
  'hierarchy:nodes:list',
  async (_event, vaultRoot: string, params: { parent_id: string | null; type?: 'project' | 'epic' | 'idea' | null }) => {
    return listHierarchyNodesOrch(vaultRoot, params);
  },
);

// -- Hierarchy node get --
ipcMain.handle('hierarchy:nodes:get', async (_event, vaultRoot: string, nodeId: string) => {
  return getHierarchyNodeOrch(vaultRoot, nodeId);
});

// -- Hierarchy node create --
ipcMain.handle(
  'hierarchy:nodes:create',
  async (
    _event,
    vaultRoot: string,
    params: { type: 'project' | 'epic' | 'idea'; node_kind?: string | null; title: string; parent_id: string | null; slug?: string | null; sort_order: number },
  ) => {
    return createHierarchyNodeOrch(vaultRoot, params);
  },
);

// -- Hierarchy node update --
ipcMain.handle(
  'hierarchy:nodes:update',
  async (
    _event,
    vaultRoot: string,
    params: { node_id: string; type?: 'project' | 'epic' | 'idea' | null; node_kind?: string | null; title?: string | null; slug?: string | null; sort_order?: number | null },
  ) => {
    return updateHierarchyNodeOrch(vaultRoot, params);
  },
);

// -- Hierarchy node move --
ipcMain.handle(
  'hierarchy:nodes:move',
  async (
    _event,
    vaultRoot: string,
    params: { node_id: string; new_parent_id: string | null; sort_order?: number | null },
  ) => {
    return moveHierarchyNodeOrch(vaultRoot, params);
  },
);

// -- Hierarchy node delete --
ipcMain.handle('hierarchy:nodes:delete', async (_event, vaultRoot: string, nodeId: string) => {
  return deleteHierarchyNodeOrch(vaultRoot, nodeId);
});

// -- Hierarchy thought upsert --
ipcMain.handle(
  'hierarchy:thoughts:upsert',
  async (_event, vaultRoot: string, params: { file_path: string; title?: string | null }) => {
    return upsertHierarchyThoughtOrch(vaultRoot, params);
  },
);

// -- Hierarchy thoughts list --
ipcMain.handle(
  'hierarchy:thoughts:list',
  async (_event, vaultRoot: string, params: { unlinked_only: boolean; limit: number }) => {
    return listHierarchyThoughtsOrch(vaultRoot, params);
  },
);

// -- Hierarchy thought-links list --
ipcMain.handle(
  'hierarchy:thought-links:list',
  async (_event, vaultRoot: string, params: { thought_id?: string | null; node_id?: string | null }) => {
    return listHierarchyThoughtLinksOrch(vaultRoot, params);
  },
);

// -- Hierarchy thought-link create --
ipcMain.handle(
  'hierarchy:thought-links:create',
  async (_event, vaultRoot: string, params: { thought_id: string; node_id: string; link_kind?: string | null }) => {
    return createHierarchyThoughtLinkOrch(vaultRoot, params);
  },
);

// -- Hierarchy thought-link delete --
ipcMain.handle('hierarchy:thought-links:delete', async (_event, vaultRoot: string, linkId: string) => {
  return deleteHierarchyThoughtLinkOrch(vaultRoot, linkId);
});

// -- Hierarchy edges list --
ipcMain.handle(
  'hierarchy:edges:list',
  async (_event, vaultRoot: string, params: { from_node_id?: string | null; to_node_id?: string | null }) => {
    return listHierarchyEdgesOrch(vaultRoot, params);
  },
);

// -- Hierarchy edge create --
ipcMain.handle(
  'hierarchy:edges:create',
  async (_event, vaultRoot: string, params: { from_node_id: string; to_node_id: string; edge_kind?: string | null }) => {
    return createHierarchyEdgeOrch(vaultRoot, params);
  },
);

// -- Hierarchy edge delete --
ipcMain.handle('hierarchy:edges:delete', async (_event, vaultRoot: string, edgeId: string) => {
  return deleteHierarchyEdgeOrch(vaultRoot, edgeId);
});

// -- Hierarchy path resolve --
ipcMain.handle('hierarchy:path:resolve', async (_event, vaultRoot: string, requestedPath: string) => {
  const resolved = resolveHierarchyPathOrch(vaultRoot, requestedPath);
  if (!resolved) {
    return {
      requested_path: requestedPath,
      found: false,
      resolved_path: null,
      target_type: null,
      target_id: null,
      via_alias: false,
    };
  }
  return {
    ...resolved,
    found: true,
  };
});

// =====================================================================
// IPC Handlers — AI Credentials
// =====================================================================

ipcMain.handle('ai:credentials:claude', async () => {
  return readClaudeCredentialsBlock();
});

ipcMain.handle('ai:credentials:azure', async () => {
  return readAzureTokenBlock();
});

ipcMain.handle('ai:credentials:claude:refresh', async (_event, refreshToken: string) => {
  return refreshClaudeTokenBlock(refreshToken);
});

ipcMain.handle('ai:credentials:codex', async () => {
  return readCodexCredentialsBlock();
});

ipcMain.handle('ai:credentials:codex:refresh', async (_event, refreshToken: string) => {
  return refreshCodexTokenBlock(refreshToken);
});

ipcMain.handle(
  'ai:chat:codex',
  async (
    _event,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    accessToken: string,
    accountId?: string,
    model?: string,
  ) => {
    return chatCodexWithOauthBlock(messages, accessToken, accountId, model);
  },
);
