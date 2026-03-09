import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock fs/promises before any module that uses it is imported.
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    readdir: vi.fn(),
  },
}));

import fs from 'fs/promises';
import { createRoutes } from '../routes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api', createRoutes());
  return app;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Minimal RepositorySnapshot fixture.
 * Tree contains one file: src/lib/auth.ts — owned by alice@example.com with 12 commits.
 */
const SNAPSHOT = {
  repositoryPath: '/repos/my-repo',
  commit: 'abc123',
  timestamp: '2026-01-01T00:00:00.000Z',
  author: 'alice@example.com',
  message: 'initial commit',
  stats: { totalFiles: 1, totalLoc: 100, filesByExtension: { ts: 1 } },
  commitMessages: {},
  tree: {
    path: '',
    name: 'root',
    type: 'directory',
    children: [
      {
        path: 'src',
        name: 'src',
        type: 'directory',
        children: [
          {
            path: 'src/lib',
            name: 'lib',
            type: 'directory',
            children: [
              {
                path: 'src/lib/auth.ts',
                name: 'auth.ts',
                type: 'file',
                loc: 80,
                extension: 'ts',
                lastModified: '2026-01-01T00:00:00.000Z',
                lastAuthor: 'alice@example.com',
                lastCommitHash: 'abc123',
                commitCount: 12,
                contributorCount: 2,
                firstCommitDate: '2025-01-01T00:00:00.000Z',
                recentLinesChanged: 50,
                avgLinesPerCommit: 10,
                daysSinceLastModified: 5,
              },
            ],
          },
        ],
      },
    ],
  },
};

/**
 * Minimal StructureGraph fixture.
 * src/lib/auth.ts imports from two modules and declares two functions.
 */
const STRUCTURE_GRAPH = {
  format: 'structure-v1',
  repositoryPath: '/repos/my-repo',
  analyzedAt: '2026-01-01T00:00:00.000Z',
  analysis: {
    filesAnalyzed: 3,
    importEdges: 2,
    functionDecls: 2,
    parseErrors: 0,
  },
  imports: [
    {
      from: 'src/lib/auth.ts',
      to: 'src/lib/token.ts',
      toRaw: './token',
      symbols: ['generateToken'],
      isExternal: false,
    },
    {
      from: 'src/lib/auth.ts',
      to: '',
      toRaw: 'bcrypt',
      symbols: ['hash', 'compare'],
      isExternal: true,
    },
    // edge that does NOT involve auth.ts — must not appear in response
    {
      from: 'src/index.ts',
      to: 'src/lib/auth.ts',
      toRaw: './lib/auth',
      symbols: ['login'],
      isExternal: false,
    },
  ],
  functions: [
    {
      file: 'src/lib/auth.ts',
      name: 'login',
      kind: 'function',
      line: 10,
      endLine: 30,
      params: ['username', 'password'],
      isExported: true,
    },
    {
      file: 'src/lib/auth.ts',
      name: 'logout',
      kind: 'function',
      line: 32,
      endLine: 40,
      params: ['sessionId'],
      isExported: true,
    },
    // function from a different file — must not appear in response
    {
      file: 'src/index.ts',
      name: 'main',
      kind: 'function',
      line: 1,
      endLine: 5,
      params: [],
      isExported: false,
    },
  ],
};

/**
 * Minimal CouplingGraph fixture.
 * Contains a coupling edge involving src/lib/auth.ts.
 */
const COUPLING_GRAPH = {
  format: 'coupling-v1',
  repositoryPath: '/repos/my-repo',
  sourceTimeline: 'my-repo-timeline.json',
  analysis: {
    totalCommits: 100,
    filesAnalyzed: 10,
    couplingEdges: 3,
    generatedAt: '2026-01-01T00:00:00.000Z',
  },
  edges: [
    {
      fileA: 'src/lib/auth.ts',
      fileB: 'src/lib/token.ts',
      coChangeCount: 8,
      coupling: 0.72,
    },
    {
      fileA: 'src/index.ts',
      fileB: 'src/lib/auth.ts',
      coChangeCount: 5,
      coupling: 0.45,
    },
    // edge that does NOT involve auth.ts
    {
      fileA: 'src/a.ts',
      fileB: 'src/b.ts',
      coChangeCount: 3,
      coupling: 0.30,
    },
  ],
  clusters: [
    {
      id: 1,
      name: 'Cluster 1',
      files: ['src/lib/auth.ts', 'src/lib/token.ts'],
      fileCount: 2,
      avgInternalCoupling: 0.72,
    },
  ],
};

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET /api/repos/:repoId/context/:filePath(*)
// ---------------------------------------------------------------------------

describe('GET /api/repos/:repoId/context/:filePath(*)', () => {
  it('returns 200 with ownership section containing lastAuthor and commitCount from the tree', async () => {
    // readFile is called multiple times: snapshot, structure, and optionally coupling.
    // Return snapshot for the first call, structure for the second, and reject coupling.
    const enoentError = Object.assign(new Error('ENOENT: no such file'), {
      code: 'ENOENT',
    });
    vi.mocked(fs.readFile)
      .mockResolvedValueOnce(JSON.stringify(SNAPSHOT) as unknown as ArrayBuffer)
      .mockResolvedValueOnce(JSON.stringify(STRUCTURE_GRAPH) as unknown as ArrayBuffer)
      .mockRejectedValueOnce(enoentError);

    const app = buildApp();
    const res = await request(app).get(
      '/api/repos/my-repo/context/src/lib/auth.ts'
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('repository');
    expect(res.body.repository.id).toBe('my-repo');
    expect(res.body).toHaveProperty('file', 'src/lib/auth.ts');
    expect(res.body).toHaveProperty('ownership');
    expect(res.body.ownership).toHaveProperty('lastAuthor', 'alice@example.com');
    expect(res.body.ownership).toHaveProperty('commitCount', 12);
  });

  it('returns imports section listing only edges that originate from the requested file', async () => {
    const enoentError = Object.assign(new Error('ENOENT: no such file'), {
      code: 'ENOENT',
    });
    vi.mocked(fs.readFile)
      .mockResolvedValueOnce(JSON.stringify(SNAPSHOT) as unknown as ArrayBuffer)
      .mockResolvedValueOnce(JSON.stringify(STRUCTURE_GRAPH) as unknown as ArrayBuffer)
      .mockRejectedValueOnce(enoentError);

    const app = buildApp();
    const res = await request(app).get(
      '/api/repos/my-repo/context/src/lib/auth.ts'
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('imports');
    expect(Array.isArray(res.body.imports)).toBe(true);
    // Only the two edges whose `from` is src/lib/auth.ts must appear
    expect(res.body.imports).toHaveLength(2);
    const targets = res.body.imports.map((e: { to: string }) => e.to);
    expect(targets).toContain('src/lib/token.ts');
    // The edge from src/index.ts must NOT appear
    const froms = res.body.imports.map((e: { from: string }) => e.from);
    expect(froms.every((f: string) => f === 'src/lib/auth.ts')).toBe(true);
  });

  it('returns functions section listing only declarations from the requested file', async () => {
    const enoentError = Object.assign(new Error('ENOENT: no such file'), {
      code: 'ENOENT',
    });
    vi.mocked(fs.readFile)
      .mockResolvedValueOnce(JSON.stringify(SNAPSHOT) as unknown as ArrayBuffer)
      .mockResolvedValueOnce(JSON.stringify(STRUCTURE_GRAPH) as unknown as ArrayBuffer)
      .mockRejectedValueOnce(enoentError);

    const app = buildApp();
    const res = await request(app).get(
      '/api/repos/my-repo/context/src/lib/auth.ts'
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('functions');
    expect(Array.isArray(res.body.functions)).toBe(true);
    // Only the two functions declared in src/lib/auth.ts must appear
    expect(res.body.functions).toHaveLength(2);
    const names = res.body.functions.map((f: { name: string }) => f.name);
    expect(names).toContain('login');
    expect(names).toContain('logout');
    // The `main` function from src/index.ts must NOT appear
    expect(names).not.toContain('main');
  });

  it('includes coupling section with related edges when coupling data exists for the repo', async () => {
    vi.mocked(fs.readFile)
      .mockResolvedValueOnce(JSON.stringify(SNAPSHOT) as unknown as ArrayBuffer)
      .mockResolvedValueOnce(JSON.stringify(STRUCTURE_GRAPH) as unknown as ArrayBuffer)
      .mockResolvedValueOnce(JSON.stringify(COUPLING_GRAPH) as unknown as ArrayBuffer);

    const app = buildApp();
    const res = await request(app).get(
      '/api/repos/my-repo/context/src/lib/auth.ts'
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('coupling');
    expect(Array.isArray(res.body.coupling)).toBe(true);
    expect(res.body.coupling.length).toBeGreaterThan(0);
    // Every entry must involve src/lib/auth.ts as either fileA or fileB
    for (const edge of res.body.coupling as Array<{ fileA: string; fileB: string }>) {
      expect(
        edge.fileA === 'src/lib/auth.ts' || edge.fileB === 'src/lib/auth.ts'
      ).toBe(true);
    }
    // The unrelated edge (src/a.ts <-> src/b.ts) must NOT appear
    const unrelated = (res.body.coupling as Array<{ fileA: string; fileB: string }>).find(
      (e) => e.fileA === 'src/a.ts' || e.fileB === 'src/b.ts'
    );
    expect(unrelated).toBeUndefined();
  });

  it('omits coupling section (no error) when coupling data does not exist for the repo', async () => {
    const enoentError = Object.assign(new Error('ENOENT: no such file'), {
      code: 'ENOENT',
    });
    vi.mocked(fs.readFile)
      .mockResolvedValueOnce(JSON.stringify(SNAPSHOT) as unknown as ArrayBuffer)
      .mockResolvedValueOnce(JSON.stringify(STRUCTURE_GRAPH) as unknown as ArrayBuffer)
      .mockRejectedValueOnce(enoentError);

    const app = buildApp();
    const res = await request(app).get(
      '/api/repos/my-repo/context/src/lib/auth.ts'
    );

    expect(res.status).toBe(200);
    // coupling key must be absent — not an empty array, not null
    expect(res.body).not.toHaveProperty('coupling');
  });

  it('returns 404 with helpful message when snapshot data does not exist for the repository', async () => {
    const enoentError = Object.assign(new Error('ENOENT: no such file'), {
      code: 'ENOENT',
    });
    vi.mocked(fs.readFile).mockRejectedValue(enoentError);
    vi.mocked(fs.readdir).mockResolvedValue([] as unknown as string[]);

    const app = buildApp();
    const res = await request(app).get(
      '/api/repos/unknown-repo/context/src/lib/auth.ts'
    );

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    // The message must give the caller a hint (mention repo, not found, or how to fix)
    const bodyText = JSON.stringify(res.body).toLowerCase();
    expect(
      bodyText.includes('not found') || bodyText.includes('unknown-repo')
    ).toBe(true);
  });

  it('correctly identifies the file node in a nested directory tree using full path traversal', async () => {
    // The snapshot only has src/lib/auth.ts — the route must walk the tree to find it
    const enoentError = Object.assign(new Error('ENOENT: no such file'), {
      code: 'ENOENT',
    });
    vi.mocked(fs.readFile)
      .mockResolvedValueOnce(JSON.stringify(SNAPSHOT) as unknown as ArrayBuffer)
      .mockResolvedValueOnce(JSON.stringify(STRUCTURE_GRAPH) as unknown as ArrayBuffer)
      .mockRejectedValueOnce(enoentError);

    const app = buildApp();
    // Deep nested path must be captured intact by Express wildcard param
    const res = await request(app).get(
      '/api/repos/my-repo/context/src/lib/auth.ts'
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('file', 'src/lib/auth.ts');
    // Ownership must reflect the data stored on the nested FileNode, not a default
    expect(res.body.ownership.lastAuthor).toBe('alice@example.com');
    expect(res.body.ownership.commitCount).toBe(12);
  });

  it('returns ownership with null values when the file is found in structure but absent from the snapshot tree', async () => {
    const enoentError = Object.assign(new Error('ENOENT: no such file'), {
      code: 'ENOENT',
    });
    vi.mocked(fs.readFile)
      .mockResolvedValueOnce(JSON.stringify(SNAPSHOT) as unknown as ArrayBuffer)
      .mockResolvedValueOnce(JSON.stringify(STRUCTURE_GRAPH) as unknown as ArrayBuffer)
      .mockRejectedValueOnce(enoentError);

    const app = buildApp();
    // src/index.ts has structure entries but is NOT in the snapshot tree fixture
    const res = await request(app).get(
      '/api/repos/my-repo/context/src/index.ts'
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('file', 'src/index.ts');
    expect(res.body).toHaveProperty('ownership');
    // lastAuthor and commitCount must be null (file not found in tree)
    expect(res.body.ownership.lastAuthor).toBeNull();
    expect(res.body.ownership.commitCount).toBeNull();
  });
});
