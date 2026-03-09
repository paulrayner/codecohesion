# CodeCohesion - Development Progress

## Project Overview

Open-source 3D visualization tool for analyzing code cohesion and architectural evolution. Interactive spatial exploration with timeline playback to understand structure, detect bounded contexts, and identify coupling patterns. Built with TypeScript, Three.js, and Node.js.

**Current Version:** 0.9.0 (see [CHANGELOG.md](../CHANGELOG.md) for version history)
**Status:** Production deployed with live demo at [codecohesion.virtualgenius.com](https://codecohesion.virtualgenius.com)

---

## Completed Features

### Architecture (v0.9.0+)
- Monorepo with npm workspaces + Turborepo (`viewer/`, `api/`, `processor/`, `packages/shared-types/`, `packages/cli/`, `packages/mcp/`)
- Shared types package (`@codecohesion/shared-types`) as single source of truth — includes `ImportEdgeSummary` and `StructureSummary` DTOs
- Unified CLI (`packages/cli/`) with `analyze`, `view`, `serve` commands + query subcommands (`context`, `impact`, `risk`, `who`)
- MCP server package (`packages/mcp/`) — exposes CodeCohesion analysis tools via Model Context Protocol (stdio transport)
- Processor importable as library with Logger/FileReader injection
- Architecture fitness tests enforcing lib file size, import boundaries, Three.js isolation
- 6 Architecture Decision Records (ADRs) in `docs/decisions/`

### Core 3D Visualization
- Solar system layout (directories as planets, files as moons orbiting in 360° rings)
- Interactive camera controls (orbit, zoom, pan)
- Hierarchical focus mode with drill-down navigation
- Click-to-focus directory navigation
- Hover highlighting with ancestor path visualization
- File size representation based on lines of code
- Directory sizing by total LOC with square root scaling
- Edges connecting parents to children

### Color Modes (9 total)
1. **File Type** — 50+ extensions with semantic grouping
2. **Last Modified** — Adaptive time intervals
3. **Author** — Consistent hash-based colors
4. **Churn** — Lifetime commit frequency heatmap
5. **Contributors** — Unique contributors per file
6. **File Age** — Time since first commit
7. **Recent Activity** — Lines changed in last 90 days
8. **Stability** — Change frequency patterns
9. **Recency** — Time since last modification

### Timeline & Evolution
- **Timeline V1**: Adaptive commit sampling (guarantees version tag capture)
- **Timeline V2**: Full commit history with Gource-style delta reconstruction
- VCR-style playback controls (play/pause, step forward/backward)
- Variable speed control (1x to 1000x)
- Interactive timeline scrubber with mouse drag
- Tag markers for version navigation
- Ghost file rendering for deletions
- Live repository statistics during playback
- Commit information display (hash, date, message, author, file counts)
- Mode switcher (HEAD Analysis vs Timeline)

### API (v0.9.0+)
- Express API on port 3001 with CORS, LRU cache, path traversal protection
- **19 endpoints** covering repos, stats, contributors, files, hotspots, imports, structure, complexity, coupling, impact, context, health, OpenAPI docs, and processing
- `POST /api/process` with SSE progress streaming (modes: head, timeline-v1, timeline-v2, coupling, structure, complexity)
- Processor-as-library integration (no CLI shelling)
- `GET /api/repos/:repoId/complexity` + `/complexity/hotspots` — per-file metrics and hotspot ranking
- `GET /api/repos/:repoId/impact/:filePath` — blast radius via BFS traversal
- `GET /api/repos/:repoId/context/:filePath` — aggregated ownership, imports, functions, coupling
- `GET /api/repos/:repoId/coupling` + `/coupling/:filePath` — temporal coupling graph
- `GET /api/repos/:repoId/health` — composite 0-100 score with weighted metrics and graceful degradation
- `GET /api/docs` — OpenAPI 3.1 JSON spec; `GET /api/docs/ui` — Swagger UI
- Full HATEOAS links on all repo listings (complexity, impact, context, coupling, health, structure, imports, hotspots, contributors, files, stats)
- 118 API tests across 12 test files

### Viewer Extracted Modules (v0.9.0+)
- `process-client.ts`, `generated-files.ts`, `github-links.ts`, `webgl-error.ts`
- `configurable-visualizer.ts`, `visualizer-adapter.ts`, `test-fixtures.ts`
- `hotspot-color.ts` — HSL-based heatmap coloring (blue→red) for complexity/hotspot visualization
- `import-edge-filter.ts` — pure filtering utilities for import edges (internal/external, file prefix, path matching)
- Built-in Analyze panel in viewer UI
- Vite plugin for automatic repository discovery

### UI & Interaction
- Collapsible panels (File Details, Repository Stats, Legend)
- Legend-based filtering (Top/All/None/Invert buttons)
- Overview mode and Navigate mode
- Label toggle (Always On / Hover Only)
- Repository switcher for multiple datasets
- Commit siblings highlighting
- Tooltips on hover
- Generated file detection and filtering

### Static Structure Analysis (New)
- `StructureAnalyzer` — tree-sitter AST parsing of TypeScript/JavaScript files
- Extracts import edges (internal/external) and function declarations
- `--structure` CLI flag for structure analysis mode
- `StructureGraph` output format with imports, functions, and parse error tracking
- Batch processing (10 files at a time) with error resilience

### Complexity Analysis (New)
- `ComplexityAnalyzer` — cyclomatic and cognitive complexity metrics per function
- Hotspot scoring (complexity × churn) for identifying risky code
- `complexity-calculators.ts` with Sonar-style cognitive complexity algorithm
- Per-file aggregation and hotspot ranking

### CLI Query Commands (New)
- `codecohesion context <file>` — show git metadata, imports, exports, and coupling for a file
- `codecohesion impact <file>` — show direct and transitive dependents (reverse dependency BFS)
- `codecohesion risk` — rank files by hotspot score (complexity × churn)
- `codecohesion who <file>` — show last author, commit count, and contributor count
- `data-reader.ts` utility with robust JSON loading and error handling

### MCP Server (New)
- `@codecohesion/mcp` package — Model Context Protocol server via stdio transport
- Registers CodeCohesion analysis tools for use with Claude Desktop and other MCP clients
- Built on `@modelcontextprotocol/sdk`

### Temporal Coupling Analysis
- `CouplingAnalyzer` with Louvain clustering algorithm
- `--coupling` CLI flag chains full-delta + coupling analysis
- Temporal coupling data generation

### Production Deployment
- GitHub Pages deployment configuration
- Production build optimizations
- Live demo with 12+ analyzed repositories

---

## Remaining Work

See [todo.md](todo.md) for the full backlog. Key areas:

- **Force-directed layout** — territory-based overlap detection implemented, further tuning ongoing
- **API persistence** — PostgreSQL storage for historical comparisons (see [API plan](plans/api-plan.md))
- **Timeline enhancements** — rename detection, video export, per-file metrics (see [timeline plan](plans/full-delta-timeline.md))
- **DDD vision** — ubiquitous language analysis, bounded context scoring (see [DDD vision](plans/ddd-vision.md))
- **Viewer refactoring** — main.ts extraction continues (see [refactoring analysis](main-ts-refactoring-analysis.md))

### Known Bugs

1. **Timeline highlighting uses HEAD paths instead of historical paths** — files renamed/deleted after a commit won't highlight
2. **Camera zoom limitation on large repositories** — hard-coded `maxDistance = 150`
3. **Large repository timeline generation is slow** — React ~40 min
4. **Line width unreliable cross-platform** — WebGL `linewidth` limitation

---

## Testing Notes

**Test Repositories:** Gource (120 files), React (6,784 files), cBioPortal (large monorepo)

**Performance:** Gource loads <500ms (53 KB), React loads ~2s (4.4 MB), smooth 60fps interaction on both.

---

## References

- [Gource](https://gource.io) — inspiration and reference study
- [Three.js](https://threejs.org) — 3D rendering library
- [Simple-git](https://www.npmjs.com/package/simple-git) — Git integration

---

*For version history, see [CHANGELOG.md](../CHANGELOG.md)*
