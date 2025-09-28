import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { defineConfig } from 'vite';

const repoBase = (() => {
  if (process.env.GITHUB_PAGES?.toLowerCase() === 'true') {
    const repo = process.env.GITHUB_REPOSITORY?.split('/')?.[1];
    if (repo) {
      return `/${repo}/`;
    }
  }
  if (process.env.VITE_BASE_PATH) {
    const base = process.env.VITE_BASE_PATH.trim();
    if (base) return base.endsWith('/') ? base : `${base}/`;
  }
  return '/';
})();

// https://vitejs.dev/config/
export default defineConfig({
  base: repoBase,
  plugins: [wasm(), topLevelAwait(), react()],
  define: { 'process.env': {} },
  optimizeDeps: {
    // Don't optimize these packages as they contain web workers and WASM files.
    // https://github.com/vitejs/vite/issues/11672#issuecomment-1415820673
    exclude: ['@journeyapps/wa-sqlite', '@powersync/web']
  },
  worker: {
    format: 'es',
    plugins: () => [wasm(), topLevelAwait()]
  },
  server: {
    fs: {
      allow: ['../../../../../']
    }
  }
});
