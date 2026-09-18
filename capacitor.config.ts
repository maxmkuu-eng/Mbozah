import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mkuu.ai',
  appName: 'MKUU AI',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    url: 'https://mbozah-irm2e.faable.link',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
