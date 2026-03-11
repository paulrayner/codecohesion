# Changelog

## [0.9.0] - 2026-03-08

### Monorepo Migration
- Migrated to npm workspaces + Turborepo monorepo with unified `npm install`, `npm test`, `npm run dev`, and `npm run lint` from root
- Added `packages/shared-types/` as single source of truth for shared TypeScript interfaces (`FileNode`, `TreeNode`, `RepositorySnapshot`, etc.)
- Added `packages/cli/` for unified `codecohesion` CLI entry point (`analyze`, `view`, `serve` commands)
- Root `turbo.json` orchestrates build, test, lint, and dev tasks across all packages
- Removed per-package `package-lock.json` files in favor of root-level lock file

### API: In-App Repository Processing
- Added `POST /api/process` endpoint that runs the processor as a library (no CLI shelling)
- Added `GET /api/process/:jobId/progress` SSE endpoint for real-time progress streaming
- `ProcessService` supports all analysis modes: `head`, `timeline-v1`, `timeline-v2`, `coupling`
- Supports both local paths and remote GitHub URLs (auto-clones to temp directory)
- Writes output directly to `viewer/public/data/` and updates `repos.json` — no manual file copying
- Added `LRUCache` for API response caching

### Viewer: Analyze Panel & Extracted Modules
- Built-in **Analyze** panel in the viewer UI for triggering processing with real-time progress bar
- Auto-loads visualization when analysis completes
- Extracted `process-client.ts` (API request building, SSE parsing, form validation)
- Extracted `generated-files.ts` (generated file detection patterns)
- Extracted `github-links.ts` (GitHub URL construction)
- Extracted `webgl-error.ts` (WebGL availability detection with browser-specific instructions)
- Extracted `configurable-visualizer.ts` and `visualizer-adapter.ts`
- Added `test-fixtures.ts` for shared test data
- Added Vite plugin for automatic repository discovery (`vite-plugin-repo-discovery.ts`)
- Architecture fitness tests enforcing lib file size, import boundaries, and Three.js isolation

### Processor: Library Mode & Refactoring
- Processor is now importable as a library (`codecohesion-processor`) with `RepositoryAnalyzer`, `TimelineAnalyzer`, `FullDeltaAnalyzer`, `CouplingAnalyzer`
- All analyzers accept an optional `Logger` parameter; `silentLogger` for library use
- Extracted `file-reader.ts`, `logger.ts`, `timeline-report-generator.ts`, `timeline-sampler-types.ts`
- Added `index.ts` barrel export for clean library API
- Added architecture and type tests

### Quality & Tooling
- Added ESLint configs (`eslint.config.js`) for api, processor, and viewer packages
- Added Vitest configs for processor
- Added e2e test infrastructure with Cucumber.js
- Added `docs/decisions/` for Architecture Decision Records

## [0.8.0] - 2025-11-04

- Modern UI redesign with cleaner visual hierarchy and improved spacing
- iOS-style toggle switches replacing checkboxes for all binary controls
- Collapsible header sections (Visualization and Display Options) with smooth animations
- SVG-based theme toggle in top-right corner (sun/moon icons)
- Improved control layout with better grouping and consistent styling
- Enhanced button and input styling with better hover states and focus indicators
- Visualization mode options moved under Visualization section for better organization
- All display options now use consistent toggle switch pattern
- Responsive design improvements with proper wrapping and spacing
- Light and dark mode refinements with better contrast and border visibility

## [0.7.0] - 2025-11-01

- API discoverability improvements with HATEOAS links in all responses
- Enhanced root endpoint (/) with examples, capabilities list, and navigation links
- Structured error responses with helpful suggestions and working curl examples
- Fuzzy matching for repository lookup errors with "Did you mean?" suggestions
- Limit parameter for contributors endpoints to get top N contributors
- Contributors endpoints now support ?limit=N parameter (1-100) for top N results
- Updated API documentation with DISCOVERABILITY.md best practices guide
- 41 passing API tests (7 new tests for discoverability and limit features)

## [0.6.0] - 2025-11-01

- CodeCohesion REST API (Milestone 1) with 8 endpoints for repository analysis data
- API deployed to Railway at https://codecohesion-api-production.up.railway.app
- Production data for public open-source repositories
- API endpoints: /api/repos, /api/repos/:id/stats, /api/repos/:id/contributors, /api/repos/:id/files, /api/repos/:id/hotspots
- CORS enabled for all origins to support external app integration
- Support for both static snapshots and timeline-v2 formats
- Removed Flat 2D layout mode to simplify viewer (kept 3D Hierarchy and Force-Directed 2D)
- TypeScript compilation fixes for production builds
- 26 passing API tests (unit + integration with vitest)

## [0.5.0] - 2025-10-30

- Force-Directed 2D layout mode with Gource-style physics for organic, breathing visualization
- Improved 2D layout clarity with proper file ring spacing preventing node overlaps
- Overhead camera view for true top-down perspective in 2D mode
- Grid and fog automatically hidden in 2D mode for cleaner visualization
- Uniform directory sizes in 2D mode for consistent visual hierarchy
- Territory radius collision detection for better file cloud spacing
- Layout and view mode preferences now persist between sessions
- Generated file detection expanded with additional build artifact patterns
- Camera orientation properly preserved when switching between 2D and 3D layouts
- File ring spacing fixed to use full diameter matching Gource algorithm
- 2D layout parent-child spacing improved with Gource two-radius system
- Color dimming issue resolved by disabling fog in 2D overhead view
- Test infrastructure upgraded (vitest with jsdom for DOM testing)
- Code quality improvements with extracted pure functions for camera, layout, and legend logic

## [0.4.4] - 2025-10-25

- Generated file detection and filtering with pattern matching for build artifacts
- "Hide generated files" checkbox showing count of detected files
- Checkbox automatically disables when no generated files found
- Fixed detection logic for accurate path pattern matching
- Console logging during analysis reports generated file count

## [0.4.3] - 2025-10-24

- 3D floating cluster details card showing coupled files with scrollable list in 3D space
- Light/Dark mode theme toggle with CSS custom properties and automatic 3D scene background adaptation
- Improved connection line visibility (increased edge opacity, black color instead of gray)
- Extracted GhostRenderer module for Timeline V2 deletion visualization (9 unit tests)
- Extracted LayoutEngine module for 3D tree layout calculations (12 unit tests)
- Reduced TreeVisualizer from 1775 to 1477 lines (17% reduction, 298 lines removed)
- Increased test coverage to 126 passing tests (21 new tests)
- Code quality improvements following extract-and-prove refactoring pattern

*Note: Refactoring work completed during Kandddinsky conference mob programming session - thanks to all participants!*

## [0.4.2] - 2025-10-24

- Lines of Code color mode with percentile-based buckets adapting to repository size distribution
- Intelligent directory coloring showing dominant file color based on file count (works for all color modes)
- Directory color cache clearing when switching color modes
- Comprehensive unit tests for directory color aggregation (105 tests passing)
- Table-driven tests using real React repository `.github` folder structure
- Extracted `calculateDominantColor` to testable pure function
- Updated README documentation with all 11 color modes and new features

## [0.4.1] - 2025-10-22

- File details now show on hover for instant preview (no click required)
- Clicking a file pins the details panel and shows commit siblings
- Clicking the same file twice unpins and restores free hover mode
- GitHub integration: clickable links to view files and directories on GitHub
- Repository dropdown now shows owner/repo (e.g., "gource (acaudwell/Gource)")
- Tag selector UI now hidden when not applicable (V1 timeline or repos without tags)
- Incremental tree generation optimization for improved timeline performance
- Enhanced debug logging for file deletion tracking

## [0.4.0] - 2025-10-21

- GitHub Pages deployment configuration with automatic build and deploy
- Live demo at thepaulrayner.com/codecohesion
- Repository switcher for loading multiple analyzed datasets
- Production build optimizations for subdirectory deployment
- Project renamed from "code-evolution-viz" to "CodeCohesion"
- Updated branding and tagline to "3D visualization of code evolution"
- Fixed data loading using relative paths for production deployment
- Fixed TypeScript compilation errors preventing production builds
- Removed compiled JavaScript artifacts from source directory

## [0.3.1] - 2025-10-21

- Collapsible File Details panel with unified scrolling
- Collapsible Repository Stats panel
- Collapsible Legend panel

## [0.3.0] - 2025-10-21

- Legend-based filtering with Top/All/None/Invert controls
- Overview mode for bird's-eye repository view
- Navigate mode for interactive exploration
- Fixed filter controls now hidden (not just disabled) in timeline mode

## [0.2.2] - 2025-10-21

- Ghost file rendering for visualizing deletions in timeline
- Interactive timeline scrubbing with mouse drag
- Adaptive keyframe strategy for improved timeline performance
- Enhanced commit change indicators showing additions, modifications, deletions (Files: +N ~N -N)
- Unified color mode filtering behavior across Timeline V1 and V2

## [0.2.1] - 2025-10-20

- Complete commit history processing with Gource-style delta reconstruction (Timeline V2)
- Delta-based tree reconstruction at each commit
- File addition, modification, and deletion tracking
- Empty commit handling
- Smart commit highlighting with contextual warnings
- Live repository statistics updating during timeline playback
- Tag markers on timeline scrubber for version navigation
- Jump-to-tag functionality for quick version seeking
- Fixed Timeline V2 highlighting to properly handle file deletions and empty commits

## [0.2.0] - 2025-10-18

- Timeline data collection with adaptive commit sampling
- Timeline playback controls (play/pause, step forward/backward)
- Variable speed control (1x to 1000x playback)
- Interactive timeline scrubber for seeking through history
- File change visualization during timeline playback
- Commit information display (hash, date, message, author)
- Timeline mode detection with automatic UI switching
- Mode switcher (HEAD Analysis vs Timeline)
- Fixed timeline visibility ensuring all files display correctly during playback
- Fixed TypeScript compilation errors in timeline code
- Fixed label visibility for invisible nodes in "Always On" mode

## [0.1.2] - 2025-10-18

- Churn heatmap color mode (lifetime commit frequency)
- Contributors count visualization
- File Age color mode
- Recent Activity (90 days) color mode
- Code Stability metric
- Recency metric
- Enhanced file details panel with comprehensive git metadata
- Commit message display in Highlight Commit mode
- Legend ordering for heatmaps now displays high-to-low (most significant first)
- UI defaults: Highlight Commit enabled by default, labels set to "Hover Only"

## [0.1.1] - 2025-10-18

- Adaptive time intervals for "Last Modified" mode (7 intervals for active repos)
- Commit message display in file details
- UI defaults: Highlight Commit enabled by default, labels set to "Hover Only"
- Fixed label visibility bug for invisible nodes in "Always On" mode

## [0.1.0] - 2025-10-17

- 3D solar system visualization layout (directories as planets, files as moons)
- Interactive camera controls (left-click rotate, right-click pan, scroll zoom)
- Hierarchical focus mode with drill-down navigation
- Click-to-focus directory navigation
- Hover highlighting with ancestor path visualization
- Collapsible directory visualization
- File size representation based on lines of code
- File type color scheme with 50+ extensions
- Last Modified color mode with adaptive time intervals
- Author/Contributor color mode with consistent color hashing
- Color mode manager and switcher UI
- Author legend sorted by file count
- Commit siblings highlighting mode
- Commit hash and metadata in file details panel
- Directory label display with toggle (Always On / Hover Only)
- Square root scaling for directory sizing to prevent overlap
- Repository structure analysis via git processor
- Lines of code calculation per file
- Git metadata collection (last modified, author, commit hash)

---

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
