import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.anurag.ltm',
  appName: 'Thinking Space',
  webDir: 'dist',
  server: {
    cleartext: true,
  },
  ios: {
    scheme: 'Thinking Space',
    contentInset: 'automatic',
  },
};

// @capacitor-community/electron reads this but the base type doesn't include it
(config as any).electron = { customUrlScheme: 'ltm-app' };

export default config;
