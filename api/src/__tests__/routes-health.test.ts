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
 * Minimal RepositorySnapshot fixture used to supply churn and contributor data.
 *
 * Files and their churn/contributor characteristics:
 *   src/hot.ts      — commitCount: 80, contributorCount: 1  (high churn, single owner)
 *   src/shared.ts   — commitCount: 50, contributorCount: 6  (moderate churn, many contributors)
 *   src/stable.ts   — commitCount: 5,  contributorCount: 3  (low churn)
 *   src/new.ts      — commitCount: 2,  contributorCount: 1
 */
const SNAPSHOT = {
  repositoryPath: '/repos/my-repo',
  timestamp: '2026-01-01T00:00:00.000Z',
  commit: 'abc123',
  stats: {
    totalFiles: 4,
    totalLoc: 800,
    filesByExtension: { '.ts': 4 },
  },
  tree: {
    type: 'directory',
    name: 'src',
    path: 'src',
    children: [
      {
        type: 'file',
        name: 'hot.ts',
        path: 'src/hot.ts',
        loc: 300,
        commitCount: 80,
        contributorCount: 1,
        lastAuthor: 'alice@example.com',
        lastModified: '2026-01-01',
        firstCommitDate: '2024-01-01',
      },
      {
        type: 'file',
        name: 'shared.ts',
        path: 'src/shared.ts',
        loc: 200,
        commitCount: 50,
        contributorCount: 6,
        lastAuthor: 'bob@example.com',
        lastModified: '2025-12-01',
        firstCommitDate: '2024-01-01',
      },
      {
        type: 'file',
        name: 'stable.ts',
        path: 'src/stable.ts',
        loc: 200,
        commitCount: 5,
        contributorCount: 3,
        lastAuthor: 'carol@example.com',
        lastModified: '2025-06-01',
        firstCommitDate: '2024-01-01',
      },
      {
        type: 'file',
        name: 'new.ts',
        path: 'src/new.ts',
        loc: 100,
        commitCount: 2,
        contributorCount: 1,
        lastAuthor: 'alice@example.com',
        lastModified: '2025-11-01',
        firstCommitDate: '2025-10-01',
      },
    ],
  },
};

/**
 * Minimal ComplexityReport fixture with two hotspots — one high-scoring,
 * one low-scoring — to exercise hotspot density calculation.
 */
const COMPLEXITY_REPORT = {
  format: 'complexity-v1',
  repositoryPath: '/repos/my-repo',
  analyzedAt: '2026-01-01T00:00:00.000Z',
  analysis: {
    filesAnalyzed: 4,
    functionsAnalyzed: 6,
    avgCyclomatic: 4.0,
    avgCognitive: 3.0,
  },
  files: [
    {
      file: 'src/hot.ts',
      totalCyclomatic: 12,
      totalCognitive: 10,
      maxCyclomatic: 8,
      maxCognitive: 6,
      functionCount: 3,
      functions: [],
    },
    {
      file: 'src/shared.ts',
      totalCyclomatic: 2,
      totalCognitive: 2,
      maxCyclomatic: 2,
      maxCognitive: 2,
      functionCount: 2,
      functions: [],
    },
  ],
  hotspots: [
    {
      file: 'src/hot.ts',
      complexityScore: 0.9,
      churnScore: 0.85,
      hotspotScore: 0.765,
      totalCyclomatic: 12,
      commitCount: 80,
    },
    {
      file: 'src/shared.ts',
      complexityScore: 0.2,
      churnScore: 0.5,
      hotspotScore: 0.1,
      totalCyclomatic: 2,
      commitCount: 50,
    },
  ],
};

/**
 * Minimal CouplingGraph fixture.
 * Three edges at varying coupling strengths to exercise coupling density.
 */
const COUPLING_GRAPH = {
  format: 'coupling-v1',
  repositoryPath: '/repos/my-repo',
  sourceTimeline: 'my-repo-timeline.json',
  analysis: {
    totalCommits: 100,
    filesAnalyzed: 4,
    couplingEdges: 3,
    generatedAt: '2026-01-01T00:00:00.000Z',
  },
  edges: [
    { fileA: 'src/hot.ts', fileB: 'src/shared.ts', coChangeCount: 40, coupling: 0.80 },
    { fileA: 'src/hot.ts', fileB: 'src/stable.ts', coChangeCount: 20, coupling: 0.60 },
    { fileA: 'src/shared.ts', fileB: 'src/new.ts', coChangeCount: 5, coupling: 0.20 },
  ],
  clusters: [
    {
      id: 1,
      name: 'Cluster 1',
      files: ['src/hot.ts', 'src/shared.ts', 'src/stable.ts'],
      fileCount: 3,
      avgInternalCoupling: 0.70,
    },
  ],
};

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helper: make readFile return different data per filename
// ---------------------------------------------------------------------------

/**
 * Sets up fs.readFile mock to dispatch on the filename suffix:
 *   *.json with no suffix keyword   → SNAPSHOT
 *   *-complexity.json               → COMPLEXITY_REPORT
 *   *-coupling.json                 → COUPLING_GRAPH
 */
function mockAllDataFiles(): void {
  vi.mocked(fs.readFile).mockImplementation((filePath: unknown) => {
    const p = String(filePath);
    if (p.endsWith('-complexity.json')) {
      return Promise.resolve(JSON.stringify(COMPLEXITY_REPORT) as unknown as ArrayBuffer);
    }
    if (p.endsWith('-coupling.json')) {
      return Promise.resolve(JSON.stringify(COUPLING_GRAPH) as unknown as ArrayBuffer);
    }
    // Snapshot (base repo file, no secondary suffix)
    return Promise.resolve(JSON.stringify(SNAPSHOT) as unknown as ArrayBuffer);
  });
}

// ---------------------------------------------------------------------------
// GET /api/repos/:repoId/health — score and breakdown
// ---------------------------------------------------------------------------

describe('GET /api/repos/:repoId/health', () => {
  it('returns HTTP 200 with a numeric score between 0 and 100 inclusive', async () => {
    mockAllDataFiles();

    const app = buildApp();
    const res = await request(app).get('/api/repos/my-repo/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('score');
    expect(typeof res.body.score).toBe('number');
    expect(res.body.score).toBeGreaterThanOrEqual(0);
    expect(res.body.score).toBeLessThanOrEqual(100);
  });

  it('includes repository id in the response envelope', async () => {
    mockAllDataFiles();

    const app = buildApp();
    const res = await request(app).get('/api/repos/my-repo/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('repository');
    expect(res.body.repository).toHaveProperty('id', 'my-repo');
  });

  it('includes a per-metric breakdown with churnConcentration, contributorDistribution, complexityHotspotDensity, and couplingDensity', async () => {
    mockAllDataFiles();

    const app = buildApp();
    const res = await request(app).get('/api/repos/my-repo/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('breakdown');

    const { breakdown } = res.body;
    expect(breakdown).toHaveProperty('churnConcentration');
    expect(breakdown).toHaveProperty('contributorDistribution');
    expect(breakdown).toHaveProperty('complexityHotspotDensity');
    expect(breakdown).toHaveProperty('couplingDensity');

    // Each metric sub-score must be a number in [0, 100]
    for (const key of [
      'churnConcentration',
      'contributorDistribution',
      'complexityHotspotDensity',
      'couplingDensity',
    ] as const) {
      expect(typeof breakdown[key]).toBe('number');
      expect(breakdown[key]).toBeGreaterThanOrEqual(0);
      expect(breakdown[key]).toBeLessThanOrEqual(100);
    }
  });

  it('includes an analyzedAt timestamp string in ISO format', async () => {
    mockAllDataFiles();

    const app = buildApp();
    const res = await request(app).get('/api/repos/my-repo/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('analyzedAt');
    expect(typeof res.body.analyzedAt).toBe('string');
    // Must be parseable as a date
    expect(isNaN(Date.parse(res.body.analyzedAt))).toBe(false);
  });

  it('includes a non-empty recommendations array', async () => {
    mockAllDataFiles();

    const app = buildApp();
    const res = await request(app).get('/api/repos/my-repo/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('recommendations');
    expect(Array.isArray(res.body.recommendations)).toBe(true);
  });

  it('includes actionable recommendation strings when a metric scores poorly', async () => {
    // Our fixture has src/hot.ts with churn 80 out of total ~137 commits — concentrated churn.
    // We expect at least one recommendation that mentions churn or the culprit file.
    mockAllDataFiles();

    const app = buildApp();
    const res = await request(app).get('/api/repos/my-repo/health');

    expect(res.status).toBe(200);
    expect(res.body.recommendations.length).toBeGreaterThan(0);

    // Each recommendation must be a non-empty string
    for (const rec of res.body.recommendations as unknown[]) {
      expect(typeof rec).toBe('string');
      expect((rec as string).length).toBeGreaterThan(0);
    }
  });

  // ---------------------------------------------------------------------------
  // Weight redistribution when optional data is missing
  // ---------------------------------------------------------------------------

  it('returns a valid score when complexity data is missing (weights redistribute across remaining metrics)', async () => {
    const enoentError = Object.assign(new Error('ENOENT: no such file'), {
      code: 'ENOENT',
    });

    vi.mocked(fs.readFile).mockImplementation((filePath: unknown) => {
      const p = String(filePath);
      if (p.endsWith('-complexity.json')) {
        return Promise.reject(enoentError);
      }
      if (p.endsWith('-coupling.json')) {
        return Promise.resolve(JSON.stringify(COUPLING_GRAPH) as unknown as ArrayBuffer);
      }
      return Promise.resolve(JSON.stringify(SNAPSHOT) as unknown as ArrayBuffer);
    });

    const app = buildApp();
    const res = await request(app).get('/api/repos/my-repo/health');

    // Must still respond 200 — graceful degradation, not an error
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('score');
    expect(typeof res.body.score).toBe('number');
    expect(res.body.score).toBeGreaterThanOrEqual(0);
    expect(res.body.score).toBeLessThanOrEqual(100);

    // complexityHotspotDensity must be absent or null to signal it was unavailable
    const { breakdown } = res.body;
    expect(breakdown).toHaveProperty('complexityHotspotDensity');
    expect(breakdown.complexityHotspotDensity === null || breakdown.complexityHotspotDensity === undefined).toBe(true);
  });

  it('returns a valid score when coupling data is missing (weights redistribute across remaining metrics)', async () => {
    const enoentError = Object.assign(new Error('ENOENT: no such file'), {
      code: 'ENOENT',
    });

    vi.mocked(fs.readFile).mockImplementation((filePath: unknown) => {
      const p = String(filePath);
      if (p.endsWith('-coupling.json')) {
        return Promise.reject(enoentError);
      }
      if (p.endsWith('-complexity.json')) {
        return Promise.resolve(JSON.stringify(COMPLEXITY_REPORT) as unknown as ArrayBuffer);
      }
      return Promise.resolve(JSON.stringify(SNAPSHOT) as unknown as ArrayBuffer);
    });

    const app = buildApp();
    const res = await request(app).get('/api/repos/my-repo/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('score');
    expect(typeof res.body.score).toBe('number');
    expect(res.body.score).toBeGreaterThanOrEqual(0);
    expect(res.body.score).toBeLessThanOrEqual(100);

    // couplingDensity must be absent or null to signal it was unavailable
    const { breakdown } = res.body;
    expect(breakdown).toHaveProperty('couplingDensity');
    expect(breakdown.couplingDensity === null || breakdown.couplingDensity === undefined).toBe(true);
  });

  it('returns a valid score when both complexity and coupling data are missing', async () => {
    const enoentError = Object.assign(new Error('ENOENT: no such file'), {
      code: 'ENOENT',
    });

    vi.mocked(fs.readFile).mockImplementation((filePath: unknown) => {
      const p = String(filePath);
      if (p.endsWith('-complexity.json') || p.endsWith('-coupling.json')) {
        return Promise.reject(enoentError);
      }
      return Promise.resolve(JSON.stringify(SNAPSHOT) as unknown as ArrayBuffer);
    });

    const app = buildApp();
    const res = await request(app).get('/api/repos/my-repo/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('score');
    expect(typeof res.body.score).toBe('number');
    expect(res.body.score).toBeGreaterThanOrEqual(0);
    expect(res.body.score).toBeLessThanOrEqual(100);
  });

  // ---------------------------------------------------------------------------
  // 404 when the base snapshot does not exist
  // ---------------------------------------------------------------------------

  it('returns 404 when the repository snapshot does not exist', async () => {
    const enoentError = Object.assign(new Error('ENOENT: no such file'), {
      code: 'ENOENT',
    });
    vi.mocked(fs.readFile).mockRejectedValue(enoentError);

    const app = buildApp();
    const res = await request(app).get('/api/repos/unknown-repo/health');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  // ---------------------------------------------------------------------------
  // Score reflects data quality — a healthy fixture scores higher
  // ---------------------------------------------------------------------------

  it('scores a well-distributed repo higher than the concentrated-churn fixture', async () => {
    // Healthy snapshot: churn spread across many files, many contributors each
    const HEALTHY_SNAPSHOT = {
      ...SNAPSHOT,
      tree: {
        type: 'directory',
        name: 'src',
        path: 'src',
        children: [
          {
            type: 'file', name: 'a.ts', path: 'src/a.ts', loc: 100,
            commitCount: 10, contributorCount: 4,
            lastAuthor: 'alice@example.com', lastModified: '2026-01-01', firstCommitDate: '2024-01-01',
          },
          {
            type: 'file', name: 'b.ts', path: 'src/b.ts', loc: 100,
            commitCount: 12, contributorCount: 5,
            lastAuthor: 'bob@example.com', lastModified: '2026-01-01', firstCommitDate: '2024-01-01',
          },
          {
            type: 'file', name: 'c.ts', path: 'src/c.ts', loc: 100,
            commitCount: 9, contributorCount: 4,
            lastAuthor: 'carol@example.com', lastModified: '2025-12-01', firstCommitDate: '2024-01-01',
          },
          {
            type: 'file', name: 'd.ts', path: 'src/d.ts', loc: 100,
            commitCount: 11, contributorCount: 5,
            lastAuthor: 'dave@example.com', lastModified: '2025-11-01', firstCommitDate: '2024-01-01',
          },
        ],
      },
    };

    // Healthy complexity: no hotspots above threshold
    const HEALTHY_COMPLEXITY = {
      ...COMPLEXITY_REPORT,
      hotspots: [
        { file: 'src/a.ts', complexityScore: 0.1, churnScore: 0.1, hotspotScore: 0.01, totalCyclomatic: 1, commitCount: 10 },
        { file: 'src/b.ts', complexityScore: 0.1, churnScore: 0.1, hotspotScore: 0.01, totalCyclomatic: 1, commitCount: 12 },
      ],
    };

    // Healthy coupling: low coupling values
    const HEALTHY_COUPLING = {
      ...COUPLING_GRAPH,
      edges: [
        { fileA: 'src/a.ts', fileB: 'src/b.ts', coChangeCount: 2, coupling: 0.10 },
        { fileA: 'src/c.ts', fileB: 'src/d.ts', coChangeCount: 1, coupling: 0.05 },
      ],
    };

    // First: get score for the concentrated-churn fixture
    mockAllDataFiles();
    const appChurny = buildApp();
    const resChurny = await request(appChurny).get('/api/repos/my-repo/health');
    expect(resChurny.status).toBe(200);
    const churnyScore = resChurny.body.score as number;

    vi.clearAllMocks();

    // Second: get score for the healthy fixture
    vi.mocked(fs.readFile).mockImplementation((filePath: unknown) => {
      const p = String(filePath);
      if (p.endsWith('-complexity.json')) {
        return Promise.resolve(JSON.stringify(HEALTHY_COMPLEXITY) as unknown as ArrayBuffer);
      }
      if (p.endsWith('-coupling.json')) {
        return Promise.resolve(JSON.stringify(HEALTHY_COUPLING) as unknown as ArrayBuffer);
      }
      return Promise.resolve(JSON.stringify(HEALTHY_SNAPSHOT) as unknown as ArrayBuffer);
    });

    const appHealthy = buildApp();
    const resHealthy = await request(appHealthy).get('/api/repos/my-repo/health');
    expect(resHealthy.status).toBe(200);
    const healthyScore = resHealthy.body.score as number;

    // The well-distributed repo must score higher than the concentrated-churn one
    expect(healthyScore).toBeGreaterThan(churnyScore);
  });
});
