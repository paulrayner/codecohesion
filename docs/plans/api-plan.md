# CodeCohesion API - Remaining Plan

**Original Plan Date:** 2025
**Status:** Milestones 0-2 complete. API evolved differently than originally planned.

**What's been built (v0.9.0+):**
- Express API on port 3001 with CORS, error handling
- `GET /api/repos`, `GET /api/repos/:repoId/stats`, `GET /api/repos/:repoId/files`
- `POST /api/process` — runs processor as library with SSE progress streaming (supports `structure` mode)
- `GET /api/process/:jobId/progress` — real-time SSE progress
- `GET /api/repos/:repoId/imports` — import edges with `?file=` and `?external=` filters
- `GET /api/repos/:repoId/structure` — structure metadata and function declarations
- `GET /api/repos/:repoId/contributors` — contributors with `since`, `until`, `limit` filters
- `GET /api/contributors?url=<url>&days=<n>` — convenience endpoint for contributors by URL
- `GET /api/repos/:repoId/complexity` — complexity analysis data
- `GET /api/repos/:repoId/complexity/hotspots` — top-N complexity hotspots
- `GET /api/repos/:repoId/coupling` — full coupling graph
- `GET /api/repos/:repoId/coupling/:filePath` — coupling edges for a specific file
- `GET /api/repos/:repoId/context/:filePath` — file context (ownership, imports, functions)
- `GET /api/repos/:repoId/impact/:filePath` — transitive impact analysis
- `GET /api/repos/:repoId/health` — composite health score
- `GET /api/docs` + `GET /api/docs/ui` — OpenAPI 3.1 spec with Swagger UI
- `findRepoByUrl()` — lookup repository by GitHub URL
- LRU cache for API response caching
- Processor-as-library integration (no CLI shelling)
- Supports local paths and GitHub URLs (auto-clones)
- Writes output to `viewer/public/data/` and updates `repos.json`
- Improved error handling: distinguishes 404 from 500 errors
- Full HATEOAS links on repo listings (complexity, impact, context, coupling, health, structure, imports, hotspots, contributors, files, stats)
- Path traversal protection on structure data loading (`data-loader-security.test.ts`)
- Test fixtures in `api/test/data/`

**Key divergence from original plan:** On-demand analysis (originally M3) was implemented early via `POST /api/process` with SSE streaming, without PostgreSQL or Redis. The processor-as-library pattern (originally M3) was done as part of the monorepo migration.

---

## Milestone 2: Query & Filter Features (Complete)

### Completed
- [x] `findRepoByUrl()` — lookup repo by GitHub URL
- [x] `GET /api/repos/:repoId/hotspots?limit=<n>` — top N files by churn/contributors (with NaN validation)
- [x] Query parameter validation with 400 responses (limit range, external boolean, NaN checks)
- [x] `GET /api/repos/:repoId/imports` — import edges with file and external filters
- [x] `GET /api/repos/:repoId/structure` — structure metadata and function declarations
- [x] `GET /api/repos/:repoId/contributors` with date filtering (`since`, `until`)
- [x] `GET /api/contributors?url=<url>&days=<n>` convenience endpoint
- [x] File filtering by path prefix and sorting by metric (churn, contributors, loc)
- [x] `GET /api/repos/:repoId/complexity` + `/complexity/hotspots` — complexity analysis
- [x] `GET /api/repos/:repoId/coupling` + `/coupling/:filePath` — coupling graph
- [x] `GET /api/repos/:repoId/context/:filePath` — file context
- [x] `GET /api/repos/:repoId/impact/:filePath` — transitive impact analysis
- [x] `GET /api/repos/:repoId/health` — composite health score
- [x] Full HATEOAS links on all repo listing responses (complexity, impact, context, coupling, health)

---

## Milestone 3: Persistence (Future)

- [ ] PostgreSQL storage for analysis results
- [ ] Database migrations and schema (`repos`, `files`, `contributors`, `analysis_jobs`)
- [ ] Cache headers (`Cache-Control`, `ETag`)

**Note:** On-demand analysis via processor-as-library is already done. The remaining M3 value is persistent storage for historical comparisons.

---

## Milestone 4: Advanced Queries & Search

- [ ] Search DSL: `commitCount.gt(50) AND contributorCount.gt(5)`
- [ ] Commit comparison: `GET /api/repos/:repoId/compare?from=<commit>&to=<commit>`
- [ ] Aggregations with histograms and percentiles
- [ ] Timeline navigation endpoints
- [ ] Field selection (`?fields=path,loc,commitCount`)
- [ ] Pagination (`limit`, `offset`, `hasMore`)
- [x] OpenAPI 3.1 spec with Swagger UI at `/api/docs` and `/api/docs/ui`

---

## Milestone 5: Notifications & Automation

- [ ] Webhook system (register, deliver events, retry with backoff)
- [ ] Threshold alerts (notify when metrics exceed limits)
- [ ] Scheduled analysis (cron-based)
- [ ] Export formats (CSV, JSONL, Prometheus)

---

## Milestone 6: Integrations & Intelligence

- [ ] GitHub App (PR comments with churn analysis, check runs)
- [ ] Slack/Discord bot commands
- [x] Repository health score (0-100 based on churn, contributors, coupling, complexity)
- [ ] Bounded context recommendations via coupling clustering
- [ ] Prometheus metrics endpoint for Grafana/Datadog

---

## Related Documents

- [API Architecture](../api/architecture.md)
- [API Specification](../api/spec.md)
- [API Vision](../api/vision.md)
- [API Discoverability](../api/discoverability.md)
