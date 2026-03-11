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

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET /api/docs — OpenAPI JSON spec
// ---------------------------------------------------------------------------

describe('GET /api/docs', () => {
  it('returns HTTP 200', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/docs');

    expect(res.status).toBe(200);
  });

  it('returns JSON content-type', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/docs');

    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('returns a body with openapi field set to "3.1.0"', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/docs');

    expect(res.body).toHaveProperty('openapi', '3.1.0');
  });

  it('includes a top-level info object with title and version', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/docs');

    expect(res.body).toHaveProperty('info');
    expect(res.body.info).toHaveProperty('title');
    expect(res.body.info).toHaveProperty('version');
    expect(typeof res.body.info.title).toBe('string');
    expect(res.body.info.title.length).toBeGreaterThan(0);
    expect(typeof res.body.info.version).toBe('string');
    expect(res.body.info.version.length).toBeGreaterThan(0);
  });

  it('includes a top-level paths object', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/docs');

    expect(res.body).toHaveProperty('paths');
    expect(typeof res.body.paths).toBe('object');
  });

  // ---------------------------------------------------------------------------
  // Each known endpoint must appear in the spec paths
  // ---------------------------------------------------------------------------

  const expectedPathPatterns: Array<{ label: string; pattern: RegExp }> = [
    { label: 'repos',        pattern: /\/repos/ },
    { label: 'stats',        pattern: /\/repos\/.*\/stats/ },
    { label: 'contributors', pattern: /\/repos\/.*\/contributors/ },
    { label: 'files',        pattern: /\/repos\/.*\/files/ },
    { label: 'hotspots',     pattern: /\/repos\/.*\/hotspots/ },
    { label: 'imports',      pattern: /\/repos\/.*\/imports/ },
    { label: 'structure',    pattern: /\/repos\/.*\/structure/ },
    { label: 'complexity',   pattern: /\/repos\/.*\/complexity/ },
    { label: 'impact',       pattern: /\/repos\/.*\/impact/ },
    { label: 'context',      pattern: /\/repos\/.*\/context/ },
    { label: 'coupling',     pattern: /\/repos\/.*\/coupling/ },
    { label: 'health',       pattern: /\/repos\/.*\/health/ },
    { label: 'process',      pattern: /\/process/ },
  ];

  for (const { label, pattern } of expectedPathPatterns) {
    it(`includes a path entry covering the "${label}" endpoint`, async () => {
      const app = buildApp();
      const res = await request(app).get('/api/docs');

      expect(res.status).toBe(200);

      const pathKeys: string[] = Object.keys(res.body.paths ?? {});
      const matched = pathKeys.some((key) => pattern.test(key));
      expect(matched).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/docs/ui — Swagger UI HTML
// ---------------------------------------------------------------------------

describe('GET /api/docs/ui', () => {
  it('returns HTTP 200', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/docs/ui');

    expect(res.status).toBe(200);
  });

  it('returns HTML content-type', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/docs/ui');

    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  it('returns a body that contains an HTML document tag', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/docs/ui');

    expect(res.text).toMatch(/<html/i);
  });

  it('references the /api/docs JSON spec URL in the HTML body', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/docs/ui');

    // The UI page must point to the machine-readable spec endpoint
    expect(res.text).toContain('/api/docs');
  });
});
