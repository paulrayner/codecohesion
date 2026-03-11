/**
 * OpenAPI 3.1 specification for the CodeCohesion API.
 *
 * This object is the single source of truth for the machine-readable API
 * description served at GET /api/docs.  It is intentionally kept as a plain
 * TypeScript object (rather than YAML) so that it stays in sync with the
 * rest of the TypeScript codebase and is validated by the compiler.
 */

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'CodeCohesion API',
    version: '1.0.0',
    description:
      'REST API for the CodeCohesion 3D code-visualization and analysis tool.',
  },
  paths: {
    '/api/repos': {
      get: {
        summary: 'List all repositories or find by URL',
        parameters: [
          {
            name: 'url',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'GitHub repository URL to look up',
          },
        ],
        responses: {
          '200': { description: 'Successful response' },
          '404': { description: 'Repository not found' },
        },
      },
    },
    '/api/repos/{repoId}/stats': {
      get: {
        summary: 'Get repository statistics',
        parameters: [
          { name: 'repoId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Repository statistics' },
          '404': { description: 'Repository not found' },
        },
      },
    },
    '/api/repos/{repoId}/contributors': {
      get: {
        summary: 'Get contributors with optional date filtering and limit',
        parameters: [
          { name: 'repoId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'since', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'until', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer' } },
        ],
        responses: {
          '200': { description: 'Contributors list' },
          '404': { description: 'Repository not found' },
        },
      },
    },
    '/api/repos/{repoId}/files': {
      get: {
        summary: 'Get all files with optional path filtering and metric sorting',
        parameters: [
          { name: 'repoId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'path', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'metric', in: 'query', required: false, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Files list' },
          '404': { description: 'Repository not found' },
        },
      },
    },
    '/api/repos/{repoId}/hotspots': {
      get: {
        summary: 'Get top N files by churn and contributor count',
        parameters: [
          { name: 'repoId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer' } },
        ],
        responses: {
          '200': { description: 'Hotspot files' },
          '404': { description: 'Repository not found' },
        },
      },
    },
    '/api/repos/{repoId}/imports': {
      get: {
        summary: 'Get import edges with optional file and external filters',
        parameters: [
          { name: 'repoId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'file', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'external', in: 'query', required: false, schema: { type: 'boolean' } },
        ],
        responses: {
          '200': { description: 'Import edges' },
          '404': { description: 'Repository or structure data not found' },
        },
      },
    },
    '/api/repos/{repoId}/structure': {
      get: {
        summary: 'Get structure metadata and function declarations',
        parameters: [
          { name: 'repoId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Structure data' },
          '404': { description: 'Structure data not found' },
        },
      },
    },
    '/api/repos/{repoId}/complexity': {
      get: {
        summary: 'Get complexity analysis data for a repository',
        parameters: [
          { name: 'repoId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Complexity data' },
          '404': { description: 'Complexity data not found' },
        },
      },
    },
    '/api/repos/{repoId}/impact/{filePath}': {
      get: {
        summary: 'Get transitive impact analysis for a file',
        parameters: [
          { name: 'repoId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'filePath', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Impact analysis' },
          '404': { description: 'Structure data not found' },
        },
      },
    },
    '/api/repos/{repoId}/context/{filePath}': {
      get: {
        summary: 'Get file context — ownership, imports, functions, and optional coupling',
        parameters: [
          { name: 'repoId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'filePath', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'File context' },
          '404': { description: 'Repository or file not found' },
        },
      },
    },
    '/api/repos/{repoId}/coupling': {
      get: {
        summary: 'Get full coupling graph for a repository',
        parameters: [
          { name: 'repoId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Coupling graph' },
          '404': { description: 'Coupling data not found' },
        },
      },
    },
    '/api/repos/{repoId}/health': {
      get: {
        summary: 'Get composite health score for a repository',
        parameters: [
          { name: 'repoId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Health score' },
          '404': { description: 'Repository not found' },
        },
      },
    },
    '/api/process': {
      post: {
        summary: 'Start a processing job for a repository',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  repoPath: { type: 'string' },
                  repoUrl: { type: 'string' },
                  mode: { type: 'string' },
                  targetCommits: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: {
          '202': { description: 'Job accepted' },
          '400': { description: 'Invalid request parameters' },
        },
      },
    },
  },
};
