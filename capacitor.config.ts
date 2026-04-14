import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.salesmanager.app',
  appName: 'Sales Manager',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
