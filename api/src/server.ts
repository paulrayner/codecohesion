import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createRoutes } from './routes';

/**
 * Create and configure the Express app without starting the server.
 * This allows tests to import the app and bind it to an ephemeral port.
 */
export function createApp(): express.Express {
  const app = express();

  // CORS - allow all origins
  app.use(cors({
    origin: '*'
  }));

  app.use(express.json());

  // API routes
  app.use('/api', createRoutes());

  /**
   * Root endpoint - API metadata with discoverability
   */
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      service: 'CodeCohesion API',
      version: '0.7.0',
      description: 'Repository analysis and metrics API',

      _links: {
        self: {
          href: '/',
          description: 'API root'
        },
        repos: {
          href: '/api/repos',
          description: 'List all analyzed repositories or find by URL'
        },
        health: {
          href: '/health',
          description: 'API health check'
        },
        documentation: {
          href: 'https://github.com/paulrayner/codecohesion/tree/main/docs/api',
          description: 'API documentation'
        },
        discoverability: {
          href: 'https://github.com/paulrayner/codecohesion/blob/main/docs/api/DISCOVERABILITY.md',
          description: 'API discoverability best practices'
        }
      },

      examples: {
        list_repositories: {
          description: 'Get all available repositories',
          request: 'GET /api/repos'
        },
        find_by_github_url: {
          description: 'Find repository by GitHub URL',
          request: 'GET /api/repos?url=https://github.com/facebook/react'
        },
        get_statistics: {
          description: 'Get repository statistics',
          request: 'GET /api/repos/react-timeline-full/stats'
        },
        recent_contributors: {
          description: 'Get top 5 contributors from last 90 days',
          request: 'GET /api/contributors?url=https://github.com/facebook/react&days=90&limit=5'
        },
        hotspot_files: {
          description: 'Get top 10 high-churn files',
          request: 'GET /api/repos/react-timeline-full/hotspots?limit=10'
        },
        filtered_files: {
          description: 'Get files in src/ directory sorted by churn',
          request: 'GET /api/repos/react-timeline-full/files?path=src&metric=churn'
        }
      },

      capabilities: [
        'repository_discovery',
        'url_based_lookup',
        'statistics',
        'contributor_analysis',
        'file_metrics',
        'hotspot_detection',
        'date_range_filtering',
        'path_filtering',
        'metric_sorting'
      ]
    });
  });

  /**
   * Health check endpoint
   */
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  /**
   * 404 handler
   */
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  /**
   * 500 error handler
   */
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({
      error: 'Internal server error',
      details: err.message
    });
  });

  return app;
}

// Start the server only when this module is run directly (not imported for testing)
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`CodeCohesion API running on port ${PORT}`);
  });
}
