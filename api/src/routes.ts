import { Router, Request, Response } from 'express';
import { DataLoader } from './data-loader';
import { QueryService } from './query-service';
import { ProcessService } from './process-service';
import {
  createRepoNotFoundError,
  createInvalidParameterError,
  createMissingParameterError
} from './error-helper';

const VALID_PROCESSING_MODES = ['head', 'timeline-v1', 'timeline-v2', 'coupling', 'structure'] as const;
type ProcessingMode = typeof VALID_PROCESSING_MODES[number];

export function createRoutes(): Router {
  const router = Router();
  const dataLoader = new DataLoader();
  const queryService = new QueryService(dataLoader);
  const processService = new ProcessService();

  /**
   * GET /api/repos
   * List all repositories or find by URL
   */
  router.get('/repos', async (req: Request, res: Response) => {
    try {
      const { url } = req.query;

      if (url) {
        const repo = await queryService.findRepoByUrl(url as string);
        if (!repo) {
          const allRepos = await dataLoader.listRepos();
          const error = createRepoNotFoundError(url as string, allRepos);
          return res.status(404).json(error);
        }

        // Add HATEOAS links to single repo response
        const enrichedRepo = {
          ...repo,
          _links: {
            self: { href: `/api/repos/${repo.id}` },
            stats: {
              href: `/api/repos/${repo.id}/stats`,
              description: 'Get repository statistics'
            },
            contributors: {
              href: `/api/repos/${repo.id}/contributors{?since,until,limit}`,
              templated: true,
              description: 'Get contributors with optional date filtering and limit'
            },
            files: {
              href: `/api/repos/${repo.id}/files{?path,metric}`,
              templated: true,
              description: 'Get files with optional path prefix and metric sorting'
            },
            hotspots: {
              href: `/api/repos/${repo.id}/hotspots{?limit}`,
              templated: true,
              description: 'Get top N high-churn/high-contributor files'
            },
            imports: {
              href: `/api/repos/${repo.id}/imports{?file,external}`,
              templated: true,
              description: 'Get import edges with optional file and external filters'
            },
            structure: {
              href: `/api/repos/${repo.id}/structure`,
              description: 'Get structure metadata and function declarations'
            }
          }
        };

        return res.json(enrichedRepo);
      }

      // List all repos with HATEOAS links
      const repos = await dataLoader.listRepos();
      const enrichedRepos = repos.map(repo => ({
        ...repo,
        _links: {
          self: { href: `/api/repos/${repo.id}` },
          stats: {
            href: `/api/repos/${repo.id}/stats`,
            description: 'Get repository statistics'
          },
          contributors: {
            href: `/api/repos/${repo.id}/contributors{?since,until,limit}`,
            templated: true,
            description: 'Get contributors with optional date filtering and limit'
          },
          files: {
            href: `/api/repos/${repo.id}/files{?path,metric}`,
            templated: true,
            description: 'Get files with optional path prefix and metric sorting'
          },
          hotspots: {
            href: `/api/repos/${repo.id}/hotspots{?limit}`,
            templated: true,
            description: 'Get top N high-churn/high-contributor files'
          },
          imports: {
            href: `/api/repos/${repo.id}/imports{?file,external}`,
            templated: true,
            description: 'Get import edges with optional file and external filters'
          },
          structure: {
            href: `/api/repos/${repo.id}/structure`,
            description: 'Get structure metadata and function declarations'
          }
        }
      }));

      res.json({
        repos: enrichedRepos,
        _links: {
          self: { href: '/api/repos' },
          find: {
            href: '/api/repos{?url}',
            templated: true,
            description: 'Find repository by GitHub URL'
          }
        }
      });
    } catch (error) {
      console.error('Error listing repos:', error);
      res.status(500).json({ error: 'Failed to list repositories' });
    }
  });

  /**
   * GET /api/repos/:repoId/stats
   * Get repository statistics
   */
  router.get('/repos/:repoId/stats', async (req: Request, res: Response) => {
    try {
      const { repoId } = req.params;
      const stats = await queryService.getStats(repoId);
      res.json(stats);
    } catch (error) {
      console.error('Error getting stats:', error);
      if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
        const allRepos = await dataLoader.listRepos();
        const errorResponse = createRepoNotFoundError(req.params.repoId, allRepos);
        return res.status(404).json(errorResponse);
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/repos/:repoId/contributors
   * Get contributors with optional date filtering and limit
   */
  router.get('/repos/:repoId/contributors', async (req: Request, res: Response) => {
    try {
      const { repoId } = req.params;
      const { since, until, limit } = req.query;

      // Validate limit parameter if provided
      let limitNum: number | undefined;
      if (limit) {
        limitNum = parseInt(limit as string, 10);
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
          const error = createInvalidParameterError(
            'limit',
            limit,
            'must be between 1 and 100',
            `https://codecohesion-api.railway.app/api/repos/${repoId}/contributors?limit=10`
          );
          return res.status(400).json(error);
        }
      }

      const contributors = await queryService.getContributors(
        repoId,
        since as string | undefined,
        until as string | undefined,
        limitNum
      );

      res.json(contributors);
    } catch (error) {
      console.error('Error getting contributors:', error);
      if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
        const allRepos = await dataLoader.listRepos();
        const errorResponse = createRepoNotFoundError(req.params.repoId, allRepos);
        return res.status(404).json(errorResponse);
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/contributors
   * Convenience endpoint: query contributors by URL with days and limit parameters
   */
  router.get('/contributors', async (req: Request, res: Response) => {
    try {
      const { url, days, since, until, limit } = req.query;

      if (!url) {
        const error = createMissingParameterError(
          'url',
          'string',
          'GitHub repository URL (e.g., https://github.com/facebook/react)',
          'https://codecohesion-api.railway.app/api/contributors?url=https://github.com/facebook/react&days=30&limit=5'
        );
        return res.status(400).json(error);
      }

      const repo = await queryService.findRepoByUrl(url as string);
      if (!repo) {
        const allRepos = await dataLoader.listRepos();
        const error = createRepoNotFoundError(url as string, allRepos);
        return res.status(404).json(error);
      }

      // Validate limit parameter if provided
      let limitNum: number | undefined;
      if (limit) {
        limitNum = parseInt(limit as string, 10);
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
          const error = createInvalidParameterError(
            'limit',
            limit,
            'must be between 1 and 100',
            `https://codecohesion-api.railway.app/api/contributors?url=${encodeURIComponent(url as string)}&days=90&limit=10`
          );
          return res.status(400).json(error);
        }
      }

      // Calculate date range from 'days' parameter
      let sinceDate = since as string | undefined;
      if (days) {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(days as string, 10));
        sinceDate = daysAgo.toISOString().split('T')[0];
      }

      const contributors = await queryService.getContributors(
        repo.id,
        sinceDate,
        until as string | undefined,
        limitNum
      );

      res.json({
        ...contributors,
        repository: { ...contributors.repository, url },
        period: {
          ...contributors.period,
          days: days ? parseInt(days as string, 10) : undefined
        }
      });
    } catch (error) {
      console.error('Error getting contributors by URL:', error);
      res.status(500).json({ error: 'Failed to fetch contributors' });
    }
  });

  /**
   * GET /api/repos/:repoId/files
   * Get all files with optional path filtering and metric sorting
   */
  router.get('/repos/:repoId/files', async (req: Request, res: Response) => {
    try {
      const { repoId } = req.params;
      const { path, metric } = req.query;

      const files = await queryService.getFiles(
        repoId,
        path as string | undefined,
        metric as string | undefined
      );

      res.json(files);
    } catch (error) {
      console.error('Error getting files:', error);
      if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
        const allRepos = await dataLoader.listRepos();
        const errorResponse = createRepoNotFoundError(req.params.repoId, allRepos);
        return res.status(404).json(errorResponse);
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/repos/:repoId/hotspots
   * Get top N files by churn and contributor count
   */
  router.get('/repos/:repoId/hotspots', async (req: Request, res: Response) => {
    try {
      const { repoId } = req.params;
      const { limit } = req.query;

      const limitNum = limit ? parseInt(limit as string, 10) : 20;

      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        const error = createInvalidParameterError(
          'limit',
          limitNum,
          'must be between 1 and 100',
          `https://codecohesion-api.railway.app/api/repos/${repoId}/hotspots?limit=20`
        );
        return res.status(400).json(error);
      }

      const hotspots = await queryService.getHotspots(repoId, limitNum);
      res.json(hotspots);
    } catch (error) {
      console.error('Error getting hotspots:', error);
      if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
        const allRepos = await dataLoader.listRepos();
        const errorResponse = createRepoNotFoundError(req.params.repoId, allRepos);
        return res.status(404).json(errorResponse);
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/repos/:repoId/imports
   * Get import edges for a repository with optional ?file= and ?external= filters.
   * Requires a structure analysis to have been run first (mode 'structure').
   */
  router.get('/repos/:repoId/imports', async (req: Request, res: Response) => {
    try {
      const { repoId } = req.params;
      const { file, external } = req.query;

      // Parse optional ?external= boolean filter
      let externalFilter: boolean | undefined;
      if (external !== undefined) {
        if (external === 'true') {
          externalFilter = true;
        } else if (external === 'false') {
          externalFilter = false;
        } else {
          const error = createInvalidParameterError(
            'external',
            external,
            'must be "true" or "false"',
            `https://codecohesion-api.railway.app/api/repos/${repoId}/imports?external=true`
          );
          return res.status(400).json(error);
        }
      }

      const imports = await dataLoader.loadImports(
        repoId,
        file as string | undefined,
        externalFilter
      );

      res.json({
        repository: { id: repoId },
        filters: {
          file: (file as string | undefined) ?? null,
          external: externalFilter ?? null
        },
        imports,
        total: imports.length,
        _links: {
          self: { href: `/api/repos/${repoId}/imports` },
          structure: {
            href: `/api/repos/${repoId}/structure`,
            description: 'Get full structure metadata and function declarations'
          }
        }
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Structure data not found')) {
        return res.status(404).json({
          error: 'Structure data not found',
          code: 'NOT_FOUND',
          message: error.message
        });
      }
      console.error('Error getting imports:', error);
      const allRepos = await dataLoader.listRepos();
      const errorResponse = createRepoNotFoundError(req.params.repoId, allRepos);
      res.status(404).json(errorResponse);
    }
  });

  /**
   * GET /api/repos/:repoId/structure
   * Get structure metadata and function declarations.
   * Requires a structure analysis to have been run first (mode 'structure').
   */
  router.get('/repos/:repoId/structure', async (req: Request, res: Response) => {
    try {
      const { repoId } = req.params;
      const structure = await dataLoader.loadStructure(repoId);

      res.json({
        repository: { id: repoId },
        analyzedAt: structure.analyzedAt,
        repositoryPath: structure.repositoryPath,
        analysis: structure.analysis,
        functions: structure.functions,
        _links: {
          self: { href: `/api/repos/${repoId}/structure` },
          imports: {
            href: `/api/repos/${repoId}/imports{?file,external}`,
            templated: true,
            description: 'Get import edges with optional file and external filters'
          }
        }
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Structure data not found')) {
        return res.status(404).json({
          error: 'Structure data not found',
          code: 'NOT_FOUND',
          message: (error as Error).message
        });
      }
      console.error('Error getting structure:', error);
      const allRepos = await dataLoader.listRepos();
      const errorResponse = createRepoNotFoundError(req.params.repoId, allRepos);
      res.status(404).json(errorResponse);
    }
  });

  /**
   * POST /api/process
   * Start a processing job for a repository
   */
  router.post('/process', async (req: Request, res: Response) => {
    try {
      const { repoPath, repoUrl, mode, targetCommits } = req.body as {
        repoPath?: string;
        repoUrl?: string;
        mode?: string;
        targetCommits?: number;
      };

      // Either repoPath or repoUrl is required
      if (!repoPath && !repoUrl) {
        const error = createMissingParameterError(
          'repoPath or repoUrl',
          'string',
          'Local filesystem path (repoPath) or remote URL (repoUrl) of the repository to process',
          'https://codecohesion-api.railway.app/api/process'
        );
        return res.status(400).json(error);
      }

      // mode is required and must be a valid value
      if (!mode) {
        const error = createMissingParameterError(
          'mode',
          'string',
          `Processing mode: one of ${VALID_PROCESSING_MODES.join(', ')}`,
          'https://codecohesion-api.railway.app/api/process'
        );
        return res.status(400).json(error);
      }

      if (!VALID_PROCESSING_MODES.includes(mode as ProcessingMode)) {
        const error = createInvalidParameterError(
          'mode',
          mode,
          `must be one of: ${VALID_PROCESSING_MODES.join(', ')}`,
          'https://codecohesion-api.railway.app/api/process'
        );
        return res.status(400).json(error);
      }

      const jobId = await processService.startJob({
        repoPath,
        repoUrl,
        mode: mode as ProcessingMode,
        targetCommits
      });

      return res.status(202).json({
        jobId,
        status: 'pending',
        _links: {
          progress: { href: `/api/process/${jobId}/progress` }
        }
      });
    } catch (error) {
      console.error('Error starting processing job:', error);
      res.status(500).json({ error: 'Failed to start processing job' });
    }
  });

  /**
   * GET /api/process/:jobId/progress
   * SSE stream for real-time progress updates on a processing job
   */
  router.get('/process/:jobId/progress', (req: Request, res: Response) => {
    const { jobId } = req.params;

    const emitter = processService.getJobEmitter(jobId);
    if (!emitter) {
      return res.status(404).json({
        error: 'Job not found',
        code: 'NOT_FOUND',
        message: `No processing job found with id '${jobId}'`
      });
    }

    // Establish SSE connection
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // All events (progress, complete, error) are emitted on the 'progress' channel
    // by ProcessService. We forward them as SSE messages and close on terminal events.
    const onProgress = (data: { type?: string }): void => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);

      // Close connection on terminal events
      if (data.type === 'complete' || data.type === 'error') {
        res.end();
        emitter.off('progress', onProgress);
      }
    };

    emitter.on('progress', onProgress);

    // Clean up listener when client disconnects to prevent memory leaks
    req.on('close', () => {
      emitter.off('progress', onProgress);
    });
  });

  return router;
}
