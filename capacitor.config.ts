import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lovein.university',
  appName: 'LoveIn',
  webDir: 'dist',
  android: {
    minWebViewVersion: 60,
    minHuaweiWebViewVersion: 10,
  },
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    errorPath: 'error.html',
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,   // Patches window.fetch on native → bypasses CORS, allows direct ASMR API access
    },
  },
};

export default config;
