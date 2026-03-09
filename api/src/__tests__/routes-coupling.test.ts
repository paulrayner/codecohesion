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
 * Minimal CouplingGraph fixture conforming to coupling-v1 format.
 *
 * Edges:
 *   src/lib/auth.ts  <->  src/lib/token.ts    (coupling 0.72, coChangeCount 8)
 *   src/index.ts     <->  src/lib/auth.ts     (coupling 0.45, coChangeCount 5)
 *   src/a.ts         <->  src/b.ts            (coupling 0.30, coChangeCount 3)
 *
 * Clusters:
 *   Cluster 1: [src/lib/auth.ts, src/lib/token.ts], avgInternalCoupling 0.72
 *   Cluster 2: [src/a.ts, src/b.ts],                avgInternalCoupling 0.30
 */
const COUPLING_GRAPH = {
  format: 'coupling-v1',
  repositoryPath: '/repos/my-repo',
  sourceTimeline: 'my-repo-timeline.json',
  analysis: {
    totalCommits: 100,
    filesAnalyzed: 5,
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
    {
      id: 2,
      name: 'Cluster 2',
      files: ['src/a.ts', 'src/b.ts'],
      fileCount: 2,
      avgInternalCoupling: 0.30,
    },
  ],
};

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET /api/repos/:repoId/coupling
// ---------------------------------------------------------------------------

describe('GET /api/repos/:repoId/coupling', () => {
  it('returns 200 with edges and clusters when coupling data exists', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify(COUPLING_GRAPH) as unknown as ArrayBuffer
    );

    const app = buildApp();
    const res = await request(app).get('/api/repos/my-repo/coupling');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('repository');
    expect(res.body.repository.id).toBe('my-repo');
    expect(res.body).toHaveProperty('data');

    const { data } = res.body;
    expect(data).toHaveProperty('edges');
    expect(Array.isArray(data.edges)).toBe(true);
    expect(data.edges.length).toBeGreaterThan(0);
    expect(data).toHaveProperty('clusters');
    expect(Array.isArray(data.clusters)).toBe(true);
  });

  it('includes analysis metadata in the response data', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify(COUPLING_GRAPH) as unknown as ArrayBuffer
    );

    const app = buildApp();
    const res = await request(app).get('/api/repos/my-repo/coupling');

    expect(res.status).toBe(200);
    const { data } = res.body;
    expect(data).toHaveProperty('analysis');
    expect(data.analysis).toHaveProperty('totalCommits');
    expect(data.analysis).toHaveProperty('filesAnalyzed');
    expect(data.analysis).toHaveProperty('couplingEdges');
    expect(data.analysis).toHaveProperty('generatedAt');
  });

  it('returns edges with fileA, fileB, coChangeCount, and coupling fields', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify(COUPLING_GRAPH) as unknown as ArrayBuffer
    );

    const app = buildApp();
    const res = await request(app).get('/api/repos/my-repo/coupling');

    expect(res.status).toBe(200);
    const firstEdge = res.body.data.edges[0];
    expect(firstEdge).toHaveProperty('fileA');
    expect(firstEdge).toHaveProperty('fileB');
    expect(firstEdge).toHaveProperty('coChangeCount');
    expect(firstEdge).toHaveProperty('coupling');
  });

  it('returns cluster data with file counts and avgInternalCoupling', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify(COUPLING_GRAPH) as unknown as ArrayBuffer
    );

    const app = buildApp();
    const res = await request(app).get('/api/repos/my-repo/coupling');

    expect(res.status).toBe(200);
    const { clusters } = res.body.data;
    expect(clusters.length).toBeGreaterThan(0);

    for (const cluster of clusters as Array<{
      id: number;
      name: string;
      files: string[];
      fileCount: number;
      avgInternalCoupling: number;
    }>) {
      expect(cluster).toHaveProperty('id');
      expect(cluster).toHaveProperty('name');
      expect(cluster).toHaveProperty('files');
      expect(Array.isArray(cluster.files)).toBe(true);
      expect(cluster).toHaveProperty('fileCount');
      expect(typeof cluster.fileCount).toBe('number');
      expect(cluster.fileCount).toBe(cluster.files.length);
      expect(cluster).toHaveProperty('avgInternalCoupling');
      expect(typeof cluster.avgInternalCoupling).toBe('number');
    }
  });

  it('returns 404 with a message directing the user to run coupling analysis when data does not exist', async () => {
    const enoentError = Object.assign(new Error('ENOENT: no such file'), {
      code: 'ENOENT',
    });
    vi.mocked(fs.readFile).mockRejectedValue(enoentError);

    const app = buildApp();
    const res = await request(app).get('/api/repos/unknown-repo/coupling');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    // The response must hint at how to generate coupling data
    const bodyText = JSON.stringify(res.body).toLowerCase();
    expect(
      bodyText.includes('coupling') || bodyText.includes('not found')
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/repos/:repoId/coupling/:filePath(*)
// ---------------------------------------------------------------------------

describe('GET /api/repos/:repoId/coupling/:filePath(*)', () => {
  it('returns 200 with only edges that involve the specified file', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify(COUPLING_GRAPH) as unknown as ArrayBuffer
    );

    const app = buildApp();
    const res = await request(app).get(
      '/api/repos/my-repo/coupling/src/lib/auth.ts'
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('repository');
    expect(res.body.repository.id).toBe('my-repo');
    expect(res.body).toHaveProperty('file', 'src/lib/auth.ts');
    expect(res.body).toHaveProperty('edges');
    expect(Array.isArray(res.body.edges)).toBe(true);

    // Only edges involving src/lib/auth.ts must appear
    for (const edge of res.body.edges as Array<{ fileA: string; fileB: string }>) {
      expect(
        edge.fileA === 'src/lib/auth.ts' || edge.fileB === 'src/lib/auth.ts'
      ).toBe(true);
    }
  });

  it('excludes edges that do not involve the specified file', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify(COUPLING_GRAPH) as unknown as ArrayBuffer
    );

    const app = buildApp();
    const res = await request(app).get(
      '/api/repos/my-repo/coupling/src/lib/auth.ts'
    );

    expect(res.status).toBe(200);
    // The unrelated src/a.ts <-> src/b.ts edge must NOT appear
    const unrelated = (res.body.edges as Array<{ fileA: string; fileB: string }>).find(
      (e) => e.fileA === 'src/a.ts' || e.fileB === 'src/b.ts'
    );
    expect(unrelated).toBeUndefined();
  });

  it('returns edges sorted by coupling value descending', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify(COUPLING_GRAPH) as unknown as ArrayBuffer
    );

    const app = buildApp();
    const res = await request(app).get(
      '/api/repos/my-repo/coupling/src/lib/auth.ts'
    );

    expect(res.status).toBe(200);
    const couplingValues: number[] = (
      res.body.edges as Array<{ coupling: number }>
    ).map((e) => e.coupling);

    for (let i = 1; i < couplingValues.length; i++) {
      expect(couplingValues[i - 1]).toBeGreaterThanOrEqual(couplingValues[i]);
    }
  });

  it('returns an empty edges array (not an error) when the file has no coupling relationships', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify(COUPLING_GRAPH) as unknown as ArrayBuffer
    );

    const app = buildApp();
    // src/standalone.ts appears in no edge of the fixture
    const res = await request(app).get(
      '/api/repos/my-repo/coupling/src/standalone.ts'
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('file', 'src/standalone.ts');
    expect(res.body).toHaveProperty('edges');
    expect(Array.isArray(res.body.edges)).toBe(true);
    expect(res.body.edges).toHaveLength(0);
  });

  it('correctly captures file paths containing slashes via wildcard param', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify(COUPLING_GRAPH) as unknown as ArrayBuffer
    );

    const app = buildApp();
    const res = await request(app).get(
      '/api/repos/my-repo/coupling/src/lib/token.ts'
    );

    expect(res.status).toBe(200);
    // The `file` field must reflect the full nested path
    expect(res.body).toHaveProperty('file', 'src/lib/token.ts');
    // src/lib/auth.ts <-> src/lib/token.ts edge must be present
    const edges = res.body.edges as Array<{ fileA: string; fileB: string }>;
    const authTokenEdge = edges.find(
      (e) =>
        (e.fileA === 'src/lib/token.ts' || e.fileB === 'src/lib/token.ts') &&
        (e.fileA === 'src/lib/auth.ts' || e.fileB === 'src/lib/auth.ts')
    );
    expect(authTokenEdge).toBeDefined();
  });

  it('returns 404 with a message directing the user to run coupling analysis when data does not exist', async () => {
    const enoentError = Object.assign(new Error('ENOENT: no such file'), {
      code: 'ENOENT',
    });
    vi.mocked(fs.readFile).mockRejectedValue(enoentError);

    const app = buildApp();
    const res = await request(app).get(
      '/api/repos/unknown-repo/coupling/src/lib/auth.ts'
    );

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    const bodyText = JSON.stringify(res.body).toLowerCase();
    expect(
      bodyText.includes('coupling') || bodyText.includes('not found')
    ).toBe(true);
  });
});
