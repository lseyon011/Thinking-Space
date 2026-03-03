import type { CapacitorElectronConfig } from '@capacitor-community/electron';
import {
  CapElectronEventEmitter,
  CapacitorSplashScreen,
  setupCapacitorElectronPlugins,
} from '@capacitor-community/electron';
import chokidar from 'chokidar';
import type { MenuItemConstructorOptions } from 'electron';
import { app, BrowserWindow, Menu, MenuItem, nativeImage, Tray, session } from 'electron';
import electronIsDev from 'electron-is-dev';
import electronServe from 'electron-serve';
import windowStateKeeper from 'electron-window-state';
import { existsSync } from 'fs';
import { join } from 'path';

// Define components for a watcher to detect when the webapp is changed so we can reload in Dev mode.
const reloadWatcher = {
  debouncer: null,
  ready: false,
  watcher: null,
};

const MAC_TRAFFIC_LIGHT_POSITION = { x: 14, y: 14 };
export function setupReloadWatcher(electronCapacitorApp: ElectronCapacitorApp): void {
  reloadWatcher.watcher = chokidar
    .watch(join(app.getAppPath(), 'app'), {
      ignored: /[/\\]\./,
      persistent: true,
    })
    .on('ready', () => {
      reloadWatcher.ready = true;
    })
    .on('all', (_event, _path) => {
      if (reloadWatcher.ready) {
        clearTimeout(reloadWatcher.debouncer);
        reloadWatcher.debouncer = setTimeout(async () => {
          electronCapacitorApp.getMainWindow().webContents.reload();
          reloadWatcher.ready = false;
          clearTimeout(reloadWatcher.debouncer);
          reloadWatcher.debouncer = null;
          reloadWatcher.watcher = null;
          setupReloadWatcher(electronCapacitorApp);
        }, 1500);
      }
    });
}

// Define our class to manage our app.
export class ElectronCapacitorApp {
  private windows: BrowserWindow[] = [];
  private SplashScreen: CapacitorSplashScreen | null = null;
  private TrayIcon: Tray | null = null;
  private CapacitorFileConfig: CapacitorElectronConfig;
  private TrayMenuTemplate: (MenuItem | MenuItemConstructorOptions)[] = [
    new MenuItem({ label: 'Quit App', role: 'quit' }),
  ];
  private AppMenuBarMenuTemplate: (MenuItem | MenuItemConstructorOptions)[] = [
    { role: process.platform === 'darwin' ? 'appMenu' : 'fileMenu' },
    { role: 'viewMenu' },
  ];
  private mainWindowState;
  private loadWebApp;
  private customScheme: string;

  constructor(
    capacitorFileConfig: CapacitorElectronConfig,
    trayMenuTemplate?: (MenuItemConstructorOptions | MenuItem)[],
    appMenuBarMenuTemplate?: (MenuItemConstructorOptions | MenuItem)[]
  ) {
    this.CapacitorFileConfig = capacitorFileConfig;

    this.customScheme = this.CapacitorFileConfig.electron?.customUrlScheme ?? 'capacitor-electron';

    if (trayMenuTemplate) {
      this.TrayMenuTemplate = trayMenuTemplate;
    }

    if (appMenuBarMenuTemplate) {
      this.AppMenuBarMenuTemplate = appMenuBarMenuTemplate;
    }

    // Setup our web app loader, this lets us load apps like react, vue, and angular without changing their build chains.
    this.loadWebApp = electronServe({
      directory: join(app.getAppPath(), 'app'),
      scheme: this.customScheme,
    });
  }

  // Helper function to load in the app.
  private async loadMainWindow(thisRef: any) {
    await thisRef.loadWebApp(thisRef.windows[0]);
  }

  // Expose the first window for backward compatibility.
  getMainWindow(): BrowserWindow {
    return this.windows[0];
  }

  getWindowCount(): number {
    return this.windows.length;
  }

  getCustomURLScheme(): string {
    return this.customScheme;
  }

  private getWindowChromeOptions() {
    if (process.platform === 'darwin') {
      return {
        frame: false,
        titleBarStyle: 'hidden' as const,
        roundedCorners: true,
        transparent: true,
        backgroundColor: '#00000000',
        trafficLightPosition: MAC_TRAFFIC_LIGHT_POSITION,
      };
    }
    return {
      roundedCorners: true,
    };
  }

  /**
   * Preserve rounded-corner window chrome by avoiding restored maximized/fullscreen states.
   */
  private enforceRoundedRectangleWindow(targetWindow: BrowserWindow): void {
    if (targetWindow.isMaximized()) {
      targetWindow.unmaximize();
    }

    if (targetWindow.isFullScreen()) {
      targetWindow.setFullScreen(false);
    }

    if (process.platform === 'darwin' && targetWindow.isSimpleFullScreen()) {
      targetWindow.setSimpleFullScreen(false);
    }
  }

  private normalizeInAppRoute(route?: string): string | null {
    const trimmed = route?.trim();
    if (!trimmed) return null;
    const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return normalized;
  }

  private routeWindowAfterLoad(targetWindow: BrowserWindow, route?: string): void {
    const normalizedRoute = this.normalizeInAppRoute(route);
    if (!normalizedRoute) return;
    const script = `(() => {
      const nextRoute = ${JSON.stringify(normalizedRoute)};
      if (window.location.hash !== \`#\${nextRoute}\`) {
        window.location.hash = nextRoute;
      }
    })();`;

    targetWindow.webContents.once('did-finish-load', () => {
      void targetWindow.webContents.executeJavaScript(script, true).catch(() => {});
    });
  }

  private resolveAppIconPath(): string {
    const iconFileName = process.platform === 'win32' ? 'appIcon.ico' : 'appIcon.png';
    const candidates = [
      join(app.getAppPath(), 'assets', iconFileName),
      join(process.resourcesPath, 'assets', iconFileName),
      join(process.cwd(), 'assets', iconFileName),
      join(process.cwd(), 'electron', 'assets', iconFileName),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    return candidates[0];
  }

  private createAppIcon() {
    const iconPath = this.resolveAppIconPath();
    const icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      console.warn(`[electron] Unable to load app icon from ${iconPath}`);
    }
    return icon;
  }

  private attachNativeContextMenu(targetWindow: BrowserWindow): void {
    targetWindow.webContents.on('context-menu', (_event, params) => {
      let template: MenuItemConstructorOptions[] = [];

      if (params.isEditable) {
        template = [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut', enabled: params.editFlags.canCut },
          { role: 'copy', enabled: params.editFlags.canCopy },
          { role: 'paste', enabled: params.editFlags.canPaste },
          {
            label: 'Paste as Markdown Table',
            enabled: params.editFlags.canPaste,
            click: () => {
              targetWindow.webContents.send('markdown-editor:paste-as-table')
            },
          },
          { role: 'selectAll' },
        ];
      } else if (params.selectionText?.trim()) {
        template = [
          { role: 'copy' },
          { type: 'separator' },
          { role: 'selectAll' },
        ];
      } else {
        return;
      }

      Menu.buildFromTemplate(template).popup({ window: targetWindow });
    });
  }

  private applyMacWindowButtonVisibility(targetWindow: BrowserWindow): void {
    if (process.platform !== 'darwin') return;
    targetWindow.setWindowButtonVisibility(true);
    targetWindow.setWindowButtonPosition(MAC_TRAFFIC_LIGHT_POSITION);
  }

  private shouldApplyConfiguredBackgroundColor(): boolean {
    return process.platform !== 'darwin';
  }

  // Create a new window (used for multi-window support).
  async createWindow(route?: string): Promise<BrowserWindow> {
    const icon = this.createAppIcon();
    const preloadPath = join(app.getAppPath(), 'build', 'src', 'preload.js');
    const winState = windowStateKeeper({
      defaultWidth: 1400,
      defaultHeight: 900,
    });

    const newWindow = new BrowserWindow({
      icon,
      show: false,
      x: winState.x,
      y: winState.y,
      width: winState.width,
      height: winState.height,
      ...this.getWindowChromeOptions(),
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: true,
        preload: preloadPath,
      },
    });
    winState.manage(newWindow);
    this.enforceRoundedRectangleWindow(newWindow);
    this.applyMacWindowButtonVisibility(newWindow);
    this.attachNativeContextMenu(newWindow);

    if (this.CapacitorFileConfig.backgroundColor && this.shouldApplyConfiguredBackgroundColor()) {
      newWindow.setBackgroundColor(this.CapacitorFileConfig.electron.backgroundColor);
    }

    // Track window and remove on close.
    this.windows.push(newWindow);
    newWindow.on('closed', () => {
      this.windows = this.windows.filter(w => w !== newWindow);
    });

    // Security
    newWindow.webContents.setWindowOpenHandler((details) => {
      if (!details.url.includes(this.customScheme)) {
        return { action: 'deny' };
      } else {
        return { action: 'allow' };
      }
    });
    newWindow.webContents.on('will-navigate', (event, _newURL) => {
      if (!newWindow.webContents.getURL().includes(this.customScheme)) {
        event.preventDefault();
      }
    });

    // Load the web app and show the window when ready.
    newWindow.webContents.on('dom-ready', () => {
      newWindow.show();
      if (electronIsDev) {
        newWindow.webContents.openDevTools();
      }
    });

    this.routeWindowAfterLoad(newWindow, route);
    await this.loadWebApp(newWindow);
    return newWindow;
  }

  async init(): Promise<void> {
    const icon = this.createAppIcon();
    if (process.platform === 'darwin' && !icon.isEmpty()) {
      app.dock?.setIcon(icon);
    }
    this.mainWindowState = windowStateKeeper({
      defaultWidth: 1400,
      defaultHeight: 900,
    });
    // Setup preload script path and construct our main window.
    const preloadPath = join(app.getAppPath(), 'build', 'src', 'preload.js');
    const mainWindow = new BrowserWindow({
      icon,
      show: false,
      x: this.mainWindowState.x,
      y: this.mainWindowState.y,
      width: this.mainWindowState.width,
      height: this.mainWindowState.height,
      ...this.getWindowChromeOptions(),
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: true,
        preload: preloadPath,
      },
    });
    this.mainWindowState.manage(mainWindow);
    this.enforceRoundedRectangleWindow(mainWindow);
    this.applyMacWindowButtonVisibility(mainWindow);
    this.windows = [mainWindow];
    this.attachNativeContextMenu(mainWindow);

    if (this.CapacitorFileConfig.backgroundColor && this.shouldApplyConfiguredBackgroundColor()) {
      mainWindow.setBackgroundColor(this.CapacitorFileConfig.electron.backgroundColor);
    }

    // If we close the main window with the splashscreen enabled we need to destroy the ref.
    mainWindow.on('closed', () => {
      this.windows = this.windows.filter(w => w !== mainWindow);
      if (this.SplashScreen?.getSplashWindow() && !this.SplashScreen.getSplashWindow().isDestroyed()) {
        this.SplashScreen.getSplashWindow().close();
      }
    });

    // When the tray icon is enabled, setup the options.
    if (this.CapacitorFileConfig.electron?.trayIconAndMenuEnabled) {
      this.TrayIcon = new Tray(icon);
      this.TrayIcon.on('double-click', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      });
      this.TrayIcon.on('click', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      });
      this.TrayIcon.setToolTip(app.getName());
      this.TrayIcon.setContextMenu(Menu.buildFromTemplate(this.TrayMenuTemplate));
    }

    // Setup the main menu bar at the top of our window.
    Menu.setApplicationMenu(Menu.buildFromTemplate(this.AppMenuBarMenuTemplate));

    // If the splashscreen is enabled, show it first while the main window loads then switch it out for the main window, or just load the main window from the start.
    if (this.CapacitorFileConfig.electron?.splashScreenEnabled) {
      this.SplashScreen = new CapacitorSplashScreen({
        imageFilePath: join(
          app.getAppPath(),
          'assets',
          this.CapacitorFileConfig.electron?.splashScreenImageName ?? 'splash.png'
        ),
        windowWidth: 400,
        windowHeight: 400,
      });
      this.SplashScreen.init(this.loadMainWindow, this);
    } else {
      this.loadMainWindow(this);
    }

    // Security
    mainWindow.webContents.setWindowOpenHandler((details) => {
      if (!details.url.includes(this.customScheme)) {
        return { action: 'deny' };
      } else {
        return { action: 'allow' };
      }
    });
    mainWindow.webContents.on('will-navigate', (event, _newURL) => {
      if (!mainWindow.webContents.getURL().includes(this.customScheme)) {
        event.preventDefault();
      }
    });

    // Link electron plugins into the system.
    setupCapacitorElectronPlugins();

    // When the web app is loaded we hide the splashscreen if needed and show the mainwindow.
    mainWindow.webContents.on('dom-ready', () => {
      if (this.CapacitorFileConfig.electron?.splashScreenEnabled) {
        this.SplashScreen.getSplashWindow().hide();
      }
      if (!this.CapacitorFileConfig.electron?.hideMainWindowOnLaunch) {
        mainWindow.show();
      }
      setTimeout(() => {
        if (electronIsDev) {
          mainWindow.webContents.openDevTools();
        }
        CapElectronEventEmitter.emit('CAPELECTRON_DeeplinkListenerInitialized', '');
      }, 400);
    });
  }
}

// Set a CSP up for our application based on the custom scheme
export function setupContentSecurityPolicy(customScheme: string): void {
  const aiConnectSrc = [
    'https://api.anthropic.com',
    'https://*.openai.azure.com',
    'https://platform.claude.com',
    'https://api.openai.com',
    'https://auth.openai.com',
    'https://chatgpt.com',
    // Allow local OpenAI-compatible runtimes (LM Studio, etc.) from Electron renderer.
    'http://localhost:1234',
    'http://127.0.0.1:1234',
    'http://192.168.4.23:1234',
    'ws://localhost:1234',
    'ws://127.0.0.1:1234',
    'ws://192.168.4.23:1234',
  ].join(' ');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          electronIsDev
            ? `default-src ${customScheme}://* 'unsafe-inline' devtools://* 'unsafe-eval' data:; img-src ${customScheme}://* data: blob: https:; media-src ${customScheme}://* data: blob: https:; connect-src ${customScheme}://* ${aiConnectSrc} devtools://*`
            : `default-src ${customScheme}://* 'unsafe-inline' data:; img-src ${customScheme}://* data: blob: https:; media-src ${customScheme}://* data: blob: https:; connect-src ${customScheme}://* ${aiConnectSrc}`,
        ],
      },
    });
  });
}
