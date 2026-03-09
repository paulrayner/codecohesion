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

/**
 * Minimal StructureGraph fixture where:
 *   src/lib/utils.ts  is imported by  src/lib/formatter.ts  and  src/index.ts
 *   src/lib/formatter.ts  is imported by  src/index.ts
 *
 * Dependency graph (arrows mean "imports"):
 *   src/lib/formatter.ts  →  src/lib/utils.ts
 *   src/index.ts          →  src/lib/utils.ts
 *   src/index.ts          →  src/lib/formatter.ts
 *
 * Therefore:
 *   direct dependents of src/lib/utils.ts:     [src/lib/formatter.ts, src/index.ts]
 *   transitive dependents of src/lib/utils.ts: [src/lib/formatter.ts, src/index.ts]
 *   direct dependents of src/lib/formatter.ts: [src/index.ts]
 *
 *   src/standalone.ts has no dependents.
 */
const STRUCTURE_GRAPH = {
  format: 'structure-v1',
  repositoryPath: '/repos/my-repo',
  analyzedAt: '2026-01-01T00:00:00.000Z',
  analysis: {
    filesAnalyzed: 4,
    importEdges: 3,
    functionDecls: 0,
    parseErrors: 0,
  },
  imports: [
    {
      from: 'src/lib/formatter.ts',
      to: 'src/lib/utils.ts',
      toRaw: './utils',
      symbols: ['formatDate'],
      isExternal: false,
    },
    {
      from: 'src/index.ts',
      to: 'src/lib/utils.ts',
      toRaw: './lib/utils',
      symbols: ['parseValue'],
      isExternal: false,
    },
    {
      from: 'src/index.ts',
      to: 'src/lib/formatter.ts',
      toRaw: './lib/formatter',
      symbols: ['formatDate'],
      isExternal: false,
    },
  ],
  functions: [],
};

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET /api/repos/:repoId/impact/:filePath(*)
// ---------------------------------------------------------------------------

describe('GET /api/repos/:repoId/impact/:filePath(*)', () => {
  it('returns direct and transitive dependents with blast radius count for a file that is imported by others', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify(STRUCTURE_GRAPH) as unknown as ArrayBuffer
    );

    const app = buildApp();
    const res = await request(app).get(
      '/api/repos/my-repo/impact/src/lib/utils.ts'
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('repository');
    expect(res.body.repository.id).toBe('my-repo');
    expect(res.body).toHaveProperty('file', 'src/lib/utils.ts');
    expect(res.body).toHaveProperty('impactedFiles');
    expect(Array.isArray(res.body.impactedFiles)).toBe(true);
    // Both direct and transitive dependents must be present
    expect(res.body.impactedFiles).toContain('src/lib/formatter.ts');
    expect(res.body.impactedFiles).toContain('src/index.ts');
    expect(res.body).toHaveProperty('blastRadius');
    expect(typeof res.body.blastRadius).toBe('number');
    expect(res.body.blastRadius).toBe(res.body.impactedFiles.length);
    expect(res.body.blastRadius).toBeGreaterThanOrEqual(2);
  });

  it('returns empty impactedFiles array (not an error) for a file with no dependents', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify(STRUCTURE_GRAPH) as unknown as ArrayBuffer
    );

    const app = buildApp();
    // src/standalone.ts does not appear as the `to` of any import edge
    const res = await request(app).get(
      '/api/repos/my-repo/impact/src/standalone.ts'
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('file', 'src/standalone.ts');
    expect(res.body).toHaveProperty('impactedFiles');
    expect(Array.isArray(res.body.impactedFiles)).toBe(true);
    expect(res.body.impactedFiles).toHaveLength(0);
    expect(res.body).toHaveProperty('blastRadius', 0);
  });

  it('returns 404 with a descriptive error when structure data does not exist for the repository', async () => {
    const enoentError = Object.assign(new Error('ENOENT: no such file'), {
      code: 'ENOENT',
    });
    vi.mocked(fs.readFile).mockRejectedValue(enoentError);

    const app = buildApp();
    const res = await request(app).get(
      '/api/repos/unknown-repo/impact/src/lib/utils.ts'
    );

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    const bodyText = JSON.stringify(res.body).toLowerCase();
    expect(
      bodyText.includes('structure') || bodyText.includes('not found')
    ).toBe(true);
  });

  it('correctly captures file paths containing slashes via wildcard param', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify(STRUCTURE_GRAPH) as unknown as ArrayBuffer
    );

    const app = buildApp();
    // The deep nested path must survive Express routing intact
    const res = await request(app).get(
      '/api/repos/my-repo/impact/src/lib/formatter.ts'
    );

    expect(res.status).toBe(200);
    // The `file` field in the response must reflect the full nested path
    expect(res.body).toHaveProperty('file', 'src/lib/formatter.ts');
    // src/index.ts imports src/lib/formatter.ts, so it must appear as a dependent
    expect(res.body.impactedFiles).toContain('src/index.ts');
  });
});
