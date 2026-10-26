import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    base: env.VITE_BASE_PATH || '/',
    server: {
      port: 5173,
      proxy: env.VITE_DEV_PROXY
        ? { '/api': { target: env.VITE_DEV_PROXY, changeOrigin: true } }
        : undefined,
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: true,
    },
  };
});
