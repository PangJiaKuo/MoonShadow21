import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.moon21.game',
  appName: '月影二十一',
  webDir: 'dist',
  server: {
    // 单机版 APK：本地静态页面，不使用 Capacitor 内置服务器
    androidScheme: 'https',
  },
};

export default config;
