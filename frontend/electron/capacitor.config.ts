import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.anurag.ltm',
  appName: 'Long Term Memory',
  webDir: 'dist',
  server: {
    cleartext: true,
  },
  ios: {
    scheme: 'Long Term Memory',
    contentInset: 'always',
  },
};

// @capacitor-community/electron reads this but the base type doesn't include it
(config as any).electron = { customUrlScheme: 'ltm-app' };

export default config;
