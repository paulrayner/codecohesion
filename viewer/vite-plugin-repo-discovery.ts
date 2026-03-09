import { readdirSync } from 'fs';
import { resolve } from 'path';
import type { Plugin } from 'vite';

/**
 * Vite plugin that auto-discovers repo JSON files in public/data/
 * and serves them as repos.json — no manual manifest needed.
 */
export function repoDiscoveryPlugin(): Plugin {
  const publicDataDir = resolve(__dirname, 'public/data');

  function discoverRepos(): string[] {
    try {
      const files = readdirSync(publicDataDir);
      return files
        .filter(f => f.endsWith('.json') && f !== 'repos.json')
        .map(f => f.replace('.json', ''));
    } catch {
      return [];
    }
  }

  return {
    name: 'repo-discovery',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/data/repos.json') {
          const repos = discoverRepos();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ repos }));
          return;
        }
        next();
      });
    },

    generateBundle() {
      const repos = discoverRepos();
      this.emitFile({
        type: 'asset',
        fileName: 'data/repos.json',
        source: JSON.stringify({ repos }),
      });
    },
  };
}
