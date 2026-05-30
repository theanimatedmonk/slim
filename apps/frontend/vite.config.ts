import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const repoRoot = path.resolve(rootDir, '../..');

export default defineConfig({
  // Load VITE_* from monorepo root .env (not only apps/frontend)
  envDir: repoRoot,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Use TS sources — dist/ is CommonJS and breaks Vite named imports
      '@asset-optimiser/shared-utils': path.resolve(
        rootDir,
        '../../packages/shared-utils/src/index.ts'
      ),
      '@asset-optimiser/shared-types': path.resolve(
        rootDir,
        '../../packages/shared-types/src/index.ts'
      ),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/health': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
