/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { serviceWorkerPlugin } from './pwa/serviceWorkerPlugin';

// base: './' makes the build work from any sub-path (GitHub Pages project sites, /kout/, etc.)
export default defineConfig({
  base: './',
  plugins: [react(), serviceWorkerPlugin(fileURLToPath(new URL('./pwa/sw.template.js', import.meta.url)))],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
