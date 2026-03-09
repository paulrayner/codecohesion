# CodeCohesion

3D code visualization tool for analyzing structure, cohesion, and architectural evolution.

## Architecture

Monorepo (npm workspaces + Turborepo) with five packages:

| Package | Path | Tech | Purpose |
|---------|------|------|---------|
| `viewer/` | Frontend | TypeScript, Three.js, Vite | 3D visualization (vanilla TS, no framework) |
| `api/` | REST API | TypeScript, Express | Serves processed repo data (port 3001) |
| `processor/` | CLI + Library | TypeScript, simple-git | Parses git repos, generates JSON snapshots |
| `packages/shared-types/` | Shared types | TypeScript | Source of truth for shared interfaces |
| `packages/cli/` | CLI | TypeScript | Unified `codecohesion` CLI entry point |

## Development

```bash
# Install all packages from root
npm install

# Start all services (viewer + API) — primary workflow
npm run dev

# Run all tests
npm test

# Lint all packages
npm run lint

# Individual package dev (still works)
cd viewer && npm run dev    # http://localhost:3000
cd api && npm run dev       # http://localhost:3001
cd processor && npm run dev -- /path/to/repo

# Unified CLI
npx ts-node packages/cli/src/index.ts analyze /path/to/repo
npx ts-node packages/cli/src/index.ts view
npx ts-node packages/cli/src/index.ts serve
```

## Links

- [Demo](https://codecohesion.virtualgenius.com)
- [GitHub](https://github.com/virtualgenius/codecohesion)

## Testing

```bash
npm test                     # All packages (recommended)
cd viewer && npm test        # vitest, jsdom environment
cd api && npm test -- --run  # vitest (default is watch mode!)
cd processor && npm test     # vitest
```

Viewer tests are co-located in `src/lib/`. Architecture fitness tests run as part of the viewer test suite (`src/lib/architecture.test.ts`).

## Quality Checks

Run these before committing to catch regressions early.

```bash
# Lint (all packages)
npm run lint

# Test coverage (viewer)
cd viewer && npm run test:coverage
```

### Shared Types

`packages/shared-types/src/index.ts` is the single source of truth for shared types (`FileNode`, `DirectoryNode`, `TreeNode`, `RepositorySnapshot`, `TimelineData`, `CommitSnapshot`, `DrillDownLayer`, `TimelineDataV2`). All packages import from `@codecohesion/shared-types`.

### Architecture Fitness Tests

`viewer/src/lib/architecture.test.ts` enforces three structural invariants:

1. Every `*.ts` file in `viewer/src/lib/` is <= 200 LOC
2. No lib file imports from `../main` or `../TreeVisualizer` (prevents coupling back to god objects)
3. No lib file imports `three` directly, except `cameraPositioning.ts`, `camera-configuration.ts`, and `layout-positioning.ts`

These run automatically with `cd viewer && npm test`.

## Processor CLI

```bash
cd processor
npm run dev -- /path/to/repo                    # Static HEAD snapshot
npm run dev -- /path/to/repo --timeline         # Timeline V1 (adaptive sampling)
npm run dev -- /path/to/repo --full-delta       # Timeline V2 (all commits)
npm run coupling -- /path/to/repo               # Temporal coupling analysis
```

Output goes to `processor/output/`. Copy JSON to `viewer/public/data/` for visualization.

## Analyze from the Viewer (Primary Workflow)

The viewer has a built-in **Analyze** panel that triggers processing via the API's `POST /api/process` endpoint. The API imports the processor as a library, runs the analysis, writes output directly to `viewer/public/data/`, and streams progress via SSE. No manual file copying needed.

Supports local paths and remote GitHub URLs. Modes: `head`, `timeline-v1`, `timeline-v2`, `coupling`.

## Processor as Library

The processor is importable as a library by other packages:

```typescript
import { RepositoryAnalyzer, silentLogger } from 'codecohesion-processor';

const analyzer = new RepositoryAnalyzer('/path/to/repo', silentLogger);
const snapshot = await analyzer.analyze();
```

All analyzers accept an optional `Logger` parameter. Use `silentLogger` to suppress output when using as a library.

## Gotchas

- **Viewer data files are gitignored** — `viewer/public/data/*.json` must be generated via processor
- **`api npm test` runs in watch mode** — use `npm test -- --run` for single pass
- **`viewer/src/main.ts` is a ~2,900-line god object** — new logic should go in `src/lib/` as pure functions with co-located tests
- **No `.env` files needed** — only env var is `PORT` for api (defaults to 3001)
- **3 pre-existing TDD failures** in `viewer/src/ForceDirectedLayoutStrategy.test.ts` — these are red-gate tests for unimplemented territory features

## Code Style

- **Viewer lib pattern**: Pure utility functions in `viewer/src/lib/` with co-located `.test.ts` files
- **Layout strategies**: Use `ILayoutStrategy` interface (Strategy pattern)
- **Color modes**: See `CONTRIBUTING.md` for adding new color modes

## Key Files

- `DDD-VISION.md` - DDD-oriented feature roadmap (ubiquitous language analysis, bounded context detection)
- `PROGRESS.md` - Development progress tracking
- `CHANGELOG.md` - Release history
- `docs/decisions/` - Architecture Decision Records (ADRs)
