# CodeCohesion TODO

Future enhancements, ideas, and known limitations.

## Force-Directed Layout (Marco's Request)

- [ ] **Dynamic force-directed graph layout**
  - Replace static tree layout with physics-based force simulation
  - Files/directories attract based on coupling/relationship strength
  - Files/directories repel when weakly related
  - Toggle between static tree and force-directed layouts
  - Damping/stabilization and animation speed controls
  - Pin/freeze specific nodes

**Note:** `ForceDirectedLayoutStrategy.ts` is in development on the `claude-harness-refactoring` branch.

## Generated/Minified File Detection

Phase 1 (pattern-based) and Phase 1.6 (expanded patterns) are complete. Remaining:

**Phase 1.5: Re-analyze Existing Repositories**
- [ ] Re-analyze Gource repository
- [ ] Re-analyze cBioPortal repository
- [ ] Re-analyze cBioPortal-Frontend repository
- [ ] Test checkbox functionality with each newly analyzed repo

**Phase 2: Content heuristics & enhanced UX**
- [ ] Content-based detection (line length, whitespace ratio, alphanumeric density)
- [ ] Dual-mode: "Lines of Code" vs "Lines of Code (All Files)"
- [ ] Enhanced stats panel showing hand-written vs generated breakdown
- [ ] Visual distinction for generated files when visible (gray color)
- [ ] Detection reason metadata (`generatedReason` field)

**Phase 3: Advanced features**
- [ ] Configuration file support (`.codecohesion.json`)
- [ ] Custom exclusion patterns per repository
- [ ] Git metadata signals (zero-commit large files, bot authors)
- [ ] Export detection report

## Lines of Code Enhancements

- [ ] **Language-Specific Bucket Tuning** — separate percentiles per language
- [ ] **Very Large File Handling** — logarithmic scaling for 10K+ LOC files
- [ ] **LOC Density** — directory-level LOC/file count metric
- [ ] **LOC x Churn Mode** — refactoring priority heatmap
- [ ] **LOC x Complexity Mode** — technical debt hotspots (requires complexity integration)
- [ ] **Code Growth/Shrinkage** — LOC changes over time in Timeline V2
- [ ] **User-configurable LOC buckets** and counting options

## Directory Color Aggregation

- [ ] Alternative aggregation: weighted by LOC, gradient/pie chart, configurable per mode
- [ ] Directory metrics panel: click to show color breakdown
- [ ] Performance: cache dominant color calculations, lazy calculation

## Testing & Quality

- [ ] Test with 10K+ file repositories (Linux kernel, Chromium)
- [ ] Deep hierarchy testing (10+ levels)
- [ ] Edge cases: empty files, 100K+ LOC files, binary files, symlinks, no-git-history repos
- [ ] Integration tests, E2E tests, performance benchmarks, visual regression testing

## Accessibility

- [ ] Color blindness-friendly palettes
- [ ] High contrast mode
- [ ] Screen reader support for stats/metrics
- [ ] Keyboard navigation improvements

## Advanced Analysis

- [ ] **Cyclomatic complexity integration** (lizard or similar) with color mode
- [ ] **Technical Debt Quadrant** — 3D scatter: complexity x churn x LOC
- [ ] **Knowledge Distribution** — bus factor, primary owner color mode
- [ ] **Architecture Drift** — expected vs actual structure comparison

## Code Cleanup

- [ ] Replace incremental scene updates in TreeVisualizer (full rebuild → mesh updates)
- [ ] Fix `linewidth` cross-platform: replace with `THREE.Line2` + `LineMaterial`
- [ ] Extract more pure functions from TreeVisualizer
- [ ] Split colorModeManager.ts into per-mode files

## Documentation

- [ ] Video walkthrough of features
- [ ] Tutorial: "Adding a new color mode"
- [ ] Tutorial: "Analyzing your first repository"
- [ ] Performance optimization guide
- [ ] More README screenshots (all color modes, directory aggregation, LOC mode)
- [ ] Comparison table: CodeCohesion vs competitors

## Export & Sharing

- [ ] Export visualization as image/video/animated GIF
- [ ] Export analysis as PDF/HTML report
- [ ] Share specific views via URL (deep links with color mode, filter state, timeline position)

## UI/UX Improvements

- [ ] Minimap for large repositories
- [ ] File search with highlighting and jump-to in 3D space
- [ ] Bookmarks for interesting views
- [ ] Loading progress indicator with time estimate
- [ ] Performance metrics panel (FPS, render time, memory)

## Related

- [DDD Vision](plans/ddd-vision.md) — bounded context detection, ubiquitous language analysis
- [Full Delta Timeline](plans/full-delta-timeline.md) — remaining timeline enhancements
- [API Plan](plans/api-plan.md) — remaining API milestones

---

*Last Updated: 2026-03-08*
*Status: v0.9.0 — Monorepo, API, 9+ Color Modes, Timeline V1/V2, Force-Directed Layout in progress*
