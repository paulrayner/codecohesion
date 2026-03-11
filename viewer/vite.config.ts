import { defineConfig } from 'vite';
import { repoDiscoveryPlugin } from './vite-plugin-repo-discovery';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: '/',
  plugins: [repoDiscoveryPlugin()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist'
  }
});
