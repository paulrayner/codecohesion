# CodeCohesion API

REST API providing programmatic access to CodeCohesion repository analysis data.

## Quick Start

### Installation

```bash
cd api
npm install
```

### Running Locally

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run build
npm start
```

The API will start on port 3001 by default (or the PORT environment variable).

### Running Tests

```bash
# Run tests once
npm test -- --run

# Run tests in watch mode
npm test

# Run tests with UI
npm run test:ui
```

## API Endpoints

### Root & Health

- `GET /` - API metadata
- `GET /health` - Health check

### Repositories

- `GET /api/repos` - List all repositories
- `GET /api/repos?url=<github-url>` - Find repository by GitHub URL

### Repository Data

- `GET /api/repos/:repoId/stats` - Repository statistics
- `GET /api/repos/:repoId/contributors?since=<date>&until=<date>` - Contributors with date filtering
- `GET /api/repos/:repoId/files?path=<prefix>&metric=<metric>` - Files with filtering and sorting
- `GET /api/repos/:repoId/hotspots?limit=<n>` - Top N high-churn/high-contributor files

### Convenience Endpoints

- `GET /api/contributors?url=<github-url>&days=<n>` - Contributors by URL with relative date range

## Example Usage

```bash
# List available repositories
curl http://localhost:3001/api/repos

# Get repository statistics
curl http://localhost:3001/api/repos/react-timeline-full/stats

# Get contributors in last 30 days
curl 'http://localhost:3001/api/contributors?url=https://github.com/facebook/react&days=30'

# Get top 10 hotspot files
curl 'http://localhost:3001/api/repos/react-timeline-full/hotspots?limit=10'

# Get files in src/ directory sorted by churn
curl 'http://localhost:3001/api/repos/react-timeline-full/files?path=src&metric=churn'
```

## Data Management

### Adding Analysis Files

The API reads JSON files from the `api/data/` directory. To add a new repository:

```bash
# Analyze a repository using the processor
cd processor
npm run dev -- ../path/to/repo

# Copy the generated JSON to the API data directory
cp output/repo-timeline-full.json ../api/data/
```

### Supported Formats

- **Static snapshots** - Single point-in-time analysis
- **Timeline V2** - Full commit history with delta changes

The API automatically detects the format and extracts the necessary data.

## Deployment

### Railway

The API is configured for Railway deployment:

1. **Build Command:** `npm run build`
2. **Start Command:** `npm start` (or `node dist/server.js`)
3. **Procfile:** Included for automatic detection

### Environment Variables

- `PORT` - Server port (set automatically by Railway)

### CORS Configuration

The API allows requests from:
- `https://thepaulrayner.com` - Production viewer
- `https://paulrayner.github.io` - GitHub Pages
- `http://localhost:3000-3003` - Local development

## Documentation

For detailed API specifications, see:
- [Vision](../docs/api/VISION.md) - Goals and use cases
- [Architecture](../docs/api/ARCHITECTURE.md) - Technical design
- [Specification](../docs/api/SPEC.md) - Endpoint documentation
- [Plan](../docs/plans/api-plan.md) - Implementation roadmap

## Tech Stack

- **Runtime:** Node.js 18+
- **Language:** TypeScript
- **Framework:** Express.js
- **Testing:** Vitest
- **Deployment:** Railway

## License

MIT
