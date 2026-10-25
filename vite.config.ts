import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import pkg from './package.json' with { type: 'json' };

// GitHub Pages serves the site from /<repo>/, so the base path must match in CI.
const base = process.env.GITHUB_PAGES_BASE ?? '/';

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1600, // Phaser is ~1.2 MB minified; that is expected.
    rollupOptions: {
      output: {
        manualChunks(id) {
          return id.includes('node_modules/phaser') ? 'phaser' : undefined;
        },
      },
    },
  },
  server: { port: 5173, strictPort: true },
});
