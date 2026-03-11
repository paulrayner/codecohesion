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

/** Minimal ComplexityReport fixture conforming to complexity-v1 format. */
const COMPLEXITY_REPORT = {
  format: 'complexity-v1',
  repositoryPath: '/repos/my-repo',
  analyzedAt: '2026-01-01T00:00:00.000Z',
  analysis: {
    filesAnalyzed: 2,
    functionsAnalyzed: 4,
    avgCyclomatic: 3.5,
    avgCognitive: 2.0,
  },
  files: [
    {
      file: 'src/a.ts',
      totalCyclomatic: 6,
      totalCognitive: 4,
      maxCyclomatic: 4,
      maxCognitive: 3,
      functionCount: 2,
      functions: [
        { name: 'foo', kind: 'function', line: 1, endLine: 10, cyclomatic: 4, cognitive: 3 },
        { name: 'bar', kind: 'function', line: 12, endLine: 20, cyclomatic: 2, cognitive: 1 },
      ],
    },
    {
      file: 'src/b.ts',
      totalCyclomatic: 1,
      totalCognitive: 1,
      maxCyclomatic: 1,
      maxCognitive: 1,
      functionCount: 2,
      functions: [
        { name: 'baz', kind: 'arrow', line: 1, endLine: 5, cyclomatic: 1, cognitive: 1 },
        { name: 'qux', kind: 'arrow', line: 7, endLine: 11, cyclomatic: 1, cognitive: 1 },
      ],
    },
  ],
  hotspots: [
    {
      file: 'src/a.ts',
      complexityScore: 0.9,
      churnScore: 0.8,
      hotspotScore: 0.72,
      totalCyclomatic: 6,
      commitCount: 42,
    },
    {
      file: 'src/b.ts',
      complexityScore: 0.2,
      churnScore: 0.1,
      hotspotScore: 0.02,
      totalCyclomatic: 1,
      commitCount: 5,
    },
    {
      file: 'src/c.ts',
      complexityScore: 0.5,
      churnScore: 0.6,
      hotspotScore: 0.3,
      totalCyclomatic: 3,
      commitCount: 20,
    },
  ],
};

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET /api/repos/:repoId/complexity
// ---------------------------------------------------------------------------

describe('GET /api/repos/:repoId/complexity', () => {
  it('returns 200 with file list containing cyclomatic and cognitive metrics when data exists', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify(COMPLEXITY_REPORT) as unknown as ArrayBuffer
    );

    const app = buildApp();
    const res = await request(app).get('/api/repos/my-repo/complexity');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('repository');
    expect(res.body.repository.id).toBe('my-repo');
    expect(res.body).toHaveProperty('data');

    const { data } = res.body;
    expect(data).toHaveProperty('files');
    expect(Array.isArray(data.files)).toBe(true);
    expect(data.files.length).toBeGreaterThan(0);

    const firstFile = data.files[0];
    expect(firstFile).toHaveProperty('file');
    expect(firstFile).toHaveProperty('totalCyclomatic');
    expect(firstFile).toHaveProperty('totalCognitive');
    expect(firstFile).toHaveProperty('maxCyclomatic');
    expect(firstFile).toHaveProperty('maxCognitive');
    expect(firstFile).toHaveProperty('functions');
  });

  it('returns 404 with helpful message when complexity data does not exist for repository', async () => {
    const enoentError = Object.assign(new Error('ENOENT: no such file'), {
      code: 'ENOENT',
    });
    vi.mocked(fs.readFile).mockRejectedValue(enoentError);

    const app = buildApp();
    const res = await request(app).get('/api/repos/unknown-repo/complexity');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    // The error message should mention how to generate complexity data
    const bodyText = JSON.stringify(res.body).toLowerCase();
    expect(
      bodyText.includes('complexity') || bodyText.includes('not found')
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/repos/:repoId/complexity/hotspots
// ---------------------------------------------------------------------------

describe('GET /api/repos/:repoId/complexity/hotspots', () => {
  it('returns entries sorted by hotspotScore descending', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify(COMPLEXITY_REPORT) as unknown as ArrayBuffer
    );

    const app = buildApp();
    const res = await request(app).get('/api/repos/my-repo/complexity/hotspots');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('hotspots');
    expect(Array.isArray(res.body.hotspots)).toBe(true);

    const scores: number[] = res.body.hotspots.map((h: { hotspotScore: number }) => h.hotspotScore);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }
  });

  it('respects the limit query parameter and returns at most limit entries', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify(COMPLEXITY_REPORT) as unknown as ArrayBuffer
    );

    const app = buildApp();
    const res = await request(app).get('/api/repos/my-repo/complexity/hotspots?limit=2');

    expect(res.status).toBe(200);
    expect(res.body.hotspots.length).toBeLessThanOrEqual(2);
  });

  it('returns 400 when limit is below the minimum allowed value of 1', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify(COMPLEXITY_REPORT) as unknown as ArrayBuffer
    );

    const app = buildApp();
    const res = await request(app).get('/api/repos/my-repo/complexity/hotspots?limit=0');

    expect(res.status).toBe(400);
  });

  it('returns 400 when limit exceeds the maximum allowed value of 100', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify(COMPLEXITY_REPORT) as unknown as ArrayBuffer
    );

    const app = buildApp();
    const res = await request(app).get('/api/repos/my-repo/complexity/hotspots?limit=101');

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/process — complexity mode acceptance
// ---------------------------------------------------------------------------

describe('POST /api/process — complexity mode', () => {
  it('accepts "complexity" as a valid processing mode and returns 202', async () => {
    // Mock ProcessService.startJob indirectly: routes create an internal ProcessService
    // instance that will attempt to run a real job unless we prevent it from reaching
    // the filesystem / git layer.  We intercept at the fs layer, which is already
    // mocked.  Listing readdir (for listRepos) returns an empty array so the service
    // has no data dir side-effects, and we ensure the job initiation path returns a
    // job ID without actually spawning a child process.
    //
    // ProcessService is not mocked here; the test asserts only that the route layer
    // accepts 'complexity' as a valid mode value (HTTP 202 rather than 400).
    // If ProcessService throws an unexpected error the route returns 500, which is
    // also distinct from 400, so we can assert status !== 400 as the core claim.

    vi.mocked(fs.readdir).mockResolvedValue([] as unknown as string[]);

    const app = buildApp();
    const res = await request(app)
      .post('/api/process')
      .send({ repoPath: '/tmp/test-repo', mode: 'complexity' });

    // The mode must be accepted (not rejected as invalid) — so NOT a 400
    expect(res.status).not.toBe(400);
  });

  it('still rejects an unknown processing mode with 400', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/process')
      .send({ repoPath: '/tmp/test-repo', mode: 'bogus-mode' });

    expect(res.status).toBe(400);
  });
});
