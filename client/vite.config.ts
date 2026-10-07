import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// monorepo 内共享包直接以 TS 源码解析
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@moon21/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@moon21/engine': path.resolve(__dirname, '../engine/src/index.ts'),
    },
  },
  server: {
    port: 5173,
  },
});
