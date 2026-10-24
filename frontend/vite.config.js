import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const rootDir = path.resolve(__dirname, '..');
  const env = loadEnv(mode, rootDir, '');
  const targetPort = env.PORT || env.VITE_BACKEND_PORT || 5001;

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${targetPort}`,
          changeOrigin: true
        },
        '/monitor': {
          target: `http://127.0.0.1:${targetPort}`,
          changeOrigin: true
        },
        '/alerts': {
          target: `http://127.0.0.1:${targetPort}`,
          changeOrigin: true
        },
        '/health': {
          target: `http://127.0.0.1:${targetPort}`,
          changeOrigin: true
        }
      }
    }
  };
});
